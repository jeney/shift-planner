"""Upgrades saved project files to the current schema version.

When the schema changes: bump `CURRENT_SCHEMA_VERSION` (and the `Literal` on
`Project.schema_version`), then register a function here that turns a version N dict into a
version N+1 dict. Migrations work on plain JSON dicts (camelCase), never on models, so old
migrations keep working as the models evolve.
"""

from collections.abc import Callable
from typing import Any

from shift_planner.domain.project import CURRENT_SCHEMA_VERSION, Project

RawProject = dict[str, Any]
Migration = Callable[[RawProject], RawProject]

# from_version -> migration to from_version + 1
MIGRATIONS: dict[int, Migration] = {}


class MigrationError(Exception):
    def __init__(self, code: str, **params: Any) -> None:
        super().__init__(code)
        self.code = code
        self.params = params


def migrate_raw(raw: RawProject, *, target: int = CURRENT_SCHEMA_VERSION) -> RawProject:
    version = raw.get("schemaVersion")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        raise MigrationError("project.missingSchemaVersion")
    if version > target:
        raise MigrationError("project.newerSchemaVersion", version=version, supported=target)
    data = dict(raw)
    while version < target:
        step = MIGRATIONS.get(version)
        if step is None:
            raise MigrationError("project.noMigration", version=version)
        data = step(data)
        version += 1
        data["schemaVersion"] = version
    return data


def migrate_project(raw: RawProject) -> Project:
    """Upgrade and validate a saved project. Raises MigrationError or pydantic.ValidationError."""
    return Project.model_validate(migrate_raw(raw))
