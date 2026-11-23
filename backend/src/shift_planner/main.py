from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shift_planner import __version__
from shift_planner.api import health
from shift_planner.config import settings


def create_app() -> FastAPI:
    app = FastAPI(
        title="Shift Planner API",
        version=__version__,
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router, prefix="/api")
    return app


app = create_app()
