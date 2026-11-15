"""Seed an empty temporary JSON database with fictional local-demo records.

Run from the repository root with::

    python -m backend.scripts.seed_demo_json

The deliberately synthetic viewer login is ``demo-alice`` with password
``bartr-demo-only``. It is for the ignored local JSON database only and
must never be used as a deployed credential.
"""

from __future__ import annotations

from io import BytesIO
import json
import os
from pathlib import Path
import secrets
import sys
from tempfile import TemporaryDirectory
from typing import Any

from dotenv import load_dotenv
from PIL import Image

from backend.app.core.config import ROOT
from backend.app.domain import Marketplace
from backend.app.storage.state import StateRepository, empty_state


DEMO_SEED_ID = "bartr-demo-v1"
DEMO_USERNAME = "demo-alice"
DEMO_PASSWORD = "bartr-demo-only"
FIXTURE_PATH = ROOT / "backend" / "fixtures" / "demo-marketplace.json"


class DemoSeedError(RuntimeError):
    """A safe, actionable rejection of demo database initialization."""


def _load_environment() -> None:
    load_dotenv(ROOT / ".env", override=False)


def _target_path() -> Path:
    configured = Path(os.getenv("BARTR_JSON_PATH", ".bartr/bartr.local.json"))
    return (configured if configured.is_absolute() else ROOT / configured).resolve()


def _load_fixture() -> dict[str, Any]:
    try:
        fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise DemoSeedError("The synthetic demo fixture is unreadable or invalid JSON.") from exc

    if not isinstance(fixture, dict) or fixture.get("seed_id") != DEMO_SEED_ID:
        raise DemoSeedError("The synthetic demo fixture has an unexpected seed identity.")
    if fixture.get("viewer", {}).get("username") != DEMO_USERNAME:
        raise DemoSeedError("The synthetic demo viewer does not match the documented login.")

    def check_public_definitions(value: Any) -> None:
        if isinstance(value, dict):
            for key, nested in value.items():
                if "password" in key.casefold() or key.casefold() in {"sessions", "notes"}:
                    raise DemoSeedError(
                        "The tracked demo fixture must not contain credentials, sessions, or private notes."
                    )
                check_public_definitions(nested)
        elif isinstance(value, list):
            for nested in value:
                check_public_definitions(nested)

    check_public_definitions(fixture)
    return fixture


def _is_pristine(document: dict[str, Any]) -> bool:
    return (
        set(document) == {"schema_version", "revision", "state", "images"}
        and document.get("schema_version") == 1
        and document.get("revision") == 0
        and document.get("state") == empty_state()
        and document.get("images") == {}
    )


def _classify_target(path: Path) -> str:
    if not path.exists():
        return "missing"
    repository = StateRepository(json_path=path)
    document = repository._read_json_document()
    marker = document.get("demo_seed")
    if marker == {"id": DEMO_SEED_ID, "fixture": FIXTURE_PATH.name}:
        return "seeded"
    if marker is not None:
        raise DemoSeedError(
            "The JSON database contains an unrecognized demo marker; it was not changed."
        )
    if _is_pristine(document):
        return "empty"
    raise DemoSeedError(
        "The JSON database is not empty and was not created by this demo seed; it was not changed."
    )


def _jpeg(color: str) -> bytes:
    image = Image.new("RGB", (48, 48), color)
    encoded = BytesIO()
    image.save(encoded, format="JPEG", quality=85, optimize=True)
    return encoded.getvalue()


def _create_item(
    marketplace: Marketplace,
    repository: StateRepository,
    actor: str,
    definition: dict[str, Any],
) -> None:
    status = definition["status"]
    facts = {
        key: definition[key]
        for key in ("title", "description", "category", "condition", "value_minor")
    }

    if status == "available":
        image_id = secrets.token_hex(16)
        repository.put_image(
            image_id,
            actor,
            {
                "data": _jpeg(definition["color"]),
                "mime_type": "image/jpeg",
                "width": 48,
                "height": 48,
            },
        )
        marketplace.save_item(
            actor,
            None,
            None,
            {**facts, "image_id": image_id, "status": "available"},
        )
        return

    created = marketplace.save_item(actor, None, None, {**facts, "status": "draft"})
    if status == "removed":
        marketplace.save_item(
            actor,
            created["id"],
            created["revision"],
            {"status": "removed"},
        )
    elif status != "draft":
        raise DemoSeedError(f"Unsupported fixture item status: {status!r}.")


def _create_member(
    marketplace: Marketplace,
    repository: StateRepository,
    definition: dict[str, Any],
    default_community: str,
) -> None:
    username = definition["username"]
    password = DEMO_PASSWORD if username == DEMO_USERNAME else secrets.token_urlsafe(32)
    profile = marketplace.register(
        username,
        password,
        definition["name"],
        definition.get("community", default_community),
    )
    marketplace.update_profile(
        profile["id"],
        profile["revision"],
        {
            "interests": definition["interests"],
            "exclusions": definition["exclusions"],
            "gap_limit": definition["gap_limit"],
        },
    )
    for item in definition["items"]:
        _create_item(marketplace, repository, profile["id"], item)


def _build_staging_database(path: Path, fixture: dict[str, Any]) -> None:
    repository = StateRepository(json_path=path)
    marketplace = Marketplace(repository)
    community = fixture["community"]
    definitions = [
        fixture["viewer"],
        *fixture["members"],
        fixture["outside_community_member"],
    ]
    for definition in definitions:
        _create_member(marketplace, repository, definition, community)
    repository._mutate_json_document(
        lambda document: document.__setitem__(
            "demo_seed",
            {"id": DEMO_SEED_ID, "fixture": FIXTURE_PATH.name},
        )
    )
    repository.close()


def seed_demo_database() -> bool:
    """Install the demo database and return True, or False when already seeded."""

    _load_environment()
    if os.getenv("BARTR_STORAGE", "mongo") != "json":
        raise DemoSeedError(
            "Demo seeding is allowed only with explicit BARTR_STORAGE=json."
        )

    target = _target_path()
    initial = _classify_target(target)
    if initial == "seeded":
        return False

    fixture = _load_fixture()
    target.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".bartr-demo-stage-", dir=target.parent) as directory:
        staged = Path(directory) / target.name
        _build_staging_database(staged, fixture)

        # Recheck immediately before installation so an intervening local write is
        # rejected instead of overwritten. JSON mode supports only one process.
        current = _classify_target(target)
        if current == "seeded":
            return False
        if current not in {"missing", "empty"}:
            raise DemoSeedError("The JSON database changed while demo data was prepared.")
        os.replace(staged, target)
    return True


def main() -> int:
    try:
        installed = seed_demo_database()
    except Exception as exc:
        print(f"Demo seed failed: {exc}", file=sys.stderr)
        return 1

    outcome = "installed" if installed else "already present"
    print(f"Bartr demo data {outcome} in {_target_path()}.")
    print(f"Local demo sign-in: {DEMO_USERNAME} / {DEMO_PASSWORD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
