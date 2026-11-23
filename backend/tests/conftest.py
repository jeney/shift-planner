import pytest
from fastapi.testclient import TestClient

from shift_planner.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
