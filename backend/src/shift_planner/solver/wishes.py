"""Which wishes a plan honours (independent of the solver, like the checker)."""

from collections import defaultdict
from datetime import date

from shift_planner.domain.base import to_minutes
from shift_planner.domain.project import Plan
from shift_planner.domain.solve import WishOutcome
from shift_planner.solver.context import Context, entry_windows, overlaps


def wish_outcomes(ctx: Context, plan: Plan) -> list[WishOutcome]:
    """One outcome per wish per open day it applies to.

    A day-off wish is honoured if no shift overlaps its window (the whole day by default);
    a work wish is honoured if a shift does.
    """
    shifts: dict[tuple[str, date], list[tuple[int, int]]] = defaultdict(list)
    for s in plan.shifts:
        shifts[(s.employee_id, s.date)].append((to_minutes(s.start), to_minutes(s.end)))
    active = {e.id for e in ctx.employees}
    outcomes = []
    for entry in ctx.project.availability:
        if entry.kind == "unavailable" or entry.employee_id not in active:
            continue
        for info in ctx.days:
            if info.window is None:
                continue
            for window in entry_windows(entry, info.day):
                working = any(overlaps(s, window) for s in shifts[(entry.employee_id, info.date)])
                outcomes.append(
                    WishOutcome(
                        entry_id=entry.id,
                        employee_id=entry.employee_id,
                        date=info.date,
                        kind=entry.kind,
                        honoured=working if entry.kind == "wish_work" else not working,
                    )
                )
    return outcomes
