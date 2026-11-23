import logging
import time

from shift_planner.domain.base import to_minutes
from shift_planner.domain.project import Plan, Project
from shift_planner.domain.solve import Diagnostic, EmployeeStats, SolveResponse
from shift_planner.solver.checker import check_plan
from shift_planner.solver.context import Context, build_context
from shift_planner.solver.model import solve_staged

logger = logging.getLogger(__name__)


def plan_stats(ctx: Context, plan: Plan) -> list[EmployeeStats]:
    """Planned hours vs target and the resulting balance, per active employee."""
    worked: dict[str, int] = {e.id: 0 for e in ctx.employees}
    counts: dict[str, int] = {e.id: 0 for e in ctx.employees}
    for s in plan.shifts:
        if s.employee_id in worked:
            length = to_minutes(s.end) - to_minutes(s.start)
            worked[s.employee_id] += length - ctx.break_minutes(length)
            counts[s.employee_id] += 1
    stats = []
    for e in ctx.employees:
        planned = worked[e.id] / 60
        target = ctx.targets[e.id] / 60
        carry = e.balance.carry_in_hours
        stats.append(
            EmployeeStats(
                employee_id=e.id,
                shifts=counts[e.id],
                planned_hours=round(planned, 2),
                target_hours=round(target, 2),
                deviation_hours=round(planned - target, 2),
                carry_in_hours=carry,
                new_balance_hours=round(carry + planned - target, 2),
            )
        )
    return stats


def solve_project(project: Project, *, workers: int = 8) -> SolveResponse:
    started = time.perf_counter()
    ctx = build_context(project)
    outcome = solve_staged(ctx, project.solver.time_limit_seconds, workers=workers)
    violations = []
    stats = []
    if outcome.plan is not None:
        violations = check_plan(project, outcome.plan, ctx)
        errors = [v for v in violations if v.severity == "error"]
        if errors:
            # The model and the checker disagree: a bug, but show it rather than hide it.
            logger.error("Solver plan broke %d rules: %s", len(errors), errors[:5])
        stats = plan_stats(ctx, outcome.plan)
    diagnostics = []
    if outcome.plan is None and not outcome.proven:
        diagnostics.append(
            Diagnostic(
                code="solver.timeout",
                params={"seconds": project.solver.time_limit_seconds},
            )
        )
    return SolveResponse(
        status=outcome.status,
        plan=outcome.plan,
        violations=violations,
        diagnostics=diagnostics,
        stats=stats,
        solve_time_ms=round((time.perf_counter() - started) * 1000),
    )
