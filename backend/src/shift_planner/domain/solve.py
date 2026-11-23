"""Results of solving and validating a plan."""

import datetime as dt
from typing import Literal

from pydantic import Field

from shift_planner.domain.base import ApiModel, Id, TimeOfDay
from shift_planner.domain.project import Plan

SolveStatus = Literal["optimal", "feasible", "best_effort", "infeasible"]
Severity = Literal["error", "warning"]

RuleCode = Literal[
    "inactive_employee",
    "store_closed",
    "outside_opening_hours",
    "overlapping_shifts",
    "shift_too_short",
    "shift_too_long",
    "too_many_shifts",
    "day_too_long",
    "rest_too_short",
    "too_many_days_in_a_row",
    "weekly_hours_exceeded",
    "weekly_above_contract",
    "unavailable",
    "understaffed",
    "opening_understaffed",
    "closing_understaffed",
    "busy_period_understaffed",
    "daily_hours_below_min",
    "daily_hours_above_max",
    "no_ride_early",
    "no_ride_late",
    "monthly_limit_exceeded",
]


class Violation(ApiModel):
    """A broken rule. The frontend translates `violation.<rule>` with `params`."""

    rule: RuleCode
    severity: Severity = "error"
    employee_id: Id | None = None
    date: dt.date | None = None
    start: TimeOfDay | None = None
    end: TimeOfDay | None = None
    amount: float | None = None
    """How far off: hours for time rules, people for staffing rules, days for day counts."""
    params: dict[str, str | int | float] = Field(default_factory=dict)


class Diagnostic(ApiModel):
    """A pre-check finding, explained in plain language (translated by the frontend)."""

    code: str
    severity: Severity = "error"
    date: dt.date | None = None
    employee_ids: list[Id] = Field(default_factory=list)
    params: dict[str, str | int | float] = Field(default_factory=dict)


class EmployeeStats(ApiModel):
    employee_id: Id
    shifts: int
    planned_hours: float
    target_hours: float
    deviation_hours: float
    """planned − target."""
    carry_in_hours: float
    new_balance_hours: float
    """carry-in + deviation: where the balance stands after this month."""


class SolveResponse(ApiModel):
    status: SolveStatus
    plan: Plan | None
    violations: list[Violation] = Field(default_factory=list)
    diagnostics: list[Diagnostic] = Field(default_factory=list)
    stats: list[EmployeeStats] = Field(default_factory=list)
    solve_time_ms: int
