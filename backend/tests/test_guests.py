"""Guests → staff hours. The frontend mirrors these exact vectors (lib/guests.test.ts)."""

import pytest

from shift_planner.domain.guests import guest_hours
from shift_planner.domain.project import GuestDemand, GuestPoint

LINEAR = [(900, 20), (1000, 20), (1100, 22), (1250, 25), (1400, 28), (1500, 30), (1600, 30)]
STEPS = [(900, 20), (1000, 20), (1100, 20), (1250, 25), (1499, 25), (1500, 30), (1600, 30)]


@pytest.mark.parametrize(("guests", "hours"), LINEAR)
def test_linear_interpolation_with_clamping(guests: int, hours: float) -> None:
    assert guest_hours(guests, GuestDemand()) == pytest.approx(hours)


@pytest.mark.parametrize(("guests", "hours"), STEPS)
def test_step_tiers_with_clamping(guests: int, hours: float) -> None:
    assert guest_hours(guests, GuestDemand(mode="steps")) == pytest.approx(hours)


def test_points_are_sorted_and_empty_tables_give_nothing() -> None:
    demand = GuestDemand(points=[GuestPoint(guests=2000, hours=40), GuestPoint(guests=0, hours=0)])
    assert guest_hours(1000, demand) == pytest.approx(20)
    assert guest_hours(1000, GuestDemand(points=[])) is None
