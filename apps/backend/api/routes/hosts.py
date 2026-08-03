import logging
from io import BytesIO
import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
import User_Management as um
from Auth import get_current_user, require_admin, require_operator
from api.deps import live_team_id, resolve_team, team_hostname_filter, team_tag
from api.managers import host_bot
from api.deps import zabbix_call
from api.schemas import (
    HostRequest,
    HostTemplateLinkRequest,
    HostUpdateRequest,
    TagsUpdateRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Hosts"])


@router.get("/hosts", tags=["Hosts"], summary="List All Hosts")
def get_all_hosts(current_user: dict = Depends(get_current_user)):
    """Returns hosts from Zabbix. root and auditor see all; others see only their team's hosts."""
    all_hosts = host_bot.get_hosts()
    roles = current_user.get("roles", [])
    if "root" in roles or "auditor" in roles:
        return {"count": len(all_hosts), "hosts": all_hosts}
    team_id = live_team_id(current_user)
    if not team_id:
        return {"count": 0, "hosts": []}
    team_name = resolve_team(current_user)
    assigned = um.get_team_hostnames(team_id)

    # A host is visible if the DB assignment OR the Zabbix team tag matches
    def _in_team(h: dict) -> bool:
        if h["host"] in assigned:
            return True
        if team_name:
            return any(
                t.get("tag") == "team" and t.get("value") == team_name for t in h.get("tags", [])
            )
        return False

    hosts = [h for h in all_hosts if _in_team(h)]
    return {"count": len(hosts), "hosts": hosts}


@router.get("/hosts/download", tags=["Hosts"], summary="Download Host Inventory (.xlsx or .csv)")
def download_inventory(format: str = "xlsx", current_user: dict = Depends(get_current_user)):
    """Generates a host inventory file. ?format=xlsx (default) or ?format=csv."""
    allowed = team_hostname_filter(current_user)
    if format == "csv":
        data = host_bot.export_hosts_to_csv_bytes(hostname_filter=allowed)
        if not data:
            raise HTTPException(status_code=500, detail="Failed to generate CSV file.")
        return StreamingResponse(
            content=iter([data]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="Zabbix_Inventory.csv"'},
        )
    data = host_bot.export_hosts_to_excel_bytes(hostname_filter=allowed)
    if not data:
        raise HTTPException(status_code=500, detail="Failed to generate Excel file.")
    return StreamingResponse(
        content=iter([data]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="Zabbix_Inventory.xlsx"'},
    )


@router.get("/templates", tags=["Hosts"], summary="List available Zabbix templates")
def list_templates(current_user: dict = Depends(get_current_user)):
    """Returns all templates from Zabbix sorted by name."""
    return {"templates": host_bot.list_templates()}


@router.post("/hosts", tags=["Hosts"], summary="Create New Host", status_code=201)
def create_host(data: HostRequest, current_user: dict = Depends(require_operator)):
    """Creates a new Zabbix host. Auto-assigns to the creator's team if they have one."""
    result, err = host_bot.create_server(
        data.hostname,
        data.ip,
        group_ids=data.group_ids or None,
        template_name=data.template,
        proxyid=data.proxyid or None,
    )
    if not result:
        raise HTTPException(status_code=400, detail=err or "Failed to create host.")
    team_id = live_team_id(current_user)
    if team_id:
        team_name = team_tag(current_user, data.apply_team_tag)
        if not um.assign_host(team_id, data.hostname):
            logger.warning("assign_host failed for %r team_id=%s", data.hostname, team_id)
        if team_name:
            host_bot.tag_host(data.hostname, team_name)
            # Add to the team's Zabbix host group so the team user can see it in Zabbix
            host_bot.add_host_to_hostgroup(data.hostname, team_name)
    return {"message": "Host created successfully.", "hostid": result}


@router.post(
    "/hosts/bulk",
    tags=["Hosts"],
    summary="Bulk Create Hosts from CSV/XLSX",
    status_code=201,
)
def _validate_bulk_upload_size(content: bytes) -> None:
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > 10 * 1024 * 1024:  # 10 MB hard limit
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")


def _parse_bulk_upload(
    filename: str, content: bytes, original_filename: str | None
) -> pd.DataFrame:
    try:
        if filename.endswith(".csv"):
            return pd.read_csv(BytesIO(content))
        return pd.read_excel(BytesIO(content))
    except Exception as exc:
        logger.exception("Bulk upload: failed to parse file %r", original_filename)
        raise HTTPException(
            status_code=400,
            detail="Failed to parse file. Ensure it is a valid CSV or XLSX.",
        ) from exc


def _resolve_bulk_columns(df: pd.DataFrame) -> tuple[str, str, str | None]:
    normalized = {str(c).strip().lower(): c for c in df.columns}
    hostname_col = normalized.get("hostname") or normalized.get("host")
    ip_col = normalized.get("ip") or normalized.get("ip_address")
    template_col = normalized.get("template")
    if not hostname_col or not ip_col:
        raise HTTPException(
            status_code=400,
            detail="File must contain hostname (or host) and ip (or ip_address) columns.",
        )
    return hostname_col, ip_col, template_col


def _create_bulk_host_row(
    idx,
    row,
    hostname_col: str,
    ip_col: str,
    template_col: str | None,
    default_template: str,
    team_id,
    team_name: str | None,
) -> tuple[bool, dict]:
    """Returns (created, entry) — entry is the created-row or failed-row payload."""
    hostname = str(row.get(hostname_col, "")).strip()
    ip = str(row.get(ip_col, "")).strip()
    template = str(row.get(template_col, "")).strip() if template_col else ""
    if not hostname or hostname.lower() == "nan" or not ip or ip.lower() == "nan":
        return False, {"row": int(idx) + 2, "reason": "Missing hostname/ip"}

    hostid, err = host_bot.create_server(hostname, ip, template_name=template or default_template)
    if not hostid:
        return False, {"row": int(idx) + 2, "hostname": hostname, "reason": err or "Unknown error"}

    if team_id:
        um.assign_host(team_id, hostname)
    if team_name:
        host_bot.tag_host(hostname, team_name)
        host_bot.add_host_to_hostgroup(hostname, team_name)
    return True, {"row": int(idx) + 2, "hostname": hostname, "hostid": hostid}


async def bulk_create_hosts(
    file: UploadFile = File(...),
    apply_team_tag: bool = Form(True),
    current_user: dict = Depends(require_operator),
):
    """Creates multiple hosts from a CSV/XLSX file with columns: hostname, ip, template(optional)."""
    filename = (file.filename or "").lower()
    if not filename.endswith((".csv", ".xlsx")):
        raise HTTPException(status_code=400, detail="Unsupported file type. Use .csv or .xlsx")

    content = await file.read()
    _validate_bulk_upload_size(content)
    df = _parse_bulk_upload(filename, content, file.filename)
    hostname_col, ip_col, template_col = _resolve_bulk_columns(df)

    default_template = "Linux by Zabbix agent"
    team_id = live_team_id(current_user)
    team_name = team_tag(current_user, apply_team_tag) if team_id else None

    def _process() -> tuple[list[dict], list[dict]]:
        created: list[dict] = []
        failed: list[dict] = []
        for idx, row in df.iterrows():
            was_created, entry = _create_bulk_host_row(
                idx, row, hostname_col, ip_col, template_col, default_template, team_id, team_name
            )
            (created if was_created else failed).append(entry)
        return created, failed

    created, failed = await run_in_threadpool(_process)

    return {
        "message": "Bulk host import completed.",
        "total_rows": int(len(df)),
        "created_count": len(created),
        "failed_count": len(failed),
        "created": created,
        "failed": failed,
    }


@router.get(
    "/hosts/{hostname}/templates",
    tags=["Hosts"],
    summary="List templates linked to a host",
)
def get_host_templates(hostname: str, current_user: dict = Depends(get_current_user)):
    """Return templates linked to the host as [{templateid, name}]."""
    with zabbix_call():
        return {"templates": host_bot.get_host_templates(hostname)}


@router.post(
    "/hosts/{hostname}/templates",
    tags=["Hosts"],
    summary="Link a template to a host",
    status_code=201,
)
def link_template(
    hostname: str,
    data: HostTemplateLinkRequest,
    _user: dict = Depends(require_operator),
):
    """Add a template to a host without removing existing templates."""
    with zabbix_call():
        ok, err = host_bot.link_template(hostname, data.templateid)
    if not ok:
        raise HTTPException(status_code=400, detail=err or "Failed to link template.")
    return {"message": "Template linked."}


@router.delete(
    "/hosts/{hostname}/templates/{templateid}",
    tags=["Hosts"],
    summary="Unlink a template from a host",
)
def unlink_template(
    hostname: str,
    templateid: str,
    _user: dict = Depends(require_operator),
):
    """Remove a template from a host and clear its inherited items."""
    with zabbix_call():
        ok, err = host_bot.unlink_template(hostname, templateid)
    if not ok:
        raise HTTPException(status_code=400, detail=err or "Failed to unlink template.")
    return {"message": "Template unlinked."}


@router.put(
    "/hosts/{hostname}",
    tags=["Hosts"],
    summary="Update host display name, IP, proxy, or status",
)
def update_host(hostname: str, body: HostUpdateRequest, _user=Depends(require_admin)):
    ok, err = host_bot.update_host(
        hostname,
        name=body.name,
        ip=body.ip,
        proxyid=body.proxyid,
        status=body.status,
        group_ids=body.group_ids if body.group_ids is not None else None,
    )
    if not ok:
        raise HTTPException(status_code=422, detail=err or "Failed to update host.")
    return {"ok": True}


@router.delete("/hosts/{hostname}", tags=["Hosts"], summary="Delete Host")
def delete_host(hostname: str, current_user: dict = Depends(require_operator)):
    """Deletes a host from Zabbix. team_lead and operator can only delete hosts in their own team."""
    if "root" not in current_user.get("roles", []):
        team_id = live_team_id(current_user)
        if not team_id:
            raise HTTPException(
                status_code=403,
                detail="You can only delete hosts assigned to your own team.",
            )
        # Check ownership via DB assignment OR Zabbix team tag
        in_db = hostname in um.get_team_hostnames(team_id)
        if not in_db:
            team_name = resolve_team(current_user)
            in_zabbix = team_name and host_bot.get_host_team(hostname) == team_name
            if not in_zabbix:
                raise HTTPException(
                    status_code=403,
                    detail="You can only delete hosts assigned to your own team.",
                )
    um.unassign_host_all(hostname)
    success = host_bot.delete_server(hostname)
    if not success:
        raise HTTPException(
            status_code=404, detail=f"Host '{hostname}' not found or deletion failed."
        )
    return {"message": f"Host '{hostname}' deleted successfully."}


@router.put("/hosts/{hostname}/tags", tags=["Hosts"], summary="Update custom tags on a host")
def update_host_tags(
    hostname: str,
    body: TagsUpdateRequest,
    current_user: dict = Depends(require_operator),
):
    """Replace all non-team tags on a host. The 'team' tag is preserved automatically."""
    allowed = team_hostname_filter(current_user)
    if allowed is not None and hostname not in allowed:
        raise HTTPException(status_code=403, detail="Host not in your team.")
    payload = [{"tag": t.tag, "value": t.value} for t in body.tags]
    ok, err = host_bot.update_host_tags(hostname, payload)
    if not ok:
        raise HTTPException(status_code=400, detail=err or "Failed to update tags.")
    return {"message": "Tags updated."}
