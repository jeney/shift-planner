from typing import Any

from pydantic import Field

from shift_planner.domain.base import ApiModel


class ErrorDetail(ApiModel):
    loc: list[str | int] = Field(default_factory=list)
    message: str


class ApiError(ApiModel):
    """Error with a translatable message key; the frontend renders `code` with `params`."""

    code: str
    params: dict[str, Any] = Field(default_factory=dict)
    details: list[ErrorDetail] = Field(default_factory=list)


class ApiErrorResponse(Exception):  # noqa: N818 - it is a response, not an error type
    """Raise from a route to return `error` as JSON with `status_code`."""

    def __init__(self, status_code: int, error: ApiError) -> None:
        super().__init__(error.code)
        self.status_code = status_code
        self.error = error
