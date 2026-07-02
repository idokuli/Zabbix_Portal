from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import User_Management as um
from Auth import get_current_user, require_admin, require_root
from api.deps import live_team_id
from api.managers import host_bot, sync_bot
from api.schemas import HostAssignRequest, MemberRequest, TeamRequest


class TeamRolesRequest(BaseModel):
    roles: list[str]


router = APIRouter(tags=["Teams"])


@router.get("/teams/overview", tags=["Teams"], summary="Teams with members and hosts")
def teams_overview(current_user: dict = Depends(get_current_user)):
    # root and auditor see all teams; everyone else sees only their own
    roles = current_user.get("roles", [])
    team_filter = (
        None if ("root" in roles or "auditor" in roles) else live_team_id(current_user)
    )
    return {"teams": um.get_overview(team_id=team_filter)}


@router.get("/teams", tags=["Teams"], summary="List teams")
def list_teams(current_user: dict = Depends(get_current_user)):
    return {"teams": um.list_teams()}


@router.post("/teams", tags=["Teams"], summary="Create team", status_code=201)
def create_team(data: TeamRequest, current_user: dict = Depends(require_root)):
    result = um.create_team(data.name, data.description or "")
    if not result:
        raise HTTPException(
            status_code=400, detail="Failed to create team. Name may already exist."
        )
    sync_bot.push_team(data.name)
    return result


@router.delete("/teams/{team_id}", tags=["Teams"], summary="Delete team")
def delete_team(team_id: int, current_user: dict = Depends(require_root)):
    team_name = um.get_team_name(team_id)
    if not um.delete_team(team_id):
        raise HTTPException(status_code=404, detail="Team not found.")
    if team_name:
        sync_bot.delete_team(team_name)
    return {"message": "Team deleted."}


@router.post(
    "/teams/{team_id}/hosts",
    tags=["Teams"],
    summary="Assign host to team",
    status_code=201,
)
def assign_host(
    team_id: int, data: HostAssignRequest, current_user: dict = Depends(require_admin)
):
    if (
        "root" not in current_user.get("roles", [])
        and live_team_id(current_user) != team_id
    ):
        raise HTTPException(
            status_code=403, detail="You can only assign hosts to your own team."
        )
    if not um.assign_host(team_id, data.hostname):
        raise HTTPException(status_code=400, detail="Failed to assign host.")
    team_name = um.get_team_name(team_id)
    if team_name:
        host_bot.tag_host(data.hostname, team_name)
        sync_bot.push_host_to_team(data.hostname, team_name)
    return {"message": "Host assigned."}


@router.delete(
    "/teams/{team_id}/hosts/{hostname}", tags=["Teams"], summary="Remove host from team"
)
def unassign_host(
    team_id: int, hostname: str, current_user: dict = Depends(require_admin)
):
    if (
        "root" not in current_user.get("roles", [])
        and live_team_id(current_user) != team_id
    ):
        raise HTTPException(
            status_code=403, detail="You can only remove hosts from your own team."
        )
    team_name = um.get_team_name(team_id)
    if not um.unassign_host(team_id, hostname):
        raise HTTPException(status_code=404, detail="Host assignment not found.")
    # Remove only this team's tag — the host may still belong to other teams
    # which each have their own 'team' tag value.
    if team_name:
        host_bot.untag_host(hostname, team_name)
    if team_name:
        sync_bot.remove_host_from_team(hostname, team_name)
    return {"message": "Host removed from team."}


@router.post(
    "/teams/{team_id}/members",
    tags=["Teams"],
    summary="Add existing user to a team",
    status_code=201,
)
def add_team_member(
    team_id: int, data: MemberRequest, current_user: dict = Depends(require_admin)
):
    if (
        "root" not in current_user.get("roles", [])
        and live_team_id(current_user) != team_id
    ):
        raise HTTPException(
            status_code=403, detail="You can only manage your own team's members."
        )
    if not um.add_team_membership(data.user_id, team_id):
        raise HTTPException(status_code=400, detail="Failed to add member.")
    return {"message": "Member added."}


@router.delete(
    "/teams/{team_id}/members/{user_id}",
    tags=["Teams"],
    summary="Remove a user from a team (membership only)",
)
def remove_team_member(
    team_id: int, user_id: int, current_user: dict = Depends(require_admin)
):
    if (
        "root" not in current_user.get("roles", [])
        and live_team_id(current_user) != team_id
    ):
        raise HTTPException(
            status_code=403, detail="You can only manage your own team's members."
        )
    if not um.remove_team_membership(user_id, team_id):
        raise HTTPException(status_code=404, detail="Membership not found.")
    return {"message": "Member removed from team."}


@router.get("/teams/{team_id}/roles", tags=["Teams"], summary="Get team roles")
def get_team_roles(team_id: int, _user: dict = Depends(require_admin)):
    return {"roles": um.get_team_roles(team_id)}


@router.put("/teams/{team_id}/roles", tags=["Teams"], summary="Set team roles")
def set_team_roles(
    team_id: int, body: TeamRolesRequest, current_user: dict = Depends(require_admin)
):
    from Auth import can_grant_roles

    if not can_grant_roles(current_user.get("roles", []), body.roles):
        raise HTTPException(
            status_code=403, detail="Cannot grant roles higher than your own."
        )
    if not um.set_team_roles(team_id, body.roles):
        raise HTTPException(status_code=404, detail="Team not found.")
    return {"ok": True}
