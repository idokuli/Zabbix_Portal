import logging
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from Auth import get_current_user
from Database import get_conn
from api.deps import live_team_id, team_hostname_filter
from api.managers import metrics_bot
from api.schemas import AcknowledgeRequest, AddNoteRequest

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Metrics"])


def _require_host_access(current_user: dict, hostname: str, action_verb: str) -> None:
    """Raise if a non-root user doesn't have their team assigned to this host."""
    if "root" in current_user.get("roles", []):
        return
    if not hostname:
        raise HTTPException(status_code=400, detail=f"hostname is required to {action_verb}.")
    user_team_id = live_team_id(current_user)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT team_id FROM host_assignments WHERE hostname = %s",
                (hostname,),
            )
            rows = cur.fetchall()
    finally:
        conn.close()
    # A host with no assignment rows is unrestricted; one with assignments
    # must include the user's own team among them (a host can belong to
    # more than one team).
    if rows and not any(r["team_id"] == user_team_id for r in rows):
        raise HTTPException(
            status_code=403,
            detail=f"You can only {action_verb} problems for hosts assigned to your team.",
        )


@router.get("/metrics/problems", tags=["Metrics"], summary="Active Zabbix problems")
def get_problems(current_user: dict = Depends(get_current_user)):
    problems = metrics_bot.get_problems()
    if not problems:
        return {"problems": problems}

    # root and auditor see all problems; everyone else sees only their team's hosts.
    allowed = team_hostname_filter(current_user)
    if allowed is not None:
        problems = [p for p in problems if p["hostname"] in allowed]

    if not problems:
        return {"problems": problems}

    event_ids = [p["eventid"] for p in problems]
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Enrich acknowledged problems with who/when/note from our DB.
            cur.execute(
                """SELECT DISTINCT ON (eventid) eventid, acknowledged_by, acked_at, note
                   FROM problem_acknowledgements
                   WHERE eventid = ANY(%s)
                   ORDER BY eventid, acked_at DESC""",
                (event_ids,),
            )
            ack_map = {
                row["eventid"]: {
                    "ack_user": row["acknowledged_by"],
                    "ack_time": row["acked_at"].isoformat(),
                    "ack_note": row["note"],
                }
                for row in cur.fetchall()
            }

            # Attach the full note thread — independent of acknowledgement.
            cur.execute(
                """SELECT eventid, username, note, created_at
                   FROM problem_notes
                   WHERE eventid = ANY(%s)
                   ORDER BY created_at ASC""",
                (event_ids,),
            )
            notes_map: dict[str, list[dict]] = {}
            for row in cur.fetchall():
                notes_map.setdefault(row["eventid"], []).append(
                    {
                        "username": row["username"],
                        "note": row["note"],
                        "created_at": row["created_at"].isoformat(),
                    }
                )
    finally:
        conn.close()

    for p in problems:
        if p["eventid"] in ack_map:
            p.update(ack_map[p["eventid"]])
        p["notes"] = notes_map.get(p["eventid"], [])
    return {"problems": problems}


@router.post(
    "/metrics/problems/{eventid}/acknowledge",
    tags=["Metrics"],
    summary="Acknowledge a Zabbix problem",
)
def acknowledge_problem(
    eventid: str,
    body: AcknowledgeRequest = Body(default_factory=AcknowledgeRequest),
    current_user: dict = Depends(get_current_user),
):
    _require_host_access(current_user, body.hostname, "acknowledge")

    username = current_user.get("username", "unknown")
    if not metrics_bot.acknowledge_problem(eventid, username=username, note=body.note):
        raise HTTPException(status_code=503, detail="Zabbix not connected or acknowledge failed.")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO problem_acknowledgements
                       (eventid, problem_name, hostname, severity, acknowledged_by, note)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (
                    eventid,
                    body.problem_name,
                    body.hostname,
                    body.severity,
                    username,
                    body.note,
                ),
            )
            conn.commit()
    finally:
        conn.close()
    logger.info("Problem %s acknowledged by %s.", eventid, username)
    return {"message": "Problem acknowledged.", "acknowledged_by": username}


@router.post(
    "/metrics/problems/{eventid}/note",
    tags=["Metrics"],
    summary="Add a note to a problem without acknowledging it",
)
def add_problem_note(
    eventid: str,
    body: AddNoteRequest,
    current_user: dict = Depends(get_current_user),
):
    if not body.note.strip():
        raise HTTPException(status_code=400, detail="note must not be empty.")
    _require_host_access(current_user, body.hostname, "add notes to")

    username = current_user.get("username", "unknown")
    if not metrics_bot.add_problem_note(eventid, username=username, note=body.note):
        raise HTTPException(status_code=503, detail="Zabbix not connected or note failed.")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO problem_notes (eventid, hostname, username, note)
                   VALUES (%s, %s, %s, %s)
                   RETURNING created_at""",
                (eventid, body.hostname, username, body.note),
            )
            created_at = cur.fetchone()["created_at"]
            conn.commit()
    finally:
        conn.close()
    logger.info("Note added to problem %s by %s.", eventid, username)
    return {
        "message": "Note added.",
        "username": username,
        "note": body.note,
        "created_at": created_at.isoformat(),
    }


@router.get("/metrics/acknowledgements", tags=["Metrics"], summary="Acknowledgement audit log")
def list_acknowledgements(
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    allowed = team_hostname_filter(current_user)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if allowed is None:
                cur.execute(
                    """SELECT id, eventid, problem_name, hostname, severity,
                              acknowledged_by, note, acked_at
                       FROM problem_acknowledgements
                       ORDER BY acked_at DESC LIMIT %s""",
                    (limit,),
                )
            else:
                team_id = live_team_id(current_user)
                team_usernames: list[str] = []
                if team_id:
                    cur.execute(
                        "SELECT username FROM team_users WHERE team_id = %s",
                        (team_id,),
                    )
                    team_usernames = [row["username"] for row in cur.fetchall()]
                cur.execute(
                    """SELECT id, eventid, problem_name, hostname, severity,
                              acknowledged_by, note, acked_at
                       FROM problem_acknowledgements
                       WHERE hostname = ANY(%s) OR acknowledged_by = ANY(%s)
                       ORDER BY acked_at DESC LIMIT %s""",
                    (list(allowed), team_usernames, limit),
                )
            rows = cur.fetchall()
    finally:
        conn.close()
    return {
        "acknowledgements": [
            {
                "id": r["id"],
                "eventid": r["eventid"],
                "problem_name": r["problem_name"],
                "hostname": r["hostname"],
                "severity": r["severity"],
                "acknowledged_by": r["acknowledged_by"],
                "note": r["note"],
                "acked_at": r["acked_at"].isoformat(),
            }
            for r in rows
        ]
    }


@router.get(
    "/metrics/problems/history",
    tags=["Metrics"],
    summary="Historical problems in a time window",
)
def get_problem_history(
    hours: int = Query(24, ge=1, le=720),
    severity_min: int = Query(0, ge=0, le=5),
    limit: int = Query(500, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
):
    """Return historical Zabbix problems (active + resolved) for the given window.
    Team-isolated — root/auditor see all hosts, others see only their team.
    """
    allowed = team_hostname_filter(current_user)
    return {
        "problems": metrics_bot.get_problem_history(
            hours=hours,
            hostname_filter=allowed,
            severity_min=severity_min,
            limit=limit,
        )
    }


@router.get("/metrics/history/{itemid}", tags=["Metrics"], summary="Item history time-series")
def get_item_history(
    itemid: str,
    minutes: int = 360,
    current_user: dict = Depends(get_current_user),
):
    if minutes < 1 or minutes > 10080:
        raise HTTPException(status_code=400, detail="minutes must be between 1 and 10080")
    logger.debug("history request: item=%s minutes=%d", itemid, minutes)
    return metrics_bot.get_item_history(itemid, minutes)
