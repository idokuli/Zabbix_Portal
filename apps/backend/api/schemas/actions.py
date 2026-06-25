"""Pydantic request models for action/media-type/script endpoints."""

from pydantic import BaseModel


class ActionCreateRequest(BaseModel):
    name: str
    eventsource: int = 0
    esc_period: str = "1h"


class MediaTypeCreateRequest(BaseModel):
    name: str
    type: int = 0
    description: str = ""
    smtp_server: str = ""
    smtp_helo: str = ""
    smtp_email: str = ""
    script: str = ""
    webhook_script: str = ""


class MediaTypeUpdateRequest(BaseModel):
    name: str
    type: int = 0
    description: str = ""
    smtp_server: str = ""
    smtp_email: str = ""
    script: str = ""
    webhook_script: str = ""


class ScriptCreateRequest(BaseModel):
    name: str
    command: str
    execute_on: int = 1
    scope: int = 2
    description: str = ""
