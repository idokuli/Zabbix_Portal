"""Pydantic request models for team endpoints."""

from pydantic import BaseModel


class TeamRequest(BaseModel):
    name: str
    description: str | None = ""


class HostAssignRequest(BaseModel):
    hostname: str


class MemberRequest(BaseModel):
    user_id: int
