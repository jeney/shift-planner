from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from shift_planner import __version__

router = APIRouter(tags=["meta"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str


@router.get("/health", operation_id="health")
def health() -> HealthResponse:
    return HealthResponse(status="ok", version=__version__)
