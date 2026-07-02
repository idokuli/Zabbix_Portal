"""Shared FastAPI dependencies and route helpers."""

from contextlib import contextmanager
from typing import Generator

import User_Management as um
from Database import get_conn
from fastapi import HTTPException
from Zabbix_Base import zabbix_err  # re-exported for route imports

__all__ = [
    "zabbix_err",
    "live_team_id",
    "team_hostname_filter",
    "resolve_team",
    "zabbix_call",
]


def live_team_id(current_user: dict) -> int | None:
    """Re-fetch team_id from the DB so stale JWTs (minted before a team change) still work."""
    try:
        user_id = int(current_user.get("sub", 0))
        live = um.get_user_by_id(user_id) if user_id else None
        return (live.get("team_id") if live else None) or current_user.get("team_id")
    except Exception:
        return current_user.get("team_id")


def resolve_team(current_user: dict) -> str:
    """Resolve the caller's team name, or empty string for root/teamless users."""
    team_id = live_team_id(current_user)
    return (um.get_team_name(team_id) if team_id else "") or ""


def team_hostname_filter(current_user: dict) -> set[str] | None:
    """Return the union of hostnames visible to this user across all their teams.
    Returns None for root/auditor (unrestricted).
    Returns an empty set when the user has no team memberships.
    """
    roles = current_user.get("roles", [])
    if any(r in roles for r in ("root", "auditor")):
        return None
    user_id = int(current_user.get("sub", 0) or 0)
    if not user_id:
        return set()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT DISTINCT ha.hostname
                   FROM user_team_memberships utm
                   JOIN host_assignments ha ON ha.team_id = utm.team_id
                   WHERE utm.user_id = %s""",
                (user_id,),
            )
            return {row["hostname"] for row in cur.fetchall()}
    finally:
        conn.close()


@contextmanager
def zabbix_call(status: int = 422) -> Generator[None, None, None]:
    """Wrap a single Zabbix manager call; converts RuntimeError to HTTPException."""
    try:
        yield
    except RuntimeError as e:
        raise HTTPException(status_code=status, detail=zabbix_err(e))
