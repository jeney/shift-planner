"""Tiny, explicit scenarios for rule tests."""

from datetime import date, datetime
from typing import Any

from shift_planner.domain.project import (
    AvailabilityEntry,
    DayHours,
    Employee,
    HourBalance,
    Plan,
    Project,
    Shift,
    StoreSettings,
    WeeklyOpeningHours,
)

DAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


def store(
    opens: str = "09:00",
    closes: str = "17:00",
    *,
    before: int = 0,
    after: int = 0,
    alone: bool = True,
    **changes: Any,
) -> StoreSettings:
    """Same hours every day (incl. holidays), no pre/post minutes, working alone allowed."""
    hours = {d: DayHours(opens=opens, closes=closes) for d in DAYS}
    return StoreSettings(
        opening_hours=WeeklyOpeningHours(**hours),
        public_holiday_hours=DayHours(opens=opens, closes=closes),
        staff_before_opening_min=before,
        staff_after_closing_min=after,
        allow_working_alone=alone,
        **changes,
    )


def employee(
    eid: str,
    hours: float = 20,
    *,
    car: bool = False,
    ride: bool = False,
    last_end: datetime | None = None,
    streak: int = 0,
    **changes: Any,
) -> Employee:
    return Employee(
        id=eid,
        name=eid.title(),
        color="#000000",
        contract_hours_per_week=hours,
        has_car=car,
        needs_ride_early=ride,
        balance=HourBalance(last_shift_ended_at=last_end, consecutive_days_at_start=streak),
        **changes,
    )


def project(
    *employees: Employee,
    month: str = "2027-02",
    store_settings: StoreSettings | None = None,
    rules: dict[str, Any] | None = None,
    availability: list[AvailabilityEntry] | None = None,
    time_limit: int = 3,
) -> Project:
    base = Project(id="p", month=month)
    return base.model_copy(
        update={
            "store": store_settings or store(),
            "employees": list(employees),
            "availability": availability or [],
            "rules": base.rules.model_copy(update=rules or {}),
            "solver": base.solver.model_copy(update={"time_limit_seconds": time_limit}),
        }
    )


def unavailable(eid: str, pattern: dict[str, Any], kind: str = "unavailable") -> AvailabilityEntry:
    return AvailabilityEntry.model_validate(
        {"id": f"{eid}-{pattern}", "employeeId": eid, "kind": kind, "pattern": pattern}
    )


def shift(eid: str, day: date | str, start: str, end: str) -> Shift:
    d = date.fromisoformat(day) if isinstance(day, str) else day
    return Shift(id=f"{eid}-{d}-{start}", employee_id=eid, date=d, start=start, end=end)


def plan(*shifts: Shift) -> Plan:
    return Plan(shifts=list(shifts))
