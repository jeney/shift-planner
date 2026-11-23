from fastapi.testclient import TestClient

from tests.factories import employee, plan, project, shift


def test_solve_returns_a_checked_plan_with_stats(client: TestClient) -> None:
    p = project(employee("a"), employee("b"), time_limit=3)
    response = client.post("/api/solve", json=p.model_dump(mode="json"))
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in ("optimal", "feasible")
    assert len(body["plan"]["shifts"]) >= 28
    assert {s["employeeId"] for s in body["stats"]} == {"a", "b"}
    assert [v for v in body["violations"] if v["severity"] == "error"] == []
    assert body["solveTimeMs"] > 0


def test_solve_returns_a_best_effort_plan_with_diagnostics(client: TestClient) -> None:
    p = project(employee("a"), time_limit=3)  # one person can't work 7 days a week
    body = client.post("/api/solve", json=p.model_dump(mode="json")).json()
    assert body["status"] == "best_effort"
    assert body["plan"]["shifts"]
    assert any(v["severity"] == "error" for v in body["violations"])
    assert "not_enough_working_days" in {d["code"] for d in body["diagnostics"]}


def test_diagnose(client: TestClient) -> None:
    p = project(employee("a"))
    body = client.post("/api/diagnose", json=p.model_dump(mode="json")).json()
    assert {(d["code"], d["severity"]) for d in body["diagnostics"]} == {
        ("not_enough_working_days", "error"),
        ("hours_below_demand", "warning"),  # 20 h/week can't staff 8 h a day
    }


def test_validate_a_hand_edited_plan(client: TestClient) -> None:
    p = project(employee("a"), employee("b"))
    p.plan = plan(shift("a", "2027-02-01", "09:00", "11:00"))
    body = client.post("/api/validate", json=p.model_dump(mode="json")).json()
    rules = {v["rule"] for v in body["violations"]}
    assert "shift_too_short" in rules
    a = next(s for s in body["stats"] if s["employeeId"] == "a")
    assert (a["shifts"], a["plannedHours"]) == (1, 2.0)


def test_solve_rejects_an_invalid_project(client: TestClient) -> None:
    assert client.post("/api/solve", json={"schemaVersion": 3, "id": "p"}).status_code == 422
