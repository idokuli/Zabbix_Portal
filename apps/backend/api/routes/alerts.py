from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from Auth import get_current_user
from api.managers import alert_bot
from api.schemas import AlertRuleCreate, AlertRuleUpdate
import User_Management as um

router = APIRouter(tags=["Alerts"])

_OP_NOT_CONTAINS = "!contains"
_RULE_NOT_FOUND = "Rule not found."


@router.get("/alerts/rules", tags=["Alerts"], summary="List alert rules for current user")
def list_alert_rules(current_user: dict = Depends(get_current_user)):
    return {"rules": alert_bot.get_rules(int(current_user["sub"]))}


@router.post("/alerts/rules", tags=["Alerts"], summary="Create alert rule", status_code=201)
def create_alert_rule(data: AlertRuleCreate, current_user: dict = Depends(get_current_user)):
    if not (0 <= data.severity <= 5):
        raise HTTPException(status_code=400, detail="severity must be 0–5")
    if data.rule_type not in ("item", "service"):
        raise HTTPException(status_code=400, detail="rule_type must be 'item' or 'service'")

    if data.rule_type == "item":
        if not data.item_id or not data.item_name or not data.hostname:
            raise HTTPException(
                status_code=400,
                detail="item_id, item_name, hostname required for item rules",
            )
        if data.operator not in (">", "<", ">=", "<=", "contains", _OP_NOT_CONTAINS):
            raise HTTPException(
                status_code=400,
                detail="operator must be >, <, >=, <=, contains, or !contains",
            )
        if data.operator not in ("contains", _OP_NOT_CONTAINS) and data.threshold is None:
            raise HTTPException(status_code=400, detail="threshold required for numeric item rules")
        result = alert_bot.create_rule(
            int(current_user["sub"]),
            data.item_id,
            data.item_name,
            data.hostname,
            data.operator,
            data.threshold,
            data.severity,
            rule_type="item",
            expected_contains=data.expected_contains,
        )
    else:
        # service rule — item_id holds the health-monitor itemid, item_name the monitor name
        if not data.item_id or not data.item_name or not data.hostname:
            raise HTTPException(
                status_code=400,
                detail="item_id, item_name, hostname required for service rules",
            )
        result = alert_bot.create_rule(
            int(current_user["sub"]),
            data.item_id,
            data.item_name,
            data.hostname,
            ">",
            0,
            data.severity,
            rule_type="service",
            expected_contains=data.expected_contains,
        )
    return result


@router.put("/alerts/rules/{rule_id}", tags=["Alerts"], summary="Update alert rule")
def update_alert_rule(
    rule_id: int, data: AlertRuleUpdate, current_user: dict = Depends(get_current_user)
):
    if not (0 <= data.severity <= 5):
        raise HTTPException(status_code=400, detail="severity must be 0–5")
    if data.operator is not None and data.operator not in (
        ">",
        "<",
        ">=",
        "<=",
        "contains",
        _OP_NOT_CONTAINS,
    ):
        raise HTTPException(status_code=400, detail="operator must be >, <, >=, or <=")
    if not alert_bot.update_rule(
        rule_id,
        int(current_user["sub"]),
        data.severity,
        operator=data.operator,
        threshold=data.threshold,
        item_id=data.item_id,
        item_name=data.item_name,
        hostname=data.hostname,
        expected_contains=data.expected_contains,
    ):
        raise HTTPException(status_code=404, detail=_RULE_NOT_FOUND)
    return {"message": "Rule updated."}


@router.delete("/alerts/rules/{rule_id}", tags=["Alerts"], summary="Delete alert rule")
def delete_alert_rule(rule_id: int, current_user: dict = Depends(get_current_user)):
    if not alert_bot.delete_rule(rule_id, int(current_user["sub"])):
        raise HTTPException(status_code=404, detail=_RULE_NOT_FOUND)
    return {"message": "Rule deleted."}


@router.patch(
    "/alerts/rules/{rule_id}/toggle",
    tags=["Alerts"],
    summary="Enable/disable alert rule",
)
def toggle_alert_rule(rule_id: int, current_user: dict = Depends(get_current_user)):
    result = alert_bot.toggle_rule(rule_id, int(current_user["sub"]))
    if result is None:
        raise HTTPException(status_code=404, detail=_RULE_NOT_FOUND)
    return {"enabled": result}


@router.get("/alerts/events", tags=["Alerts"], summary="Recent alert events for current user")
def get_alert_events(
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    clamped = max(1, min(limit, 500))
    return {"events": alert_bot.get_events(int(current_user["sub"]), limit=clamped)}


class NotifHistoryEntry(BaseModel):
    id: str
    source: str
    hostname: str
    severity: int
    name: str
    clock: int
    acknowledged: bool


@router.get(
    "/alerts/notification-history",
    tags=["Alerts"],
    summary="Get persisted notification history for current user",
)
def get_notification_history(current_user: dict = Depends(get_current_user)):
    entries = um.get_notification_history(int(current_user["sub"]))
    return {"history": entries}


@router.post(
    "/alerts/notification-history",
    tags=["Alerts"],
    summary="Save notification history entries for current user",
    status_code=204,
)
def save_notification_history(
    entries: list[NotifHistoryEntry],
    current_user: dict = Depends(get_current_user),
):
    um.save_notification_history(int(current_user["sub"]), [e.model_dump() for e in entries])
