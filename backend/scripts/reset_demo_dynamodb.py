"""Offline, explicitly confirmed reset of disposable Bartr demo records.

Stop every application writer before use. This is a backed-up sequence of bounded
operations, not one atomic reset. Never use it to repair an individual account.
"""
from __future__ import annotations

import argparse
import base64
from copy import deepcopy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import secrets
import sys
from time import sleep
from uuid import uuid4

from botocore.exceptions import BotoCoreError, ClientError
from dotenv import load_dotenv

from backend.app.core.config import ROOT
from backend.app.domain import Marketplace
from backend.app.storage.dynamodb import DynamoRepository, SCHEMA, VECTOR_SCHEMA
from backend.app.storage.dynamodb_records import assemble, canonical, records
from backend.app.storage.state import StateRepository
from backend.scripts.seed_demo_json import _create_item, _load_fixture

TABLE = "bartr-dev"
REGION = "us-east-1"
BACKUP_FORMAT = "bartr-demo-reset-backup-v1"


class DemoResetError(RuntimeError):
    """A rejection whose message contains no application records or credentials."""


def _json_binary(value):
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"__bartr_binary_base64__": base64.b64encode(value).decode("ascii")}
    raise TypeError("Unsupported backup value.")


def _restore_binary(value):
    if set(value) == {"__bartr_binary_base64__"} and isinstance(value["__bartr_binary_base64__"], str):
        return base64.b64decode(value["__bartr_binary_base64__"], validate=True)
    return value


def _write_private(path: Path, value) -> None:
    path = Path(path).resolve()
    if path.is_relative_to(ROOT.resolve()):
        raise DemoResetError("Private backup and credentials files must be outside the repository.")
    payload = json.dumps(value, default=_json_binary, sort_keys=True).encode("utf-8")
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def read_backup(path: Path):
    """Read raw AttributeValues for separately reviewed recovery; performs no writes."""
    value = json.loads(Path(path).read_text(encoding="utf-8"), object_hook=_restore_binary)
    if value.get("format") != BACKUP_FORMAT or value.get("table") != TABLE or not isinstance(value.get("items"), list):
        raise DemoResetError("The private backup format is not recognized.")
    return value


def _stage():
    fixture = _load_fixture()
    definitions = [fixture["viewer"], *fixture["members"], fixture["outside_community_member"]]
    item_keys = [item["key"] for member in definitions for item in member["items"]]
    if len(item_keys) != len(set(item_keys)):
        raise DemoResetError("The fictional fixture contains duplicate item definitions.")
    repository = StateRepository(memory=True)
    marketplace = Marketplace(repository)
    credentials = []
    for definition in definitions:
        password = secrets.token_urlsafe(32)
        while any(entry["password"] == password for entry in credentials):
            password = secrets.token_urlsafe(32)
        profile = marketplace.register(definition["username"], password, definition["name"],
                                       definition.get("community", fixture["community"]))
        credentials.append({"username": profile["username"], "password": password})
        marketplace.update_profile(profile["id"], profile["revision"], {
            key: definition[key] for key in ("interests", "exclusions", "gap_limit")
        })
        for item in definition["items"]:
            _create_item(marketplace, repository, profile["id"], item)
    state = repository.read()
    if len(state["users"]) != len(definitions) or len(state["items"]) != len(item_keys):
        raise DemoResetError("The fictional fixture did not stage completely.")
    staged_rows = records(state)
    if len(staged_rows) + 1 > 100:
        raise DemoResetError("The fictional fixture exceeds one bounded initialization transaction.")
    if canonical(assemble(staged_rows)) != canonical(state):
        raise DemoResetError("The fictional fixture failed persistence validation.")
    for item in state["items"].values():
        if item["owner"] not in state["users"] or (item.get("image_id") and item["image_id"] not in repository.images):
            raise DemoResetError("The fictional fixture has an invalid owner or image reference.")
    return state, deepcopy(repository.images), credentials


def _references(row):
    owners, images = set(), set()

    def visit(value):
        if isinstance(value, dict):
            for key, child in value.items():
                text = child.get("S") if isinstance(child, dict) else child
                if key in {"user_id", "owner_id", "owner", "left_owner", "right_owner"} and isinstance(text, str):
                    owners.add(text)
                if key == "image_id" and isinstance(text, str):
                    images.add(text)
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(row)
    return owners, images


def _scan(client):
    rows, parameters = [], {"TableName": TABLE, "ConsistentRead": True}
    while True:
        page = client.scan(**parameters)
        rows.extend(page.get("Items", []))
        if not page.get("LastEvaluatedKey"):
            return rows
        parameters["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def _targets(rows, namespace):
    targets, owners, images, protected_owners, protected_images = [], set(), set(), set(), set()
    for raw in rows:
        if raw.get("PK") == {"S": f"{namespace}#STATE"} and raw.get("SK") == {"S": "0"}:
            raise DemoResetError("A legacy state record prevents safe reseeding; no records were deleted.")
        scope = raw.get("_scope", {}).get("S", "")
        pk = raw.get("PK", {}).get("S", "")
        schema = raw.get("_schema", {}).get("S")
        if scope.startswith("TEST#") or pk.startswith("TEST#"):
            found_owners, found_images = _references(raw)
            protected_owners.update(found_owners)
            protected_images.update(found_images)
        elif schema in {SCHEMA, VECTOR_SCHEMA} and raw.get("_scope") == {"S": ""}:
            targets.append(raw)
            found_owners, found_images = _references(raw)
            owners.update(found_owners)
            images.update(found_images)
    for raw in rows:
        pk = raw.get("PK", {}).get("S", "")
        if raw.get("kind") != {"S": "bartr-image-v1"} or not pk.startswith(f"{namespace}#IMAGE#"):
            continue
        image_id = pk[len(namespace + "#IMAGE#"):]
        owner = raw.get("owner", {}).get("S")
        if image_id in protected_images or owner in protected_owners or raw.get("_scope", {}).get("S", "").startswith("TEST#"):
            continue
        if image_id in images or owner in owners:
            targets.append(raw)
    return targets


def _delete_batches(client, rows):
    for offset in range(0, len(rows), 25):
        actions = [{"Delete": {"TableName": TABLE, "Key": {key: row[key] for key in ("PK", "SK")}}}
                   for row in rows[offset:offset + 25]]
        token = uuid4().hex
        for attempt in range(6):
            try:
                client.transact_write_items(TransactItems=actions, ClientRequestToken=token)
                break
            except ClientError as error:
                code = error.response.get("Error", {}).get("Code")
                reasons = [reason.get("Code") for reason in error.response.get("CancellationReasons", [])]
                retry = code in {"InternalServerError", "RequestTimeout", "TransactionInProgressException", "TransactionConflictException", "ProvisionedThroughputExceededException", "ThrottlingException"}
                retry = retry or (code == "TransactionCanceledException" and bool(reasons) and all(reason in {"None", "TransactionConflict", "ProvisionedThroughputExceeded", "ThrottlingError"} for reason in reasons))
                if not retry or attempt == 5:
                    raise
            except BotoCoreError:
                if attempt == 5:
                    raise
            sleep(min(0.05 * 2 ** attempt, 0.8))


def reset_demo_database(*, confirm_table: str, writers_stopped: bool, backup_path: Path,
                        credentials_path: Path, client=None, namespace: str | None = None):
    if confirm_table != TABLE or writers_stopped is not True:
        raise DemoResetError("Confirm table bartr-dev and explicitly attest that all writers are stopped.")
    # All fixture work and private credential persistence precede any cloud work.
    state, images, credentials = _stage()
    _write_private(credentials_path, {"format": "bartr-demo-credentials-v1", "table": TABLE, "accounts": credentials})
    if client is None:
        import boto3
        from botocore.config import Config
        client = boto3.client("dynamodb", region_name=REGION,
                              config=Config(connect_timeout=5, read_timeout=15,
                                            retries={"mode": "standard", "total_max_attempts": 10}))
    if client.meta.region_name != REGION:
        raise DemoResetError("Only the existing us-east-1 demo table is supported.")
    repository = DynamoRepository(client=client)
    repository.table, repository.partition_key, repository.sort_key = TABLE, "PK", "SK"
    repository.namespace = namespace or os.getenv("DYNAMODB_NAMESPACE", "BARTR_V1")
    planned = [repository._put(key, row, 1, None) for key, row in records(state).items()]
    planned.append(repository._put(("CONTROL#BARTR", "DETAILS"), {"entity_type": "CONTROL"}, 1, None))
    if len(planned) > 100 or len(canonical(planned).encode()) > 4 * 1024 * 1024:
        raise DemoResetError("The fictional fixture exceeds the initialization transaction budget.")
    repository.connection()  # Verify the existing table shape; never provision.
    selected = _targets(_scan(client), repository.namespace)
    backup = {"format": BACKUP_FORMAT, "table": TABLE, "region": REGION,
              "namespace": repository.namespace, "created_at": datetime.now(timezone.utc).isoformat(), "items": selected}
    _write_private(backup_path, backup)
    if read_backup(backup_path) != backup:
        raise DemoResetError("Private backup verification failed; no records were deleted.")
    try:
        _delete_batches(client, selected)
        if _targets(_scan(client), repository.namespace):
            raise DemoResetError("Target records remain after deletion.")
        for image_id, image in images.items():
            repository.put_image(image_id, image["owner"], image)
        # Users and listings become visible together through one normal epoch/CAS
        # transaction. Image uploads and the earlier reset remain separate steps.
        repository.mutate(lambda live: live.update(deepcopy(state)))
        if canonical(repository.read()) != canonical(state):
            raise DemoResetError("Reseed verification failed.")
    except Exception as error:
        raise DemoResetError("Reset is incomplete. Keep writers stopped and retain the private backup for reviewed recovery.") from error
    return {"deleted": len(selected), "members": len(state["users"]), "items": len(state["items"]), "images": len(images)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-table", required=True)
    parser.add_argument("--writers-stopped", action="store_true")
    parser.add_argument("--backup", required=True, type=Path)
    parser.add_argument("--credentials", required=True, type=Path)
    arguments = parser.parse_args()
    try:
        load_dotenv(ROOT / ".env", override=False)
        counts = reset_demo_database(confirm_table=arguments.confirm_table, writers_stopped=arguments.writers_stopped,
                                     backup_path=arguments.backup, credentials_path=arguments.credentials)
    except Exception:
        print("Demo reset failed. Keep writers stopped; inspect private backup availability before recovery. No credentials are printed.", file=sys.stderr)
        return 1
    print(f"Demo reset completed: {counts['members']} members, {counts['items']} items. Credentials are in the private file. Restart writers only after verification.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
