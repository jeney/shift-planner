"""Guest-based demand: a soft daily staff-hours target."""

from datetime import date

from shift_planner.domain.base import to_minutes
from shift_planner.domain.project import GuestDemand, GuestPoint, Project
from shift_planner.solver.checker import check_plan
from shift_planner.solver.context import build_context
from shift_planner.solver.diagnostics import precheck
from shift_planner.solver.service import solve_project
from tests.factories import employee, plan, project, shift, store

MON = date(2027, 2, 1)


def with_guests(p: Project, guests: dict[date, int], enabled: bool = True) -> Project:
    p.guest_demand = GuestDemand(
        enabled=enabled,
        points=[GuestPoint(guests=0, hours=8), GuestPoint(guests=1000, hours=24)],
        tolerance_hours=1,
        guests_by_date=guests,
    )
    return p


def day_hours(p: Project, day: date) -> float:
    assert p.plan is not None
    return sum(
        (to_minutes(s.end) - to_minutes(s.start)) / 60 for s in p.plan.shifts if s.date == day
    )


def test_planner_staffs_up_toward_the_guest_target() -> None:
    # 09–17 needs only 8 h with one person; 1000 guests ask for 24 h (± 1 h) on Monday.
    p = with_guests(
        project(*(employee(x, hours=40) for x in "abcd"), time_limit=6),
        {MON: 1000, date(2027, 2, 2): 0},
    )
    result = solve_project(p, workers=4)
    assert result.plan is not None
    p.plan = result.plan
    assert 23 <= day_hours(p, MON) <= 25
    assert day_hours(p, date(2027, 2, 2)) <= 9


def test_targets_are_ignored_when_the_feature_is_off() -> None:
    p = with_guests(project(employee("a")), {MON: 1000}, enabled=False)
    assert build_context(p).days[0].guest_target is None


def test_missing_the_target_is_a_warning() -> None:
    p = with_guests(project(employee("a"), employee("b")), {MON: 1000})
    violations = check_plan(p, plan(shift("a", MON, "09:00", "17:00")))
    [v] = [v for v in violations if v.rule == "guest_hours_below"]
    assert (v.severity, v.amount) == ("warning", 15.0)  # 8 h planned vs 24 − 1
    assert v.params == {"target": 24.0, "tolerance": 1.0, "planned": 8.0, "guests": 1000}


def test_guest_targets_stay_soft_even_with_hard_daily_limits() -> None:
    s = store()
    s.daily_hours_hard = True
    p = with_guests(project(employee("a"), employee("b"), store_settings=s), {MON: 1000})
    violations = check_plan(p, plan(shift("a", MON, "09:00", "17:00")))
    assert [v.severity for v in violations if v.rule.startswith("guest_")] == ["warning"]


def test_precheck_warns_about_days_without_guest_counts() -> None:
    p = with_guests(project(employee("a"), employee("b")), {MON: 800})
    [d] = [d for d in precheck(build_context(p)) if d.code == "guest_counts_missing"]
    assert (d.severity, d.params) == ("warning", {"count": 27, "first": "2027-02-02"})
