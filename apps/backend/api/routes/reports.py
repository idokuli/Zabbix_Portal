import time as _time
import Audit_Log
from api.deps import team_hostname_filter, zabbix_call
from fastapi import APIRouter, Depends, HTTPException, Query
from Auth import get_current_user, require_admin
from api.managers import report_bot

router = APIRouter()

# ~6 calendar months, with slack for month-length variance (28-31 days each).
_MAX_AVAILABILITY_RANGE_SECONDS = 190 * 86400


@router.get("/reports/top-triggers")
def reports_top_triggers(
    limit: int = Query(100, ge=1, le=500),
    severity_min: int = Query(0, ge=0, le=5),
    hours: int = Query(24, ge=1, le=720),
    current_user: dict = Depends(get_current_user),
):
    allowed = team_hostname_filter(current_user)
    with zabbix_call(status=502):
        triggers = report_bot.get_top_triggers(limit=limit, severity_min=severity_min, hours=hours)
    if allowed is not None:
        triggers = [
            t for t in triggers if any(h.get("host") in allowed for h in t.get("hosts", []))
        ]
    return {"triggers": triggers}


@router.get("/reports/audit-log")
def reports_audit_log(
    limit: int = Query(200, ge=1, le=1000),
    hours: int = Query(24, ge=1, le=720),
    _user=Depends(require_admin),
):
    time_from = int(_time.time()) - hours * 3600
    with zabbix_call(status=502):
        return {"entries": report_bot.get_audit_log(limit=limit, time_from=time_from)}


@router.get("/reports/portal-actions")
def reports_portal_actions(
    limit: int = Query(200, ge=1, le=1000),
    hours: int = Query(24, ge=1, le=720),
    _user=Depends(require_admin),
):
    """Portal-side write-action log, correctly attributed to the real logged-in user —
    unlike /reports/audit-log, which reflects Zabbix's own audit trail and can only ever
    show the shared ZABBIX_USER service account (see Audit_Log.py)."""
    return {"entries": Audit_Log.list_actions(limit=limit, hours=hours)}


@router.get("/reports/action-log")
def reports_action_log(
    limit: int = Query(200, ge=1, le=1000),
    hours: int = Query(24, ge=1, le=720),
    _user=Depends(get_current_user),
):
    time_from = int(_time.time()) - hours * 3600
    with zabbix_call(status=502):
        return {"entries": report_bot.get_action_log(limit=limit, time_from=time_from)}


@router.get("/reports/availability")
def reports_availability(
    hours: int = Query(24, ge=1, le=720),
    groupid: str | None = Query(None),
    time_from: int | None = Query(None, description="Epoch seconds — start of an explicit range"),
    time_to: int | None = Query(None, description="Epoch seconds — end of an explicit range"),
    current_user: dict = Depends(get_current_user),
):
    if (time_from is None) != (time_to is None):
        raise HTTPException(
            status_code=400, detail="time_from and time_to must be provided together."
        )
    if time_from is not None and time_to is not None:
        if time_to <= time_from:
            raise HTTPException(status_code=400, detail="time_to must be after time_from.")
        if time_to - time_from > _MAX_AVAILABILITY_RANGE_SECONDS:
            raise HTTPException(status_code=400, detail="Date range cannot exceed 6 months.")
    allowed = team_hostname_filter(current_user)
    with zabbix_call(status=502):
        hosts = report_bot.get_availability(
            hours=hours, groupid=groupid, time_from=time_from, time_to=time_to
        )
    if allowed is not None:
        hosts = [h for h in hosts if h["hostname"] in allowed]
    return {"hosts": hosts}


@router.get("/reports/notifications")
def reports_notifications(
    hours: int = Query(24, ge=1, le=720),
    limit: int = Query(500, ge=1, le=1000),
    _user=Depends(get_current_user),
):
    with zabbix_call(status=502):
        return {"notifications": report_bot.get_notification_history(hours=hours, limit=limit)}
