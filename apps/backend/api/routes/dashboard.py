from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
import User_Management as um
from Auth import get_current_user
from api.deps import is_global_viewer, live_team_id, team_hostname_filter
from api.managers import dashboard_bot
from api.schemas import (
    DashboardLayoutRequest,
    DashboardPageCreateRequest,
    DashboardPageRenameRequest,
)

router = APIRouter(tags=["Dashboard"])

_KINDS = ("dashboard", "metrics")

_SCOPE_MUST_BE_USER_OR_TEAM = "scope must be 'user' or 'team'"
_NOT_IN_A_TEAM = "You are not in a team."
_KIND_MUST_BE_DASHBOARD_OR_METRICS = "kind must be 'dashboard' or 'metrics'"


def _require_global_viewer(current_user: dict) -> None:
    if not is_global_viewer(current_user):
        raise HTTPException(
            status_code=403, detail="scope 'all' is restricted to root/auditor roles."
        )


@router.get("/dashboard/graphs", tags=["Dashboard"], summary="List Zabbix graphs")
def list_graphs(hostid: str | None = None, current_user: dict = Depends(get_current_user)):
    allowed = team_hostname_filter(current_user)
    graphs = dashboard_bot.get_graphs(hostid)
    if allowed is not None:
        graphs = [g for g in graphs if any(h.get("host") in allowed for h in g.get("hosts", []))]
    return {"graphs": graphs}


@router.get(
    "/dashboard/graphs/{graphid}/image",
    tags=["Dashboard"],
    summary="Proxy native Zabbix graph image",
)
def get_graph_image(
    graphid: str,
    period: int = 3600,
    width: int = 900,
    height: int = 200,
    current_user: dict = Depends(get_current_user),
):
    img = dashboard_bot.get_graph_image(graphid, period, width, height)
    if not img:
        raise HTTPException(
            status_code=503, detail="Graph image unavailable — check Zabbix web session"
        )
    return Response(content=img, media_type="image/png")


@router.get(
    "/dashboard/graphs/{graphid}/data",
    tags=["Dashboard"],
    summary="Chart.js data for a graph",
)
def get_graph_data(
    graphid: str,
    minutes: int = 360,
    current_user: dict = Depends(get_current_user),
):
    if minutes < 1 or minutes > 10080:
        raise HTTPException(status_code=400, detail="minutes must be between 1 and 10080")
    return dashboard_bot.get_graph_data(graphid, minutes)


@router.get(
    "/dashboard/hosts/metrics",
    tags=["Dashboard"],
    summary="Last metric values for all hosts",
)
def get_hosts_metrics(current_user: dict = Depends(get_current_user)):
    allowed = team_hostname_filter(current_user)
    hosts = dashboard_bot.get_hosts_metrics()
    if allowed is not None:
        hosts = [h for h in hosts if h.get("hostname") in allowed]
    return {"hosts": hosts}


@router.get("/dashboard/items/recent", tags=["Dashboard"], summary="Recently created items")
def get_recent_items(limit: int = 30, current_user: dict = Depends(get_current_user)):
    allowed = team_hostname_filter(current_user)
    items = dashboard_bot.get_recent_items(min(limit, 100))
    if allowed is not None:
        items = [i for i in items if i.get("hostname") in allowed]
    return {"items": items}


@router.get("/dashboard/layout", tags=["Dashboard"], summary="Get saved dashboard layout")
def get_dashboard_layout(
    scope: str = "user",
    page: str = "dashboard",
    team_id: int | None = None,
    current_user: dict = Depends(get_current_user),
):
    if scope == "all":
        _require_global_viewer(current_user)
        if team_id is None:
            raise HTTPException(status_code=400, detail="team_id is required for scope 'all'.")
        return {
            "widgets": um.get_dashboard_layout("team", team_id, page),
            "scope": "all",
        }
    if scope == "team":
        team_id = live_team_id(current_user)
        if not team_id:
            return {"widgets": [], "scope": "team"}
        return {
            "widgets": um.get_dashboard_layout("team", int(team_id), page),
            "scope": "team",
        }
    user_id = int(current_user.get("sub", 0))
    return {"widgets": um.get_dashboard_layout("user", user_id, page), "scope": "user"}


@router.put("/dashboard/layout", tags=["Dashboard"], summary="Save dashboard layout")
def save_dashboard_layout(
    data: DashboardLayoutRequest,
    page: str = "dashboard",
    current_user: dict = Depends(get_current_user),
):
    if data.scope not in ("user", "team"):
        raise HTTPException(status_code=400, detail=_SCOPE_MUST_BE_USER_OR_TEAM)
    if data.scope == "team":
        team_id = live_team_id(current_user)
        if not team_id:
            raise HTTPException(status_code=400, detail=_NOT_IN_A_TEAM)
        if not um.save_dashboard_layout("team", int(team_id), data.widgets, page):
            raise HTTPException(status_code=500, detail="Failed to save layout.")
    else:
        user_id = int(current_user.get("sub", 0))
        if not um.save_dashboard_layout("user", user_id, data.widgets, page):
            raise HTTPException(status_code=500, detail="Failed to save layout.")
    return {"message": "Layout saved."}


@router.get("/dashboard/pages", tags=["Dashboard"], summary="List saved dashboards")
def list_dashboard_pages(
    scope: str = "user",
    kind: str = "dashboard",
    current_user: dict = Depends(get_current_user),
):
    if kind not in _KINDS:
        raise HTTPException(status_code=400, detail=_KIND_MUST_BE_DASHBOARD_OR_METRICS)
    if scope == "all":
        _require_global_viewer(current_user)
        return {"pages": _list_all_team_dashboard_pages(kind)}
    if scope == "team":
        team_id = live_team_id(current_user)
        if not team_id:
            return {"pages": [{"page": kind, "name": "Default", "is_default": True}]}
        return {"pages": um.list_dashboard_pages("team", int(team_id), kind)}
    user_id = int(current_user.get("sub", 0))
    return {"pages": um.list_dashboard_pages("user", user_id, kind)}


def _list_all_team_dashboard_pages(kind: str) -> list[dict]:
    """Every team's saved dashboards for this kind, tagged with their owning team.
    One query for every team's custom pages (see um.list_all_team_dashboard_pages)
    instead of one query per team."""
    pages: list[dict] = []
    seen_defaults: set[int] = set()
    for row in um.list_all_team_dashboard_pages(kind):
        team_id, team_name = row["team_id"], row["team_name"]
        if team_id not in seen_defaults:
            pages.append(
                {
                    "page": kind,
                    "name": f"{team_name} — Default",
                    "is_default": True,
                    "team_id": team_id,
                    "team_name": team_name,
                }
            )
            seen_defaults.add(team_id)
        if row["page_key"] is not None:
            pages.append(
                {
                    "page": row["page_key"],
                    "name": f"{team_name} — {row['page_name']}",
                    "is_default": False,
                    "team_id": team_id,
                    "team_name": team_name,
                }
            )
    return pages


@router.post("/dashboard/pages", tags=["Dashboard"], summary="Create a new dashboard")
def create_dashboard_page(
    data: DashboardPageCreateRequest, current_user: dict = Depends(get_current_user)
):
    if data.scope not in ("user", "team"):
        raise HTTPException(status_code=400, detail=_SCOPE_MUST_BE_USER_OR_TEAM)
    if data.kind not in _KINDS:
        raise HTTPException(status_code=400, detail=_KIND_MUST_BE_DASHBOARD_OR_METRICS)
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    if data.scope == "team":
        team_id = live_team_id(current_user)
        if not team_id:
            raise HTTPException(status_code=400, detail=_NOT_IN_A_TEAM)
        page = um.create_dashboard_page("team", int(team_id), data.kind, name)
    else:
        user_id = int(current_user.get("sub", 0))
        page = um.create_dashboard_page("user", user_id, data.kind, name)
    if not page:
        raise HTTPException(status_code=500, detail="Failed to create dashboard.")
    return page


@router.put("/dashboard/pages/{page_key}", tags=["Dashboard"], summary="Rename a dashboard")
def rename_dashboard_page(
    page_key: str,
    data: DashboardPageRenameRequest,
    kind: str = "dashboard",
    current_user: dict = Depends(get_current_user),
):
    if page_key in _KINDS:
        raise HTTPException(status_code=400, detail="Cannot rename the default dashboard.")
    if data.scope not in ("user", "team"):
        raise HTTPException(status_code=400, detail=_SCOPE_MUST_BE_USER_OR_TEAM)
    if kind not in _KINDS:
        raise HTTPException(status_code=400, detail=_KIND_MUST_BE_DASHBOARD_OR_METRICS)
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    if data.scope == "team":
        team_id = live_team_id(current_user)
        if not team_id:
            raise HTTPException(status_code=400, detail=_NOT_IN_A_TEAM)
        owner_type, owner_id = "team", int(team_id)
    else:
        owner_type, owner_id = "user", int(current_user.get("sub", 0))
    if not um.rename_dashboard_page(owner_type, owner_id, kind, page_key, name):
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    return {"message": "Dashboard renamed."}


@router.delete("/dashboard/pages/{page_key}", tags=["Dashboard"], summary="Delete a dashboard")
def delete_dashboard_page(
    page_key: str,
    scope: str = "user",
    kind: str = "dashboard",
    current_user: dict = Depends(get_current_user),
):
    if page_key in _KINDS:
        raise HTTPException(status_code=400, detail="Cannot delete the default dashboard.")
    if scope not in ("user", "team"):
        raise HTTPException(status_code=400, detail=_SCOPE_MUST_BE_USER_OR_TEAM)
    if kind not in _KINDS:
        raise HTTPException(status_code=400, detail=_KIND_MUST_BE_DASHBOARD_OR_METRICS)
    if scope == "team":
        team_id = live_team_id(current_user)
        if not team_id:
            raise HTTPException(status_code=400, detail=_NOT_IN_A_TEAM)
        owner_type, owner_id = "team", int(team_id)
    else:
        owner_type, owner_id = "user", int(current_user.get("sub", 0))
    if not um.delete_dashboard_page(owner_type, owner_id, kind, page_key):
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    return {"message": "Dashboard deleted."}
