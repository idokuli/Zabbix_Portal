"""Shared FastAPI dependencies and route helpers."""

import User_Management as um
from Database import get_conn


def live_team_id(current_user: dict) -> int | None:
    """Re-fetch team_id from the DB so stale JWTs (minted before a team change) still work."""
    try:
        user_id = int(current_user.get("sub", 0))
        live = um.get_user_by_id(user_id) if user_id else None
        return (live.get("team_id") if live else None) or current_user.get("team_id")
    except Exception:
        return current_user.get("team_id")


def team_hostname_filter(current_user: dict) -> set[str] | None:
    """Return the set of hostnames visible to this user.
    Returns None for root/auditor (no restriction).
    Returns an empty set when the user has no team assignment.
    """
    roles = current_user.get("roles", [])
    if any(r in roles for r in ("root", "auditor")):
        return None
    team_id = live_team_id(current_user)
    if not team_id:
        return set()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT hostname FROM host_assignments WHERE team_id = %s",
                (team_id,),
            )
            return {row["hostname"] for row in cur.fetchall()}
    finally:
        conn.close()
