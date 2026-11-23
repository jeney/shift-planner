from datetime import date

import pytest

from shift_planner.domain.calendar import CalendarDay, month_calendar
from shift_planner.domain.hours import (
    effective_hours,
    monthly_target_hours,
    staffed_window,
    team_targets,
)
from shift_planner.domain.project import (
    Employee,
    Project,
    Rules,
    SpecialDate,
    StoreSettings,
)


def day_of(month: str, day: int) -> CalendarDay:
    return month_calendar(month).days[day - 1]


def employee(hours: float, *, eid: str = "e", active: bool = True) -> Employee:
    return Employee(id=eid, name=eid, color="#000000", contract_hours_per_week=hours, active=active)


class TestEffectiveHours:
    def test_monday_and_friday_are_long_days(self) -> None:
        store = StoreSettings()
        monday = day_of("2027-02", 1)
        friday = day_of("2027-02", 5)
        tuesday = day_of("2027-02", 2)
        assert (effective_hours(store, monday).opens, effective_hours(store, monday).closes) == (
            "07:00",
            "20:00",
        )
        assert effective_hours(store, friday).closes == "20:00"
        assert effective_hours(store, tuesday).closes == "18:00"

    def test_public_holiday_on_monday_uses_holiday_hours(self) -> None:
        easter_monday = day_of("2027-03", 29)
        assert easter_monday.holiday == "easter_monday"
        assert effective_hours(StoreSettings(), easter_monday).closes == "18:00"

    def test_enabled_special_date_wins(self) -> None:
        christmas_eve = day_of("2027-12", 24)
        store = StoreSettings(
            special_dates=[SpecialDate(date=date(2027, 12, 24), enabled=True, closes="17:00")]
        )
        assert effective_hours(store, christmas_eve).closes == "17:00"

    def test_disabled_special_date_is_ignored(self) -> None:
        christmas_eve = day_of("2027-12", 24)  # a Friday
        store = StoreSettings(special_dates=[SpecialDate(date=date(2027, 12, 24), closes="17:00")])
        assert effective_hours(store, christmas_eve).closes == "20:00"

    def test_special_date_can_close_the_store(self) -> None:
        store = StoreSettings(
            special_dates=[SpecialDate(date=date(2027, 2, 3), enabled=True, closed=True)]
        )
        assert staffed_window(store, day_of("2027-02", 3)) is None

    def test_staffed_window_adds_pre_and_post_minutes(self) -> None:
        window = staffed_window(StoreSettings(), day_of("2027-02", 1))  # Monday
        assert window is not None
        assert (window.start, window.end) == (6 * 60, 20 * 60 + 30)
        assert window.minutes == 14.5 * 60


class TestMonthlyTarget:
    def test_default_factor_is_52_over_12(self) -> None:
        target = monthly_target_hours(employee(10), Rules(), month_calendar("2027-02"))
        assert target == pytest.approx(43.333, abs=1e-3)

    def test_fixed_4_4(self) -> None:
        rules = Rules(monthly_target_mode="fixed_4_4")
        assert monthly_target_hours(employee(10), rules, month_calendar("2027-02")) == 44

    def test_actual_weekdays(self) -> None:
        rules = Rules(monthly_target_mode="actual_weekdays")
        # February 2027 has 20 weekdays; March 2027 has 23.
        assert monthly_target_hours(employee(10), rules, month_calendar("2027-02")) == 40
        assert monthly_target_hours(employee(10), rules, month_calendar("2027-03")) == 46

    def test_holidays_do_not_reduce_target_by_default(self) -> None:
        rules = Rules(monthly_target_mode="actual_weekdays")
        assert monthly_target_hours(employee(10), rules, month_calendar("2027-03")) == 46

    def test_holidays_reduce_target_when_enabled(self) -> None:
        # March 2027: Maundy Thursday, Good Friday and Easter Monday fall on weekdays.
        rules = Rules(monthly_target_mode="actual_weekdays", holidays_reduce_target=True)
        assert monthly_target_hours(employee(10), rules, month_calendar("2027-03")) == 40

    def test_inactive_employee_has_no_target(self) -> None:
        target = monthly_target_hours(
            employee(40, active=False), Rules(), month_calendar("2027-02")
        )
        assert target == 0

    def test_team_adjustment_is_spread_by_contract_hours(self) -> None:
        project = Project(
            id="p",
            month="2027-02",
            employees=[employee(40, eid="a"), employee(10, eid="b")],
            rules=Rules(monthly_target_mode="fixed_4_4", team_adjustment_hours=-10),
        )
        targets = team_targets(project, month_calendar("2027-02"))
        assert targets["a"] == pytest.approx(176 - 8)
        assert targets["b"] == pytest.approx(44 - 2)
