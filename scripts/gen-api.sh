#!/usr/bin/env bash
# Regenerate frontend/openapi.json from the backend's Pydantic models,
# then the TypeScript types in frontend/src/api/schema.ts.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
(cd "$root/backend" && uv run python -m shift_planner.export_openapi) > "$root/frontend/openapi.json"
(cd "$root/frontend" && npm run --silent gen:api)
echo "API types regenerated."
