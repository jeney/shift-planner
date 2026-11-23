"""Facts derived from a project that both the solver and the checker need.

Everything is in minutes after local midnight (Europe/Copenhagen wall-clock time).
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from shift_planner.domain.base import to_minutes
from shift_planner.domain.calendar import CalendarDay, DayType, month_calendar
from shift_planner.domain.guests import guest_hours
from shift_planner.domain.hours import StaffedWindow, staffed_window, team_targets
from shift_planner.domain.project import AvailabilityEntry, Employee, Project

MINUTES_PER_DAY = 24 * 60
Window = tuple[int, int]
"""Half-open [start, end) in minutes."""


@dataclass(frozen=True)
class Limits:
    """Hard per-person limits after applying personal overrides. All in minutes."""

    min_shift: int
    max_shift: int
    max_per_day: int
    min_rest: int
    max_consecutive_days: int
    max_weekly: int


@dataclass(frozen=True)
class DayInfo:
    day: CalendarDay
    window: StaffedWindow | None
    """None when the store is closed."""
    min_people: int
    """At every staffed moment: 2 unless working alone is allowed."""
    min_at_opening: int
    min_at_closing: int
    ranges: list[tuple[Window, int]]
    """Busy periods for this day type: ((start, end), min people)."""
    daily_min: int | None
    daily_max: int | None
    guest_target: int | None
    """Guest-based total staff minutes for the day (soft, ± guest_tolerance)."""
    guest_tolerance: int
    early_cutoff: int
    late_cutoff: int

    @property
    def date(self) -> date:
        return self.day.date

    @property
    def day_type(self) -> DayType:
        return self.day.day_type


@dataclass
class Context:
    project: Project
    days: list[DayInfo]
    employees: list[Employee]
    """Active employees only."""
    limits: dict[str, Limits]
    targets: dict[str, int]
    """Monthly target in minutes."""
    drivers: dict[str, list[str]] = field(default_factory=dict)
    """For each employee who needs a ride: who may drive them (has a car, not themselves)."""

    @property
    def month_start(self) -> datetime:
        first = self.days[0].date
        return datetime(first.year, first.month, first.day)

    def blocked(self, employee_id: str, day: CalendarDay) -> list[Window]:
        """Hard unavailability windows for an employee on a day."""
        return [
            w
            for e in self.project.availability
            if e.employee_id == employee_id and e.kind == "unavailable"
            for w in entry_windows(e, day)
        ]

    def break_minutes(self, presence: int) -> int:
        """Unpaid break deducted from a shift of `presence` minutes (0 if breaks are paid/off)."""
        breaks = self.project.rules.breaks
        if not breaks.enabled or breaks.paid:
            return 0
        return max(
            (r.minutes for r in breaks.rules if presence > round(r.after_hours * 60)), default=0
        )

    def weeks(self) -> dict[tuple[int, int], list[int]]:
        """ISO week -> indexes into `days`. Weeks crossing the month edge only include
        in-month days (the neighbouring month's shifts are unknown)."""
        result: dict[tuple[int, int], list[int]] = {}
        for i, info in enumerate(self.days):
            iso = info.date.isocalendar()
            result.setdefault((iso.year, iso.week), []).append(i)
        return result


def entry_windows(entry: AvailabilityEntry, day: CalendarDay) -> list[Window]:
    """The part of `day` an availability entry covers (empty if it doesn't apply)."""
    pattern = entry.pattern
    if pattern.type == "range":
        covers = pattern.start_date <= day.date <= pattern.end_date
        return [(0, MINUTES_PER_DAY)] if covers else []
    if pattern.type == "weekly" and pattern.weekday != day.weekday:
        return []
    if pattern.type == "date" and pattern.date != day.date:
        return []
    start = to_minutes(pattern.start) if pattern.start else 0
    end = to_minutes(pattern.end) if pattern.end else MINUTES_PER_DAY
    return [(start, end)]


def overlaps(a: Window, b: Window) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def build_context(project: Project) -> Context:
    calendar = month_calendar(project.month)
    store = project.store
    rules = project.rules
    days = []
    for day in calendar.days:
        staffing = store.staffing.for_day_type(day.day_type)
        days.append(
            DayInfo(
                day=day,
                window=staffed_window(store, day),
                min_people=1 if store.allow_working_alone else 2,
                min_at_opening=staffing.min_at_opening,
                min_at_closing=staffing.min_at_closing,
                ranges=[
                    ((to_minutes(r.start), to_minutes(r.end)), r.min_people)
                    for r in store.time_range_minimums
                    if day.day_type in r.day_types
                ],
                daily_min=_minutes(staffing.daily_hours_min),
                daily_max=_minutes(staffing.daily_hours_max),
                guest_target=_guest_target(project, day.date),
                guest_tolerance=round(project.guest_demand.tolerance_hours * 60),
                early_cutoff=to_minutes(rules.bus_rule.early_cutoff.for_day_type(day.day_type)),
                late_cutoff=to_minutes(rules.bus_rule.late_cutoff.for_day_type(day.day_type)),
            )
        )

    employees = [e for e in project.employees if e.active]
    limits = {}
    for e in employees:
        o = e.overrides
        max_shift = o.max_shift_hours if o.max_shift_hours is not None else rules.max_shift_hours
        per_day = o.max_hours_per_day or rules.max_hours_per_day or max_shift
        limits[e.id] = Limits(
            min_shift=_hours(o.min_shift_hours, rules.min_shift_hours),
            max_shift=round(max_shift * 60),
            max_per_day=round(per_day * 60),
            min_rest=_hours(o.min_rest_hours, rules.min_rest_hours),
            max_consecutive_days=o.max_consecutive_days or rules.max_consecutive_days,
            max_weekly=_hours(o.max_weekly_hours, rules.max_weekly_hours),
        )

    with_car = [e.id for e in employees if e.has_car]
    drivers = {}
    for e in employees:
        if e.needs_ride_early or e.needs_ride_late:
            allowed = with_car if e.allowed_driver_ids is None else e.allowed_driver_ids
            drivers[e.id] = [d for d in allowed if d in with_car and d != e.id]

    targets = {eid: round(h * 60) for eid, h in team_targets(project, calendar).items()}
    return Context(
        project=project,
        days=days,
        employees=employees,
        limits=limits,
        targets={e.id: targets.get(e.id, 0) for e in employees},
        drivers=drivers,
    )


def minutes_since(moment: datetime, month_start: datetime) -> int:
    """Whole minutes from `moment` until the start of the month (negative if after)."""
    return int((month_start - moment) / timedelta(minutes=1))


def _guest_target(project: Project, day: date) -> int | None:
    demand = project.guest_demand
    guests = demand.guests_by_date.get(day)
    if not demand.enabled or guests is None:
        return None
    hours = guest_hours(guests, demand)
    return None if hours is None else round(hours * 60)


def _hours(override: float | None, default: float) -> int:
    return round((override if override is not None else default) * 60)


def _minutes(hours: float | None) -> int | None:
    return None if hours is None else round(hours * 60)
