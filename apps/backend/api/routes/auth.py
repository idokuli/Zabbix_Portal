import logging
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from Auth import create_token, get_current_user, hash_password, verify_password
import User_Management as um
from api.limiter import limiter
from api.schemas import LoginRequest
from ldap_auth import LdapUserNotFoundError, authenticate_ldap, is_ldap_enabled

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Auth"])

_INVALID_CREDENTIALS = "Invalid username or password."


def _jit_provision_ldap_user(username: str, password: str, client_ip: str) -> tuple[dict, str]:
    """LDAP enabled + user not in portal DB: authenticate via LDAP and auto-create on success.
    Returns (user, ldap_display_name). Raises HTTPException on any failure."""
    try:
        ldap_authenticated, ldap_display_name = authenticate_ldap(username, password)
    except LdapUserNotFoundError:
        ldap_authenticated = False
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f"LDAP configuration error: {e}") from e

    if not ldap_authenticated:
        logger.warning("Failed JIT login for %r from %s.", username, client_ip)
        raise HTTPException(status_code=401, detail=_INVALID_CREDENTIALS)

    # Store LDAP-provisioned accounts lowercase. This is the path that actually caused
    # duplicates: LDAP authenticates `IdOkUlI` and `idokuli` alike, so without a canonical
    # stored form every new capitalisation minted another portal account for one directory user.
    user = um.create_user(
        username=username.lower(),
        password_hash=hash_password(secrets.token_hex(32)),  # unusable local password
        roles=["operator"],
        source="ldap",
        display_name=ldap_display_name,
    )
    if not user:
        raise HTTPException(status_code=500, detail="Failed to provision user account.")
    logger.info(
        "JIT-provisioned LDAP user %r (display_name=%r) with roles=['operator'].",
        username,
        ldap_display_name,
    )
    return user, ldap_display_name


def _authenticate_existing_user(
    user: dict, password: str, ldap_on: bool, client_ip: str
) -> tuple[bool, str]:
    """Returns (authenticated, ldap_display_name) for a user already in the portal DB."""
    # root always uses internal auth — prevents LDAP misconfiguration from locking out the admin.
    # Exception: LDAP-sourced users always authenticate via LDAP regardless of their portal role,
    # because their password_hash is an unusable random value set at JIT-provisioning time.
    is_root = "root" in (user.get("roles") or []) and user.get("source") != "ldap"
    if not (ldap_on and not is_root):
        return verify_password(password, user["password_hash"]), ""

    try:
        return authenticate_ldap(user["username"], password)
    except LdapUserNotFoundError:
        logger.info(
            "User %r not in LDAP directory, falling back to local auth.",
            user["username"],
        )
        return verify_password(password, user["password_hash"]), ""
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f"LDAP configuration error: {e}") from e


@router.post("/auth/login", tags=["Auth"], summary="Login")
@limiter.limit("10/minute")  # brute-force protection — 10 attempts per IP per minute
def login(request: Request, data: LoginRequest):
    client_ip = request.client.host if request.client else "unknown"
    ldap_on = is_ldap_enabled()
    # Do NOT lowercase the input here — the lookup itself is case-insensitive
    # (see um.get_user_by_username). Lowercasing the input would break every row
    # already stored with other casing: the seeded root is `Admin`, and Zabbix-synced
    # users keep whatever casing Zabbix had. Only accounts the portal *creates* are
    # normalised to lowercase, at the point of creation.
    username = data.username.strip()
    user = um.get_user_by_username(username)

    # JIT provisioning: LDAP enabled + user not in portal DB → try LDAP and auto-create on success
    if not user and ldap_on:
        user, ldap_display_name = _jit_provision_ldap_user(username, data.password, client_ip)
        authenticated = True
    else:
        if not user:
            logger.warning("Failed login attempt for username %r from %s.", username, client_ip)
            raise HTTPException(status_code=401, detail=_INVALID_CREDENTIALS)
        authenticated, ldap_display_name = _authenticate_existing_user(
            user, data.password, ldap_on, client_ip
        )

    if not authenticated:
        logger.warning("Failed login attempt for username %r from %s.", username, client_ip)
        raise HTTPException(status_code=401, detail=_INVALID_CREDENTIALS)

    # Use the freshest display_name: from this login's LDAP response, or whatever is stored in DB.
    display_name = ldap_display_name or user.get("display_name") or user["username"]

    effective_roles = um.get_effective_roles(user["id"], user["roles"])
    logger.info(
        "User %r logged in (roles=%s effective=%s) from %s.",
        username,
        user["roles"],
        effective_roles,
        client_ip,
    )
    token = create_token(
        user["id"], user["username"], effective_roles, user["team_id"], display_name
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "display_name": display_name,
            "roles": effective_roles,
            "team_id": user["team_id"],
        },
    }


@router.get("/auth/ldap-status", tags=["Auth"], summary="LDAP enabled status (public)")
def ldap_status():
    return {"enabled": is_ldap_enabled()}


@router.get("/auth/me", tags=["Auth"], summary="Current user")
def me(current_user: dict = Depends(get_current_user)):
    return current_user
