"""The checker finds every broken rule in hand-built plans (the single source of truth)."""

from datetime import date, datetime

from shift_planner.domain.project import BreakRule, BreakSettings, SpecialDate, TimeRangeMinimum
from shift_planner.domain.solve import Violation
from shift_planner.solver.checker import check_plan
from tests.factories import employee, plan, project, shift, store, unavailable

MON = "2027-02-01"
TUE = "2027-02-02"


def only(violations: list[Violation], rule: str) -> list[Violation]:
    return [v for v in violations if v.rule == rule]


def test_valid_day_has_no_shift_violations() -> None:
    p = project(employee("a"))
    violations = check_plan(p, plan(shift("a", MON, "09:00", "17:00")))
    on_monday = [v for v in violations if v.date == date(2027, 2, 1)]
    assert on_monday == []


def test_outside_opening_hours_and_closed_store() -> None:
    closed = SpecialDate(date=date(2027, 2, 2), enabled=True, closed=True)
    p = project(employee("a"), store_settings=store(special_dates=[closed]))
    violations = check_plan(
        p, plan(shift("a", MON, "08:00", "12:00"), shift("a", TUE, "09:00", "13:00"))
    )
    [outside] = only(violations, "outside_opening_hours")
    assert (outside.date, outside.start, outside.params["windowStart"]) == (
        date(2027, 2, 1),
        "08:00",
        "09:00",
    )
    [closed_v] = only(violations, "store_closed")
    assert closed_v.date == date(2027, 2, 2)


def test_pre_and_post_minutes_widen_the_window() -> None:
    p = project(employee("a"), store_settings=store("09:00", "17:00", before=60, after=30))
    violations = check_plan(p, plan(shift("a", MON, "08:00", "17:30")))
    assert only(violations, "outside_opening_hours") == []


def test_shift_length_limits_including_personal_overrides() -> None:
    p = project(
        employee("a"),
        employee("b", overrides={"max_shift_hours": 4}),
        store_settings=store("06:00", "22:00"),
    )
    violations = check_plan(
        p,
        plan(
            shift("a", MON, "06:00", "08:00"),  # 2 h < 3 h
            shift("a", TUE, "06:00", "15:00"),  # 9 h > 8 h
            shift("b", MON, "08:00", "13:00"),  # 5 h > personal 4 h
        ),
    )
    [short] = only(violations, "shift_too_short")
    assert (short.employee_id, short.amount) == ("a", 1.0)
    long = only(violations, "shift_too_long")
    assert {(v.employee_id, v.amount) for v in long} == {("a", 1.0), ("b", 1.0)}


def test_one_shift_per_day_and_overlaps() -> None:
    p = project(employee("a"), store_settings=store("06:00", "22:00"))
    violations = check_plan(
        p, plan(shift("a", MON, "06:00", "10:00"), shift("a", MON, "09:00", "13:00"))
    )
    assert only(violations, "too_many_shifts")[0].amount == 1
    [overlap] = only(violations, "overlapping_shifts")
    assert (overlap.start, overlap.end) == ("09:00", "10:00")


def test_day_total_limit_with_split_shifts() -> None:
    p = project(
        employee("a"), store_settings=store("06:00", "22:00"), rules={"one_shift_per_day": False}
    )
    violations = check_plan(
        p, plan(shift("a", MON, "06:00", "11:00"), shift("a", MON, "15:00", "20:00"))
    )
    assert only(violations, "too_many_shifts") == []
    [day] = only(violations, "day_too_long")
    assert day.amount == 2.0  # 10 h worked vs 8 h max


def test_rest_between_days_and_from_last_month() -> None:
    p = project(
        employee("a", last_end=datetime(2027, 1, 31, 23, 0)),
        store_settings=store("06:00", "22:00"),
    )
    violations = check_plan(
        p,
        plan(
            shift("a", MON, "08:00", "16:00"),  # 9 h after 23:00 the night before
            shift("a", "2027-02-02", "14:00", "22:00"),
            shift("a", "2027-02-03", "06:00", "12:00"),  # 8 h after 22:00
        ),
    )
    rests = only(violations, "rest_too_short")
    assert [(v.date, v.params["rest"], v.amount) for v in rests] == [
        (date(2027, 2, 1), 9.0, 2.0),
        (date(2027, 2, 3), 8.0, 3.0),
    ]


def test_seventh_day_in_a_row_including_carry_in() -> None:
    p = project(employee("a", streak=4))
    shifts = [shift("a", f"2027-02-0{d}", "09:00", "13:00") for d in range(1, 5)]
    [v] = only(check_plan(p, plan(*shifts)), "too_many_days_in_a_row")
    assert (v.date, v.amount) == (date(2027, 2, 3), 1)  # 4 carried + 3 = 7th day


def test_six_days_then_a_day_off_is_fine() -> None:
    p = project(employee("a"))
    shifts = [shift("a", f"2027-02-0{d}", "09:00", "13:00") for d in (1, 2, 3, 4, 5, 6, 8, 9)]
    assert only(check_plan(p, plan(*shifts)), "too_many_days_in_a_row") == []


def test_weekly_hours_use_only_the_in_month_part_of_a_week() -> None:
    # January 2027 starts on a Friday: Fri 1 – Sun 3 is the first (partial) week.
    p = project(employee("a"), month="2027-01", rules={"max_weekly_hours": 16})
    shifts = [shift("a", f"2027-01-0{d}", "09:00", "17:00") for d in (1, 2, 3)]
    [v] = only(check_plan(p, plan(*shifts)), "weekly_hours_exceeded")
    assert (v.date, v.amount, v.params["planned"]) == (date(2027, 1, 1), 8.0, 24.0)


def test_full_timer_above_contract_is_a_warning() -> None:
    p = project(
        employee("a", hours=37), employee("b", hours=20), store_settings=store("06:00", "22:00")
    )
    # 5 × 8 h = 40 h in the week of 1 Feb.
    shifts = [shift(who, f"2027-02-0{d}", "09:00", "17:00") for d in range(1, 6) for who in "ab"]
    warnings = only(check_plan(p, plan(*shifts)), "weekly_above_contract")
    assert [(v.employee_id, v.severity, v.amount) for v in warnings] == [("a", "warning", 3.0)]


def test_unpaid_breaks_reduce_worked_hours() -> None:
    p = project(
        employee("a", hours=37),
        rules={
            "max_weekly_hours": 38,
            "breaks": BreakSettings(
                enabled=True, paid=False, rules=[BreakRule(after_hours=6, minutes=30)]
            ),
        },
    )
    shifts = [shift("a", f"2027-02-0{d}", "09:00", "17:00") for d in range(1, 6)]
    violations = check_plan(p, plan(*shifts))
    assert only(violations, "weekly_hours_exceeded") == []  # 5 × 7.5 h = 37.5 h
    assert only(violations, "weekly_above_contract")[0].amount == 0.5


def test_hard_unavailability_partial_window() -> None:
    p = project(
        employee("a"),
        availability=[unavailable("a", {"type": "weekly", "weekday": 0, "start": "12:00"})],
    )
    violations = check_plan(
        p, plan(shift("a", MON, "09:00", "14:00"), shift("a", TUE, "09:00", "14:00"))
    )
    [v] = only(violations, "unavailable")
    assert (v.date, v.start, v.end, v.amount) == (date(2027, 2, 1), "12:00", "14:00", 2.0)


def test_wishes_are_not_violations() -> None:
    p = project(
        employee("a"),
        availability=[unavailable("a", {"type": "date", "date": MON}, kind="wish_off")],
    )
    assert only(check_plan(p, plan(shift("a", MON, "09:00", "14:00"))), "unavailable") == []


def test_no_one_alone_reports_the_uncovered_period() -> None:
    p = project(employee("a"), employee("b"), store_settings=store(alone=False))
    violations = check_plan(
        p, plan(shift("a", MON, "09:00", "17:00"), shift("b", MON, "09:00", "13:00"))
    )
    gaps = [v for v in only(violations, "understaffed") if v.date == date(2027, 2, 1)]
    assert [(v.start, v.end, v.amount, v.params["required"]) for v in gaps] == [
        ("13:00", "17:00", 1, 2)
    ]


def test_opening_and_closing_minimums() -> None:
    s = store()
    s.staffing.weekday.min_at_opening = 2
    s.staffing.weekday.min_at_closing = 2
    p = project(employee("a"), employee("b"), store_settings=s)
    violations = check_plan(
        p, plan(shift("a", MON, "09:00", "17:00"), shift("b", MON, "10:00", "16:00"))
    )
    [opening] = [v for v in only(violations, "opening_understaffed") if v.date == date(2027, 2, 1)]
    [closing] = [v for v in only(violations, "closing_understaffed") if v.date == date(2027, 2, 1)]
    assert (opening.start, opening.amount) == ("09:00", 1)
    assert (closing.end, closing.amount) == ("17:00", 1)


def test_busy_period_minimum() -> None:
    busy = TimeRangeMinimum(id="r", day_types=["weekday"], start="11:00", end="14:00", min_people=2)
    p = project(employee("a"), employee("b"), store_settings=store(time_range_minimums=[busy]))
    violations = check_plan(
        p, plan(shift("a", MON, "09:00", "17:00"), shift("b", MON, "12:00", "16:00"))
    )
    [v] = [v for v in only(violations, "busy_period_understaffed") if v.date == date(2027, 2, 1)]
    assert (v.start, v.end, v.amount) == ("11:00", "12:00", 1)


def test_daily_hour_targets() -> None:
    s = store()
    s.staffing.weekday.daily_hours_min = 10
    s.staffing.weekday.daily_hours_max = 12
    p = project(employee("a"), employee("b"), store_settings=s)
    under = check_plan(p, plan(shift("a", MON, "09:00", "17:00")))
    assert [
        v.amount for v in only(under, "daily_hours_below_min") if v.date == date(2027, 2, 1)
    ] == [2.0]
    over = check_plan(p, plan(shift("a", MON, "09:00", "17:00"), shift("b", MON, "09:00", "17:00")))
    assert only(over, "daily_hours_above_max")[0].amount == 4.0


class TestBusRule:
    def setup(self, start_rider: str, start_driver: str) -> list[Violation]:
        p = project(
            employee("rider", ride=True),
            employee("driver", car=True),
            employee("walker"),
            store_settings=store("06:00", "18:00"),
        )
        shifts = plan(
            shift("rider", MON, start_rider, "14:00"),
            shift("driver", MON, start_driver, "14:00"),
            shift("walker", MON, "06:00", "14:00"),
        )
        return only(check_plan(p, shifts), "no_ride_early")

    def test_early_start_needs_a_driver_starting_at_the_same_time(self) -> None:
        assert self.setup("06:00", "06:00") == []
        [v] = self.setup("06:00", "07:00")
        assert (v.employee_id, v.start, v.params["cutoff"]) == ("rider", "06:00", "06:30")

    def test_someone_without_a_car_cannot_drive(self) -> None:
        # The walker starts at 06:00 too, but has no car.
        assert len(self.setup("06:00", "08:00")) == 1

    def test_start_at_or_after_cutoff_is_free(self) -> None:
        assert self.setup("06:30", "08:00") == []

    def test_restricted_driver_list(self) -> None:
        p = project(
            employee("rider", ride=True, allowed_driver_ids=["other"]),
            employee("driver", car=True),
            employee("other", car=True),
            store_settings=store("06:00", "18:00"),
        )
        shifts = plan(shift("rider", MON, "06:00", "12:00"), shift("driver", MON, "06:00", "12:00"))
        assert len(only(check_plan(p, shifts), "no_ride_early")) == 1


def test_monthly_hard_limit() -> None:
    p = project(employee("a", hours=10), rules={"monthly_hard_limit_hours": 5})
    violations = check_plan(p, plan(shift("a", MON, "09:00", "17:00")))
    [v] = only(violations, "monthly_limit_exceeded")
    assert v.params["deviation"] == round(8 - 10 * 52 / 12, 2)


def test_shifts_for_inactive_employees_are_flagged() -> None:
    p = project(employee("a", active=False))
    assert only(check_plan(p, plan(shift("a", MON, "09:00", "13:00"))), "inactive_employee")
