from typing import Any

import pytest

from shift_planner.domain import migrations
from shift_planner.domain.migrations import MigrationError, migrate_project, migrate_raw


def test_current_version_passes_through() -> None:
    project = migrate_project({"schemaVersion": 1, "id": "p", "month": "2027-02"})
    assert project.schema_version == 1


@pytest.mark.parametrize("version", [None, "1", 0, True])
def test_missing_or_bad_version(version: Any) -> None:
    raw = {"id": "p", "month": "2027-02"}
    if version is not None:
        raw["schemaVersion"] = version
    with pytest.raises(MigrationError) as exc:
        migrate_raw(raw)
    assert exc.value.code == "project.missingSchemaVersion"


def test_newer_version_is_rejected() -> None:
    with pytest.raises(MigrationError) as exc:
        migrate_raw({"schemaVersion": 99})
    assert exc.value.code == "project.newerSchemaVersion"
    assert exc.value.params == {"version": 99, "supported": 1}


def test_migrations_are_chained(monkeypatch: pytest.MonkeyPatch) -> None:
    def v1_to_v2(raw: dict[str, Any]) -> dict[str, Any]:
        data = dict(raw)
        data["renamed"] = data.pop("old")
        return data

    def v2_to_v3(raw: dict[str, Any]) -> dict[str, Any]:
        return {**raw, "added": True}

    monkeypatch.setattr(migrations, "MIGRATIONS", {1: v1_to_v2, 2: v2_to_v3})
    result = migrate_raw({"schemaVersion": 1, "old": "x"}, target=3)
    assert result == {"schemaVersion": 3, "renamed": "x", "added": True}


def test_missing_migration_step(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(migrations, "MIGRATIONS", {})
    with pytest.raises(MigrationError) as exc:
        migrate_raw({"schemaVersion": 1}, target=2)
    assert exc.value.code == "project.noMigration"
