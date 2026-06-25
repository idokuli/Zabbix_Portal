"""Pydantic request models for user endpoints."""

from pydantic import BaseModel, Field


class UserRequest(BaseModel):
    username: str
    password: str
    email: str | None = ""
    roles: list[str] = Field(default_factory=lambda: ["member"])
    team_id: int | None = None


class PasswordChangeRequest(BaseModel):
    new_password: str


class UserUpdateRequest(BaseModel):
    roles: list[str]
    team_id: int | None = None
