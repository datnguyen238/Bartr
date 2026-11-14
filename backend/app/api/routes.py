"""Foundation endpoints; no external service calls."""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal['ok']
    service: str


def create_router(name: str) -> APIRouter:
    router = APIRouter()

    @router.get('/health', response_model=HealthResponse, tags=['System'])
    def health() -> HealthResponse:
        return HealthResponse(status='ok', service=name)

    return router
