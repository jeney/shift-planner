from fastapi import APIRouter

from shift_planner.domain.project import Plan, Project
from shift_planner.domain.solve import DiagnoseResponse, SolveResponse, ValidateResponse
from shift_planner.solver.service import diagnose_project, solve_project, validate_plan

router = APIRouter(tags=["solver"])


@router.post("/solve", operation_id="solve")
def post_solve(project: Project) -> SolveResponse:
    """Generate a plan for the project's month. Blocks for up to the configured time limit."""
    return solve_project(project)


@router.post("/diagnose", operation_id="diagnose")
def post_diagnose(project: Project) -> DiagnoseResponse:
    """Fast pre-checks, without solving: why the month can't (or probably can't) be planned."""
    return diagnose_project(project)


@router.post("/validate", operation_id="validate")
def post_validate(project: Project) -> ValidateResponse:
    """Check the project's plan (e.g. after hand edits) against every rule."""
    return validate_plan(project, project.plan or Plan())
