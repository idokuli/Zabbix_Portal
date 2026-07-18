from api.deps import zabbix_call, zabbix_err
from fastapi import APIRouter, Depends, HTTPException
from Auth import get_current_user, require_admin, require_root
from api.managers import zadmin_bot
from api.schemas import (
    AuthSettingsUpdateRequest,
    HousekeepingUpdateRequest,
    LdapServerRequest,
    LdapTestRequest,
    MacroCreateRequest,
    MacroUpdateRequest,
    ProxyCreateRequest,
    ProxyGroupCreateRequest,
    ProxyUpdateRequest,
    RoleCreateRequest,
    RoleUpdateRequest,
    TokenCreateRequest,
    UserGroupCreateRequest,
)
from ldap_auth import (
    get_portal_ldap_config,
    save_portal_ldap_config,
    test_portal_ldap_connection,
)
from pydantic import BaseModel

router = APIRouter()


class PortalLdapConfigRequest(BaseModel):
    enabled: bool = False
    host: str = ""
    port: int = 389
    use_ssl: bool = False
    start_tls: bool = False
    base_dn: str = ""
    bind_dn: str = ""
    bind_password: str = ""
    search_attribute: str = "sAMAccountName"
    search_filter: str = ""


class PortalLdapTestRequest(PortalLdapConfigRequest):
    test_username: str = ""
    test_password: str = ""


@router.get("/user-groups")
def list_user_groups(_user=Depends(require_admin)):
    return {"groups": zadmin_bot.list_user_groups()}


@router.get("/zabbix-users")
def list_zabbix_users(_user=Depends(require_admin)):
    return {"users": zadmin_bot.list_zabbix_users()}


@router.post("/user-groups")
def create_user_group(body: UserGroupCreateRequest, _user=Depends(require_admin)):
    with zabbix_call():
        gid = zadmin_bot.create_user_group(
            body.name,
            body.gui_access,
            body.users_status,
            debug_mode=body.debug_mode,
            userids=body.userids or None,
            hostgroup_rights=body.hostgroup_rights or None,
            templategroup_rights=body.templategroup_rights or None,
            tag_filters=body.tag_filters or None,
        )
    return {"usrgrpid": gid}


@router.delete("/user-groups/{usrgrpid}")
def delete_user_group(usrgrpid: str, _user=Depends(require_admin)):
    with zabbix_call():
        zadmin_bot.delete_user_group(usrgrpid)
    return {"ok": True}


@router.get("/roles")
def list_roles(_user=Depends(require_admin)):
    return {"roles": zadmin_bot.list_roles()}


@router.post("/roles")
def create_role(body: RoleCreateRequest, _user=Depends(require_admin)):
    with zabbix_call():
        rid = zadmin_bot.create_role(
            body.name,
            body.type,
            ui_access=body.ui_access,
            ui_default_access=body.ui_default_access,
            services_read_mode=body.services_read_mode,
            services_write_mode=body.services_write_mode,
            modules_default_access=body.modules_default_access,
            api_access=body.api_access,
        )
    return {"roleid": rid}


@router.put("/roles/{roleid}")
def update_role(roleid: str, body: RoleUpdateRequest, _user=Depends(require_admin)):
    with zabbix_call():
        zadmin_bot.update_role(roleid, body.name)
    return {"ok": True}


@router.delete("/roles/{roleid}")
def delete_role(roleid: str, _user=Depends(require_admin)):
    with zabbix_call():
        zadmin_bot.delete_role(roleid)
    return {"ok": True}


@router.get("/api-tokens")
def list_api_tokens(_user=Depends(require_root)):
    return {"tokens": zadmin_bot.list_api_tokens()}


@router.post("/api-tokens")
def create_api_token(body: TokenCreateRequest, _user=Depends(require_root)):
    with zabbix_call():
        tokenid, token_value = zadmin_bot.create_api_token(body.name, body.userid, body.expires_at)
    return {"tokenid": tokenid, "token": token_value}


@router.delete("/api-tokens/{tokenid}")
def delete_api_token(tokenid: str, _user=Depends(require_root)):
    with zabbix_call():
        zadmin_bot.delete_api_token(tokenid)
    return {"ok": True}


@router.get("/proxies")
def list_proxies(_user=Depends(get_current_user)):
    return {"proxies": zadmin_bot.list_proxies()}


@router.post("/proxies")
def create_proxy(body: ProxyCreateRequest, _user=Depends(require_admin)):
    with zabbix_call():
        pid = zadmin_bot.create_proxy(**body.to_manager_kwargs())
    return {"proxyid": pid}


@router.put("/proxies/{proxyid}")
def update_proxy(proxyid: str, body: ProxyUpdateRequest, _user=Depends(require_admin)):
    with zabbix_call():
        zadmin_bot.update_proxy(proxyid, **body.to_manager_kwargs())
    return {"ok": True}


@router.delete("/proxies/{proxyid}")
def delete_proxy(proxyid: str, _user=Depends(require_admin)):
    with zabbix_call():
        zadmin_bot.delete_proxy(proxyid)
    return {"ok": True}


@router.get("/proxy_groups")
def list_proxy_groups(_user=Depends(get_current_user)):
    return {"proxy_groups": zadmin_bot.list_proxy_groups()}


@router.post("/proxy_groups")
def create_proxy_group(body: ProxyGroupCreateRequest, _user=Depends(require_admin)):
    with zabbix_call():
        pgid = zadmin_bot.create_proxy_group(
            body.name, body.failover_delay, body.min_online, body.description
        )
    return {"proxygroupid": pgid}


@router.delete("/proxy_groups/{proxygroupid}")
def delete_proxy_group(proxygroupid: str, _user=Depends(require_admin)):
    with zabbix_call():
        zadmin_bot.delete_proxy_group(proxygroupid)
    return {"ok": True}


@router.get("/macros")
def list_macros(_user=Depends(get_current_user)):
    return {"macros": zadmin_bot.list_global_macros()}


@router.post("/macros")
def create_macro(body: MacroCreateRequest, _user=Depends(require_admin)):
    with zabbix_call():
        mid = zadmin_bot.create_global_macro(body.macro, body.value, body.description, body.type)
    return {"globalmacroid": mid}


@router.put("/macros/{globalmacroid}")
def update_macro(globalmacroid: str, body: MacroUpdateRequest, _user=Depends(require_admin)):
    with zabbix_call():
        zadmin_bot.update_global_macro(globalmacroid, body.value, body.description)
    return {"ok": True}


@router.delete("/macros/{globalmacroid}")
def delete_macro(globalmacroid: str, _user=Depends(require_admin)):
    with zabbix_call():
        zadmin_bot.delete_global_macro(globalmacroid)
    return {"ok": True}


@router.get("/admin/queue")
def get_queue(_user=Depends(require_admin)):
    return zadmin_bot.get_queue_overview()


@router.get("/admin/settings")
def get_settings(_user=Depends(require_admin)):
    with zabbix_call(status=502):
        return zadmin_bot.get_settings()


@router.put("/admin/housekeeping")
def update_housekeeping(body: HousekeepingUpdateRequest, _user=Depends(require_root)):
    with zabbix_call():
        zadmin_bot.update_housekeeping(body.model_dump(exclude_none=True))
    return {"ok": True}


@router.get("/admin/auth")
def get_auth_settings(_user=Depends(require_root)):
    with zabbix_call(status=502):
        return zadmin_bot.get_auth_settings()


@router.put("/admin/auth")
def update_auth_settings(body: AuthSettingsUpdateRequest, _user=Depends(require_root)):
    with zabbix_call():
        zadmin_bot.update_auth_settings(body.model_dump(exclude_none=True))
    return {"ok": True}


@router.post("/admin/auth/ldap/test")
def test_ldap_connection(body: LdapTestRequest, _user=Depends(require_root)):
    with zabbix_call():
        params = body.model_dump(exclude={"test_username", "test_password"}, exclude_none=True)
        result = zadmin_bot.test_ldap_connection(params, body.test_username, body.test_password)
    return {"result": result}


@router.get("/admin/auth/ldap/servers")
def list_ldap_servers(_user=Depends(require_root)):
    with zabbix_call(status=502):
        servers = zadmin_bot.list_ldap_userdirectories()
    return {"servers": servers}


@router.get("/admin/auth/ldap/servers/{userdirectoryid}")
def get_ldap_server(userdirectoryid: str, _user=Depends(require_root)):
    with zabbix_call(status=404):
        return zadmin_bot.get_ldap_userdirectory(userdirectoryid)


@router.post("/admin/auth/ldap/servers")
def create_ldap_server(body: LdapServerRequest, _user=Depends(require_root)):
    with zabbix_call():
        userdirectoryid = zadmin_bot.create_ldap_userdirectory(body.model_dump())
    return {"userdirectoryid": userdirectoryid}


@router.put("/admin/auth/ldap/servers/{userdirectoryid}")
def update_ldap_server(userdirectoryid: str, body: LdapServerRequest, _user=Depends(require_root)):
    with zabbix_call():
        zadmin_bot.update_ldap_userdirectory(userdirectoryid, body.model_dump())
    return {"ok": True}


@router.delete("/admin/auth/ldap/servers/{userdirectoryid}")
def delete_ldap_server(userdirectoryid: str, _user=Depends(require_root)):
    with zabbix_call():
        zadmin_bot.delete_ldap_userdirectory(userdirectoryid)
    return {"ok": True}


@router.post("/admin/auth/ldap/servers/{userdirectoryid}/default")
def set_default_ldap_server(userdirectoryid: str, _user=Depends(require_root)):
    with zabbix_call():
        zadmin_bot.set_default_ldap_userdirectory(userdirectoryid)
    return {"ok": True}


@router.get("/admin/auth/portal-ldap")
def get_portal_ldap(_user=Depends(require_root)):
    cfg = get_portal_ldap_config() or {}
    # Never return the bind password
    return {**cfg, "bind_password": ""}


@router.put("/admin/auth/portal-ldap")
def save_portal_ldap(body: PortalLdapConfigRequest, _user=Depends(require_root)):
    existing = get_portal_ldap_config() or {}
    payload = body.model_dump()
    if not payload["bind_password"]:
        payload["bind_password"] = existing.get("bind_password", "")
    if payload.get("enabled"):
        ok, msg = test_portal_ldap_connection(payload)
        if not ok:
            raise HTTPException(status_code=422, detail=f"LDAP connection test failed: {msg}")
    save_portal_ldap_config(payload)
    return {"ok": True}


@router.post("/admin/auth/portal-ldap/test")
def test_portal_ldap(body: PortalLdapTestRequest, _user=Depends(require_root)):
    """Test portal LDAP connectivity and optionally a user bind, without saving."""
    from ldap_auth import LdapUserNotFoundError, _do_ldap_auth

    existing = get_portal_ldap_config() or {}
    payload = body.model_dump()
    cfg = {
        **existing,
        **{k: v for k, v in payload.items() if k not in ("test_username", "test_password") and v},
    }
    if not cfg.get("bind_password"):
        cfg["bind_password"] = existing.get("bind_password", "")

    test_username = body.test_username.strip()
    test_password = body.test_password

    ok, msg = test_portal_ldap_connection(cfg)
    if not ok:
        raise HTTPException(status_code=422, detail=f"Connection failed: {msg}")

    if not test_username:
        return {
            "ok": True,
            "message": "Connection successful (service-account bind OK).",
        }

    try:
        result = _do_ldap_auth(cfg, test_username, test_password)
    except LdapUserNotFoundError:
        raise HTTPException(
            status_code=422,
            detail=f"User '{test_username}' not found in LDAP directory.",
        ) from None
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=zabbix_err(e)) from e

    if result:
        return {
            "ok": True,
            "message": f"Authentication succeeded for '{test_username}'.",
        }
    raise HTTPException(status_code=422, detail=f"Wrong password for '{test_username}'.")
