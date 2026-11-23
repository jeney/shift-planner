"""When no plan follows every rule: a best-effort plan with the broken rules listed."""

from collections import Counter

from shift_planner.domain.project import Project
from shift_planner.domain.solve import SolveResponse
from shift_planner.solver.service import solve_project
from tests.factories import employee, project, store


def solve(p: Project) -> SolveResponse:
    result = solve_project(p, workers=4)
    assert result.status == "best_effort"
    assert result.plan is not None and result.plan.shifts
    return result


def broken(result: SolveResponse) -> Counter[str]:
    return Counter(v.rule for v in result.violations if v.severity == "error")


def test_one_person_cannot_work_every_day_so_some_days_stay_unstaffed() -> None:
    result = solve(project(employee("a")))
    rules = broken(result)
    # Labour law (days in a row) is kept; the plan shows the uncovered days instead.
    assert "too_many_days_in_a_row" not in rules
    assert rules["understaffed"] >= 4  # at least one uncovered day per week
    assert any(d.code == "not_enough_working_days" for d in result.diagnostics)


def test_rider_without_a_driver_leaves_a_short_gap_rather_than_breaking_the_ride_rule() -> None:
    p = project(
        employee("rider", ride=True),
        employee("walker"),
        employee("walker2"),
        store_settings=store("06:00", "14:00", alone=False),
        time_limit=5,
    )
    cutoffs = {"weekday": "06:30", "saturday": "06:30", "sunday": "06:30", "holiday": "06:30"}
    p.rules.bus_rule.early_cutoff = p.rules.bus_rule.early_cutoff.model_copy(update=cutoffs)
    rules = broken(solve(p))
    assert "no_ride_early" not in rules
    assert set(rules) <= {"understaffed", "opening_understaffed"}


def test_hard_daily_limits_are_reported() -> None:
    s = store("09:00", "17:00")
    s.staffing.weekday.daily_hours_max = 4
    s.daily_hours_hard = True
    rules = broken(solve(project(*(employee(x) for x in "abc"), store_settings=s)))
    assert set(rules) & {"daily_hours_above_max", "understaffed"}


def test_a_feasible_month_is_not_best_effort() -> None:
    result = solve_project(project(employee("a"), employee("b")), workers=4)
    assert result.status in ("optimal", "feasible")
    assert all(d.severity == "warning" for d in result.diagnostics)
