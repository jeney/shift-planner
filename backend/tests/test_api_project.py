from fastapi.testclient import TestClient


def test_calendar(client: TestClient) -> None:
    response = client.get("/api/calendar/2026-12")
    assert response.status_code == 200
    days = response.json()["days"]
    assert len(days) == 31
    assert days[24] == {
        "date": "2026-12-25",
        "weekday": 4,
        "isoWeek": 52,
        "dayType": "holiday",
        "holiday": "christmas_day",
        "notable": None,
    }


def test_calendar_rejects_bad_month(client: TestClient) -> None:
    assert client.get("/api/calendar/2026-13").status_code == 422


def test_new_project(client: TestClient) -> None:
    response = client.get("/api/project/new", params={"month": "2027-02"})
    assert response.status_code == 200
    body = response.json()
    assert body["schemaVersion"] == 2
    assert body["month"] == "2027-02"
    assert body["employees"] == []
    assert body["store"]["openingHours"]["monday"]["closes"] == "20:00"


def test_demo_project(client: TestClient) -> None:
    body = client.get("/api/project/demo", params={"month": "2027-02"}).json()
    assert len(body["employees"]) == 9


def test_migrate_round_trip(client: TestClient) -> None:
    demo = client.get("/api/project/demo", params={"month": "2027-02"}).json()
    response = client.post("/api/project/migrate", json=demo)
    assert response.status_code == 200
    assert response.json() == demo


def test_migrate_newer_version(client: TestClient) -> None:
    response = client.post("/api/project/migrate", json={"schemaVersion": 5})
    assert response.status_code == 422
    assert response.json() == {
        "code": "project.newerSchemaVersion",
        "params": {"version": 5, "supported": 2},
        "details": [],
    }


def test_migrate_invalid_project(client: TestClient) -> None:
    response = client.post(
        "/api/project/migrate", json={"schemaVersion": 2, "id": "p", "month": "nope"}
    )
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "project.invalid"
    assert body["details"][0]["loc"] == ["month"]
