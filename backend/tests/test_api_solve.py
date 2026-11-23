from fastapi.testclient import TestClient

from tests.factories import employee, project


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


def test_solve_reports_a_proven_infeasible_project(client: TestClient) -> None:
    p = project(employee("a"), time_limit=3)  # one person can't work 7 days a week
    body = client.post("/api/solve", json=p.model_dump(mode="json")).json()
    assert body["status"] == "infeasible"
    assert body["plan"] is None
    assert body["diagnostics"] == []


def test_solve_rejects_an_invalid_project(client: TestClient) -> None:
    assert client.post("/api/solve", json={"schemaVersion": 3, "id": "p"}).status_code == 422
