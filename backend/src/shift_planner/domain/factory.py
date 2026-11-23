"""Builders for new and demo projects. All demo data is fictional."""

import uuid
from calendar import monthrange

from shift_planner.domain.calendar import parse_month
from shift_planner.domain.project import (
    AvailabilityEntry,
    AvailabilityKind,
    AvailabilityPattern,
    DateRangePattern,
    Employee,
    HourBalance,
    Project,
    SingleDatePattern,
    StoreSettings,
    TimeRangeMinimum,
    WeeklyPattern,
)

EMPLOYEE_COLORS = [
    "#2563eb",
    "#16a34a",
    "#d97706",
    "#dc2626",
    "#7c3aed",
    "#0891b2",
    "#db2777",
    "#65a30d",
    "#ea580c",
    "#4f46e5",
]


def new_id() -> str:
    return str(uuid.uuid4())


def new_project(month: str) -> Project:
    """An empty project with all defaults."""
    return Project(id=new_id(), month=month)


def demo_project(month: str) -> Project:
    """A realistic, fictional team: 2 full-timers, 4 part-timers and 3 student workers."""
    year, mon = parse_month(month)
    last_day = monthrange(year, mon)[1]

    def day(n: int) -> str:
        return f"{month}-{min(n, last_day):02d}"

    # (name, weekly hours, has car, needs ride early, carry-in, week of balancing period)
    team = [
        ("Anna Holm", 40, True, False, 3.5, 6),
        ("Bence Kovács", 40, True, False, -2.0, 6),
        ("Clara Jensen", 20, True, False, 1.0, 10),
        ("David Nagy", 20, False, True, -4.5, 14),
        ("Emma Larsen", 20, True, False, 0.0, 2),
        ("Frederik Berg", 20, False, False, 6.0, 15),
        ("Greta Møller", 10, False, True, -1.5, 6),
        ("Hanna Tóth", 10, False, False, 2.0, 3),
        ("Isak Lund", 10, True, False, 0.0, 1),
    ]
    employees = [
        Employee(
            id=new_id(),
            name=name,
            color=EMPLOYEE_COLORS[i],
            contract_hours_per_week=hours,
            has_car=car,
            needs_ride_early=ride,
            balance=HourBalance(carry_in_hours=carry, period_week=week),
        )
        for i, (name, hours, car, ride, carry, week) in enumerate(team)
    ]
    by_name = {e.name.split()[0]: e.id for e in employees}

    def entry(
        who: str, kind: AvailabilityKind, pattern: AvailabilityPattern, note: str = ""
    ) -> AvailabilityEntry:
        return AvailabilityEntry(
            id=new_id(), employee_id=by_name[who], kind=kind, pattern=pattern, note=note
        )

    availability = [
        entry("Bence", "unavailable", SingleDatePattern.model_validate({"date": day(5)})),
        entry(
            "Clara",
            "unavailable",
            DateRangePattern.model_validate({"startDate": day(10), "endDate": day(16)}),
            "Vacation",
        ),
        entry("Greta", "unavailable", WeeklyPattern(weekday=0, start="16:00"), "Evening class"),
        entry("Hanna", "unavailable", WeeklyPattern(weekday=1), "University"),
        entry("Hanna", "unavailable", WeeklyPattern(weekday=3), "University"),
        entry("Isak", "unavailable", WeeklyPattern(weekday=2, start="08:00", end="15:00")),
        entry("David", "wish_off", SingleDatePattern.model_validate({"date": day(20)})),
        entry("Anna", "wish_off", SingleDatePattern.model_validate({"date": day(24)})),
        entry("Frederik", "wish_off", WeeklyPattern(weekday=6)),
        entry("Emma", "wish_work", WeeklyPattern(weekday=5)),
    ]

    store = StoreSettings(
        name="Demo Bakery",
        time_range_minimums=[
            TimeRangeMinimum(
                id=new_id(), day_types=["saturday"], start="11:00", end="14:00", min_people=2
            )
        ],
    )
    return Project(
        id=new_id(),
        name="Demo plan",
        month=month,
        store=store,
        employees=employees,
        availability=availability,
    )
