"""Pydantic request models for metrics/problem endpoints."""

from pydantic import BaseModel


class AcknowledgeRequest(BaseModel):
    problem_name: str = ""
    hostname: str = ""
    severity: int = 0
    note: str = ""
