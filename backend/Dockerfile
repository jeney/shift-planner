# Works with both BuildKit and the legacy builder. Targets: prod (default in compose.yaml), dev.
ARG PYTHON_VERSION=3.12

# ---- base: Python + uv ----
FROM python:${PYTHON_VERSION}-slim AS base
COPY --from=ghcr.io/astral-sh/uv:0.13.9 /uv /uvx /bin/
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"
WORKDIR /app

# ---- build: runtime deps + project, non-editable ----
FROM base AS build
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY README.md ./
COPY src ./src
RUN uv sync --locked --no-dev --no-editable

# ---- prod: slim runtime, non-root ----
FROM python:${PYTHON_VERSION}-slim AS prod
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/opt/venv/bin:$PATH"
RUN useradd --system --uid 10001 app
COPY --from=build /opt/venv /opt/venv
USER app
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"]
CMD ["uvicorn", "shift_planner.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]

# ---- dev: all deps, source bind-mounted, hot reload ----
# Kept last so the legacy builder doesn't build it for the prod target.
FROM base AS dev
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project
COPY . .
RUN uv sync --locked
EXPOSE 8000
CMD ["uvicorn", "shift_planner.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "src"]
