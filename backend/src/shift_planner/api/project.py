from typing import Annotated, Any

from fastapi import APIRouter, Body, Query
from pydantic import ValidationError

from shift_planner.api.errors import ApiError, ApiErrorResponse, ErrorDetail
from shift_planner.domain.factory import demo_project, new_project
from shift_planner.domain.migrations import MigrationError, migrate_project
from shift_planner.domain.project import Project

router = APIRouter(prefix="/project", tags=["project"])

MonthQuery = Annotated[str, Query(pattern=r"^\d{4}-(?:0[1-9]|1[0-2])$", examples=["2027-01"])]


@router.get("/new", operation_id="newProject")
def get_new_project(month: MonthQuery) -> Project:
    """An empty project for `month`, with every setting at its default."""
    return new_project(month)


@router.get("/demo", operation_id="demoProject")
def get_demo_project(month: MonthQuery) -> Project:
    """A fictional demo team (9 people) with some availability and wishes."""
    return demo_project(month)


@router.post(
    "/migrate",
    operation_id="migrateProject",
    responses={422: {"model": ApiError, "description": "Not a valid project file"}},
)
def post_migrate_project(raw: Annotated[dict[str, Any], Body()]) -> Project:
    """Upgrade a saved project (any schema version) to the current version and validate it."""
    try:
        return migrate_project(raw)
    except MigrationError as exc:
        error = ApiError(code=exc.code, params=exc.params)
    except ValidationError as exc:
        error = ApiError(
            code="project.invalid",
            params={"count": exc.error_count()},
            details=[ErrorDetail(loc=list(e["loc"]), message=e["msg"]) for e in exc.errors()[:20]],
        )
    raise ApiErrorResponse(422, error)
