from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from shift_planner import __version__
from shift_planner.api import calendar, health, project
from shift_planner.api.errors import ApiErrorResponse
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

    @app.exception_handler(ApiErrorResponse)
    async def handle_api_exception(_request: Request, exc: ApiErrorResponse) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.error.model_dump(mode="json"))

    app.include_router(health.router, prefix="/api")
    app.include_router(calendar.router, prefix="/api")
    app.include_router(project.router, prefix="/api")
    return app


app = create_app()
