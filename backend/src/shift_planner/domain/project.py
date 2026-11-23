"""The project: everything the manager enters, plus the (optional) plan.

The backend is stateless; every request carries a full `Project`. These Pydantic models are the
canonical schema: the frontend's TypeScript types are generated from them via OpenAPI.

Defaults here are the app's defaults. They match the store the app was built for (see README).
"""

from datetime import date, datetime
from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from shift_planner.domain.base import ApiModel, HexColor, Id, TimeOfDay, YearMonth, to_minutes
from shift_planner.domain.calendar import DayType, month_dates

CURRENT_SCHEMA_VERSION: Literal[2] = 2

Hours = Annotated[float, Field(ge=0, le=24)]
WeeklyHours = Annotated[float, Field(ge=0, le=168)]


def _check_window(start: str | None, end: str | None) -> None:
    if start is not None and end is not None and to_minutes(start) >= to_minutes(end):
        raise ValueError("start must be before end")


# --------------------------------------------------------------------------------------------
# Store
# --------------------------------------------------------------------------------------------


class DayHours(ApiModel):
    """Opening hours for one day. Times are when the store is open to customers."""

    closed: bool = False
    opens: TimeOfDay = "07:00"
    closes: TimeOfDay = "18:00"

    @model_validator(mode="after")
    def _opens_before_closes(self) -> Self:
        if not self.closed:
            _check_window(self.opens, self.closes)
        return self


def _hours(opens: str, closes: str) -> DayHours:
    return DayHours(opens=opens, closes=closes)


class WeeklyOpeningHours(ApiModel):
    monday: DayHours = Field(default_factory=lambda: _hours("07:00", "20:00"))
    tuesday: DayHours = Field(default_factory=lambda: _hours("07:00", "18:00"))
    wednesday: DayHours = Field(default_factory=lambda: _hours("07:00", "18:00"))
    thursday: DayHours = Field(default_factory=lambda: _hours("07:00", "18:00"))
    friday: DayHours = Field(default_factory=lambda: _hours("07:00", "20:00"))
    saturday: DayHours = Field(default_factory=lambda: _hours("07:00", "18:00"))
    sunday: DayHours = Field(default_factory=lambda: _hours("07:00", "18:00"))

    def for_weekday(self, weekday: int) -> DayHours:
        """0 = Monday … 6 = Sunday."""
        return (
            self.monday,
            self.tuesday,
            self.wednesday,
            self.thursday,
            self.friday,
            self.saturday,
            self.sunday,
        )[weekday]


class SpecialDate(ApiModel):
    """Custom opening hours (or closed) for one date. Only applies while `enabled`."""

    date: date
    enabled: bool = False
    closed: bool = False
    opens: TimeOfDay = "07:00"
    closes: TimeOfDay = "17:00"
    note: str = Field("", max_length=200)

    @model_validator(mode="after")
    def _opens_before_closes(self) -> Self:
        if not self.closed:
            _check_window(self.opens, self.closes)
        return self


class DayTypeStaffing(ApiModel):
    min_at_opening: int = Field(1, ge=0, le=50)
    """People present at the start of the staffed day (opening minus pre-opening minutes)."""
    min_at_closing: int = Field(1, ge=0, le=50)
    """People present at the end of the staffed day (closing plus post-closing minutes)."""
    daily_hours_min: WeeklyHours | None = None
    daily_hours_max: WeeklyHours | None = None

    @model_validator(mode="after")
    def _min_le_max(self) -> Self:
        if (
            self.daily_hours_min is not None
            and self.daily_hours_max is not None
            and self.daily_hours_min > self.daily_hours_max
        ):
            raise ValueError("dailyHoursMin must not exceed dailyHoursMax")
        return self


class StaffingByDayType(ApiModel):
    weekday: DayTypeStaffing = Field(default_factory=DayTypeStaffing)
    saturday: DayTypeStaffing = Field(default_factory=DayTypeStaffing)
    sunday: DayTypeStaffing = Field(default_factory=DayTypeStaffing)
    holiday: DayTypeStaffing = Field(default_factory=DayTypeStaffing)

    def for_day_type(self, day_type: DayType) -> DayTypeStaffing:
        result: DayTypeStaffing = getattr(self, day_type)
        return result


class TimeRangeMinimum(ApiModel):
    """E.g. "at least 2 people 11:00–14:00 on Saturdays"."""

    id: Id
    day_types: list[DayType] = Field(min_length=1)
    start: TimeOfDay
    end: TimeOfDay
    min_people: int = Field(ge=1, le=50)

    @model_validator(mode="after")
    def _window(self) -> Self:
        _check_window(self.start, self.end)
        return self


class StoreSettings(ApiModel):
    name: str = Field("My store", max_length=100)
    opening_hours: WeeklyOpeningHours = Field(default_factory=WeeklyOpeningHours)
    public_holiday_hours: DayHours = Field(default_factory=lambda: _hours("07:00", "18:00"))
    """Opening hours on Danish public holidays (instead of that weekday's hours)."""
    special_dates: list[SpecialDate] = Field(default_factory=list)
    staff_before_opening_min: int = Field(60, ge=0, le=240)
    staff_after_closing_min: int = Field(30, ge=0, le=240)
    allow_working_alone: bool = False
    """If false, at least 2 people must be present whenever the store is staffed."""
    staffing: StaffingByDayType = Field(default_factory=StaffingByDayType)
    time_range_minimums: list[TimeRangeMinimum] = Field(default_factory=list)

    @model_validator(mode="after")
    def _unique_special_dates(self) -> Self:
        dates = [s.date for s in self.special_dates]
        if len(dates) != len(set(dates)):
            raise ValueError("special dates must be unique")
        return self


# --------------------------------------------------------------------------------------------
# Employees
# --------------------------------------------------------------------------------------------


class EmployeeRuleOverrides(ApiModel):
    """Per-employee replacements for global limits. `None` means "use the global rule"."""

    min_shift_hours: Hours | None = None
    max_shift_hours: Hours | None = None
    max_hours_per_day: Hours | None = None
    min_rest_hours: Hours | None = None
    max_consecutive_days: int | None = Field(None, ge=1, le=31)
    max_weekly_hours: WeeklyHours | None = None


class HourBalance(ApiModel):
    """Hours carried in from earlier months. The app doesn't remember past months."""

    carry_in_hours: float = Field(0, ge=-500, le=500)
    """Positive = worked more than target so far in the balancing period."""
    period_week: int = Field(1, ge=1, le=104)
    """Which week of the balancing period this month starts in (e.g. week 6 of 16)."""
    last_shift_ended_at: datetime | None = None
    """End of the last shift in the previous month (local time), for the rest rule on day 1."""
    consecutive_days_at_start: int = Field(0, ge=0, le=31)
    """Days worked in a row up to and including the last day of the previous month."""


class Employee(ApiModel):
    id: Id
    name: str = Field(min_length=1, max_length=80)
    color: HexColor
    active: bool = True
    contract_hours_per_week: WeeklyHours
    has_car: bool = False
    needs_ride_early: bool = False
    """Can't take the bus to early shifts (see the bus/car rule)."""
    needs_ride_late: bool = False
    """Can't take the bus home from late shifts (only used if the late rule is enabled)."""
    allowed_driver_ids: list[Id] | None = None
    """Who may drive this person. `None` = anyone with a car."""
    overrides: EmployeeRuleOverrides = Field(default_factory=EmployeeRuleOverrides)
    balance: HourBalance = Field(default_factory=HourBalance)


# --------------------------------------------------------------------------------------------
# Availability & wishes
# --------------------------------------------------------------------------------------------

AvailabilityKind = Literal["unavailable", "wish_off", "wish_work"]
"""`unavailable` is hard. `wish_off` / `wish_work` are soft (penalty / reward in the objective)."""


class WeeklyPattern(ApiModel):
    """Every week on `weekday`, optionally only within a time window."""

    type: Literal["weekly"] = "weekly"
    weekday: int = Field(ge=0, le=6)
    """0 = Monday … 6 = Sunday."""
    start: TimeOfDay | None = None
    """None = from start of day."""
    end: TimeOfDay | None = None
    """None = until end of day."""

    @model_validator(mode="after")
    def _window(self) -> Self:
        _check_window(self.start, self.end)
        return self


class SingleDatePattern(ApiModel):
    type: Literal["date"] = "date"
    date: date
    start: TimeOfDay | None = None
    end: TimeOfDay | None = None

    @model_validator(mode="after")
    def _window(self) -> Self:
        _check_window(self.start, self.end)
        return self


class DateRangePattern(ApiModel):
    """Whole days from `start_date` to `end_date`, inclusive (e.g. vacation)."""

    type: Literal["range"] = "range"
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.start_date > self.end_date:
            raise ValueError("startDate must not be after endDate")
        return self


AvailabilityPattern = Annotated[
    WeeklyPattern | SingleDatePattern | DateRangePattern, Field(discriminator="type")
]


class AvailabilityEntry(ApiModel):
    id: Id
    employee_id: Id
    kind: AvailabilityKind
    pattern: AvailabilityPattern
    weight: float = Field(1.0, ge=0, le=10)
    """Multiplier on the wish weight. Ignored for `unavailable`."""
    note: str = Field("", max_length=200)


# --------------------------------------------------------------------------------------------
# Rules, weights and settings
# --------------------------------------------------------------------------------------------


class BreakRule(ApiModel):
    """A shift longer than `after_hours` includes a break of `minutes`."""

    after_hours: float = Field(gt=0, le=24)
    minutes: int = Field(ge=0, le=180)


class BreakSettings(ApiModel):
    enabled: bool = False
    paid: bool = False
    """Unpaid breaks don't count as worked hours."""
    rules: list[BreakRule] = Field(default_factory=lambda: [BreakRule(after_hours=6, minutes=30)])


class CutoffsByDayType(ApiModel):
    weekday: TimeOfDay
    saturday: TimeOfDay
    sunday: TimeOfDay
    holiday: TimeOfDay

    def for_day_type(self, day_type: DayType) -> str:
        result: str = getattr(self, day_type)
        return result


class BusRule(ApiModel):
    """People who need a ride must start (or end) at exactly the same time as a driver."""

    enabled: bool = True
    early_cutoff: CutoffsByDayType = Field(
        default_factory=lambda: CutoffsByDayType(
            weekday="06:30", saturday="07:30", sunday="08:30", holiday="08:30"
        )
    )
    """A shift starting before this time needs a driver starting at the same time."""
    late_enabled: bool = False
    late_cutoff: CutoffsByDayType = Field(
        default_factory=lambda: CutoffsByDayType(
            weekday="20:00", saturday="20:00", sunday="20:00", holiday="20:00"
        )
    )
    """A shift ending after this time needs a driver ending at the same time."""


MonthlyTargetMode = Literal["weeks_per_month", "fixed_4_4", "actual_weekdays"]
"""`weeks_per_month` = 52/12 ≈ 4.33; `fixed_4_4` = 4.4; `actual_weekdays` = Mon–Fri days ÷ 5."""


class Rules(ApiModel):
    granularity_min: Literal[15, 30, 60] = 30
    min_shift_hours: Hours = 3
    max_shift_hours: Hours = 8
    max_hours_per_day: Hours | None = None
    """Total of all shifts on one day. None = same as max shift length."""
    one_shift_per_day: bool = True
    min_rest_hours: Hours = 11
    max_consecutive_days: int = Field(6, ge=1, le=31)
    max_weekly_hours: WeeklyHours = 48
    full_time_threshold_hours: WeeklyHours = 37
    """Employees with at least this many contract hours per week count as full-time."""
    full_time_contract_warning: bool = True
    """Warn (don't block) when a full-timer is planned above their own contract hours in a week."""
    monthly_tolerance_hours: float = Field(2, ge=0, le=100)
    monthly_hard_limit_hours: float | None = Field(None, ge=0, le=200)
    """Optional hard limit on |planned − target| per month. None = soft only."""
    balancing_period_weeks: int = Field(16, ge=1, le=104)
    monthly_target_mode: MonthlyTargetMode = "weeks_per_month"
    holidays_reduce_target: bool = False
    """If on, each public holiday on Mon–Fri reduces the monthly target by a fifth of a week."""
    team_adjustment_hours: float = Field(0, ge=-1000, le=1000)
    """Shift the whole team's total target this month, e.g. −10 after a busy month."""
    breaks: BreakSettings = Field(default_factory=BreakSettings)
    bus_rule: BusRule = Field(default_factory=BusRule)

    @model_validator(mode="after")
    def _shift_length(self) -> Self:
        if self.min_shift_hours > self.max_shift_hours:
            raise ValueError("minShiftHours must not exceed maxShiftHours")
        return self


class ObjectiveWeights(ApiModel):
    """Relative importance of the soft goals. Higher = matters more."""

    wish_off: float = Field(10, ge=0, le=1000)
    wish_work: float = Field(4, ge=0, le=1000)
    hour_balance: float = Field(5, ge=0, le=1000)
    beyond_tolerance: float = Field(50, ge=0, le=1000)
    daily_target: float = Field(3, ge=0, le=1000)
    short_gap: float = Field(0.5, ge=0, le=1000)
    contiguous_days_off: float = Field(0.5, ge=0, le=1000)


class GuestPoint(ApiModel):
    guests: int = Field(ge=0)
    hours: float = Field(ge=0, le=1000)


class GuestDemand(ApiModel):
    """Optional: derive each day's required total staff hours from expected guests."""

    enabled: bool = False
    mode: Literal["linear", "steps"] = "linear"
    points: list[GuestPoint] = Field(
        default_factory=lambda: [
            GuestPoint(guests=1000, hours=20),
            GuestPoint(guests=1250, hours=25),
            GuestPoint(guests=1500, hours=30),
        ]
    )
    tolerance_hours: float = Field(2, ge=0, le=100)
    guests_by_date: dict[date, int] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _sorted_points(self) -> Self:
        self.points.sort(key=lambda p: p.guests)
        guests = [p.guests for p in self.points]
        if len(guests) != len(set(guests)):
            raise ValueError("guest counts in points must be unique")
        return self


class SolverSettings(ApiModel):
    time_limit_seconds: int = Field(20, ge=1, le=600)


# --------------------------------------------------------------------------------------------
# Plan
# --------------------------------------------------------------------------------------------


class Shift(ApiModel):
    id: Id
    employee_id: Id
    date: date
    start: TimeOfDay
    end: TimeOfDay
    pinned: bool = False
    """Keep this shift fixed when re-generating."""

    @model_validator(mode="after")
    def _window(self) -> Self:
        _check_window(self.start, self.end)
        return self


class Plan(ApiModel):
    shifts: list[Shift] = Field(default_factory=list)


# --------------------------------------------------------------------------------------------
# Project
# --------------------------------------------------------------------------------------------


class Project(ApiModel):
    schema_version: Literal[2] = CURRENT_SCHEMA_VERSION
    id: Id
    name: str = Field("Shift plan", max_length=100)
    month: YearMonth
    store: StoreSettings = Field(default_factory=StoreSettings)
    employees: list[Employee] = Field(default_factory=list)
    availability: list[AvailabilityEntry] = Field(default_factory=list)
    rules: Rules = Field(default_factory=Rules)
    weights: ObjectiveWeights = Field(default_factory=ObjectiveWeights)
    guest_demand: GuestDemand = Field(default_factory=GuestDemand)
    solver: SolverSettings = Field(default_factory=SolverSettings)
    plan: Plan | None = None

    @model_validator(mode="after")
    def _references(self) -> Self:
        ids = [e.id for e in self.employees]
        known = set(ids)
        if len(ids) != len(known):
            raise ValueError("employee ids must be unique")
        for employee in self.employees:
            unknown = set(employee.allowed_driver_ids or []) - known
            if unknown:
                raise ValueError(
                    f"employee {employee.id}: unknown allowed drivers {sorted(unknown)}"
                )
        for entry in self.availability:
            if entry.employee_id not in known:
                raise ValueError(f"availability {entry.id}: unknown employee {entry.employee_id}")
        if self.plan is not None:
            in_month = set(month_dates(self.month))
            for shift in self.plan.shifts:
                if shift.employee_id not in known:
                    raise ValueError(f"shift {shift.id}: unknown employee {shift.employee_id}")
                if shift.date not in in_month:
                    raise ValueError(f"shift {shift.id}: date {shift.date} is outside {self.month}")
        return self
