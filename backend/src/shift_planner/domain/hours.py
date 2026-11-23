"""Opening hours and hour targets derived from a project."""

from dataclasses import dataclass

from shift_planner.domain.base import to_minutes
from shift_planner.domain.calendar import CalendarDay, MonthCalendar
from shift_planner.domain.project import DayHours, Employee, Project, Rules, StoreSettings

WEEKS_PER_MONTH = 52 / 12
MINUTES_PER_DAY = 24 * 60


@dataclass(frozen=True)
class StaffedWindow:
    """When staff must be present on a day, in minutes after midnight (end exclusive)."""

    start: int
    end: int

    @property
    def minutes(self) -> int:
        return self.end - self.start


def effective_hours(store: StoreSettings, day: CalendarDay) -> DayHours:
    """Opening hours for one day: an enabled special date wins, then public holiday hours,
    then the regular weekday hours."""
    for special in store.special_dates:
        if special.date == day.date and special.enabled:
            return DayHours(closed=special.closed, opens=special.opens, closes=special.closes)
    if day.holiday is not None:
        return store.public_holiday_hours
    return store.opening_hours.for_weekday(day.weekday)


def staffed_window(store: StoreSettings, day: CalendarDay) -> StaffedWindow | None:
    """Opening hours widened by the pre-opening and post-closing minutes; None if closed."""
    hours = effective_hours(store, day)
    if hours.closed:
        return None
    return StaffedWindow(
        start=max(0, to_minutes(hours.opens) - store.staff_before_opening_min),
        end=min(MINUTES_PER_DAY, to_minutes(hours.closes) + store.staff_after_closing_min),
    )


def month_factor(rules: Rules, calendar: MonthCalendar) -> float:
    """Weeks-per-month factor used to turn weekly contract hours into a monthly target."""
    match rules.monthly_target_mode:
        case "weeks_per_month":
            return WEEKS_PER_MONTH
        case "fixed_4_4":
            return 4.4
        case "actual_weekdays":
            return sum(1 for d in calendar.days if d.weekday < 5) / 5


def weekday_holidays(calendar: MonthCalendar) -> int:
    return sum(1 for d in calendar.days if d.holiday is not None and d.weekday < 5)


def monthly_target_hours(employee: Employee, rules: Rules, calendar: MonthCalendar) -> float:
    """Contract hours for the month, before the team adjustment. Inactive employees: 0."""
    if not employee.active:
        return 0.0
    weekly = employee.contract_hours_per_week
    target = weekly * month_factor(rules, calendar)
    if rules.holidays_reduce_target:
        target -= weekly / 5 * weekday_holidays(calendar)
    return max(0.0, target)


def team_targets(project: Project, calendar: MonthCalendar) -> dict[str, float]:
    """Monthly target per employee, with the team adjustment spread in proportion to
    contract hours."""
    base = {e.id: monthly_target_hours(e, project.rules, calendar) for e in project.employees}
    total = sum(base.values())
    adjustment = project.rules.team_adjustment_hours
    if total <= 0 or adjustment == 0:
        return base
    return {eid: max(0.0, hours + adjustment * hours / total) for eid, hours in base.items()}
