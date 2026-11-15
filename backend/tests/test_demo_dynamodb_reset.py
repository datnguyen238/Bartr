"""Synthetic Moto reset evidence only; never accesses a live AWS account."""
from copy import deepcopy
import json
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from moto import mock_aws
import pytest

from backend.app.domain import Marketplace
from backend.app.errors import AppError
from backend.app.storage.dynamodb import SCHEMA, VECTOR_SCHEMA, DynamoRepository
from backend.scripts import reset_demo_dynamodb as reset
from backend.scripts.seed_demo_json import _load_fixture


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("AWS_PROFILE", raising=False)
    monkeypatch.delenv("AWS_DEFAULT_PROFILE", raising=False)
    with mock_aws():
        client = boto3.client("dynamodb", region_name="us-east-1", aws_access_key_id="testing", aws_secret_access_key="testing")
        client.create_table(TableName="bartr-dev", KeySchema=[{"AttributeName": "PK", "KeyType": "HASH"}, {"AttributeName": "SK", "KeyType": "RANGE"}],
                            AttributeDefinitions=[{"AttributeName": key, "AttributeType": "S"} for key in ("PK", "SK")], BillingMode="PAY_PER_REQUEST")
        yield client


@pytest.fixture
def small_fixture(monkeypatch):
    fixture = deepcopy(_load_fixture())
    fixture["members"] = []
    fixture["viewer"]["items"] = [fixture["viewer"]["items"][0], fixture["viewer"]["items"][-1]]
    fixture["outside_community_member"]["items"] = fixture["outside_community_member"]["items"][:1]
    monkeypatch.setattr(reset, "_load_fixture", lambda: deepcopy(fixture))
    return fixture


def options(client, tmp_path):
    return dict(confirm_table="bartr-dev", writers_stopped=True, backup_path=tmp_path / "backup.json",
                credentials_path=tmp_path / "credentials.json", client=client, namespace="BARTR_V1")


def put(client, pk, sk="DETAILS", **fields):
    row = {"PK": {"S": pk}, "SK": {"S": sk}, **fields}
    client.put_item(TableName="bartr-dev", Item=row)
    return row


def old_profile(client):
    return put(client, "USER#old", "PROFILE", _schema={"S": SCHEMA}, _scope={"S": ""},
               entity_type={"S": "PROFILE"}, user_id={"S": "old"}, _version={"N": "1"})


def exists(client, row):
    return client.get_item(TableName="bartr-dev", Key={key: row[key] for key in ("PK", "SK")}).get("Item")


@pytest.mark.parametrize("confirmation,stopped", [("different-table", True), ("bartr-dev", False)])
def test_confirmation_and_writer_attestation_are_required_without_any_work(monkeypatch, tmp_path, confirmation, stopped):
    monkeypatch.setattr(reset, "_stage", lambda: pytest.fail("Rejected arguments must not stage or access AWS."))
    with pytest.raises(reset.DemoResetError, match="Confirm table"):
        reset.reset_demo_database(confirm_table=confirmation, writers_stopped=stopped, backup_path=tmp_path / "backup",
                                  credentials_path=tmp_path / "credentials", client=object())
    assert not list(tmp_path.iterdir())


def test_success_preserves_scopes_backs_up_binary_and_supports_normal_actions(client, small_fixture, tmp_path, capsys):
    profile = old_profile(client)
    semantic = put(client, "SEMANTIC#ITEM#old", _schema={"S": VECTOR_SCHEMA}, _scope={"S": ""})
    image = put(client, "BARTR_V1#IMAGE#old-photo", "0", kind={"S": "bartr-image-v1"}, owner={"S": "old"},
                payload={"B": b"\x00\xffsynthetic"}, more={"M": {"binary_set": {"BS": [b"one", b"two"]}}})
    kept = [
        put(client, "UNRELATED", arbitrary={"S": "kept"}),
        put(client, "TEST#scope#USER#test", "PROFILE", _schema={"S": SCHEMA}, _scope={"S": "TEST#scope#"},
            entity_type={"S": "PROFILE"}, user_id={"S": "test"}),
        put(client, "TEST#scope#SEMANTIC#ITEM#test", _schema={"S": VECTOR_SCHEMA}, _scope={"S": "TEST#scope#"}),
        put(client, "BARTR_V1#IMAGE#test-photo", "0", kind={"S": "bartr-image-v1"}, owner={"S": "test"}, payload={"B": b"test"}),
        put(client, "BARTR_V1#IMAGE#unattributed", "0", kind={"S": "bartr-image-v1"}, owner={"S": "unknown"}),
        put(client, "OTHER#IMAGE#old-photo", "0", kind={"S": "bartr-image-v1"}, owner={"S": "old"}),
        put(client, "MISSING-SCOPE", _schema={"S": SCHEMA}),
    ]
    result = reset.reset_demo_database(**options(client, tmp_path))
    assert result == {"deleted": 3, "members": 2, "items": 3, "images": 2}
    assert all(exists(client, row) == row for row in kept)
    assert not exists(client, profile) and not exists(client, semantic) and not exists(client, image)
    backup = reset.read_backup(tmp_path / "backup.json")
    assert sorted(backup["items"], key=lambda row: row["PK"]["S"]) == sorted([profile, semantic, image], key=lambda row: row["PK"]["S"])
    for path in (tmp_path / "backup.json", tmp_path / "credentials.json"):
        assert path.stat().st_mode & 0o777 == 0o600
    accounts = json.loads((tmp_path / "credentials.json").read_text())["accounts"]
    assert len({account["password"] for account in accounts}) == len(accounts)
    assert all(len(account["password"]) >= 40 and account["password"] != "bartr-demo-only" for account in accounts)
    assert capsys.readouterr().out == ""
    repo = DynamoRepository(client=client)
    repo.table, repo.partition_key, repo.sort_key = "bartr-dev", "PK", "SK"
    marketplace = Marketplace(repo)
    alice = next(account for account in accounts if account["username"] == "demo-alice")
    token, profile = marketplace.login(**alice)
    assert marketplace.authenticate(token) == profile["id"]
    view = marketplace.view(profile["id"])
    assert view["profile"]["name"] == small_fixture["viewer"]["name"]
    assert any(item["status"] == "available" for item in view["items"])
    available = next(item for item in view["items"] if item["status"] == "available")
    assert repo.image(available["image_id"])["data"].startswith(b"\xff\xd8")
    marketplace.update_profile(profile["id"], profile["revision"], {"name": "Updated fictional name"})
    assert marketplace.save_item(profile["id"], None, None, {"title": "New fictional draft", "status": "draft"})["status"] == "draft"
    marketplace.logout(token)
    with pytest.raises(AppError, match="Sign in"):
        marketplace.authenticate(token)


def test_failed_staging_deletes_nothing(client, monkeypatch, tmp_path):
    row = old_profile(client)
    def fail():
        raise ValueError("Invalid fictional fixture")
    monkeypatch.setattr(reset, "_stage", fail)
    monkeypatch.setattr(client, "transact_write_items", lambda **kwargs: pytest.fail("Preparation must precede deletion."))
    with pytest.raises(ValueError):
        reset.reset_demo_database(**options(client, tmp_path))
    assert exists(client, row) == row
    assert not list(tmp_path.iterdir())


def test_oversized_stage_rejects_before_credentials_or_cloud_work(small_fixture, tmp_path):
    template = deepcopy(small_fixture["viewer"]["items"][0])
    small_fixture["viewer"]["items"] = [dict(template, key=f"synthetic-draft-{number}", status="draft") for number in range(100)]
    with pytest.raises(reset.DemoResetError, match="bounded initialization"):
        reset.reset_demo_database(**options(object(), tmp_path))
    assert not list(tmp_path.iterdir())


def test_failed_backup_deletes_nothing(client, small_fixture, monkeypatch, tmp_path):
    row = old_profile(client)
    original = reset._write_private
    def fail_backup(path, value):
        if Path(path).name == "backup.json":
            raise OSError("Synthetic backup failure")
        return original(path, value)
    monkeypatch.setattr(reset, "_write_private", fail_backup)
    monkeypatch.setattr(client, "transact_write_items", lambda **kwargs: pytest.fail("Backup must precede deletion."))
    with pytest.raises(OSError):
        reset.reset_demo_database(**options(client, tmp_path))
    assert exists(client, row) == row


def test_failed_initialization_does_not_publish_partial_business_rows(client, small_fixture, monkeypatch, tmp_path):
    old_profile(client)
    original = client.transact_write_items
    initializations = []
    def reject_initialization(**kwargs):
        if any(action.get("Put", {}).get("Item", {}).get("entity_type") == {"S": "PROFILE"} for action in kwargs["TransactItems"]):
            initializations.append(kwargs)
            raise ClientError({"Error": {"Code": "ValidationException"}}, "TransactWriteItems")
        return original(**kwargs)
    monkeypatch.setattr(client, "transact_write_items", reject_initialization)
    with pytest.raises(reset.DemoResetError, match="incomplete"):
        reset.reset_demo_database(**options(client, tmp_path))
    assert len(initializations) == 1
    assert not [row for row in reset._scan(client) if row.get("_schema") == {"S": SCHEMA}]
    assert reset.read_backup(tmp_path / "backup.json")["items"]


def test_legacy_state_rejects_before_deletion(client, small_fixture, monkeypatch, tmp_path):
    row = put(client, "BARTR_V1#STATE", "0", kind={"S": "legacy"})
    monkeypatch.setattr(client, "transact_write_items", lambda **kwargs: pytest.fail("Legacy data must not be deleted."))
    with pytest.raises(reset.DemoResetError, match="legacy"):
        reset.reset_demo_database(**options(client, tmp_path))
    assert exists(client, row) == row


@pytest.mark.parametrize("code", ["TransactionConflictException", "ThrottlingException", "ProvisionedThroughputExceededException"])
def test_bounded_delete_retry_reuses_exact_transaction(monkeypatch, code):
    calls = []
    class Client:
        def transact_write_items(self, **kwargs):
            calls.append(deepcopy(kwargs))
            if len(calls) == 1:
                raise ClientError({"Error": {"Code": code}}, "TransactWriteItems")
    monkeypatch.setattr(reset, "sleep", lambda delay: None)
    rows = [{"PK": {"S": f"synthetic-{number}"}, "SK": {"S": "DETAILS"}} for number in range(26)]
    reset._delete_batches(Client(), rows)
    assert calls[0] == calls[1]
    assert [len(call["TransactItems"]) for call in calls] == [25, 25, 1]


def test_persistent_throttling_stops_after_bounded_exact_retries(monkeypatch):
    calls = []
    class Client:
        def transact_write_items(self, **kwargs):
            calls.append(deepcopy(kwargs))
            raise ClientError({"Error": {"Code": "ThrottlingException"}}, "TransactWriteItems")
    monkeypatch.setattr(reset, "sleep", lambda delay: None)
    rows = [{"PK": {"S": f"synthetic-{number}"}, "SK": {"S": "DETAILS"}} for number in range(26)]
    with pytest.raises(ClientError):
        reset._delete_batches(Client(), rows)
    assert len(calls) == 6
    assert all(call == calls[0] for call in calls)


def test_cli_loads_server_configuration_before_reset(monkeypatch, tmp_path):
    (tmp_path / ".env").write_text("DYNAMODB_NAMESPACE=SYNTHETIC_NAMESPACE\n")
    monkeypatch.setattr(reset, "ROOT", tmp_path)
    monkeypatch.delenv("DYNAMODB_NAMESPACE", raising=False)
    monkeypatch.setattr(reset.sys, "argv", ["reset-demo", "--confirm-table", "bartr-dev", "--writers-stopped",
                                          "--backup", str(tmp_path / "backup"), "--credentials", str(tmp_path / "credentials")])
    def run(**kwargs):
        assert reset.os.getenv("DYNAMODB_NAMESPACE") == "SYNTHETIC_NAMESPACE"
        return {"members": 2, "items": 3}
    monkeypatch.setattr(reset, "reset_demo_database", run)
    assert reset.main() == 0
