from fastapi import APIRouter, Depends, HTTPException
from Auth import get_current_user
from api.managers import alert_bot
from api.schemas import AlertRuleCreate, AlertRuleUpdate

router = APIRouter(tags=["Alerts"])


@router.get(
    "/alerts/rules", tags=["Alerts"], summary="List alert rules for current user"
)
def list_alert_rules(current_user: dict = Depends(get_current_user)):
    return {"rules": alert_bot.get_rules(int(current_user["sub"]))}


@router.post(
    "/alerts/rules", tags=["Alerts"], summary="Create alert rule", status_code=201
)
def create_alert_rule(
    data: AlertRuleCreate, current_user: dict = Depends(get_current_user)
):
    if data.operator not in (">", "<", ">=", "<="):
        raise HTTPException(status_code=400, detail="operator must be >, <, >=, or <=")
    if not (0 <= data.severity <= 5):
        raise HTTPException(status_code=400, detail="severity must be 0–5")
    result = alert_bot.create_rule(
        int(current_user["sub"]),
        data.item_id,
        data.item_name,
        data.hostname,
        data.operator,
        data.threshold,
        data.severity,
    )
    return result


@router.put("/alerts/rules/{rule_id}", tags=["Alerts"], summary="Update alert rule")
def update_alert_rule(
    rule_id: int, data: AlertRuleUpdate, current_user: dict = Depends(get_current_user)
):
    if data.operator not in (">", "<", ">=", "<="):
        raise HTTPException(status_code=400, detail="operator must be >, <, >=, or <=")
    if not (0 <= data.severity <= 5):
        raise HTTPException(status_code=400, detail="severity must be 0–5")
    if not alert_bot.update_rule(
        rule_id,
        int(current_user["sub"]),
        data.operator,
        data.threshold,
        data.severity,
        data.item_id,
        data.item_name,
        data.hostname,
    ):
        raise HTTPException(status_code=404, detail="Rule not found.")
    return {"message": "Rule updated."}


@router.delete("/alerts/rules/{rule_id}", tags=["Alerts"], summary="Delete alert rule")
def delete_alert_rule(rule_id: int, current_user: dict = Depends(get_current_user)):
    if not alert_bot.delete_rule(rule_id, int(current_user["sub"])):
        raise HTTPException(status_code=404, detail="Rule not found.")
    return {"message": "Rule deleted."}


@router.patch(
    "/alerts/rules/{rule_id}/toggle",
    tags=["Alerts"],
    summary="Enable/disable alert rule",
)
def toggle_alert_rule(rule_id: int, current_user: dict = Depends(get_current_user)):
    result = alert_bot.toggle_rule(rule_id, int(current_user["sub"]))
    if result is None:
        raise HTTPException(status_code=404, detail="Rule not found.")
    return {"enabled": result}


@router.get(
    "/alerts/events", tags=["Alerts"], summary="Recent alert events for current user"
)
def get_alert_events(
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    clamped = max(1, min(limit, 500))
    return {"events": alert_bot.get_events(int(current_user["sub"]), limit=clamped)}
