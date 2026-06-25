"""Pydantic request models for dashboard endpoints."""

from pydantic import BaseModel


class DashboardLayoutRequest(BaseModel):
    scope: str
    widgets: list[dict]


class DashboardPageCreateRequest(BaseModel):
    scope: str
    kind: str
    name: str


class DashboardPageRenameRequest(BaseModel):
    scope: str
    name: str
