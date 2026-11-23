"""Danish calendar: public holidays, notable days and day types."""

from calendar import monthrange
from datetime import date, timedelta
from typing import Literal

from shift_planner.domain.base import ApiModel, YearMonth

DayType = Literal["weekday", "saturday", "sunday", "holiday"]

HolidayKey = Literal[
    "new_years_day",
    "maundy_thursday",
    "good_friday",
    "easter_sunday",
    "easter_monday",
    "great_prayer_day",
    "ascension_day",
    "whit_sunday",
    "whit_monday",
    "christmas_day",
    "boxing_day",
]
"""Official Danish public holidays (helligdage)."""

NotableDayKey = Literal["constitution_day", "christmas_eve", "new_years_eve"]
"""Not public holidays, but days on which shops commonly have special hours."""


class CalendarDay(ApiModel):
    date: date
    weekday: int
    """0 = Monday … 6 = Sunday."""
    iso_week: int
    day_type: DayType
    holiday: HolidayKey | None = None
    notable: NotableDayKey | None = None


class MonthCalendar(ApiModel):
    month: YearMonth
    days: list[CalendarDay]


def easter_sunday(year: int) -> date:
    """Gregorian Easter Sunday (anonymous Gregorian algorithm)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    ell = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * ell) // 451
    month, day = divmod(h + ell - 7 * m + 114, 31)
    return date(year, month, day + 1)


def danish_public_holidays(year: int) -> dict[date, HolidayKey]:
    easter = easter_sunday(year)
    holidays: dict[date, HolidayKey] = {
        date(year, 1, 1): "new_years_day",
        easter - timedelta(days=3): "maundy_thursday",
        easter - timedelta(days=2): "good_friday",
        easter: "easter_sunday",
        easter + timedelta(days=1): "easter_monday",
        easter + timedelta(days=39): "ascension_day",
        easter + timedelta(days=49): "whit_sunday",
        easter + timedelta(days=50): "whit_monday",
        date(year, 12, 25): "christmas_day",
        date(year, 12, 26): "boxing_day",
    }
    # Store Bededag was abolished as a public holiday from 2024.
    if year < 2024:
        holidays[easter + timedelta(days=26)] = "great_prayer_day"
    return holidays


def notable_days(year: int) -> dict[date, NotableDayKey]:
    return {
        date(year, 6, 5): "constitution_day",
        date(year, 12, 24): "christmas_eve",
        date(year, 12, 31): "new_years_eve",
    }


def parse_month(month: str) -> tuple[int, int]:
    year, mon = month.split("-")
    return int(year), int(mon)


def month_dates(month: str) -> list[date]:
    year, mon = parse_month(month)
    return [date(year, mon, day) for day in range(1, monthrange(year, mon)[1] + 1)]


def day_type_of(day: date, holiday: HolidayKey | None) -> DayType:
    if holiday is not None:
        return "holiday"
    if day.weekday() == 5:
        return "saturday"
    if day.weekday() == 6:
        return "sunday"
    return "weekday"


def month_calendar(month: str) -> MonthCalendar:
    year, _ = parse_month(month)
    holidays = danish_public_holidays(year)
    notables = notable_days(year)
    days = []
    for day in month_dates(month):
        holiday = holidays.get(day)
        days.append(
            CalendarDay(
                date=day,
                weekday=day.weekday(),
                iso_week=day.isocalendar().week,
                day_type=day_type_of(day, holiday),
                holiday=holiday,
                notable=notables.get(day),
            )
        )
    return MonthCalendar(month=month, days=days)
