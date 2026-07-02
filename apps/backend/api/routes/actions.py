from api.deps import zabbix_err
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from Auth import get_current_user, require_admin
from api.managers import actions_bot
from api.schemas import (
    ActionCreateRequest,
    MediaTypeCreateRequest,
    MediaTypeUpdateRequest,
    ScriptCreateRequest,
)

router = APIRouter()


@router.get("/actions")
def list_actions(
    eventsource: int | None = Query(None, ge=0, le=4),
    _user=Depends(get_current_user),
):
    return {"actions": actions_bot.list_actions(eventsource=eventsource)}


@router.post("/actions")
def create_action(body: ActionCreateRequest, _user=Depends(require_admin)):
    try:
        aid = actions_bot.create_action(body.name, body.eventsource, body.esc_period)
        return {"actionid": aid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=zabbix_err(e))


@router.delete("/actions/{actionid}")
def delete_action(actionid: str, _user=Depends(require_admin)):
    try:
        actions_bot.delete_action(actionid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=zabbix_err(e))


@router.put("/actions/{actionid}/toggle")
def toggle_action(
    actionid: str, status: int = Body(..., embed=True), _user=Depends(require_admin)
):
    try:
        actions_bot.toggle_action(actionid, status)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=zabbix_err(e))


@router.get("/media-types")
def list_media_types(_user=Depends(get_current_user)):
    return {"media_types": actions_bot.list_media_types()}


@router.post("/media-types")
def create_media_type(body: MediaTypeCreateRequest, _user=Depends(require_admin)):
    try:
        mid = actions_bot.create_media_type(
            body.name,
            body.type,
            body.description,
            body.smtp_server,
            body.smtp_helo,
            body.smtp_email,
            body.script,
            body.webhook_script,
        )
        return {"mediatypeid": mid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=zabbix_err(e))


@router.put("/media-types/{mediatypeid}")
def update_media_type(
    mediatypeid: str, body: MediaTypeUpdateRequest, _user=Depends(require_admin)
):
    try:
        actions_bot.update_media_type(
            mediatypeid,
            body.name,
            body.type,
            body.description,
            body.smtp_server,
            body.smtp_email,
            body.script,
            body.webhook_script,
        )
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=zabbix_err(e))


@router.delete("/media-types/{mediatypeid}")
def delete_media_type(mediatypeid: str, _user=Depends(require_admin)):
    try:
        actions_bot.delete_media_type(mediatypeid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=zabbix_err(e))


@router.put("/media-types/{mediatypeid}/toggle")
def toggle_media_type(
    mediatypeid: str, status: int = Body(..., embed=True), _user=Depends(require_admin)
):
    try:
        actions_bot.toggle_media_type(mediatypeid, status)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=zabbix_err(e))


@router.get("/scripts")
def list_scripts(_user=Depends(get_current_user)):
    return {"scripts": actions_bot.list_scripts()}


@router.post("/scripts")
def create_script(body: ScriptCreateRequest, _user=Depends(require_admin)):
    try:
        sid = actions_bot.create_script(
            body.name, body.command, body.execute_on, body.scope, body.description
        )
        return {"scriptid": sid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=zabbix_err(e))


@router.delete("/scripts/{scriptid}")
def delete_script(scriptid: str, _user=Depends(require_admin)):
    try:
        actions_bot.delete_script(scriptid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=zabbix_err(e))
