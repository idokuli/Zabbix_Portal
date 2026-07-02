"""Pydantic request models for custom alert rule endpoints."""

from pydantic import BaseModel


class AlertRuleCreate(BaseModel):
    rule_type: str = "item"
    # item rules
    item_id: str | None = None
    item_name: str | None = None
    hostname: str | None = None
    operator: str | None = None
    threshold: float | None = None
    severity: int = 2
    # service rules
    expected_contains: str = "ok"


class AlertRuleUpdate(BaseModel):
    severity: int
    # item rules
    operator: str | None = None
    threshold: float | None = None
    item_id: str | None = None
    item_name: str | None = None
    hostname: str | None = None
    # service rules
    expected_contains: str | None = None
