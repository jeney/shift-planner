from datetime import date

import pytest

from shift_planner.domain.calendar import (
    danish_public_holidays,
    easter_sunday,
    month_calendar,
    notable_days,
)


@pytest.mark.parametrize(
    ("year", "expected"),
    [
        (2000, date(2000, 4, 23)),
        (2024, date(2024, 3, 31)),
        (2025, date(2025, 4, 20)),
        (2026, date(2026, 4, 5)),
        (2027, date(2027, 3, 28)),
        (2038, date(2038, 4, 25)),
    ],
)
def test_easter_sunday(year: int, expected: date) -> None:
    assert easter_sunday(year) == expected


def test_danish_holidays_2026() -> None:
    assert danish_public_holidays(2026) == {
        date(2026, 1, 1): "new_years_day",
        date(2026, 4, 2): "maundy_thursday",
        date(2026, 4, 3): "good_friday",
        date(2026, 4, 5): "easter_sunday",
        date(2026, 4, 6): "easter_monday",
        date(2026, 5, 14): "ascension_day",
        date(2026, 5, 24): "whit_sunday",
        date(2026, 5, 25): "whit_monday",
        date(2026, 12, 25): "christmas_day",
        date(2026, 12, 26): "boxing_day",
    }


def test_great_prayer_day_only_before_2024() -> None:
    assert danish_public_holidays(2023)[date(2023, 5, 5)] == "great_prayer_day"
    assert "great_prayer_day" not in danish_public_holidays(2024).values()


def test_notable_days_are_not_holidays() -> None:
    notables = notable_days(2026)
    assert notables[date(2026, 12, 24)] == "christmas_eve"
    assert notables[date(2026, 12, 31)] == "new_years_eve"
    assert notables[date(2026, 6, 5)] == "constitution_day"
    assert not set(notables) & set(danish_public_holidays(2026))


def test_month_calendar_day_types() -> None:
    cal = month_calendar("2026-12")
    assert len(cal.days) == 31
    by_day = {d.date.day: d for d in cal.days}

    assert by_day[1].weekday == 1  # Tuesday
    assert by_day[1].day_type == "weekday"
    assert by_day[5].day_type == "saturday"
    assert by_day[6].day_type == "sunday"
    assert by_day[24].day_type == "weekday"
    assert by_day[24].notable == "christmas_eve"
    assert by_day[25].day_type == "holiday"
    # A holiday on a Saturday is a holiday, not a Saturday.
    assert by_day[26].weekday == 5
    assert by_day[26].day_type == "holiday"
    assert by_day[26].holiday == "boxing_day"


def test_month_calendar_lengths_and_iso_weeks() -> None:
    assert len(month_calendar("2027-02").days) == 28
    assert len(month_calendar("2028-02").days) == 29
    jan = month_calendar("2027-01").days
    assert jan[0].iso_week == 53  # Fri 1 Jan 2027 belongs to ISO week 53 of 2026
    assert jan[3].iso_week == 1  # Mon 4 Jan 2027
