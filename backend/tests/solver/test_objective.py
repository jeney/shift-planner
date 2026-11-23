"""The objective: wishes, hour-balance steering, soft daily targets and tie-breakers."""

import itertools
from datetime import date, datetime, timedelta

import pytest

from shift_planner.domain.base import to_minutes
from shift_planner.domain.project import Project
from shift_planner.domain.solve import EmployeeStats, SolveResponse
from shift_planner.solver.checker import check_plan
from shift_planner.solver.context import build_context
from shift_planner.solver.model import period_progress
from shift_planner.solver.service import solve_project
from shift_planner.solver.wishes import wish_outcomes
from tests.factories import employee, plan, project, shift, store, unavailable

MON = "2027-02-01"


def solve(p: Project) -> SolveResponse:
    result = solve_project(p, workers=4)
    assert result.plan is not None
    assert [v for v in result.violations if v.severity == "error"] == []
    return result


def stats(result: SolveResponse, eid: str) -> EmployeeStats:
    return next(s for s in result.stats if s.employee_id == eid)


def worked_on(result: SolveResponse, eid: str, day: date) -> list[tuple[str, str]]:
    assert result.plan is not None
    return [(s.start, s.end) for s in result.plan.shifts if s.employee_id == eid and s.date == day]


class TestWishes:
    def test_day_off_wishes_are_honoured(self) -> None:
        p = project(
            *(employee(x) for x in "abc"),
            availability=[
                unavailable("a", {"type": "date", "date": MON}, kind="wish_off"),
                unavailable("b", {"type": "weekly", "weekday": 6}, kind="wish_off"),
            ],
            time_limit=5,
        )
        result = solve(p)
        assert worked_on(result, "a", date(2027, 2, 1)) == []
        assert all(not worked_on(result, "b", date(2027, 2, d)) for d in (7, 14, 21, 28))
        assert (stats(result, "b").wishes_honoured, stats(result, "b").wishes_total) == (4, 4)

    def test_part_day_wish(self) -> None:
        p = project(
            *(employee(x) for x in "abc"),
            availability=[
                unavailable("a", {"type": "weekly", "weekday": 0, "start": "13:00"}, "wish_off")
            ],
            time_limit=5,
        )
        result = solve(p)
        for d in (1, 8, 15, 22):
            assert all(end <= "13:00" for _, end in worked_on(result, "a", date(2027, 2, d)))

    def test_work_wishes_are_honoured(self) -> None:
        p = project(
            *(employee(x) for x in "abc"),
            availability=[unavailable("c", {"type": "weekly", "weekday": 5}, kind="wish_work")],
            time_limit=5,
        )
        result = solve(p)
        assert all(worked_on(result, "c", date(2027, 2, d)) for d in (6, 13, 20, 27))
        assert stats(result, "c").wishes_honoured == 4

    def test_a_wish_gives_way_to_hard_rules(self) -> None:
        # b and c can't work on Monday, so a must, despite wishing for the day off.
        p = project(
            *(employee(x) for x in "abc"),
            availability=[
                unavailable("a", {"type": "date", "date": MON}, kind="wish_off"),
                unavailable("b", {"type": "date", "date": MON}),
                unavailable("c", {"type": "date", "date": MON}),
            ],
            time_limit=5,
        )
        result = solve(p)
        assert worked_on(result, "a", date(2027, 2, 1))
        assert (stats(result, "a").wishes_honoured, stats(result, "a").wishes_total) == (0, 1)

    def test_wish_outcomes_for_a_hand_made_plan(self) -> None:
        p = project(
            employee("a"),
            availability=[
                unavailable("a", {"type": "date", "date": MON, "start": "14:00"}, "wish_off"),
                unavailable("a", {"type": "date", "date": "2027-02-02"}, kind="wish_work"),
            ],
        )
        outcomes = wish_outcomes(build_context(p), plan(shift("a", MON, "09:00", "14:00")))
        assert [(o.kind, o.honoured) for o in outcomes] == [
            ("wish_off", True),
            ("wish_work", False),
        ]


class TestHourBalance:
    @staticmethod
    def balance_project(**weights: float) -> Project:
        a = employee("a", hours=20)
        b = employee("b", hours=20)
        c = employee("c", hours=20)
        a.balance.carry_in_hours, a.balance.period_week = 6, 16
        b.balance.carry_in_hours, b.balance.period_week = -6, 16
        p = project(a, b, c, time_limit=6)
        p.weights = p.weights.model_copy(update=weights)
        return p

    def test_steers_toward_zero_within_the_monthly_tolerance(self) -> None:
        result = solve(self.balance_project())
        a, b = stats(result, "a"), stats(result, "b")
        # Worked too much so far → fewer hours now, and vice versa, but only by ~2 h.
        assert -2.5 <= a.deviation_hours < -1
        assert 1 < b.deviation_hours <= 2.5

    def test_without_tolerance_penalty_the_balance_goes_to_zero(self) -> None:
        result = solve(self.balance_project(beyond_tolerance=0))
        assert stats(result, "a").new_balance_hours == pytest.approx(0, abs=0.6)
        assert stats(result, "b").new_balance_hours == pytest.approx(0, abs=0.6)

    @pytest.mark.parametrize(
        ("week", "period", "expected"),
        [(1, 16, 4 / 16), (6, 16, 9 / 16), (16, 16, 1.0), (1, 52, 4 / 52)],
    )
    def test_progress_grows_toward_the_end_of_the_period(
        self, week: int, period: int, expected: float
    ) -> None:
        assert period_progress(week, 4, period) == pytest.approx(expected)


class TestDailyTargets:
    @staticmethod
    def daily_project(hard: bool) -> Project:
        s = store("09:00", "17:00")  # covering the day needs 8 h
        s.staffing.weekday.daily_hours_max = 4
        s.daily_hours_hard = hard
        return project(*(employee(x) for x in "abc"), store_settings=s, time_limit=5)

    def test_hard_daily_limits_can_make_a_month_impossible(self) -> None:
        assert solve_project(self.daily_project(hard=True), workers=4).status == "infeasible"

    def test_soft_daily_targets_become_warnings(self) -> None:
        result = solve(self.daily_project(hard=False))
        over = [v for v in result.violations if v.rule == "daily_hours_above_max"]
        assert over and all(v.severity == "warning" for v in over)

    def test_checker_severity_follows_the_toggle(self) -> None:
        for hard, severity in ((True, "error"), (False, "warning")):
            p = self.daily_project(hard)
            violations = check_plan(p, plan(shift("a", MON, "09:00", "17:00")))
            [v] = [v for v in violations if v.rule == "daily_hours_above_max"]
            assert v.severity == severity


class TestTieBreakers:
    @staticmethod
    def free_project(**weights: float) -> Project:
        """Main goals switched off, so only the tie-breakers shape the plan."""
        p = project(*(employee(x) for x in "abcd"), store_settings=store("06:00", "22:00"))
        p.weights = p.weights.model_copy(
            update={"hour_balance": 0, "beyond_tolerance": 0, **weights}
        )
        p.solver.time_limit_seconds = 8
        return p

    def test_avoids_quick_returns(self) -> None:
        result = solve(self.free_project(short_gap=5, contiguous_days_off=0))
        assert result.plan is not None
        for eid in "abcd":
            mine = sorted(
                (s for s in result.plan.shifts if s.employee_id == eid),
                key=lambda s: (s.date, s.start),
            )
            for x, y in itertools.pairwise(mine):
                end = datetime.combine(x.date, datetime.min.time()) + timedelta(
                    minutes=to_minutes(x.end)
                )
                start = datetime.combine(y.date, datetime.min.time()) + timedelta(
                    minutes=to_minutes(y.start)
                )
                assert start - end >= timedelta(hours=14)

    def test_prefers_days_off_together(self) -> None:
        result = solve(self.free_project(short_gap=0, contiguous_days_off=5))
        assert result.plan is not None
        for eid in "abcd":
            worked = {s.date.day for s in result.plan.shifts if s.employee_id == eid}
            isolated = [
                d for d in range(2, 28) if d - 1 in worked and d + 1 in worked and d not in worked
            ]
            assert isolated == []
