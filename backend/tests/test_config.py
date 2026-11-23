import pytest

from shift_planner import config


def test_workers_follow_available_cpus(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config.settings, "solver_workers", None)
    for cpus, workers in [(0.1, 4), (1.0, 4), (2.0, 4), (3.0, 6), (16.0, 8)]:
        monkeypatch.setattr(config, "available_cpus", lambda c=cpus: c)
        assert config.solver_workers() == workers


def test_workers_can_be_set_explicitly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config.settings, "solver_workers", 3)
    assert config.solver_workers() == 3


def test_available_cpus_is_positive() -> None:
    assert config.available_cpus() > 0
