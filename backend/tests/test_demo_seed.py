import json
from collections import Counter

import pytest

from backend.app.domain import Marketplace
from backend.app.storage.state import StateRepository
from backend.scripts.seed_demo_json import (
    DEMO_PASSWORD,
    DEMO_SEED_ID,
    DEMO_USERNAME,
    DemoSeedError,
    FIXTURE_PATH,
    seed_demo_database,
)


def configure_json(monkeypatch, path):
    monkeypatch.setenv("BARTR_STORAGE", "json")
    monkeypatch.setenv("BARTR_JSON_PATH", str(path))


def test_seed_persists_public_demo_inventory_and_images(monkeypatch, tmp_path):
    path = tmp_path / "demo.json"
    configure_json(monkeypatch, path)

    assert seed_demo_database() is True
    document = json.loads(path.read_text(encoding="utf-8"))
    assert document["demo_seed"] == {
        "id": DEMO_SEED_ID,
        "fixture": FIXTURE_PATH.name,
    }
    assert document["state"]["sessions"] == {}
    assert path.stat().st_mode & 0o777 == 0o600

    repository = StateRepository(json_path=path)
    marketplace = Marketplace(repository)
    token, profile = marketplace.login(DEMO_USERNAME, DEMO_PASSWORD)
    actor = marketplace.authenticate(token)
    assert actor == profile["id"]

    view = marketplace.view(actor)
    state = repository.read()
    available_by_owner = Counter(
        item["owner"] for item in state["items"].values()
        if item["status"] == "available"
    )
    assert len(state["users"]) == 10
    assert all(available_by_owner[owner] == 3 for owner in state["users"])
    viewer = state["users"][actor]
    same_community = {
        member["id"]
        for member in state["users"].values()
        if member["community"].casefold() == viewer["community"].casefold()
    }
    outside = next(
        member
        for member in state["users"].values()
        if member["community"].casefold() != viewer["community"].casefold()
    )

    assert len(same_community - {actor}) >= 7
    assert {member["id"] for member in view["members"]} == set(state["users"])
    assert all(set(member) == {"id", "name", "community"} for member in view["members"])
    assert outside["id"] in {member["id"] for member in view["members"]}

    public_items = [item for item in view["items"] if item["owner"] != actor]
    assert public_items
    assert len(public_items) == 27
    assert all(count == 3 for count in Counter(item["owner"] for item in public_items).values())
    assert any(item["value_minor"] is None for item in public_items)
    assert all(item["status"] == "available" for item in public_items)
    assert outside["id"] in {item["owner"] for item in public_items}
    assert all(
        any(
            interest.casefold()
            in " ".join(
                str(item[field])
                for field in ("title", "description", "category", "condition")
            ).casefold()
            for interest in viewer["interests"]
        )
        for item in public_items
    )

    assert any(item["owner"] == actor and item["status"] == "draft" for item in view["items"])
    removed = [item for item in state["items"].values() if item["status"] == "removed"]
    assert removed
    assert all(item["id"] not in {visible["id"] for visible in view["items"]} for item in removed)

    for item in state["items"].values():
        if item["status"] != "available":
            continue
        image = repository.image(item["image_id"])
        assert image is not None
        assert image["mime_type"] == "image/jpeg"
        assert image["data"].startswith(b"\xff\xd8")

    restarted = StateRepository(json_path=path)
    assert len(restarted.read()["users"]) == len(state["users"])
    assert restarted.image(public_items[0]["image_id"]) is not None


def test_seed_rerun_is_noop_even_after_demo_login(monkeypatch, tmp_path):
    path = tmp_path / "demo.json"
    configure_json(monkeypatch, path)
    assert seed_demo_database() is True

    marketplace = Marketplace(StateRepository(json_path=path))
    marketplace.login(DEMO_USERNAME, DEMO_PASSWORD)
    before = path.read_bytes()

    assert seed_demo_database() is False
    assert path.read_bytes() == before


def test_seed_rejects_unrecognized_nonempty_database_without_changes(
    monkeypatch, tmp_path
):
    path = tmp_path / "existing.json"
    configure_json(monkeypatch, path)
    repository = StateRepository(json_path=path)
    repository.mutate(
        lambda state: state["commands"].update({"existing-record": {"result": "kept"}})
    )
    before = path.read_bytes()

    with pytest.raises(DemoSeedError, match="not empty"):
        seed_demo_database()

    assert path.read_bytes() == before


def test_seed_refuses_non_json_storage(monkeypatch, tmp_path):
    path = tmp_path / "must-not-exist.json"
    monkeypatch.setenv("BARTR_STORAGE", "memory")
    monkeypatch.setenv("BARTR_JSON_PATH", str(path))

    with pytest.raises(DemoSeedError, match="BARTR_STORAGE=json"):
        seed_demo_database()

    assert not path.exists()


def test_tracked_fixture_contains_definitions_not_credentials():
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    serialized = json.dumps(fixture).casefold()
    assert "password" not in serialized
    assert "sessions" not in serialized
    assert "private notes" not in serialized
    assert fixture["viewer"]["username"] == DEMO_USERNAME
    assert len(fixture["members"]) >= 7
    definitions = [fixture["viewer"], *fixture["members"], fixture["outside_community_member"]]
    keys = [item["key"] for member in definitions for item in member["items"]]
    assert len(keys) == len(set(keys))
