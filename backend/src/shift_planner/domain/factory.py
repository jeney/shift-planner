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
    """A fictional team: 3 full-timers (40 h), 2 part-timers (20 h) and 4 student workers
    (10 h). Some have no car; Ioannis and Emilia need a ride to early shifts."""
    year, mon = parse_month(month)
    last_day = monthrange(year, mon)[1]

    def day(n: int) -> str:
        return f"{month}-{min(n, last_day):02d}"

    # (name, weekly hours, has car, needs ride early, carry-in, week of balancing period)
    team = [
        ("Sophie", 40, True, False, 3.5, 6),
        ("Lykke", 40, True, False, -2.0, 6),
        ("Oliver", 40, True, False, 1.0, 10),
        ("Ioannis", 20, False, True, -4.5, 14),
        ("Signe", 20, True, False, 0.0, 2),
        ("Emilia", 10, False, True, -1.5, 6),
        ("Örs", 10, False, False, 2.0, 3),
        ("Jana", 10, True, False, 0.0, 1),
        ("Miguel", 10, False, False, 1.5, 15),
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
    by_name = {e.name: e.id for e in employees}

    def entry(
        who: str, kind: AvailabilityKind, pattern: AvailabilityPattern, note: str = ""
    ) -> AvailabilityEntry:
        return AvailabilityEntry(
            id=new_id(), employee_id=by_name[who], kind=kind, pattern=pattern, note=note
        )

    availability = [
        entry("Lykke", "unavailable", SingleDatePattern.model_validate({"date": day(5)})),
        entry(
            "Oliver",
            "unavailable",
            DateRangePattern.model_validate({"startDate": day(10), "endDate": day(16)}),
            "Vacation",
        ),
        entry("Emilia", "unavailable", WeeklyPattern(weekday=0, start="16:00"), "Evening class"),
        entry("Örs", "unavailable", WeeklyPattern(weekday=1), "University"),
        entry("Örs", "unavailable", WeeklyPattern(weekday=3), "University"),
        entry("Jana", "unavailable", WeeklyPattern(weekday=2, start="08:00", end="15:00")),
        entry("Ioannis", "wish_off", SingleDatePattern.model_validate({"date": day(20)})),
        entry("Sophie", "wish_off", SingleDatePattern.model_validate({"date": day(24)})),
        entry("Miguel", "wish_off", WeeklyPattern(weekday=6)),
        entry("Signe", "wish_work", WeeklyPattern(weekday=5)),
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
