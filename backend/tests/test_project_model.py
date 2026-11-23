from typing import Any

import pytest
from pydantic import ValidationError

from shift_planner.domain.project import Project


def minimal(**overrides: Any) -> dict[str, Any]:
    raw: dict[str, Any] = {"schemaVersion": 3, "id": "p1", "month": "2027-02"}
    raw.update(overrides)
    return raw


EMPLOYEE = {"id": "e1", "name": "Test Person", "color": "#123456", "contractHoursPerWeek": 20}


def test_defaults_match_store_decisions() -> None:
    project = Project.model_validate(minimal())
    hours = project.store.opening_hours
    assert (hours.monday.opens, hours.monday.closes) == ("07:00", "20:00")
    assert (hours.friday.opens, hours.friday.closes) == ("07:00", "20:00")
    for day in (hours.tuesday, hours.wednesday, hours.thursday, hours.saturday, hours.sunday):
        assert (day.opens, day.closes, day.closed) == ("07:00", "18:00", False)
    assert (
        project.store.public_holiday_hours.opens,
        project.store.public_holiday_hours.closes,
    ) == (
        "07:00",
        "18:00",
    )
    assert project.store.staff_before_opening_min == 60
    assert project.store.staff_after_closing_min == 30
    assert project.store.allow_working_alone is False
    assert project.store.special_dates == []
    assert project.store.daily_hours_hard is False

    rules = project.rules
    assert rules.granularity_min == 30
    assert (rules.min_shift_hours, rules.max_shift_hours) == (3, 8)
    assert rules.max_hours_per_day is None
    assert rules.one_shift_per_day is True
    assert rules.min_rest_hours == 11
    assert rules.max_consecutive_days == 6
    assert rules.max_weekly_hours == 48
    assert rules.full_time_contract_warning is True
    assert rules.monthly_tolerance_hours == 2
    assert rules.balancing_period_weeks == 16
    assert rules.monthly_target_mode == "weeks_per_month"
    assert rules.holidays_reduce_target is False
    assert rules.breaks.enabled is False
    assert rules.bus_rule.enabled is True
    assert rules.bus_rule.early_cutoff.weekday == "06:30"
    assert rules.bus_rule.late_enabled is False
    assert project.guest_demand.enabled is False
    assert project.solver.time_limit_seconds == 20


def test_json_uses_camel_case_and_round_trips() -> None:
    project = Project.model_validate(minimal(employees=[EMPLOYEE]))
    dumped = project.model_dump(mode="json")
    assert "schemaVersion" in dumped
    assert "contractHoursPerWeek" in dumped["employees"][0]
    assert "staffBeforeOpeningMin" in dumped["store"]
    assert Project.model_validate(dumped) == project


def test_accepts_snake_case_too() -> None:
    project = Project.model_validate(
        {"schema_version": 3, "id": "p1", "month": "2027-02", "solver": {"time_limit_seconds": 5}}
    )
    assert project.solver.time_limit_seconds == 5


@pytest.mark.parametrize(
    "raw",
    [
        pytest.param(minimal(month="2027-13"), id="bad month"),
        pytest.param(minimal(unexpected=True), id="unknown field"),
        pytest.param(
            minimal(store={"openingHours": {"monday": {"opens": "18:00", "closes": "07:00"}}}),
            id="opens after closes",
        ),
        pytest.param(
            minimal(store={"publicHolidayHours": {"opens": "25:00", "closes": "26:00"}}),
            id="invalid time",
        ),
        pytest.param(
            minimal(
                store={
                    "specialDates": [
                        {"date": "2027-02-03", "enabled": True},
                        {"date": "2027-02-03", "closed": True},
                    ]
                }
            ),
            id="duplicate special date",
        ),
        pytest.param(minimal(rules={"minShiftHours": 9}), id="min shift > max shift"),
        pytest.param(minimal(rules={"granularityMin": 20}), id="granularity not 15/30/60"),
        pytest.param(minimal(employees=[EMPLOYEE, EMPLOYEE]), id="duplicate employee"),
        pytest.param(
            minimal(employees=[{**EMPLOYEE, "allowedDriverIds": ["ghost"]}]), id="unknown driver"
        ),
        pytest.param(
            minimal(
                availability=[
                    {
                        "id": "a1",
                        "employeeId": "ghost",
                        "kind": "unavailable",
                        "pattern": {"type": "weekly", "weekday": 0},
                    }
                ]
            ),
            id="availability for unknown employee",
        ),
        pytest.param(
            minimal(
                employees=[EMPLOYEE],
                availability=[
                    {
                        "id": "a1",
                        "employeeId": "e1",
                        "kind": "wish_off",
                        "pattern": {"type": "weekly", "weekday": 7},
                    }
                ],
            ),
            id="weekday out of range",
        ),
        pytest.param(
            minimal(
                employees=[EMPLOYEE],
                availability=[
                    {
                        "id": "a1",
                        "employeeId": "e1",
                        "kind": "unavailable",
                        "pattern": {
                            "type": "range",
                            "startDate": "2027-02-10",
                            "endDate": "2027-02-01",
                        },
                    }
                ],
            ),
            id="reversed date range",
        ),
        pytest.param(
            minimal(
                employees=[EMPLOYEE],
                plan={
                    "shifts": [
                        {
                            "id": "s1",
                            "employeeId": "e1",
                            "date": "2027-03-01",
                            "start": "07:00",
                            "end": "12:00",
                        }
                    ]
                },
            ),
            id="shift outside month",
        ),
        pytest.param(
            minimal(
                employees=[EMPLOYEE],
                plan={
                    "shifts": [
                        {
                            "id": "s1",
                            "employeeId": "e1",
                            "date": "2027-02-01",
                            "start": "12:00",
                            "end": "12:00",
                        }
                    ]
                },
            ),
            id="empty shift",
        ),
    ],
)
def test_rejects_invalid_projects(raw: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        Project.model_validate(raw)


def test_time_windows_are_optional_and_24_00_is_end_of_day() -> None:
    project = Project.model_validate(
        minimal(
            employees=[EMPLOYEE],
            availability=[
                {
                    "id": "a1",
                    "employeeId": "e1",
                    "kind": "unavailable",
                    "pattern": {"type": "weekly", "weekday": 0, "start": "16:00"},
                },
                {
                    "id": "a2",
                    "employeeId": "e1",
                    "kind": "wish_work",
                    "pattern": {"type": "date", "date": "2027-02-06", "end": "24:00"},
                },
            ],
        )
    )
    assert project.availability[0].pattern.type == "weekly"


def test_guest_points_are_sorted() -> None:
    project = Project.model_validate(
        minimal(
            guestDemand={
                "points": [{"guests": 1500, "hours": 30}, {"guests": 1000, "hours": 20}],
            }
        )
    )
    assert [p.guests for p in project.guest_demand.points] == [1000, 1500]
