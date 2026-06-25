"""Pydantic request models for custom alert rule endpoints."""

from pydantic import BaseModel


class AlertRuleCreate(BaseModel):
    item_id: str
    item_name: str
    hostname: str
    operator: str
    threshold: float
    severity: int = 2


class AlertRuleUpdate(BaseModel):
    operator: str
    threshold: float
    severity: int
    item_id: str | None = None
    item_name: str | None = None
    hostname: str | None = None
