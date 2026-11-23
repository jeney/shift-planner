"""Guest-based demand: expected guests → required total staff hours for a day."""

import itertools

from shift_planner.domain.project import GuestDemand


def guest_hours(guests: int, demand: GuestDemand) -> float | None:
    """Staff hours for `guests`, from the conversion points (sorted by guests).

    * linear: interpolate between neighbouring points;
    * steps:  use the hours of the highest point at or below `guests`.
    Below the first point or above the last, the nearest point's hours apply (clamped).
    """
    points = demand.points
    if not points:
        return None
    if guests <= points[0].guests:
        return points[0].hours
    if guests >= points[-1].guests:
        return points[-1].hours
    for low, high in itertools.pairwise(points):
        if low.guests <= guests < high.guests:
            if demand.mode == "steps":
                return low.hours
            share = (guests - low.guests) / (high.guests - low.guests)
            return low.hours + share * (high.hours - low.hours)
    return points[-1].hours  # unreachable: covered by the clamps above
