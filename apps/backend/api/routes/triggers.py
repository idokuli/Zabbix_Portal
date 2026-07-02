from fastapi import APIRouter, Depends, HTTPException, Query
from Auth import get_current_user, require_operator
from api.deps import team_hostname_filter, zabbix_err
from api.managers import item_bot
from api.schemas import BulkTriggerRequest, TriggerRequest, TriggerUpdateRequest

router = APIRouter(tags=["Triggers"])


@router.get(
    "/triggers", tags=["Triggers"], summary="List all triggers across all hosts"
)
def list_all_triggers(
    search: str = Query(default=""),
    hostname: str = Query(default=""),
    limit: int = Query(default=2000, ge=1, le=5000),
    current_user: dict = Depends(get_current_user),
):
    allowed = team_hostname_filter(current_user)
    try:
        triggers = item_bot.list_all_triggers(
            search=search, hostname=hostname, limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=zabbix_err(e))
    if allowed is not None:
        triggers = [t for t in triggers if t["hostname"] in allowed]
    return {"triggers": triggers, "total": len(triggers)}


@router.get(
    "/triggers/{hostname}", tags=["Triggers"], summary="List triggers for a host"
)
def list_triggers(hostname: str, current_user: dict = Depends(get_current_user)):
    allowed = team_hostname_filter(current_user)
    if allowed is not None and hostname not in allowed:
        raise HTTPException(status_code=403, detail="Host not assigned to your team.")
    triggers, host_available = item_bot.list_triggers(hostname)
    return {"triggers": triggers, "host_available": host_available}


@router.delete(
    "/triggers/{triggerid}", tags=["Triggers"], summary="Delete trigger by ID"
)
def delete_trigger(triggerid: str, current_user: dict = Depends(require_operator)):
    allowed = team_hostname_filter(current_user)
    if allowed is not None:
        hostname = item_bot.get_trigger_hostname(triggerid)
        if not hostname or hostname not in allowed:
            raise HTTPException(
                status_code=403, detail="Trigger not assigned to your team."
            )
    if not item_bot.delete_trigger(triggerid):
        raise HTTPException(
            status_code=404, detail="Trigger not found or could not be deleted."
        )
    return {"message": "Trigger deleted."}


@router.put(
    "/triggers/{triggerid}",
    tags=["Triggers"],
    summary="Update trigger name, severity, status or expression",
)
def update_trigger(
    triggerid: str,
    data: TriggerUpdateRequest,
    current_user: dict = Depends(require_operator),
):
    allowed = team_hostname_filter(current_user)
    if allowed is not None:
        hostname = item_bot.get_trigger_hostname(triggerid)
        if not hostname or hostname not in allowed:
            raise HTTPException(
                status_code=403, detail="Trigger not assigned to your team."
            )
    try:
        item_bot.update_trigger(
            triggerid,
            description=data.description,
            priority=data.priority,
            status=data.status,
            expression=data.expression,
            event_name=data.event_name,
            comments=data.comments,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=zabbix_err(e))
    return {"message": "Trigger updated."}


@router.post(
    "/triggers", tags=["Triggers"], summary="Add Trigger to Item", status_code=201
)
def add_trigger(data: TriggerRequest, current_user: dict = Depends(require_operator)):
    """Adds a trigger to an existing host item."""
    if data.string_pattern is not None:
        trigger_id, err = item_bot.add_string_trigger(
            hostname=data.hostname,
            item_key=data.item_key,
            trigger_name=data.trigger_name,
            pattern=data.string_pattern,
            match_type=data.match_type or "like",
            priority=data.severity or 3,
            event_name=data.event_name,
            comments=data.comments,
        )
    else:
        if data.threshold is None:
            raise HTTPException(
                status_code=422, detail="threshold is required for numeric triggers."
            )
        trigger_id, err = item_bot.add_trigger(
            hostname=data.hostname,
            item_key=data.item_key,
            trigger_name=data.trigger_name,
            threshold=data.threshold,
            operator=data.operator or ">",
            priority=data.severity or 3,
            event_name=data.event_name,
            comments=data.comments,
        )
    if not trigger_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add trigger.")
    return {"message": "Trigger added successfully.", "triggerid": trigger_id}


@router.post(
    "/triggers/bulk",
    tags=["Triggers"],
    summary="Bulk Add Trigger to Multiple Hosts",
    status_code=201,
)
def bulk_add_triggers(
    data: BulkTriggerRequest, current_user: dict = Depends(require_operator)
):
    """Adds the same trigger to multiple hosts in one call."""
    if not data.hostnames:
        raise HTTPException(status_code=400, detail="hostnames list is empty.")
    config = data.model_dump(exclude={"hostnames"})
    results = item_bot.bulk_add_triggers(data.hostnames, config)
    ok = sum(1 for r in results if not r["error"])
    return {
        "message": f"{ok}/{len(results)} triggers added successfully.",
        "results": results,
    }
