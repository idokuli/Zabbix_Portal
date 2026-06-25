"""Pydantic request models for auth endpoints."""

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str
