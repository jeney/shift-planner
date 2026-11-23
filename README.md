# Shift Planner

[![CI](https://github.com/jeney/shift-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/jeney/shift-planner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A shift-planning web app for a single store manager with a small team. Enter opening hours,
staffing needs, employees and their availability. The app generates an optimal monthly plan
with Google OR-Tools CP-SAT, and you can fine-tune it by hand with live rule checking.

- **No accounts, no database.** The browser owns all data (autosave + save/open as `.json`).
- **English, Danish and Hungarian.**
- Simple by default. Every rule and weight is available under *Advanced settings*.

> 🚧 Early development. See the [roadmap](#roadmap).

## Quick start

You need Docker with Docker Compose.

```bash
docker compose up --build
```

Then open <http://localhost:8080>. Set `FRONTEND_PORT=9000` to use another port.

### Development (hot reload)

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

| What | URL |
|---|---|
| Frontend (Vite) | <http://localhost:5173> |
| Backend API docs | <http://localhost:8000/api/docs> |

### Without Docker

Requirements: [uv](https://docs.astral.sh/uv/) and Node.js 22.

```bash
# Terminal 1: backend
cd backend
uv sync
uv run uvicorn shift_planner.main:app --reload

# Terminal 2: frontend (proxies /api to localhost:8000)
cd frontend
npm ci
npm run dev
```

## Project layout

```
backend/    FastAPI + Pydantic v2 + OR-Tools CP-SAT (stateless; every request carries the full project)
frontend/   React + Vite + TypeScript, Tailwind CSS + shadcn/ui, react-i18next, TanStack Query
scripts/    Helper scripts (e.g. regenerating API types)
compose.yaml       Production-like stack: nginx serves the frontend and proxies /api to the backend
compose.dev.yaml   Development overrides with hot reload
```

### API types

The Pydantic models are the canonical schema. The frontend's TypeScript types are generated from
the OpenAPI spec, and CI fails if they're out of date:

```bash
./scripts/gen-api.sh
```

## Checks

| | Backend (`cd backend`) | Frontend (`cd frontend`) |
|---|---|---|
| Lint | `uv run ruff check .` | `npm run lint` |
| Format | `uv run ruff format .` | `npm run format` |
| Types | `uv run mypy src tests` | `npm run typecheck` |
| Tests | `uv run pytest` | `npm test` |
| E2E | | `npm run e2e` (or `E2E_BASE_URL=http://localhost:8080 npm run e2e` against Docker) |

CI runs all of these on every pull request, along with a Docker build and an e2e smoke test against the
production-like stack.

## Contributing workflow

- `main` only changes through pull requests.
- Use branches named `feat/…`, `fix/…` or `chore/…`, with [Conventional Commits](https://www.conventionalcommits.org/).
- PRs are squash-merged once CI is green.
- Never commit real employee data. Demo data is fictional.

## Roadmap

0. ✅ Scaffold: repo, Docker, CI, health endpoint, app shell with language switcher
1. Schema: project model, generated TS types, save/open, autosave, demo project
2. Setup UI: Store, Employees, Availability & wishes, Advanced settings
3. Solver core: hard constraints, coverage, `/api/solve`
4. Objective: wishes, hour-balance steering, daily targets
5. Diagnostics and best-effort plans with violation reporting
6. Plan grid: editing, live validation, undo/redo, pin & re-generate
7. Export: PDF/print, ODS/XLSX
8. Guest-based demand (optional feature)
9. Polish: design pass, translations review, e2e tests, docs

## License

[MIT](LICENSE)
