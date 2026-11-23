"""Pinned (hand-edited) shifts survive re-generation exactly as entered."""

from datetime import date

from shift_planner.domain.project import Plan, Project, Shift, SpecialDate
from shift_planner.domain.solve import SolveResponse
from shift_planner.solver.service import solve_project
from tests.factories import employee, project, shift, store, unavailable


def pinned(eid: str, day: str, start: str, end: str) -> Shift:
    return shift(eid, day, start, end).model_copy(update={"pinned": True})


def solve(p: Project, *shifts: Shift) -> SolveResponse:
    p.plan = Plan(shifts=list(shifts))
    result = solve_project(p, workers=4)
    assert result.plan is not None
    return result


def kept(result: SolveResponse, s: Shift) -> bool:
    assert result.plan is not None
    return s in result.plan.shifts


def test_pinned_off_grid_shift_is_kept_exactly_and_planned_around() -> None:
    edit = pinned("a", "2027-02-03", "09:10", "13:50")
    result = solve(project(employee("a"), employee("b"), employee("c")), edit)
    assert kept(result, edit)
    assert result.status in ("optimal", "feasible")
    assert [v for v in result.violations if v.severity == "error"] == []
    # The rest of Wednesday is still covered (09:00–17:00 store, working alone allowed).
    assert result.plan is not None
    others = [s for s in result.plan.shifts if s.date == date(2027, 2, 3) and s != edit]
    assert any(s.start <= "13:50" and s.end >= "17:00" for s in others)


def test_unpinned_shifts_from_the_old_plan_are_not_kept() -> None:
    stale = shift("a", "2027-02-03", "09:00", "17:00")  # not pinned
    p = project(employee("a"), employee("b"), employee("c"))
    p.plan = Plan(shifts=[stale])
    result = solve_project(p, workers=4)
    assert result.plan is not None
    assert all(s.id != stale.id for s in result.plan.shifts)


def test_a_pinned_shift_that_breaks_a_rule_is_kept_and_reported() -> None:
    edit = pinned("a", "2027-02-01", "09:00", "17:00")
    p = project(
        employee("a"),
        employee("b"),
        employee("c"),
        availability=[unavailable("a", {"type": "date", "date": "2027-02-01"})],
    )
    result = solve(p, edit)
    assert kept(result, edit)
    assert result.status == "best_effort"
    assert [(v.rule, v.employee_id) for v in result.violations if v.severity == "error"] == [
        ("unavailable", "a")
    ]


def test_pinned_shift_on_a_closed_day_is_passed_through() -> None:
    closed = SpecialDate(date=date(2027, 2, 2), enabled=True, closed=True)
    edit = pinned("a", "2027-02-02", "09:00", "13:00")
    p = project(
        employee("a"), employee("b"), employee("c"), store_settings=store(special_dates=[closed])
    )
    result = solve(p, edit)
    assert kept(result, edit)
    assert {v.rule for v in result.violations if v.severity == "error"} == {"store_closed"}


def test_two_pinned_shifts_on_one_day_are_both_kept() -> None:
    first = pinned("a", "2027-02-01", "09:00", "12:00")
    second = pinned("a", "2027-02-01", "13:00", "17:00")
    result = solve(project(employee("a"), employee("b"), employee("c")), first, second)
    assert kept(result, first) and kept(result, second)
    assert "too_many_shifts" in {v.rule for v in result.violations}
