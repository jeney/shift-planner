from fastapi import APIRouter

from shift_planner.domain.project import Project
from shift_planner.domain.solve import SolveResponse
from shift_planner.solver.service import solve_project

router = APIRouter(tags=["solver"])


@router.post("/solve", operation_id="solve")
def post_solve(project: Project) -> SolveResponse:
    """Generate a plan for the project's month. Blocks for up to the configured time limit."""
    return solve_project(project)
