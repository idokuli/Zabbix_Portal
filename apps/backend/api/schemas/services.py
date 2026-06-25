"""Pydantic request models for business services / SLA endpoints."""

from pydantic import BaseModel


class ServiceCreateRequest(BaseModel):
    name: str
    algorithm: int = 0
    sortorder: int = 0
    weight: int = 0
    description: str = ""


class ServiceUpdateRequest(BaseModel):
    name: str | None = None
    algorithm: int | None = None
    description: str | None = None


class SlaCreateRequest(BaseModel):
    name: str
    slo: float = 99.9
    period: str = "PERIOD_MONTHLY"
    timezone: str = "UTC"
    description: str = ""
    service_tags: list[dict] = []


class HealthMonitorCreateRequest(BaseModel):
    hostid: str
    name: str
    url: str
    expected_contains: str = "ok"
    process_name: str | None = None
