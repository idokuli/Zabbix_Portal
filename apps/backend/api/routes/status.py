import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from Auth import get_current_user, require_root
from api.lifespan import sync_lock, sync_subscribers
from api.managers import host_bot, sync_bot

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Status"])


@router.get("/health", tags=["Status"], summary="API Health Check")
def health():
    """Returns whether the API is up and connected to Zabbix."""
    return {"status": "online", "zabbix_connected": host_bot.zapi is not None}


@router.post("/sync", tags=["Status"], summary="Trigger full Zabbix sync now")
def trigger_sync(current_user: dict = Depends(require_root)):
    """Immediately runs a full bidirectional sync (users, groups, hosts).
    Normally runs automatically every ZABBIX_SYNC_INTERVAL seconds."""
    sync_bot.full_sync()
    return {"message": "Sync complete."}


@router.get("/sync/debug/{team_name}", tags=["Status"], summary="Show Zabbix state for a team")
def debug_team_sync(team_name: str, current_user: dict = Depends(require_root)):
    """Returns the Zabbix user group, host group, permissions, and hosts for a team."""
    if not sync_bot.zapi:
        raise HTTPException(status_code=503, detail="Zabbix not connected.")
    result: dict = {"team": team_name}
    try:
        rights_param = (
            "selectHostGroupRights"
            if sync_bot._rights_field == "hostgroup_rights"
            else "selectRights"
        )
        ug = sync_bot.zapi.usergroup.get(
            filter={"name": team_name},
            output=["usrgrpid", "name"],
            **{rights_param: ["id", "permission"]},
        )
        result["user_group"] = ug[0] if ug else None
    except Exception as e:
        result["user_group_error"] = repr(e)
    try:
        hg = sync_bot.zapi.hostgroup.get(
            filter={"name": team_name},
            output=["groupid", "name"],
        )
        result["host_group"] = hg[0] if hg else None
        if hg:
            hosts_in_group = sync_bot.zapi.host.get(
                groupids=[hg[0]["groupid"]],
                output=["hostid", "host"],
            )
            result["hosts_in_group"] = hosts_in_group
    except Exception as e:
        result["host_group_error"] = repr(e)
    return result


@router.get("/events", tags=["Status"], summary="SSE stream for real-time sync events")
async def sse_events(request: Request, current_user: dict = Depends(get_current_user)):
    """Server-Sent Events stream. Sends 'data: sync' whenever a full_sync completes."""
    queue: asyncio.Queue[str] = asyncio.Queue()
    with sync_lock:
        sync_subscribers.add(queue)

    async def _stream():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"data: {event}\n\n"
                except TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            with sync_lock:
                sync_subscribers.discard(queue)

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
