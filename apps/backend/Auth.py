import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

load_dotenv(Path(__file__).resolve().parent / ".env", override=False)

_SECRET = os.getenv("SECRET_KEY")
if not _SECRET:
    raise RuntimeError(
        "SECRET_KEY environment variable must be set before starting the server."
    )
_ALG = "HS256"
_HOURS = 8

_bearer = HTTPBearer(auto_error=False)

# Role definitions (multiple roles per user are supported):
#   root       — full access across all teams
#   team_lead  — manage own team: hosts, users, host assignments
#   operator   — manage own team's hosts and monitoring, no user management
#   member     — read-only, own team hosts only
#   auditor    — read-only, cross-team visibility (no writes)

VALID_ROLES = {"root", "team_lead", "operator", "member", "auditor"}

# Numeric levels for hierarchy comparison (higher = more privilege)
_ROLE_LEVELS: dict[str, int] = {
    "member": 1,
    "operator": 2,
    "team_lead": 3,
    "root": 4,
    # auditor is not in the chain — root-only to grant (cross-team access)
}


def can_grant_roles(granter_roles: list[str], requested_roles: list[str]) -> bool:
    """
    True if a user with granter_roles is allowed to assign requested_roles to someone.
    Rules:
      - root can grant anything.
      - Others can only grant roles whose level does not exceed their own highest level.
      - Nobody except root can grant 'auditor' (cross-team visibility).
    """
    if "root" in granter_roles:
        return True
    granter_max = max((_ROLE_LEVELS.get(r, 0) for r in granter_roles), default=0)
    for role in requested_roles:
        if role == "auditor":
            return False
        if _ROLE_LEVELS.get(role, 0) > granter_max:
            return False
    return True


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=14)).decode(
        "utf-8"
    )


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(
    user_id: int, username: str, roles: list[str], team_id: int | None
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=_HOURS)
    return jwt.encode(
        {
            "sub": str(user_id),
            "username": username,
            "roles": roles,
            "team_id": team_id,
            "exp": expire,
        },
        _SECRET,
        algorithm=_ALG,
    )


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, _SECRET, algorithms=[_ALG])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token."
        ) from exc


# ── FastAPI dependencies ──────────────────────────────────────────────────────


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated."
        )
    return _decode(creds.credentials)


def require_root(user: dict = Depends(get_current_user)) -> dict:
    """Only root. Used for platform-wide actions: create/delete teams."""
    if "root" not in user.get("roles", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Root access required."
        )
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """root or team_lead. Used for user management and host assignments."""
    roles = user.get("roles", [])
    if not any(r in roles for r in ("root", "team_lead")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Team lead access required."
        )
    return user


def require_operator(user: dict = Depends(get_current_user)) -> dict:
    """root, team_lead, or operator. Used for host/item/trigger CRUD."""
    roles = user.get("roles", [])
    if not any(r in roles for r in ("root", "team_lead", "operator")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Operator access required."
        )
    return user
