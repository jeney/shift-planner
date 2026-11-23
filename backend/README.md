# Shift Planner – backend

Stateless FastAPI service. Every request carries the full project; nothing is stored server-side.

```bash
uv sync
uv run uvicorn shift_planner.main:app --reload   # http://localhost:8000/api/health
uv run pytest
uv run ruff check . && uv run ruff format --check .
uv run mypy src tests
uv run python -m shift_planner.export_openapi > ../frontend/openapi.json
```
