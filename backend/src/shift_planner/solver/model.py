"""CP-SAT model of a month of shifts.

Formulation: **candidate shifts**. For every active employee and open day we enumerate the
shifts they could work: start and end on the time grid inside the staffed window (plus the
window edges and busy-period edges), length within their limits, not overlapping their hard
unavailability. Each candidate is one boolean; at most one (or two, if split shifts are
allowed) is chosen per day. This keeps every hard rule linear and exact:

* coverage:      a flow encoding per person, present[k] = present[k−1] + (shifts starting at
                 point k) − (shifts ending at point k), keeps every candidate in just two
                 small sums (instead of one term per covered slot); the number of people
                 present in each slot then meets the minimum. Keeping `present` boolean also
                 stops split shifts from overlapping.
* rest:          with one shift per day, start = Σ y·start + 48 h·(1 − works) and
                 end = Σ y·end, so tomorrow.start + 24 h − today.end ≥ rest holds trivially
                 on days off. With split shifts, first/last bounds are used instead.
* bus/car rule:  for each start time before the cutoff, a rider's shifts starting then are
                 covered by drivers' shifts starting at exactly the same time.
* breaks:        each candidate knows its own paid minutes.

The objective (wishes, hour balance, soft daily targets, tie-breakers) is documented on
`ShiftModel._objective`.

Weeks that cross a month edge only count in-month days.
"""

import itertools
import math
import time
import uuid
from dataclasses import dataclass
from typing import Literal

from ortools.sat.python import cp_model

from shift_planner.domain.base import from_minutes, to_minutes
from shift_planner.domain.project import Plan, Shift
from shift_planner.solver.context import (
    MINUTES_PER_DAY,
    Context,
    DayInfo,
    entry_windows,
    minutes_since,
    overlaps,
)

Status = Literal["optimal", "feasible", "infeasible"]
OFF = 2 * MINUTES_PER_DAY
SCALE = 1000
"""Objective points per unit of weight."""
QUICK_RETURN = 14 * 60
"""Rest shorter than this between two working days counts as a quick return."""


def period_progress(period_week: int, weeks_in_month: float, period_weeks: int) -> float:
    """Share of the balancing period elapsed by the end of this month (0–1). Scales how hard
    the hour balance is steered toward zero."""
    return min(1.0, (period_week - 1 + weeks_in_month) / period_weeks)


def weighted(terms: list[tuple[int, cp_model.LinearExprT]]) -> cp_model.LinearExpr:
    kept = [(coef, expr) for coef, expr in terms if coef != 0]
    return cp_model.LinearExpr.weighted_sum([e for _, e in kept], [c for c, _ in kept])


def per_minute(weight_per_hour: float) -> int:
    return round(weight_per_hour * SCALE / 60)


"""Start time used for a day off: far enough that rest is always satisfied."""


@dataclass(frozen=True)
class Candidate:
    start: int
    end: int
    paid: int
    var: cp_model.IntVar


@dataclass
class EmployeeDay:
    """Variables for one employee on one open day."""

    candidates: list[Candidate]
    present: list[cp_model.IntVar]
    """Per slot between grid points: is this person at work?"""
    works: cp_model.IntVar
    worked: cp_model.IntVar
    start: cp_model.IntVar
    """Earliest start that day (OFF if not working)."""
    end: cp_model.IntVar
    """Latest end that day (0 if not working)."""


@dataclass
class Outcome:
    status: Status
    plan: Plan | None
    objective: float | None = None
    primary: float | None = None
    """Objective value without tie-breakers."""
    wall_time_ms: int = 0
    proven: bool = True
    """False when no plan was found but infeasibility wasn't proven (time ran out)."""


def grid_points(info: DayInfo, granularity: int) -> list[int]:
    """Candidate start/end times for one day."""
    assert info.window is not None
    start, end = info.window.start, info.window.end
    points = {start, end}
    points.update(range(math.ceil(start / granularity) * granularity, end, granularity))
    for (a, b), _ in info.ranges:
        points.update(p for p in (a, b) if start < p < end)
    return sorted(points)


class ShiftModel:
    def __init__(
        self, ctx: Context, granularity: int | None = None, tie_breakers: bool = True
    ) -> None:
        self.tie_breakers = tie_breakers
        self.primary: cp_model.LinearExpr = cp_model.LinearExpr.constant(0)
        """The main goals (wishes, balance, daily targets), without tie-breakers."""
        self.ctx = ctx
        self.model = cp_model.CpModel()
        self.split = not ctx.project.rules.one_shift_per_day
        self.granularity = granularity or ctx.project.rules.granularity_min
        self.points: list[list[int] | None] = [
            grid_points(info, self.granularity) if info.window else None for info in ctx.days
        ]
        self.vars: dict[str, list[EmployeeDay | None]] = {}
        self.day_totals: dict[int, cp_model.IntVar] = {}
        self._build()

    # ------------------------------------------------------------------------------------

    def _build(self) -> None:
        for employee in self.ctx.employees:
            self.vars[employee.id] = [
                self._employee_day(employee.id, i) for i in range(len(self.ctx.days))
            ]
            self._rest(employee.id)
            self._consecutive_days(employee.id)
            self._weekly_hours(employee.id)
            self._monthly_limit(employee.id)
        for i in range(len(self.ctx.days)):
            self._coverage(i)
            self._rides(i)
        self._objective()

    def _employee_day(self, employee_id: str, i: int) -> EmployeeDay | None:
        info, points = self.ctx.days[i], self.points[i]
        if points is None:
            return None
        m, limits = self.model, self.ctx.limits[employee_id]
        blocked = self.ctx.blocked(employee_id, info.day)
        longest = min(limits.max_shift, limits.max_per_day)
        tag = f"{employee_id[:8]}_{i}"

        candidates = []
        for start, end in itertools.combinations(points, 2):
            length = end - start
            if length < limits.min_shift or length > longest:
                continue
            if any(overlaps((start, end), w) for w in blocked):
                continue
            var = m.new_bool_var(f"y_{tag}_{start}_{end}")
            paid = length - self.ctx.break_minutes(length)
            candidates.append(Candidate(start, end, paid, var))

        ys = [c.var for c in candidates]
        # Each daily quantity gets its own variable, defined once, so the many constraints
        # that use it (rest, days in a row, weekly hours, objective) stay short.
        longest_paid = max((c.paid for c in candidates), default=0)
        worked = m.new_int_var(0, 2 * longest_paid, f"wk_{tag}")
        m.add(worked == cp_model.LinearExpr.weighted_sum(ys, [c.paid for c in candidates]))
        works = m.new_bool_var(f"w_{tag}")
        start_var = m.new_int_var(0, OFF, f"st_{tag}")
        end_var = m.new_int_var(0, MINUTES_PER_DAY, f"en_{tag}")
        if not self.split:
            m.add(works == sum(ys))
            m.add(
                start_var
                == cp_model.LinearExpr.weighted_sum(ys, [c.start - OFF for c in candidates]) + OFF
            )
            m.add(end_var == cp_model.LinearExpr.weighted_sum(ys, [c.end for c in candidates]))
        else:
            m.add(sum(ys) <= 2)
            lengths = [c.end - c.start for c in candidates]
            m.add(cp_model.LinearExpr.weighted_sum(ys, lengths) <= limits.max_per_day)
            for y in ys:
                m.add_implication(y, works)
            m.add(works <= sum(ys))
            for c in candidates:
                m.add(start_var <= c.start).only_enforce_if(c.var)
                m.add(end_var >= c.end).only_enforce_if(c.var)

        # Flow encoding of presence per slot (see module docstring).
        index = {p: k for k, p in enumerate(points)}
        starting: list[list[cp_model.IntVar]] = [[] for _ in points]
        ending: list[list[cp_model.IntVar]] = [[] for _ in points]
        for c in candidates:
            starting[index[c.start]].append(c.var)
            ending[index[c.end]].append(c.var)
        present = [m.new_bool_var(f"p_{tag}_{k}") for k in range(len(points) - 1)]
        for k, var in enumerate(present):
            previous = present[k - 1] if k > 0 else 0
            m.add(var == previous + sum(starting[k]) - sum(ending[k]))

        return EmployeeDay(
            candidates=candidates,
            present=present,
            works=works,
            worked=worked,
            start=start_var,
            end=end_var,
        )

    def _rest(self, employee_id: str) -> None:
        days = self.vars[employee_id]
        rest = self.ctx.limits[employee_id].min_rest
        for today, tomorrow in itertools.pairwise(days):
            if today is not None and tomorrow is not None:
                self.model.add(tomorrow.start + MINUTES_PER_DAY - today.end >= rest)
        employee = next(e for e in self.ctx.employees if e.id == employee_id)
        last = employee.balance.last_shift_ended_at
        first = days[0] if days else None
        if last is not None and first is not None:
            needed = rest - minutes_since(last, self.ctx.month_start)
            if needed > 0:
                self.model.add(first.start >= needed)

    def _consecutive_days(self, employee_id: str) -> None:
        works = [d.works if d else 0 for d in self.vars[employee_id]]
        limit = self.ctx.limits[employee_id].max_consecutive_days
        for i in range(len(works) - limit):
            self.model.add(sum(works[i : i + limit + 1]) <= limit)
        employee = next(e for e in self.ctx.employees if e.id == employee_id)
        carried = employee.balance.consecutive_days_at_start
        for j in range(1, min(carried, limit) + 1):
            # The last j days of last month were worked: the first (limit + 1 − j) days of
            # this month may contain at most (limit − j) working days.
            self.model.add(sum(works[: limit + 1 - j]) <= limit - j)

    def _weekly_hours(self, employee_id: str) -> None:
        days = self.vars[employee_id]
        limit = self.ctx.limits[employee_id].max_weekly
        for indexes in self.ctx.weeks().values():
            worked = [d.worked for i in indexes if (d := days[i]) is not None]
            if worked:
                self.model.add(sum(worked) <= limit)

    def total_worked(self, employee_id: str) -> cp_model.LinearExprT:
        return sum(d.worked for d in self.vars[employee_id] if d is not None)

    def _monthly_limit(self, employee_id: str) -> None:
        limit = self.ctx.project.rules.monthly_hard_limit_hours
        if limit is None:
            return
        target, total = self.ctx.targets[employee_id], self.total_worked(employee_id)
        self.model.add(total <= target + round(limit * 60))
        self.model.add(total >= target - round(limit * 60))

    def _coverage(self, i: int) -> None:
        info, points = self.ctx.days[i], self.points[i]
        if points is None:
            return
        days = [d for e in self.ctx.employees if (d := self.vars[e.id][i]) is not None]
        n = len(points) - 1
        for k in range(n):
            required = info.min_people
            if k == 0:
                required = max(required, info.min_at_opening)
            if k == n - 1:
                required = max(required, info.min_at_closing)
            for (a, b), people in info.ranges:
                if a <= points[k] and points[k + 1] <= b:
                    required = max(required, people)
            if required > 0:
                self.model.add(sum(d.present[k] for d in days) >= required)
        if info.daily_min is None and info.daily_max is None:
            return
        total = self.model.new_int_var(0, 100 * MINUTES_PER_DAY, f"day_total_{i}")
        self.model.add(total == sum(d.worked for d in days))
        self.day_totals[i] = total
        if self.ctx.project.store.daily_hours_hard:
            if info.daily_min is not None:
                self.model.add(total >= info.daily_min)
            if info.daily_max is not None:
                self.model.add(total <= info.daily_max)

    def _rides(self, i: int) -> None:
        bus = self.ctx.project.rules.bus_rule
        info = self.ctx.days[i]
        if not bus.enabled or info.window is None:
            return
        for employee in self.ctx.employees:
            rider = self.vars[employee.id][i]
            if rider is None:
                continue
            drivers = [
                d for did in self.ctx.drivers.get(employee.id, []) if (d := self.vars[did][i])
            ]
            from_drivers = [c for d in drivers for c in d.candidates]
            if employee.needs_ride_early:
                for t in {c.start for c in rider.candidates if c.start < info.early_cutoff}:
                    self.model.add(
                        sum(c.var for c in rider.candidates if c.start == t)
                        <= sum(c.var for c in from_drivers if c.start == t)
                    )
            if bus.late_enabled and employee.needs_ride_late:
                for t in {c.end for c in rider.candidates if c.end > info.late_cutoff}:
                    self.model.add(
                        sum(c.var for c in rider.candidates if c.end == t)
                        <= sum(c.var for c in from_drivers if c.end == t)
                    )

    def _objective(self) -> None:
        """Minimise, in rough priority order (weights from the project):

        1. broken wishes (day-off wishes cost, work wishes earn),
        2. hour balance: |carry-in + planned − target|, weighted by how far into the balancing
           period the person is, plus a heavier penalty beyond the monthly tolerance,
        3. distance from soft daily hour targets,
        4. subtle tie-breakers: quick returns and isolated single days off.
        """
        weights = self.ctx.project.weights
        primary: list[tuple[int, cp_model.LinearExprT]] = []
        primary += self._wish_terms()
        primary += self._balance_terms()
        primary += self._daily_target_terms(per_minute(weights.daily_target))
        self.primary = weighted(primary)
        ties = self._tie_breaker_terms() if self.tie_breakers else []
        self.model.minimize(weighted([(1, self.primary), *ties]))

    def bound_primary(self, value: float) -> None:
        """Only accept plans at least this good on the main goals (lexicographic polish)."""
        self.model.add(self.primary <= round(value))

    def _wish_terms(self) -> list[tuple[int, cp_model.LinearExprT]]:
        weights = self.ctx.project.weights
        terms: list[tuple[int, cp_model.LinearExprT]] = []
        for entry in self.ctx.project.availability:
            days = self.vars.get(entry.employee_id)
            if entry.kind == "unavailable" or days is None:
                continue
            base = weights.wish_off if entry.kind == "wish_off" else weights.wish_work
            coef = round(base * entry.weight * SCALE)
            if coef == 0:
                continue
            sign = 1 if entry.kind == "wish_off" else -1
            for info, day in zip(self.ctx.days, days, strict=True):
                if day is None:
                    continue
                for window in entry_windows(entry, info.day):
                    terms.append((sign * coef, self._works_during(day, window)))
        return terms

    def _works_during(self, day: EmployeeDay, window: tuple[int, int]) -> cp_model.LinearExprT:
        """1 if a chosen shift overlaps `window` (whole day: if working at all)."""
        if window == (0, MINUTES_PER_DAY):
            return day.works
        overlapping = [c.var for c in day.candidates if overlaps((c.start, c.end), window)]
        if not overlapping:
            return 0
        hit = self.model.new_int_var(0, 2, "")
        self.model.add(hit == sum(overlapping))
        return hit

    def _balance_terms(self) -> list[tuple[int, cp_model.LinearExprT]]:
        weights, rules = self.ctx.project.weights, self.ctx.project.rules
        tolerance = round(rules.monthly_tolerance_hours * 60)
        weeks_in_month = len(self.ctx.days) / 7
        terms: list[tuple[int, cp_model.LinearExprT]] = []
        for employee in self.ctx.employees:
            target = self.ctx.targets[employee.id]
            planned = self.model.new_int_var(0, 31 * MINUTES_PER_DAY, f"planned_{employee.id[:8]}")
            self.model.add(planned == self.total_worked(employee.id))
            carry = round(employee.balance.carry_in_hours * 60)

            # Distance of the resulting balance from zero, steered harder near the period end.
            progress = period_progress(
                employee.balance.period_week, weeks_in_month, rules.balancing_period_weeks
            )
            balance = self.model.new_int_var(0, 100_000, f"balance_{employee.id[:8]}")
            self.model.add_abs_equality(balance, carry + planned - target)
            terms.append((per_minute(weights.hour_balance * progress), balance))

            # This month's deviation beyond the tolerance (heavier).
            deviation = self.model.new_int_var(0, 100_000, f"dev_{employee.id[:8]}")
            self.model.add_abs_equality(deviation, planned - target)
            beyond = self.model.new_int_var(0, 100_000, f"beyond_{employee.id[:8]}")
            self.model.add(beyond >= deviation - tolerance)
            terms.append((per_minute(weights.beyond_tolerance), beyond))
        return terms

    def _daily_target_terms(self, coef: int) -> list[tuple[int, cp_model.LinearExprT]]:
        if self.ctx.project.store.daily_hours_hard or coef == 0:
            return []
        terms: list[tuple[int, cp_model.LinearExprT]] = []
        for i, total in self.day_totals.items():
            info = self.ctx.days[i]
            if info.daily_min is not None:
                under = self.model.new_int_var(0, info.daily_min, f"under_{i}")
                self.model.add(under >= info.daily_min - total)
                terms.append((coef, under))
            if info.daily_max is not None:
                over = self.model.new_int_var(0, 100 * MINUTES_PER_DAY, f"over_{i}")
                self.model.add(over >= total - info.daily_max)
                terms.append((coef, over))
        return terms

    def _tie_breaker_terms(self) -> list[tuple[int, cp_model.LinearExprT]]:
        weights = self.ctx.project.weights
        quick = round(weights.short_gap * SCALE)
        isolated = round(weights.contiguous_days_off * SCALE)
        terms: list[tuple[int, cp_model.LinearExprT]] = []
        for employee in self.ctx.employees:
            days = self.vars[employee.id]
            if quick:
                # A "quick return": less than QUICK_RETURN between two working days.
                for today, tomorrow in itertools.pairwise(days):
                    if today is None or tomorrow is None:
                        continue
                    q = self.model.new_bool_var("")
                    gap = tomorrow.start + MINUTES_PER_DAY - today.end
                    self.model.add(gap + QUICK_RETURN * q >= QUICK_RETURN)
                    terms.append((quick, q))
            if isolated:
                # A single day off between two working days.
                for before, day, after in zip(days, days[1:], days[2:], strict=False):
                    if before is None or day is None or after is None:
                        continue
                    single = self.model.new_bool_var("")
                    self.model.add(single >= before.works + after.works - day.works - 1)
                    terms.append((isolated, single))
        return terms

    # ------------------------------------------------------------------------------------

    def hint(self, plan: Plan) -> None:
        """Start the search from an existing plan (e.g. from a coarser grid)."""
        chosen = {
            (s.employee_id, s.date, to_minutes(s.start), to_minutes(s.end)) for s in plan.shifts
        }
        for employee_id, days in self.vars.items():
            for info, day in zip(self.ctx.days, days, strict=True):
                for c in day.candidates if day else []:
                    key = (employee_id, info.date, c.start, c.end)
                    self.model.add_hint(c.var, key in chosen)

    def solve(
        self,
        time_limit_seconds: float,
        workers: int = 8,
        seed: int = 0,
        light_presolve: bool = False,
    ) -> Outcome:
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_seconds
        solver.parameters.num_workers = workers
        solver.parameters.random_seed = seed
        if light_presolve:
            for name, value in LIGHT_PRESOLVE.items():
                setattr(solver.parameters, name, value)
        code = solver.solve(self.model)
        wall_ms = round(solver.wall_time * 1000)
        if code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return Outcome(
                status="infeasible",
                plan=None,
                wall_time_ms=wall_ms,
                proven=code == cp_model.INFEASIBLE,
            )
        return Outcome(
            status="optimal" if code == cp_model.OPTIMAL else "feasible",
            plan=self._extract(solver),
            objective=solver.objective_value,
            primary=solver.value(self.primary),
            wall_time_ms=wall_ms,
        )

    def _extract(self, solver: cp_model.CpSolver) -> Plan:
        shifts = [
            Shift(
                id=str(uuid.uuid4()),
                employee_id=employee_id,
                date=info.date,
                start=from_minutes(c.start),
                end=from_minutes(c.end),
            )
            for employee_id, days in self.vars.items()
            for info, day in zip(self.ctx.days, days, strict=True)
            if day is not None
            for c in day.candidates
            if solver.boolean_value(c.var)
        ]
        shifts.sort(key=lambda s: (s.date, s.start, s.employee_id))
        return Plan(shifts=shifts)


COARSE_GRID = 60
COARSE_SHARE = 0.75
LIGHT_PRESOLVE = {
    # Used when refining from a good hint: a full presolve of the fine model takes seconds,
    # which is better spent improving the hinted plan.
    "cp_model_probing_level": 0,
    "merge_at_most_one_work_limit": 0,
    "symmetry_level": 0,
    "presolve_inclusion_work_limit": 0,
}


def solve_staged(ctx: Context, time_limit_seconds: float, workers: int = 8) -> Outcome:
    """Two stages:

    1. A coarse 60-minute grid, main goals only (no tie-breakers). Small, so it finds very
       good plans fast; it stops early if it proves its optimum.
    2. The configured grid with the full objective, starting from stage 1's plan (every
       coarse shift is also a fine candidate) and only accepting plans at least as good on
       the main goals, so tie-breakers polish without trading away wishes or hours.
    """
    started = time.perf_counter()
    coarse_grid = max(COARSE_GRID, ctx.project.rules.granularity_min)
    coarse = ShiftModel(ctx, granularity=coarse_grid, tie_breakers=False).solve(
        max(1.0, time_limit_seconds * COARSE_SHARE), workers
    )
    fine = ShiftModel(ctx)
    hinted = coarse.plan is not None and COARSE_GRID % ctx.project.rules.granularity_min == 0
    if hinted and coarse.plan is not None and coarse.primary is not None:
        fine.hint(coarse.plan)
        fine.bound_primary(coarse.primary)
    remaining = max(1.0, time_limit_seconds - (time.perf_counter() - started))
    refined = fine.solve(remaining, workers, light_presolve=hinted)
    best = refined if refined.plan is not None else coarse
    if best.plan is None:
        # Only the fine model can prove infeasibility: the coarse grid has fewer options.
        return refined
    status: Status = "optimal" if best is refined and refined.status == "optimal" else "feasible"
    return Outcome(
        status=status,
        plan=best.plan,
        objective=best.objective,
        primary=best.primary,
        wall_time_ms=round((time.perf_counter() - started) * 1000),
    )
