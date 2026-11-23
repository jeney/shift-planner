"""The solver respects every hard rule (verified with the independent checker)."""

import itertools
from collections import defaultdict
from datetime import date, datetime, timedelta

import pytest

from shift_planner.domain.base import to_minutes
from shift_planner.domain.factory import demo_project
from shift_planner.domain.project import (
    BreakRule,
    BreakSettings,
    Project,
    Shift,
    TimeRangeMinimum,
)
from shift_planner.domain.solve import SolveResponse
from shift_planner.solver.service import solve_project
from tests.factories import employee, project, store, unavailable


def solve(p: Project, strict: bool = True) -> SolveResponse:
    result = solve_project(p, workers=4)
    if result.plan is not None and strict:
        errors = [v for v in result.violations if v.severity == "error"]
        assert errors == [], "solver output must pass the checker"
    return result


def shifts_of(result: SolveResponse, eid: str | None = None) -> list[Shift]:
    assert result.plan is not None
    return [s for s in result.plan.shifts if eid is None or s.employee_id == eid]


def minutes(s: Shift) -> int:
    return to_minutes(s.end) - to_minutes(s.start)


def present(shifts: list[Shift], day: date, t: str) -> int:
    m = to_minutes(t)
    return sum(1 for s in shifts if s.date == day and to_minutes(s.start) <= m < to_minutes(s.end))


def test_covers_every_open_day() -> None:
    result = solve(project(employee("a"), employee("b")))
    assert result.status in ("optimal", "feasible")
    days = {s.date for s in shifts_of(result)}
    assert len(days) == 28  # February 2027


def test_shifts_stay_on_the_grid_and_within_length_limits() -> None:
    p = project(
        employee("a"),
        employee("b"),
        employee("c"),
        store_settings=store("08:00", "20:00"),
        rules={"min_shift_hours": 4, "max_shift_hours": 6, "granularity_min": 60},
    )
    for s in shifts_of(solve(p)):
        assert 240 <= minutes(s) <= 360
        assert to_minutes(s.start) % 60 == 0 and to_minutes(s.end) % 60 == 0


def test_no_one_works_alone() -> None:
    p = project(employee("a"), employee("b"), employee("c"), store_settings=store(alone=False))
    result = solve(p)
    shifts = shifts_of(result)
    for day in {s.date for s in shifts}:
        for t in ("09:00", "12:30", "16:30"):
            assert present(shifts, day, t) >= 2


def test_opening_and_closing_minimums() -> None:
    s = store("09:00", "21:00")
    s.staffing.weekday.min_at_opening = 2
    s.staffing.weekday.min_at_closing = 3
    # Larger scenarios need more than the 3 s default to find a first plan.
    result = solve(project(*(employee(x) for x in "abcdefgh"), store_settings=s, time_limit=15))
    shifts = shifts_of(result)
    monday = date(2027, 2, 1)
    assert present(shifts, monday, "09:00") >= 2
    assert present(shifts, monday, "20:59") >= 3


def test_busy_period() -> None:
    busy = TimeRangeMinimum(
        id="r", day_types=["saturday"], start="11:00", end="14:00", min_people=2
    )
    p = project(*(employee(x) for x in "abc"), store_settings=store(time_range_minimums=[busy]))
    shifts = shifts_of(solve(p))
    saturday = date(2027, 2, 6)
    assert all(present(shifts, saturday, t) >= 2 for t in ("11:00", "12:30", "13:30"))


def test_hard_unavailability_whole_day_and_window() -> None:
    p = project(
        employee("a"),
        employee("b"),
        availability=[
            unavailable("a", {"type": "weekly", "weekday": 0}),
            unavailable("b", {"type": "weekly", "weekday": 1, "start": "13:00"}),
        ],
    )
    result = solve(p)
    assert all(s.date.weekday() != 0 for s in shifts_of(result, "a"))
    for s in shifts_of(result, "b"):
        if s.date.weekday() == 1:
            assert to_minutes(s.end) <= to_minutes("13:00")


def test_rest_between_days_and_from_last_month() -> None:
    p = project(
        employee("a", last_end=datetime(2027, 1, 31, 22, 0)),
        *(employee(x) for x in "bcd"),
        store_settings=store("06:00", "22:00"),
        time_limit=15,
    )
    result = solve(p)
    by_employee: dict[str, list[Shift]] = defaultdict(list)
    for s in shifts_of(result):
        by_employee[s.employee_id].append(s)
    for shifts in by_employee.values():
        for a, b in itertools.pairwise(sorted(shifts, key=lambda s: (s.date, s.start))):
            end = datetime.combine(a.date, datetime.min.time()) + timedelta(
                minutes=to_minutes(a.end)
            )
            start = datetime.combine(b.date, datetime.min.time()) + timedelta(
                minutes=to_minutes(b.start)
            )
            assert start - end >= timedelta(hours=11)
    first = [s for s in by_employee["a"] if s.date == date(2027, 2, 1)]
    assert all(to_minutes(s.start) >= to_minutes("09:00") for s in first)


def test_never_a_seventh_day_in_a_row() -> None:
    result = solve(project(employee("a"), employee("b")))
    for eid in "ab":
        worked = {s.date for s in shifts_of(result, eid)}
        streak = 0
        for d in range(1, 29):
            streak = streak + 1 if date(2027, 2, d) in worked else 0
            assert streak <= 6


def test_days_in_a_row_carried_in_from_last_month() -> None:
    result = solve(project(employee("a", streak=6), employee("b")))
    assert all(s.date != date(2027, 2, 1) for s in shifts_of(result, "a"))


def test_one_person_cannot_cover_every_day() -> None:
    """Seven open days a week with a single employee breaks the days-in-a-row limit."""
    result = solve(project(employee("a")), strict=False)
    assert result.status == "best_effort"


def test_weekly_limit_on_the_partial_first_week() -> None:
    # Fri 1 – Sun 3 January 2027 is a 3-day week; 16 h allows only two 8-hour shifts.
    p = project(
        *(employee(x, hours=40) for x in "abcd"),
        month="2027-01",
        rules={"max_weekly_hours": 16, "min_shift_hours": 8},
    )
    result = solve(p)
    assert result.status != "infeasible"
    for eid in "abcd":
        first_week = [s for s in shifts_of(result, eid) if s.date.day <= 3]
        assert len(first_week) <= 2


class TestBusRule:
    def bus_project(self, *, opens: str, with_driver: bool) -> Project:
        s = store(opens, "14:00", alone=False)
        # Two walkers and (optionally) two drivers, so nobody has to work every day.
        people = [employee("rider", ride=True), employee("walker"), employee("walker2")]
        if with_driver:
            people += [employee("driver", car=True), employee("driver2", car=True)]
        cutoffs = {"weekday": "06:30", "saturday": "06:30", "sunday": "06:30", "holiday": "06:30"}
        p = project(*people, store_settings=s)
        p.rules.bus_rule.early_cutoff = p.rules.bus_rule.early_cutoff.model_copy(update=cutoffs)
        return p

    def test_early_start_needs_a_driver_at_the_same_time(self) -> None:
        result = solve(self.bus_project(opens="06:00", with_driver=True))
        shifts = shifts_of(result)
        early = [s for s in shifts if s.employee_id == "rider" and s.start < "06:30"]
        assert early, "the scenario should make the rider open sometimes"
        for s in early:
            assert any(
                d.employee_id.startswith("driver") and d.date == s.date and d.start == s.start
                for d in shifts
            )

    def test_without_any_driver_the_rider_never_starts_early(self) -> None:
        # Only the two walkers can open, so they'd both work every day: impossible.
        result = solve(self.bus_project(opens="06:00", with_driver=False), strict=False)
        assert result.status == "best_effort"
        assert all(v.rule != "no_ride_early" for v in result.violations)

    def test_late_starts_need_no_driver(self) -> None:
        result = solve(self.bus_project(opens="08:00", with_driver=False))
        assert result.status in ("optimal", "feasible")


def test_unpaid_breaks_count_toward_stats() -> None:
    p = project(
        employee("a", hours=40),
        employee("b", hours=40),
        rules={
            "min_shift_hours": 8,
            "breaks": BreakSettings(
                enabled=True, paid=False, rules=[BreakRule(after_hours=6, minutes=30)]
            ),
        },
    )
    result = solve(p)
    stats = {s.employee_id: s for s in result.stats}
    shifts = len(shifts_of(result, "a"))
    assert stats["a"].planned_hours == pytest.approx(shifts * 7.5)


def test_stats_and_balance() -> None:
    p = project(employee("a", hours=20), employee("b", hours=20))
    p.employees[0].balance.carry_in_hours = 3
    result = solve(p)
    a = next(s for s in result.stats if s.employee_id == "a")
    assert a.target_hours == pytest.approx(20 * 52 / 12, abs=0.01)
    assert a.deviation_hours == pytest.approx(a.planned_hours - a.target_hours, abs=0.01)
    assert a.new_balance_hours == pytest.approx(3 + a.deviation_hours, abs=0.01)


@pytest.mark.slow
def test_performance_demo_team_for_a_31_day_month() -> None:
    """10 employees × 31 days: a valid plan within the default 20 s time limit."""
    p = demo_project("2027-03")
    p.employees.append(employee("extra", hours=20, car=True))
    result = solve(p)
    assert result.status in ("optimal", "feasible")
    assert result.solve_time_ms <= (p.solver.time_limit_seconds + 5) * 1000
