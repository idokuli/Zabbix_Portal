from fastapi import APIRouter, Body, Depends, HTTPException, Query
from Auth import get_current_user, require_admin
from api.managers import dc_bot

router = APIRouter(tags=["DataCollection"])


@router.get(
    "/dc/template-groups", tags=["DataCollection"], summary="List template groups"
)
def list_template_groups(current_user: dict = Depends(get_current_user)):
    return {"groups": dc_bot.list_template_groups()}


@router.post(
    "/dc/template-groups",
    tags=["DataCollection"],
    summary="Create template group",
    status_code=201,
)
def create_template_group(
    body: dict = Body(...), current_user: dict = Depends(require_admin)
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    gid, err = dc_bot.create_template_group(name)
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"groupid": gid, "message": f"Template group '{name}' created."}


@router.put(
    "/dc/template-groups/{groupid}",
    tags=["DataCollection"],
    summary="Rename template group",
)
def update_template_group(
    groupid: str, body: dict = Body(...), current_user: dict = Depends(require_admin)
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    if not dc_bot.update_template_group(groupid, name):
        raise HTTPException(status_code=400, detail="Failed to update template group.")
    return {"message": "Template group updated."}


@router.delete(
    "/dc/template-groups/{groupid}",
    tags=["DataCollection"],
    summary="Delete template group",
)
def delete_template_group(groupid: str, current_user: dict = Depends(require_admin)):
    if not dc_bot.delete_template_group(groupid):
        raise HTTPException(
            status_code=404, detail="Template group not found or could not be deleted."
        )
    return {"message": "Template group deleted."}


@router.get(
    "/dc/template-groups/{groupid}/members",
    tags=["DataCollection"],
    summary="Templates in a group",
)
def get_template_group_members(
    groupid: str, current_user: dict = Depends(get_current_user)
):
    return {"templates": dc_bot.get_template_group_members(groupid)}


@router.put(
    "/dc/template-groups/{groupid}/members",
    tags=["DataCollection"],
    summary="Set template group members",
)
def set_template_group_members(
    groupid: str, body: dict = Body(...), current_user: dict = Depends(require_admin)
):
    templateids = body.get("templateids", [])
    if not dc_bot.set_template_group_members(groupid, templateids):
        raise HTTPException(
            status_code=400, detail="Failed to update template group members."
        )
    return {"ok": True}


# Host Groups


@router.get("/dc/host-groups", tags=["DataCollection"], summary="List host groups")
def list_host_groups(current_user: dict = Depends(get_current_user)):
    return {"groups": dc_bot.list_host_groups()}


@router.post(
    "/dc/host-groups",
    tags=["DataCollection"],
    summary="Create host group",
    status_code=201,
)
def create_host_group(
    body: dict = Body(...), current_user: dict = Depends(require_admin)
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    gid, err = dc_bot.create_host_group(name)
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"groupid": gid, "message": f"Host group '{name}' created."}


@router.put(
    "/dc/host-groups/{groupid}", tags=["DataCollection"], summary="Rename host group"
)
def update_host_group(
    groupid: str, body: dict = Body(...), current_user: dict = Depends(require_admin)
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    if not dc_bot.update_host_group(groupid, name):
        raise HTTPException(status_code=400, detail="Failed to update host group.")
    return {"message": "Host group updated."}


@router.delete(
    "/dc/host-groups/{groupid}", tags=["DataCollection"], summary="Delete host group"
)
def delete_host_group(groupid: str, current_user: dict = Depends(require_admin)):
    if not dc_bot.delete_host_group(groupid):
        raise HTTPException(
            status_code=404, detail="Host group not found or could not be deleted."
        )
    return {"message": "Host group deleted."}


@router.get(
    "/dc/host-groups/{groupid}/members",
    tags=["DataCollection"],
    summary="Hosts in a group",
)
def get_host_group_members(
    groupid: str, current_user: dict = Depends(get_current_user)
):
    return {"hosts": dc_bot.get_host_group_members(groupid)}


@router.put(
    "/dc/host-groups/{groupid}/members",
    tags=["DataCollection"],
    summary="Set host group members",
)
def set_host_group_members(
    groupid: str, body: dict = Body(...), current_user: dict = Depends(require_admin)
):
    hostids = body.get("hostids", [])
    if not dc_bot.set_host_group_members(groupid, hostids):
        raise HTTPException(
            status_code=400, detail="Failed to update host group members."
        )
    return {"ok": True}


# Templates


@router.get("/dc/templates", tags=["DataCollection"], summary="List templates")
def list_dc_templates(
    search: str = Query(default=""),
    current_user: dict = Depends(get_current_user),
):
    return {"templates": dc_bot.list_templates(search=search)}


@router.post(
    "/dc/templates", tags=["DataCollection"], summary="Create template", status_code=201
)
def create_dc_template(
    body: dict = Body(...), current_user: dict = Depends(require_admin)
):
    name = (body.get("name") or "").strip()
    group_ids = body.get("group_ids") or []
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    tid, err = dc_bot.create_template(
        name,
        group_ids,
        description=body.get("description", ""),
        visible_name=body.get("visible_name", ""),
        template_ids=body.get("template_ids") or [],
        tags=body.get("tags") or [],
        macros=body.get("macros") or [],
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"templateid": tid, "message": f"Template '{name}' created."}


@router.delete(
    "/dc/templates/{templateid}", tags=["DataCollection"], summary="Delete template"
)
def delete_dc_template(templateid: str, current_user: dict = Depends(require_admin)):
    if not dc_bot.delete_template(templateid):
        raise HTTPException(
            status_code=404, detail="Template not found or could not be deleted."
        )
    return {"message": "Template deleted."}


# Maintenance


@router.get("/dc/maintenances", tags=["DataCollection"], summary="List maintenances")
def list_maintenances(current_user: dict = Depends(get_current_user)):
    return {"maintenances": dc_bot.list_maintenances()}


@router.post(
    "/dc/maintenances",
    tags=["DataCollection"],
    summary="Create maintenance",
    status_code=201,
)
def create_maintenance(
    body: dict = Body(...), current_user: dict = Depends(require_admin)
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    mid, err = dc_bot.create_maintenance(
        name=name,
        maintenance_type=int(body.get("maintenance_type", 0)),
        active_since=int(body.get("active_since", 0)),
        active_till=int(body.get("active_till", 0)),
        hostids=body.get("hostids") or [],
        groupids=body.get("groupids") or [],
        description=body.get("description", ""),
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"maintenanceid": mid, "message": f"Maintenance '{name}' created."}


@router.delete(
    "/dc/maintenances/{maintenanceid}",
    tags=["DataCollection"],
    summary="Delete maintenance",
)
def delete_maintenance(maintenanceid: str, current_user: dict = Depends(require_admin)):
    if not dc_bot.delete_maintenance(maintenanceid):
        raise HTTPException(
            status_code=404, detail="Maintenance not found or could not be deleted."
        )
    return {"message": "Maintenance deleted."}


# Event Correlation


@router.get("/dc/correlations", tags=["DataCollection"], summary="List correlations")
def list_correlations(current_user: dict = Depends(get_current_user)):
    return {"correlations": dc_bot.list_correlations()}


@router.post(
    "/dc/correlations",
    tags=["DataCollection"],
    summary="Create correlation",
    status_code=201,
)
def create_correlation(
    body: dict = Body(...), current_user: dict = Depends(require_admin)
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    cid, err = dc_bot.create_correlation(
        name=name,
        description=body.get("description", ""),
        status=int(body.get("status", 0)),
        conditions=body.get("conditions", []),
        evaltype=int(body.get("evaltype", 0)),
        operation_type=int(body.get("operation_type", 0)),
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"correlationid": cid, "message": f"Correlation '{name}' created."}


@router.delete(
    "/dc/correlations/{correlationid}",
    tags=["DataCollection"],
    summary="Delete correlation",
)
def delete_correlation(correlationid: str, current_user: dict = Depends(require_admin)):
    if not dc_bot.delete_correlation(correlationid):
        raise HTTPException(
            status_code=404, detail="Correlation not found or could not be deleted."
        )
    return {"message": "Correlation deleted."}


# Discovery Rules


@router.get(
    "/dc/discovery-rules", tags=["DataCollection"], summary="List discovery rules"
)
def list_discovery_rules(current_user: dict = Depends(get_current_user)):
    return {"rules": dc_bot.list_discovery_rules()}


@router.post(
    "/dc/discovery-rules",
    tags=["DataCollection"],
    summary="Create discovery rule",
    status_code=201,
)
def create_discovery_rule(
    body: dict = Body(...), current_user: dict = Depends(require_admin)
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    rid, err = dc_bot.create_discovery_rule(
        name=name,
        iprange=body.get("iprange", ""),
        delay=body.get("delay", "1h"),
        check_types=body.get("check_types") or ["icmp"],
        ports=body.get("ports", ""),
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"druleid": rid, "message": f"Discovery rule '{name}' created."}


@router.delete(
    "/dc/discovery-rules/{druleid}",
    tags=["DataCollection"],
    summary="Delete discovery rule",
)
def delete_discovery_rule(druleid: str, current_user: dict = Depends(require_admin)):
    if not dc_bot.delete_discovery_rule(druleid):
        raise HTTPException(
            status_code=404, detail="Discovery rule not found or could not be deleted."
        )
    return {"message": "Discovery rule deleted."}
