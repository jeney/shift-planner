from typing import Annotated

from fastapi import APIRouter, Path

from shift_planner.domain.calendar import MonthCalendar, month_calendar

router = APIRouter(tags=["calendar"])

MonthParam = Annotated[str, Path(pattern=r"^\d{4}-(?:0[1-9]|1[0-2])$", examples=["2027-01"])]


@router.get("/calendar/{month}", operation_id="getMonthCalendar")
def get_month_calendar(month: MonthParam) -> MonthCalendar:
    """Days of the month with day types, Danish public holidays and notable days."""
    return month_calendar(month)
