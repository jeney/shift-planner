from collections import Counter

import pytest

from shift_planner.domain.factory import demo_project, new_project
from shift_planner.domain.project import Project


def test_new_project_is_empty_with_defaults() -> None:
    project = new_project("2027-02")
    assert project.month == "2027-02"
    assert project.employees == []
    assert project.availability == []
    assert project.plan is None


@pytest.mark.parametrize("month", ["2027-01", "2027-02", "2028-02", "2027-04"])
def test_demo_project_is_valid_for_any_month(month: str) -> None:
    project = demo_project(month)
    # Round-trip through JSON proves it is a valid, self-consistent project.
    assert Project.model_validate_json(project.model_dump_json()) == project


def test_demo_team_composition() -> None:
    project = demo_project("2027-02")
    hours = Counter(e.contract_hours_per_week for e in project.employees)
    assert hours == {40: 2, 20: 4, 10: 3}
    assert any(not e.has_car for e in project.employees)
    assert any(e.needs_ride_early for e in project.employees)
    kinds = {a.kind for a in project.availability}
    assert kinds == {"unavailable", "wish_off", "wish_work"}
    assert len({e.color for e in project.employees}) == len(project.employees)
