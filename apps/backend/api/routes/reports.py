import time as _time
from api.deps import zabbix_call
from fastapi import APIRouter, Depends, Query
from Auth import get_current_user, require_admin
from api.managers import report_bot

router = APIRouter()


@router.get("/reports/top-triggers")
def reports_top_triggers(
    limit: int = Query(100, ge=1, le=500),
    severity_min: int = Query(0, ge=0, le=5),
    hours: int = Query(24, ge=1, le=720),
    _user=Depends(get_current_user),
):
    with zabbix_call(status=502):
        return {
            "triggers": report_bot.get_top_triggers(
                limit=limit, severity_min=severity_min, hours=hours
            )
        }


@router.get("/reports/audit-log")
def reports_audit_log(
    limit: int = Query(200, ge=1, le=1000),
    hours: int = Query(24, ge=1, le=720),
    _user=Depends(require_admin),
):
    time_from = int(_time.time()) - hours * 3600
    with zabbix_call(status=502):
        return {"entries": report_bot.get_audit_log(limit=limit, time_from=time_from)}


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
    _user=Depends(get_current_user),
):
    with zabbix_call(status=502):
        return {"hosts": report_bot.get_availability(hours=hours, groupid=groupid)}


@router.get("/reports/notifications")
def reports_notifications(
    hours: int = Query(24, ge=1, le=720),
    limit: int = Query(500, ge=1, le=1000),
    _user=Depends(get_current_user),
):
    with zabbix_call(status=502):
        return {"notifications": report_bot.get_notification_history(hours=hours, limit=limit)}
