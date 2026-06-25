"""Pydantic request models for trigger endpoints."""

from typing import Literal

from pydantic import BaseModel


class TriggerRequest(BaseModel):
    hostname: str
    item_key: str
    trigger_name: str
    threshold: float | None = None  # required for numeric items
    operator: Literal[">", ">=", "<", "<=", "=", "<>"] | None = ">"
    severity: int | None = 3
    string_pattern: str | None = None  # set for string/text items
    match_type: Literal["like", "notlike", "regexp", "notregexp"] | None = "like"
    event_name: str = ""  # optional — shown in Problems view when trigger fires
    comments: str = ""  # optional — internal notes stored on the trigger


class TriggerUpdateRequest(BaseModel):
    description: str | None = None
    priority: int | None = None
    status: int | None = None  # 0=enabled 1=disabled
    expression: str | None = None
    event_name: str | None = None
    comments: str | None = None


class BulkTriggerRequest(BaseModel):
    hostnames: list[str]
    item_key: str
    trigger_name: str
    threshold: float
    operator: Literal[">", ">=", "<", "<="] | None = ">"
    priority: int = 3
