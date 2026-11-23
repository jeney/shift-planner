import time

from shift_planner.domain.base import to_minutes
from shift_planner.domain.project import Plan, Project
from shift_planner.domain.solve import (
    DiagnoseResponse,
    Diagnostic,
    EmployeeStats,
    SolveResponse,
    SolveStatus,
    ValidateResponse,
    Violation,
    WishOutcome,
)
from shift_planner.solver.checker import check_plan
from shift_planner.solver.context import Context, build_context
from shift_planner.solver.diagnostics import precheck
from shift_planner.solver.model import solve_staged
from shift_planner.solver.wishes import wish_outcomes


def plan_stats(
    ctx: Context, plan: Plan, wishes: list[WishOutcome] | None = None
) -> list[EmployeeStats]:
    """Planned hours vs target and the resulting balance, per active employee."""
    worked: dict[str, int] = {e.id: 0 for e in ctx.employees}
    counts: dict[str, int] = {e.id: 0 for e in ctx.employees}
    for s in plan.shifts:
        if s.employee_id in worked:
            length = to_minutes(s.end) - to_minutes(s.start)
            worked[s.employee_id] += length - ctx.break_minutes(length)
            counts[s.employee_id] += 1
    honoured: dict[str, int] = {e.id: 0 for e in ctx.employees}
    total: dict[str, int] = {e.id: 0 for e in ctx.employees}
    for w in wishes if wishes is not None else wish_outcomes(ctx, plan):
        total[w.employee_id] += 1
        honoured[w.employee_id] += w.honoured
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
                wishes_honoured=honoured[e.id],
                wishes_total=total[e.id],
            )
        )
    return stats


def solve_project(project: Project, *, workers: int = 8) -> SolveResponse:
    """Pre-check, solve strictly, and fall back to a best-effort plan if no plan follows
    every rule (or none was found in time)."""
    started = time.perf_counter()
    limit = project.solver.time_limit_seconds
    ctx = build_context(project)
    diagnostics = precheck(ctx)
    impossible = any(d.severity == "error" for d in diagnostics)

    outcome = None if impossible else solve_staged(ctx, limit, workers=workers)
    if outcome is None or outcome.plan is None:
        timed_out = outcome is not None and not outcome.proven
        remaining = limit - (time.perf_counter() - started)
        relaxed = solve_staged(ctx, max(remaining, limit / 2), workers=workers, relaxed=True)
        if relaxed.plan is None and timed_out:
            diagnostics.append(Diagnostic(code="solver.timeout", params={"seconds": limit}))
        outcome = relaxed

    violations: list[Violation] = []
    stats: list[EmployeeStats] = []
    wishes: list[WishOutcome] = []
    status: SolveStatus = outcome.status
    if outcome.plan is not None:
        violations = check_plan(project, outcome.plan, ctx)
        if any(v.severity == "error" for v in violations):
            status = "best_effort"
        wishes = wish_outcomes(ctx, outcome.plan)
        stats = plan_stats(ctx, outcome.plan, wishes)
    return SolveResponse(
        status=status,
        plan=outcome.plan,
        violations=violations,
        diagnostics=diagnostics,
        stats=stats,
        wishes=wishes,
        solve_time_ms=round((time.perf_counter() - started) * 1000),
    )


def validate_plan(project: Project, plan: Plan) -> ValidateResponse:
    """Check a (possibly hand-edited) plan: the single source of truth for rule checking."""
    ctx = build_context(project)
    wishes = wish_outcomes(ctx, plan)
    return ValidateResponse(
        violations=check_plan(project, plan, ctx),
        stats=plan_stats(ctx, plan, wishes),
        wishes=wishes,
    )


def diagnose_project(project: Project) -> DiagnoseResponse:
    return DiagnoseResponse(diagnostics=precheck(build_context(project)))
