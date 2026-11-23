"""Pre-check diagnostics: each code fires on a tiny scenario, and never on the demo team."""

from datetime import date

import pytest

from shift_planner.domain.factory import demo_project
from shift_planner.domain.project import Project, TimeRangeMinimum
from shift_planner.domain.solve import Diagnostic
from shift_planner.solver.context import build_context
from shift_planner.solver.diagnostics import precheck
from tests.factories import employee, project, store, unavailable

MON = date(2027, 2, 1)


def run(p: Project) -> list[Diagnostic]:
    return precheck(build_context(p))


def codes(p: Project) -> set[str]:
    return {d.code for d in run(p)}


def on(diagnostics: list[Diagnostic], code: str, day: date | None = None) -> list[Diagnostic]:
    return [d for d in diagnostics if d.code == code and (day is None or d.date == day)]


@pytest.mark.parametrize("month", ["2026-12", "2027-02", "2027-03"])
def test_no_false_alarms_for_the_demo_team(month: str) -> None:
    assert run(demo_project(month)) == []


def test_no_employees() -> None:
    assert codes(project()) == {"no_employees"}


def test_opening_needs_more_people_than_are_available() -> None:
    s = store()
    s.staffing.weekday.min_at_opening = 2
    p = project(
        employee("a"),
        employee("b"),
        store_settings=s,
        availability=[unavailable("b", {"type": "date", "date": "2027-02-01"})],
    )
    [d] = on(run(p), "opening_short", MON)
    assert (d.severity, d.employee_ids, d.params) == (
        "error",
        ["b"],
        {"time": "09:00", "required": 2, "available": 1},
    )
    assert on(run(p), "opening_short", date(2027, 2, 2)) == []


def test_closing_needs_more_people_than_are_available() -> None:
    s = store()
    s.staffing.weekday.min_at_closing = 3
    p = project(*(employee(x) for x in "ab"), store_settings=s)
    [d] = on(run(p), "closing_short", MON)
    assert d.params == {"time": "17:00", "required": 3, "available": 2}


def test_nobody_alone_with_a_part_day_absence() -> None:
    p = project(
        employee("a"),
        employee("b"),
        store_settings=store(alone=False),
        availability=[unavailable("b", {"type": "date", "date": "2027-02-01", "start": "12:00"})],
    )
    [d] = on(run(p), "moment_short", MON)
    assert d.params == {"time": "12:00", "required": 2, "available": 1}


def test_busy_period() -> None:
    busy = TimeRangeMinimum(
        id="r", day_types=["saturday"], start="11:00", end="14:00", min_people=3
    )
    p = project(employee("a"), employee("b"), store_settings=store(time_range_minimums=[busy]))
    saturdays = on(run(p), "busy_period_short")
    assert [d.date for d in saturdays] == [date(2027, 2, d) for d in (6, 13, 20, 27)]


def test_staffed_day_shorter_than_the_minimum_shift() -> None:
    p = project(employee("a"), employee("b"), store_settings=store("09:00", "11:00"))
    assert len(on(run(p), "window_shorter_than_min_shift")) == 28


def test_not_enough_people_to_cover_a_long_day() -> None:
    # 06–22 with 2 people at all times and 8-hour shifts needs 4 people a day.
    p = project(*(employee(x) for x in "abc"), store_settings=store("06:00", "22:00", alone=False))
    [d, *_] = on(run(p), "day_short_of_people")
    assert d.params == {"required": 4, "available": 3}


def test_not_enough_working_days() -> None:
    [d] = on(run(project(employee("a"))), "not_enough_working_days")
    assert d.params == {"required": 28, "available": 24}  # 28 days, one off in every 7


def test_contract_hours_far_below_or_above_demand() -> None:
    low = project(
        employee("a", hours=10), employee("b", hours=10), store_settings=store(alone=False)
    )
    [d] = on(run(low), "hours_below_demand")
    assert d.severity == "warning"
    assert d.params["demand"] == 448.0  # 2 people × 8 h × 28 days

    high = project(*(employee(x, hours=40) for x in "abcdefgh"))
    assert on(run(high), "hours_above_demand")


def test_rides() -> None:
    nobody = project(
        employee("rider", ride=True), employee("a"), store_settings=store("06:00", "14:00")
    )
    assert [d.employee_ids for d in on(run(nobody), "rider_without_driver")] == [["rider"]]

    p = project(
        employee("rider", ride=True),
        employee("driver", car=True),
        employee("a"),
        store_settings=store("06:00", "14:00"),
        availability=[unavailable("driver", {"type": "date", "date": "2027-02-01"})],
    )
    [d] = on(run(p), "no_driver_early")
    assert (d.date, d.severity, d.params["cutoff"]) == (MON, "warning", "06:30")
