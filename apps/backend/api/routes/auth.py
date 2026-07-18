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


@router.post("/auth/login", tags=["Auth"], summary="Login")
@limiter.limit("10/minute")  # brute-force protection — 10 attempts per IP per minute
def login(request: Request, data: LoginRequest):
    client_ip = request.client.host if request.client else "unknown"
    ldap_on = is_ldap_enabled()
    user = um.get_user_by_username(data.username)

    # JIT provisioning: LDAP enabled + user not in portal DB → try LDAP and auto-create on success
    ldap_authenticated: bool | None = None  # cache result to avoid a second bind below
    ldap_display_name: str = ""
    if not user and ldap_on:
        try:
            ldap_authenticated, ldap_display_name = authenticate_ldap(data.username, data.password)
        except LdapUserNotFoundError:
            ldap_authenticated = False
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=f"LDAP configuration error: {e}") from e

        if ldap_authenticated:
            user = um.create_user(
                username=data.username,
                password_hash=hash_password(secrets.token_hex(32)),  # unusable local password
                roles=["operator"],
                source="ldap",
                display_name=ldap_display_name,
            )
            if not user:
                raise HTTPException(status_code=500, detail="Failed to provision user account.")
            logger.info(
                "JIT-provisioned LDAP user %r (display_name=%r) with roles=['operator'].",
                data.username,
                ldap_display_name,
            )
        else:
            logger.warning("Failed JIT login for %r from %s.", data.username, client_ip)
            raise HTTPException(status_code=401, detail="Invalid username or password.")

    if not user:
        logger.warning("Failed login attempt for username %r from %s.", data.username, client_ip)
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    # root always uses internal auth — prevents LDAP misconfiguration from locking out the admin.
    # Exception: LDAP-sourced users always authenticate via LDAP regardless of their portal role,
    # because their password_hash is an unusable random value set at JIT-provisioning time.
    is_root = "root" in (user.get("roles") or []) and user.get("source") != "ldap"

    if ldap_authenticated is not None:
        # Already authenticated above during JIT check — reuse the result
        authenticated = ldap_authenticated
    elif ldap_on and not is_root:
        try:
            authenticated, ldap_display_name = authenticate_ldap(data.username, data.password)
        except LdapUserNotFoundError:
            logger.info(
                "User %r not in LDAP directory, falling back to local auth.",
                data.username,
            )
            authenticated = verify_password(data.password, user["password_hash"])
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=f"LDAP configuration error: {e}") from e
    else:
        authenticated = verify_password(data.password, user["password_hash"])

    if not authenticated:
        logger.warning("Failed login attempt for username %r from %s.", data.username, client_ip)
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    # Use the freshest display_name: from this login's LDAP response, or whatever is stored in DB.
    display_name = ldap_display_name or user.get("display_name") or user["username"]

    effective_roles = um.get_effective_roles(user["id"], user["roles"])
    logger.info(
        "User %r logged in (roles=%s effective=%s) from %s.",
        data.username,
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
