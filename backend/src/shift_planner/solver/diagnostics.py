"""Fast pre-checks: plain-language reasons a month can't (or probably can't) be planned.

No solver involved. Errors are sufficient conditions for infeasibility (the month cannot be
planned as configured); warnings point at likely trouble. Messages are translated by the
frontend from `diagnostic.<code>` with `params`.
"""

import math
from collections.abc import Iterator

from shift_planner.domain.base import from_minutes
from shift_planner.domain.solve import Diagnostic
from shift_planner.solver.context import Context, DayInfo, Window, overlaps

DEMAND_LOW = 0.9
"""Warn when contract hours cover less than this share of the minimum staffing demand."""
DEMAND_HIGH = 1.5
"""Warn when contract hours exceed the minimum staffing demand by this factor."""


def precheck(ctx: Context) -> list[Diagnostic]:
    if not ctx.employees:
        return [Diagnostic(code="no_employees")]
    diagnostics: list[Diagnostic] = []
    for info in ctx.days:
        if info.window is not None:
            diagnostics += _day(ctx, info)
    diagnostics += _working_days(ctx)
    diagnostics += _hours(ctx)
    diagnostics += _rides(ctx)
    diagnostics += _guests(ctx)
    return diagnostics


def _guests(ctx: Context) -> list[Diagnostic]:
    """Guest-based demand is on, but some open days have no expected guest count."""
    if not ctx.project.guest_demand.enabled:
        return []
    missing = [info for info in ctx.days if info.window is not None and info.guest_target is None]
    if not missing:
        return []
    return [
        Diagnostic(
            code="guest_counts_missing",
            severity="warning",
            params={"count": len(missing), "first": missing[0].date.isoformat()},
        )
    ]


def _blocked_at(ctx: Context, info: DayInfo, window: Window) -> list[str]:
    """Employees hard-unavailable at some point during `window`."""
    return [
        e.id for e in ctx.employees if any(overlaps(window, w) for w in ctx.blocked(e.id, info.day))
    ]


def _available_all_day(ctx: Context, info: DayInfo) -> list[str]:
    """Employees with at least one stretch free for their minimum shift length."""
    assert info.window is not None
    result = []
    for e in ctx.employees:
        blocked = sorted(ctx.blocked(e.id, info.day))
        free, cursor = 0, info.window.start
        for a, b in blocked:
            free = max(free, min(a, info.window.end) - cursor)
            cursor = max(cursor, b)
        free = max(free, info.window.end - cursor)
        if free >= ctx.limits[e.id].min_shift:
            result.append(e.id)
    return result


def _checkpoints(ctx: Context, info: DayInfo) -> Iterator[tuple[int, int, str]]:
    """(moment, people required, which rule) across the staffed day."""
    assert info.window is not None
    start, end = info.window.start, info.window.end
    step = ctx.project.rules.granularity_min
    moments = sorted({start, end - 1, *range(start, end, step), *(a for (a, _), _ in info.ranges)})
    for t in moments:
        if not start <= t < end:
            continue
        if t == start and info.min_at_opening > info.min_people:
            yield t, info.min_at_opening, "opening"
        if t == end - 1 and info.min_at_closing > info.min_people:
            yield t, info.min_at_closing, "closing"
        for (a, b), people in info.ranges:
            if a <= t < b and people > info.min_people:
                yield t, people, "busy"
        yield t, info.min_people, "always"


def _day(ctx: Context, info: DayInfo) -> list[Diagnostic]:
    assert info.window is not None
    window = info.window
    found: list[Diagnostic] = []

    shortest = min(lim.min_shift for lim in ctx.limits.values())
    if window.minutes < shortest:
        return [
            Diagnostic(
                code="window_shorter_than_min_shift",
                date=info.date,
                params={
                    "start": from_minutes(window.start),
                    "end": from_minutes(window.end),
                    "min": shortest / 60,
                },
            )
        ]

    # People needed at the same moment vs people not unavailable at that moment.
    reported: set[str] = set()
    for t, required, rule in _checkpoints(ctx, info):
        blocked = _blocked_at(ctx, info, (t, t + 1))
        available = len(ctx.employees) - len(blocked)
        if available < required and rule not in reported:
            reported.add(rule)
            code = {
                "opening": "opening_short",
                "closing": "closing_short",
                "busy": "busy_period_short",
                "always": "moment_short",
            }[rule]
            found.append(
                Diagnostic(
                    code=code,
                    date=info.date,
                    employee_ids=blocked,
                    params={
                        "time": from_minutes(window.end if rule == "closing" else t),
                        "required": required,
                        "available": available,
                    },
                )
            )

    # Head count: nobody can cover more of the day than their daily maximum, so covering
    # the whole staffed day with `min_people` needs at least this many people.
    needed = _people_needed(ctx, info)
    available_ids = _available_all_day(ctx, info)
    if len(available_ids) < needed and not found:
        found.append(
            Diagnostic(
                code="day_short_of_people",
                date=info.date,
                employee_ids=[e.id for e in ctx.employees if e.id not in available_ids],
                params={"required": needed, "available": len(available_ids)},
            )
        )
    return found


def _longest_day(ctx: Context) -> int:
    """The most minutes one person can be at work on a day."""
    one_shift = ctx.project.rules.one_shift_per_day
    return max(
        min(lim.max_shift, lim.max_per_day) if one_shift else lim.max_per_day
        for lim in ctx.limits.values()
    )


def _people_needed(ctx: Context, info: DayInfo) -> int:
    assert info.window is not None
    longest = _longest_day(ctx)
    return max(
        info.min_people * math.ceil(info.window.minutes / longest),
        info.min_at_opening,
        info.min_at_closing,
    )


def _working_days(ctx: Context) -> list[Diagnostic]:
    """Person-days needed vs the most anyone can work under the days-in-a-row limit."""
    open_days = [info for info in ctx.days if info.window is not None]
    needed = sum(_people_needed(ctx, info) for info in open_days)
    possible = 0
    for e in ctx.employees:
        limit = ctx.limits[e.id].max_consecutive_days
        days = len(ctx.days)
        free_days = sum(1 for info in open_days if e.id in _available_all_day(ctx, info))
        # At least one day off in every (limit + 1) days.
        possible += min(free_days, days - days // (limit + 1))
    if needed > possible:
        return [
            Diagnostic(
                code="not_enough_working_days",
                params={"required": needed, "available": possible},
            )
        ]
    return []


def _hours(ctx: Context) -> list[Diagnostic]:
    demand = sum(
        info.min_people * info.window.minutes for info in ctx.days if info.window is not None
    )
    contract = sum(ctx.targets.values())
    if demand == 0:
        return []
    params: dict[str, str | int | float] = {
        "contract": round(contract / 60, 1),
        "demand": round(demand / 60, 1),
    }
    if contract < DEMAND_LOW * demand:
        return [Diagnostic(code="hours_below_demand", severity="warning", params=params)]
    if contract > DEMAND_HIGH * demand:
        return [Diagnostic(code="hours_above_demand", severity="warning", params=params)]
    return []


def _rides(ctx: Context) -> list[Diagnostic]:
    bus = ctx.project.rules.bus_rule
    if not bus.enabled:
        return []
    found = []
    for e in ctx.employees:
        if not (e.needs_ride_early or (bus.late_enabled and e.needs_ride_late)):
            continue
        drivers = ctx.drivers.get(e.id, [])
        if not drivers:
            found.append(
                Diagnostic(code="rider_without_driver", severity="warning", employee_ids=[e.id])
            )
            continue
        if not e.needs_ride_early:
            continue
        for info in ctx.days:
            if info.window is None or info.window.start >= info.early_cutoff:
                continue
            opening = (info.window.start, info.window.start + 1)
            rider_free = not any(overlaps(opening, w) for w in ctx.blocked(e.id, info.day))
            free_drivers = [
                d
                for d in drivers
                if not any(overlaps(opening, w) for w in ctx.blocked(d, info.day))
            ]
            if rider_free and not free_drivers:
                found.append(
                    Diagnostic(
                        code="no_driver_early",
                        severity="warning",
                        date=info.date,
                        employee_ids=[e.id],
                        params={"cutoff": from_minutes(info.early_cutoff)},
                    )
                )
    return found
