"""Independent rule checker: given a project and a (possibly hand-edited) plan, list every
broken rule. This is the single source of truth for rule checking; the solver's output is
always run through it too.
"""

import itertools
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from shift_planner.domain.base import from_minutes, to_minutes
from shift_planner.domain.project import Plan, Project
from shift_planner.domain.solve import RuleCode, Severity, Violation
from shift_planner.solver.context import (
    MINUTES_PER_DAY,
    Context,
    DayInfo,
    build_context,
    minutes_since,
    overlaps,
)


@dataclass(frozen=True)
class S:
    """A shift in minutes."""

    id: str
    employee_id: str
    date: date
    start: int
    end: int

    @property
    def length(self) -> int:
        return self.end - self.start


def hours(minutes: float) -> float:
    return round(minutes / 60, 2)


class Checker:
    def __init__(self, project: Project, plan: Plan, context: Context | None = None) -> None:
        self.ctx = context or build_context(project)
        self.project = project
        self.shifts = [
            S(s.id, s.employee_id, s.date, to_minutes(s.start), to_minutes(s.end))
            for s in plan.shifts
        ]
        self.by_day: dict[date, list[S]] = defaultdict(list)
        self.by_employee: dict[str, list[S]] = defaultdict(list)
        for s in sorted(self.shifts, key=lambda s: (s.date, s.start)):
            self.by_day[s.date].append(s)
            self.by_employee[s.employee_id].append(s)
        self.active = {e.id for e in self.ctx.employees}
        self.violations: list[Violation] = []

    def add(
        self,
        rule: RuleCode,
        *,
        employee_id: str | None = None,
        day: date | None = None,
        start: int | None = None,
        end: int | None = None,
        amount: float | None = None,
        severity: Severity = "error",
        **params: str | int | float,
    ) -> None:
        self.violations.append(
            Violation(
                rule=rule,
                severity=severity,
                employee_id=employee_id,
                date=day,
                start=None if start is None else from_minutes(start),
                end=None if end is None else from_minutes(end),
                amount=amount,
                params=params,
            )
        )

    def worked(self, s: S) -> int:
        return s.length - self.ctx.break_minutes(s.length)

    # ------------------------------------------------------------------------------------

    def run(self) -> list[Violation]:
        days = {d.date: d for d in self.ctx.days}
        for s in self.shifts:
            if s.employee_id not in self.active:
                self.add("inactive_employee", employee_id=s.employee_id, day=s.date)
            self.check_shift(s, days[s.date])
        for employee_id, shifts in self.by_employee.items():
            if employee_id in self.active:
                self.check_employee(employee_id, shifts)
        for info in self.ctx.days:
            self.check_coverage(info)
            self.check_rides(info)
        return self.violations

    def check_shift(self, s: S, info: DayInfo) -> None:
        e = s.employee_id
        if info.window is None:
            self.add("store_closed", employee_id=e, day=s.date, start=s.start, end=s.end)
        elif s.start < info.window.start or s.end > info.window.end:
            self.add(
                "outside_opening_hours",
                employee_id=e,
                day=s.date,
                start=s.start,
                end=s.end,
                windowStart=from_minutes(info.window.start),
                windowEnd=from_minutes(info.window.end),
            )
        if e not in self.active:
            return
        limits = self.ctx.limits[e]
        if s.length < limits.min_shift:
            self.add(
                "shift_too_short",
                employee_id=e,
                day=s.date,
                start=s.start,
                end=s.end,
                amount=hours(limits.min_shift - s.length),
                min=hours(limits.min_shift),
            )
        if s.length > limits.max_shift:
            self.add(
                "shift_too_long",
                employee_id=e,
                day=s.date,
                start=s.start,
                end=s.end,
                amount=hours(s.length - limits.max_shift),
                max=hours(limits.max_shift),
            )
        for start, end in self.ctx.blocked(e, info.day):
            if overlaps((s.start, s.end), (start, end)):
                self.add(
                    "unavailable",
                    employee_id=e,
                    day=s.date,
                    start=max(s.start, start),
                    end=min(s.end, end),
                    amount=hours(min(s.end, end) - max(s.start, start)),
                )

    def check_employee(self, e: str, shifts: list[S]) -> None:
        limits = self.ctx.limits[e]
        rules = self.project.rules
        per_day: dict[date, list[S]] = defaultdict(list)
        for s in shifts:
            per_day[s.date].append(s)

        for day, items in per_day.items():
            max_count = 1 if rules.one_shift_per_day else 2
            if len(items) > max_count:
                self.add("too_many_shifts", employee_id=e, day=day, amount=len(items) - max_count)
            for a, b in itertools.pairwise(items):
                if b.start < a.end:
                    self.add("overlapping_shifts", employee_id=e, day=day, start=b.start, end=a.end)
            total = sum(s.length for s in items)
            if total > limits.max_per_day:
                self.add(
                    "day_too_long",
                    employee_id=e,
                    day=day,
                    amount=hours(total - limits.max_per_day),
                    max=hours(limits.max_per_day),
                )

        # Rest between shifts on different days, including the previous month's last shift.
        employee = next(x for x in self.ctx.employees if x.id == e)
        previous_end: datetime | None = employee.balance.last_shift_ended_at
        for s in shifts:
            start = _at(s.date, s.start)
            if previous_end is not None and previous_end.date() != s.date:
                gap = int((start - previous_end) / timedelta(minutes=1))
                if gap < limits.min_rest:
                    self.add(
                        "rest_too_short",
                        employee_id=e,
                        day=s.date,
                        start=s.start,
                        amount=hours(limits.min_rest - gap),
                        rest=hours(gap),
                        min=hours(limits.min_rest),
                    )
            end = _at(s.date, s.end)
            if previous_end is None or end > previous_end:
                previous_end = end

        # Days in a row, counting days worked at the end of last month.
        worked_days = set(per_day)
        streak = employee.balance.consecutive_days_at_start
        reported = False
        for info in self.ctx.days:
            if info.date in worked_days:
                streak += 1
                if streak > limits.max_consecutive_days and not reported:
                    self.add(
                        "too_many_days_in_a_row",
                        employee_id=e,
                        day=info.date,
                        amount=streak - limits.max_consecutive_days,
                        max=limits.max_consecutive_days,
                    )
                    reported = True
            else:
                streak, reported = 0, False

        # Weekly hours (in-month part of each ISO week).
        full_time = employee.contract_hours_per_week >= rules.full_time_threshold_hours
        contract = round(employee.contract_hours_per_week * 60)
        for indexes in self.ctx.weeks().values():
            week_days = [self.ctx.days[i].date for i in indexes]
            total = sum(self.worked(s) for d in week_days for s in per_day.get(d, []))
            if total > limits.max_weekly:
                self.add(
                    "weekly_hours_exceeded",
                    employee_id=e,
                    day=week_days[0],
                    amount=hours(total - limits.max_weekly),
                    max=hours(limits.max_weekly),
                    planned=hours(total),
                )
            elif rules.full_time_contract_warning and full_time and total > contract:
                self.add(
                    "weekly_above_contract",
                    severity="warning",
                    employee_id=e,
                    day=week_days[0],
                    amount=hours(total - contract),
                    contract=hours(contract),
                    planned=hours(total),
                )

        limit = rules.monthly_hard_limit_hours
        if limit is not None:
            planned = sum(self.worked(s) for s in shifts)
            deviation = planned - self.ctx.targets[e]
            if abs(deviation) > limit * 60:
                self.add(
                    "monthly_limit_exceeded",
                    employee_id=e,
                    amount=hours(abs(deviation) - limit * 60),
                    deviation=hours(deviation),
                    limit=limit,
                )

    def check_coverage(self, info: DayInfo) -> None:
        window = info.window
        if window is None:
            return
        shifts = [s for s in self.by_day.get(info.date, []) if s.employee_id in self.active]

        def present(t: int) -> int:
            return sum(1 for s in shifts if s.start <= t < s.end)

        # Segment the staffed day at every shift edge and busy-period edge.
        points = {window.start, window.end}
        points.update(p for s in shifts for p in (s.start, s.end))
        points.update(p for (a, b), _ in info.ranges for p in (a, b))
        cuts = sorted(p for p in points if window.start <= p <= window.end)
        segments = [(a, b, present(a)) for a, b in itertools.pairwise(cuts) if a < b]

        def report(rule: RuleCode, required: int, within: tuple[int, int]) -> None:
            run: tuple[int, int, int] | None = None  # start, end, worst count
            for a, b, count in [*segments, (window.end, window.end, required)]:
                inside = a < within[1] and b > within[0]
                if inside and count < required:
                    run = (run[0], b, min(run[2], count)) if run else (a, b, count)
                elif run:
                    self.add(
                        rule,
                        day=info.date,
                        start=run[0],
                        end=run[1],
                        amount=required - run[2],
                        required=required,
                    )
                    run = None

        report("understaffed", info.min_people, (window.start, window.end))
        opening = present(window.start)
        if opening < info.min_at_opening:
            self.add(
                "opening_understaffed",
                day=info.date,
                start=window.start,
                amount=info.min_at_opening - opening,
                required=info.min_at_opening,
            )
        closing = present(window.end - 1)
        if closing < info.min_at_closing:
            self.add(
                "closing_understaffed",
                day=info.date,
                end=window.end,
                amount=info.min_at_closing - closing,
                required=info.min_at_closing,
            )
        for (a, b), required in info.ranges:
            report("busy_period_understaffed", required, (max(a, window.start), min(b, window.end)))

        total = sum(self.worked(s) for s in shifts)
        if info.daily_min is not None and total < info.daily_min:
            self.add(
                "daily_hours_below_min",
                day=info.date,
                amount=hours(info.daily_min - total),
                min=hours(info.daily_min),
                planned=hours(total),
            )
        if info.daily_max is not None and total > info.daily_max:
            self.add(
                "daily_hours_above_max",
                day=info.date,
                amount=hours(total - info.daily_max),
                max=hours(info.daily_max),
                planned=hours(total),
            )

    def check_rides(self, info: DayInfo) -> None:
        bus = self.project.rules.bus_rule
        if not bus.enabled:
            return
        shifts = self.by_day.get(info.date, [])
        employees = {e.id: e for e in self.ctx.employees}
        for s in shifts:
            rider = employees.get(s.employee_id)
            if rider is None:
                continue
            drivers = set(self.ctx.drivers.get(rider.id, []))
            needs_early = rider.needs_ride_early and s.start < info.early_cutoff
            if needs_early and not any(
                d.employee_id in drivers and d.start == s.start for d in shifts
            ):
                self.add(
                    "no_ride_early",
                    employee_id=rider.id,
                    day=info.date,
                    start=s.start,
                    cutoff=from_minutes(info.early_cutoff),
                )
            needs_late = bus.late_enabled and rider.needs_ride_late and s.end > info.late_cutoff
            if needs_late and not any(d.employee_id in drivers and d.end == s.end for d in shifts):
                self.add(
                    "no_ride_late",
                    employee_id=rider.id,
                    day=info.date,
                    end=s.end,
                    cutoff=from_minutes(info.late_cutoff),
                )


def _at(day: date, minutes: int) -> datetime:
    return datetime(day.year, day.month, day.day) + timedelta(minutes=minutes)


def check_plan(project: Project, plan: Plan, context: Context | None = None) -> list[Violation]:
    return Checker(project, plan, context).run()


__all__ = ["MINUTES_PER_DAY", "check_plan", "minutes_since"]
