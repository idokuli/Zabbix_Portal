"""Shared FastAPI dependencies and route helpers."""

import logging
from contextlib import contextmanager
from collections.abc import Generator

import User_Management as um
from Database import get_conn
from fastapi import HTTPException
from Zabbix_Base import zabbix_err  # re-exported for route imports

logger = logging.getLogger(__name__)

__all__ = [
    "zabbix_err",
    "live_team_id",
    "team_hostname_filter",
    "team_group_names",
    "resolve_team",
    "team_tag",
    "zabbix_call",
    "is_global_viewer",
]


def is_global_viewer(current_user: dict) -> bool:
    """True for roles that see data across every team (root, auditor)."""
    roles = current_user.get("roles", [])
    return any(r in roles for r in ("root", "auditor"))


def live_team_id(current_user: dict) -> int | None:
    """Re-fetch team_id from the DB so stale JWTs (minted before a team change) still work."""
    try:
        user_id = int(current_user.get("sub", 0))
        live = um.get_user_by_id(user_id) if user_id else None
        return (live.get("team_id") if live else None) or current_user.get("team_id")
    except Exception as exc:
        logger.debug("live_team_id DB lookup failed, falling back to JWT: %s", exc)
        return current_user.get("team_id")


def resolve_team(current_user: dict) -> str:
    """Resolve the caller's team name, or empty string for root/teamless users."""
    team_id = live_team_id(current_user)
    return (um.get_team_name(team_id) if team_id else "") or ""


def team_tag(current_user: dict, apply_team_tag: bool) -> str:
    """Resolve the caller's team name for auto-tagging newly created objects,
    unless the caller opted out via apply_team_tag=False."""
    return resolve_team(current_user) if apply_team_tag else ""


def team_hostname_filter(current_user: dict) -> set[str] | None:
    """Return the union of hostnames visible to this user across all their teams.
    Returns None for root/auditor (unrestricted).
    Returns an empty set when the user has no team memberships.
    """
    if is_global_viewer(current_user):
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


def team_group_names(current_user: dict) -> list[str] | None:
    """Names of every Zabbix host group this user's team(s) own — each team's own
    auto-created same-named group (see ZabbixSync.push_team()) plus any groups
    explicitly linked via team_host_groups (see User_Management.link_team_group()).
    Ordered by each team's admin-set display_order for users in 2+ teams, with a
    team's linked groups grouped right after its own name.
    Returns None for root/auditor (unrestricted — see every host group).
    Returns an empty list when the user has no team memberships.
    """
    if is_global_viewer(current_user):
        return None
    user_id = int(current_user.get("sub", 0) or 0)
    if not user_id:
        return []
    names: list[str] = []
    seen: set[str] = set()
    for team in um.get_user_teams_ordered(user_id):
        for name in (team["name"], *um.list_team_linked_groups(team["id"])):
            if name not in seen:
                seen.add(name)
                names.append(name)
    return names


@contextmanager
def zabbix_call(status: int = 422) -> Generator[None, None, None]:
    """Wrap a single Zabbix manager call; converts RuntimeError to HTTPException."""
    try:
        yield
    except RuntimeError as e:
        raise HTTPException(status_code=status, detail=zabbix_err(e)) from e
