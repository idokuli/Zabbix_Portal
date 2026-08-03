from fastapi import APIRouter, Depends, HTTPException
import User_Management as um
from Auth import can_grant_roles, hash_password, require_admin
from api.deps import live_team_id
from api.managers import sync_bot
from api.schemas import PasswordChangeRequest, UserRequest, UserUpdateRequest

router = APIRouter(tags=["Users"])

_USER_NOT_FOUND = "User not found."


@router.get("/users", tags=["Users"], summary="List users")
def list_users(current_user: dict = Depends(require_admin)):
    """root sees all users; team_lead sees only users in their own team."""
    if "root" in current_user.get("roles", []):
        return {"users": um.list_users()}
    team_id = live_team_id(current_user)
    if not team_id:
        return {"users": []}
    return {"users": um.list_users(team_id=team_id)}


@router.put("/users/{user_id}", tags=["Users"], summary="Update user roles and team")
def update_user(user_id: int, data: UserUpdateRequest, current_user: dict = Depends(require_admin)):
    target = um.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail=_USER_NOT_FOUND)
    if "root" not in current_user.get("roles", []) and target.get("team_id") != live_team_id(
        current_user
    ):
        raise HTTPException(status_code=403, detail="You can only edit users in your own team.")
    if not can_grant_roles(current_user.get("roles", []), data.roles):
        raise HTTPException(status_code=403, detail="You cannot assign roles higher than your own.")
    if not um.update_user_profile(user_id, data.roles, data.team_id):
        raise HTTPException(status_code=400, detail="Failed to update user.")
    team_name = um.get_team_name(data.team_id) if data.team_id else None
    sync_bot.push_user(target["username"], "", data.roles, team_name)
    return {"message": "User updated."}


@router.post("/users", tags=["Teams"], summary="Create user", status_code=201)
def create_user(data: UserRequest, current_user: dict = Depends(require_admin)):
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
    if "root" not in current_user.get("roles", []) and data.team_id != live_team_id(current_user):
        raise HTTPException(status_code=403, detail="You can only create users in your own team.")
    if not can_grant_roles(current_user.get("roles", []), data.roles or ["member"]):
        raise HTTPException(status_code=403, detail="You cannot assign roles higher than your own.")
    roles = data.roles or ["member"]
    # Accounts the portal creates are stored lowercase, so every new row has one canonical
    # form and lookups can never match two rows. Legacy rows written with other casing
    # (seeded `Admin`, Zabbix-synced logins) are left alone — the case-insensitive lookup
    # in um.get_user_by_username still resolves those.
    username = data.username.strip().lower()
    result = um.create_user(
        username,
        hash_password(data.password),
        data.email or "",
        roles,
        data.team_id,
    )
    if not result:
        raise HTTPException(
            status_code=400, detail="Failed to create user. Username may already exist."
        )
    team_name = um.get_team_name(data.team_id) if data.team_id else None
    sync_bot.push_user(username, data.password, roles, team_name)
    return result


@router.put("/users/{user_id}/password", tags=["Teams"], summary="Change user password")
def change_password(
    user_id: int,
    data: PasswordChangeRequest,
    current_user: dict = Depends(require_admin),
):
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
    target = um.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail=_USER_NOT_FOUND)
    if "root" not in current_user.get("roles", []) and target.get("team_id") != live_team_id(
        current_user
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only change passwords for users in your own team.",
        )
    if not um.update_password(user_id, hash_password(data.new_password)):
        raise HTTPException(status_code=400, detail="Failed to update password.")
    sync_bot.update_password(target["username"], data.new_password)
    return {"message": "Password updated."}


@router.delete("/users/{user_id}", tags=["Teams"], summary="Delete user")
def delete_user(user_id: int, current_user: dict = Depends(require_admin)):
    target = um.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail=_USER_NOT_FOUND)
    if "root" not in current_user.get("roles", []) and target.get("team_id") != live_team_id(
        current_user
    ):
        raise HTTPException(status_code=403, detail="You can only delete users in your own team.")
    if not um.delete_user(user_id):
        raise HTTPException(status_code=404, detail=_USER_NOT_FOUND)
    sync_bot.delete_user(target["username"])
    return {"message": "User deleted."}
