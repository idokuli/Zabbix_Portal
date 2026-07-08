"""Tests for ZabbixAdmin_Manager (all mixins)."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://fake-zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture()
def mgr():
    with patch("zabbix_utils.ZabbixAPI"):
        from ZabbixAdmin_Manager import ZabbixAdmin_Manager

        m = ZabbixAdmin_Manager()
        m.zapi = MagicMock()
        m._cache = {}
        m._zabbix_version = (7, 0)
        return m


# ── User groups ───────────────────────────────────────────────────────────────


def test_list_user_groups_returns_list(mgr):
    mgr.zapi.usergroup.get.return_value = [
        {
            "usrgrpid": "1",
            "name": "Zabbix administrators",
            "gui_access": "0",
            "users_status": "0",
            "users": [],
        }
    ]
    result = mgr.list_user_groups()
    assert isinstance(result, list)
    assert result[0]["usrgrpid"] == "1"


def test_list_user_groups_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_user_groups()
    assert result == []


def test_delete_user_group_true(mgr):
    mgr.zapi.usergroup.delete.return_value = {"usrgrpids": ["1"]}
    assert mgr.delete_user_group("1") is True


def test_list_zabbix_users_returns_list(mgr):
    mgr.zapi.user.get.return_value = [
        {
            "userid": "1",
            "username": "Admin",
            "name": "Admin",
            "surname": "",
            "roleid": "3",
        }
    ]
    result = mgr.list_zabbix_users()
    assert isinstance(result, list)


# ── Roles ─────────────────────────────────────────────────────────────────────


def test_list_roles_returns_list(mgr):
    mgr.zapi.role.get.return_value = [
        {"roleid": "1", "name": "Admin role", "type": "2", "readonly": "0"}
    ]
    result = mgr.list_roles()
    assert isinstance(result, list)
    assert result[0]["roleid"] == "1"


def test_list_roles_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_roles()
    assert result == []


def test_delete_role_true(mgr):
    mgr.zapi.role.delete.return_value = {"roleids": ["1"]}
    assert mgr.delete_role("1") is True


# ── API Tokens ────────────────────────────────────────────────────────────────


def test_list_api_tokens_returns_list(mgr):
    mgr.zapi.token.get.return_value = [
        {
            "tokenid": "1",
            "name": "My token",
            "userid": "1",
            "status": "0",
            "expires_at": "0",
            "created_at": "1700000000",
            "lastaccess": "0",
            "description": "",
        }
    ]
    mgr.zapi.user.get.return_value = [{"userid": "1", "username": "admin"}]
    result = mgr.list_api_tokens()
    assert isinstance(result, list)


def test_list_api_tokens_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_api_tokens()
    assert result == []


def test_delete_api_token_true(mgr):
    mgr.zapi.token.delete.return_value = {"tokenids": ["1"]}
    assert mgr.delete_api_token("1") is True


# ── Global macros ─────────────────────────────────────────────────────────────


def test_list_global_macros_returns_list(mgr):
    mgr.zapi.usermacro.get.return_value = [
        {
            "globalmacroid": "1",
            "macro": "{$MACRO}",
            "value": "val",
            "description": "",
            "type": "0",
        }
    ]
    result = mgr.list_global_macros()
    assert isinstance(result, list)
    assert result[0]["globalmacroid"] == "1"


def test_list_global_macros_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_global_macros()
    assert result == []


def test_delete_global_macro_true(mgr):
    mgr.zapi.usermacro.deleteglobal.return_value = {"globalmacroids": ["1"]}
    assert mgr.delete_global_macro("1") is True


# ── Proxies ───────────────────────────────────────────────────────────────────


def test_list_proxies_returns_list(mgr):
    mgr.zapi.proxy.get.return_value = [
        {
            "proxyid": "1",
            "name": "proxy01",
            "operating_mode": "0",
            "description": "",
            "lastaccess": "1700000000",
            "version": "7.0.0",
            "hosts": "3",
            "proxy_groupid": "0",
            "local_address": "",
            "local_port": "",
            "address": "192.168.1.10",
            "port": "10051",
            "allowed_addresses": "",
            "tls_connect": "1",
            "tls_accept": "1",
            "tls_issuer": "",
            "tls_subject": "",
            "tls_psk_identity": "",
            "custom_timeouts": "0",
        }
    ]
    result = mgr.list_proxies()
    assert isinstance(result, list)
    assert result[0]["proxyid"] == "1"
    assert result[0]["mode_label"] == "Active"


def test_list_proxies_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_proxies()
    assert result == []


def test_delete_proxy_true(mgr):
    mgr.zapi.proxy.delete.return_value = {"proxyids": ["1"]}
    assert mgr.delete_proxy("1") is True


# ── System / queue ────────────────────────────────────────────────────────────


def test_get_queue_overview_returns_dict(mgr):
    mgr.zapi.queue.get.return_value = [{"itemscount": "5", "proxy": {"proxyid": "0"}}]
    result = mgr.get_queue_overview()
    assert isinstance(result, dict)


def test_get_queue_overview_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_queue_overview()
    assert result == {} or isinstance(result, dict)


def test_get_settings_returns_dict(mgr):
    mgr.zapi.settings.get.return_value = {
        "alert_usrgrpid": "7",
        "discovery_groupid": "5",
        "default_inventory_mode": "-1",
        "hk_events_mode": "1",
        "hk_events_trigger": "365",
        "hk_services_mode": "1",
        "hk_services": "365",
        "hk_audit_mode": "1",
        "hk_audit": "365",
        "hk_sessions_mode": "1",
        "hk_sessions": "365",
        "hk_history_mode": "1",
        "hk_history_global": "0",
        "hk_history": "90",
        "hk_trends_mode": "1",
        "hk_trends_global": "0",
        "hk_trends": "365",
    }
    result = mgr.get_settings()
    assert isinstance(result, dict)


# ── Auth settings ──────────────────────────────────────────────────────────────


def test_get_auth_settings_returns_dict(mgr):
    mgr.zapi.authentication.get.return_value = {
        "authentication_type": "0",
        "ldap_configured": "0",
        "saml_configured": "0",
        "passwd_min_length": "8",
        "passwd_check_rules": "8",
    }
    result = mgr.get_auth_settings()
    assert isinstance(result, dict)


def test_get_auth_settings_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.get_auth_settings()


def test_update_auth_settings_ok(mgr):
    mgr.zapi.authentication.update.return_value = {}
    result = mgr.update_auth_settings({"authentication_type": "1"})
    assert result is True


def test_update_auth_settings_renames_ldap_configured(mgr):
    mgr.zapi.authentication.update.return_value = {}
    result = mgr.update_auth_settings({"ldap_configured": "1"})
    assert result is True
    call_kwargs = mgr.zapi.authentication.update.call_args[1]
    assert "ldap_auth_enabled" in call_kwargs
    assert "ldap_configured" not in call_kwargs


def test_update_auth_settings_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.update_auth_settings({})


def test_update_auth_settings_zabbix_error(mgr):
    mgr.zapi.authentication.update.side_effect = Exception("zabbix error")
    with pytest.raises(RuntimeError):
        mgr.update_auth_settings({})


# ── LDAP user directories ──────────────────────────────────────────────────────


def test_list_ldap_userdirectories_ok(mgr):
    mgr.zapi.userdirectory.get.return_value = [
        {"userdirectoryid": "1", "name": "AD", "usrgrps": "3"}
    ]
    mgr.zapi.authentication.get.return_value = {"ldap_userdirectoryid": "1"}
    result = mgr.list_ldap_userdirectories()
    assert isinstance(result, list)
    assert result[0]["is_default"] is True
    assert result[0]["usrgrp_count"] == 3


def test_list_ldap_userdirectories_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.list_ldap_userdirectories()


def test_list_ldap_userdirectories_version_too_old(mgr):
    mgr._zabbix_version = (6, 2)
    with pytest.raises(RuntimeError, match="6.4"):
        mgr.list_ldap_userdirectories()


def test_list_ldap_userdirectories_zabbix_error(mgr):
    mgr.zapi.userdirectory.get.side_effect = Exception("api error")
    with pytest.raises(RuntimeError):
        mgr.list_ldap_userdirectories()


def test_get_ldap_userdirectory_ok(mgr):
    mgr.zapi.userdirectory.get.return_value = [
        {
            "userdirectoryid": "1",
            "name": "AD",
            "host": "ldap.example.com",
            "port": "389",
            "base_dn": "dc=example,dc=com",
            "bind_dn": "",
            "search_attribute": "sAMAccountName",
            "description": "",
            "provision_status": "0",
            "start_tls": "0",
            "search_filter": "",
            "group_basedn": "",
            "group_name": "",
            "group_member": "",
            "group_filter": "",
            "group_membership": "",
            "user_username": "",
            "user_lastname": "",
            "user_ref_attr": "",
            "provision_groups": [],
            "provision_media": [],
        }
    ]
    result = mgr.get_ldap_userdirectory("1")
    assert result["userdirectoryid"] == "1"
    assert result["bind_password"] == ""


def test_get_ldap_userdirectory_not_found(mgr):
    mgr.zapi.userdirectory.get.return_value = []
    with pytest.raises(RuntimeError, match="not found"):
        mgr.get_ldap_userdirectory("99")


def test_get_ldap_userdirectory_normalises_provision_groups(mgr):
    mgr.zapi.userdirectory.get.return_value = [
        {
            "userdirectoryid": "1",
            "name": "AD",
            "host": "ldap.example.com",
            "port": "389",
            "base_dn": "dc=example,dc=com",
            "bind_dn": "",
            "search_attribute": "uid",
            "description": "",
            "provision_status": "0",
            "start_tls": "0",
            "search_filter": "",
            "group_basedn": "",
            "group_name": "",
            "group_member": "",
            "group_filter": "",
            "group_membership": "",
            "user_username": "",
            "user_lastname": "",
            "user_ref_attr": "",
            "provision_groups": [
                {"user_groups": [{"usrgrpid": "7"}, {"usrgrpid": "8"}]}
            ],
            "provision_media": [{"severity": "5", "active": "1"}],
        }
    ]
    result = mgr.get_ldap_userdirectory("1")
    assert result["provision_groups"][0]["user_groups"] == ["7", "8"]
    assert result["provision_media"][0]["severity"] == 5


def test_create_ldap_userdirectory_ok(mgr):
    mgr.zapi.userdirectory.create.return_value = {"userdirectoryids": ["5"]}
    result = mgr.create_ldap_userdirectory({"name": "AD", "host": "ldap.example.com"})
    assert result == "5"


def test_create_ldap_userdirectory_strips_empty_strings(mgr):
    mgr.zapi.userdirectory.create.return_value = {"userdirectoryids": ["5"]}
    mgr.create_ldap_userdirectory({"name": "AD", "host": "", "port": "389"})
    call_kwargs = mgr.zapi.userdirectory.create.call_args[1]
    assert "host" not in call_kwargs
    assert "port" in call_kwargs


def test_create_ldap_userdirectory_error(mgr):
    mgr.zapi.userdirectory.create.side_effect = Exception("create failed")
    with pytest.raises(RuntimeError):
        mgr.create_ldap_userdirectory({"name": "AD"})


def test_update_ldap_userdirectory_ok(mgr):
    mgr.zapi.userdirectory.update.return_value = {}
    result = mgr.update_ldap_userdirectory("1", {"name": "AD Updated"})
    assert result is True


def test_update_ldap_userdirectory_strips_empty_bind_password(mgr):
    mgr.zapi.userdirectory.update.return_value = {}
    mgr.update_ldap_userdirectory("1", {"name": "AD", "bind_password": ""})
    call_kwargs = mgr.zapi.userdirectory.update.call_args[1]
    assert "bind_password" not in call_kwargs


def test_delete_ldap_userdirectory_ok(mgr):
    mgr.zapi.userdirectory.delete.return_value = {}
    result = mgr.delete_ldap_userdirectory("1")
    assert result is True


def test_delete_ldap_userdirectory_error(mgr):
    mgr.zapi.userdirectory.delete.side_effect = Exception("delete failed")
    with pytest.raises(RuntimeError):
        mgr.delete_ldap_userdirectory("1")


def test_set_default_ldap_userdirectory_ok(mgr):
    mgr.zapi.authentication.update.return_value = {}
    result = mgr.set_default_ldap_userdirectory("1")
    assert result is True


def test_test_ldap_connection_ok(mgr):
    mgr.zapi.userdirectory.test.return_value = {"user": {"userid": "1"}}
    result = mgr.test_ldap_connection(
        {"host": "ldap.example.com", "bind_password": "secret"},
        test_username="alice",
        test_password="pass",
    )
    assert isinstance(result, dict)


def test_test_ldap_connection_uses_id_when_no_password(mgr):
    mgr.zapi.userdirectory.test.return_value = {}
    mgr.test_ldap_connection(
        {"userdirectoryid": "3", "bind_password": ""},
        test_username="alice",
        test_password="pass",
    )
    call_kwargs = mgr.zapi.userdirectory.test.call_args[1]
    assert call_kwargs.get("userdirectoryid") == "3"
    assert "bind_password" not in call_kwargs


def test_test_ldap_connection_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.test_ldap_connection({}, "user", "pass")


def test_test_ldap_connection_version_too_old(mgr):
    mgr._zabbix_version = (6, 2)
    with pytest.raises(RuntimeError, match="6.4"):
        mgr.test_ldap_connection({}, "user", "pass")


# ── Proxy CRUD ────────────────────────────────────────────────────────────────


def test_create_proxy_ok(mgr):
    mgr.zapi.proxy.create.return_value = {"proxyids": ["10"]}
    result = mgr.create_proxy(name="proxy01", operating_mode=0)
    assert result == "10"


def test_create_proxy_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.create_proxy(name="proxy01")


def test_create_proxy_error(mgr):
    mgr.zapi.proxy.create.side_effect = Exception("duplicate")
    with pytest.raises(RuntimeError):
        mgr.create_proxy(name="dup")


def test_update_proxy_ok(mgr):
    mgr.zapi.proxy.update.return_value = {"proxyids": ["10"]}
    result = mgr.update_proxy("10", name="proxy01-updated")
    assert result is True


def test_update_proxy_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.update_proxy("10", name="x")


def test_update_proxy_error(mgr):
    mgr.zapi.proxy.update.side_effect = Exception("not found")
    with pytest.raises(RuntimeError):
        mgr.update_proxy("99", name="x")


def test_list_proxy_groups_ok(mgr):
    mgr.zapi.proxygroup.get.return_value = [
        {
            "proxygroupid": "1",
            "name": "group01",
            "failover_delay": "1m",
            "min_online": "1",
        }
    ]
    result = mgr.list_proxy_groups()
    assert isinstance(result, list)
    assert result[0]["proxygroupid"] == "1"


def test_list_proxy_groups_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_proxy_groups()
    assert result == []


def test_create_proxy_group_ok(mgr):
    mgr.zapi.proxygroup.create.return_value = {"proxygroupids": ["5"]}
    result = mgr.create_proxy_group(name="group01", failover_delay="1m", min_online=1)
    assert result == "5"


def test_create_proxy_group_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.create_proxy_group(name="group01")


def test_delete_proxy_group_ok(mgr):
    mgr.zapi.proxygroup.delete.return_value = {"proxygroupids": ["1"]}
    result = mgr.delete_proxy_group("1")
    assert result is True


def test_delete_proxy_group_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.delete_proxy_group("1")


# ── Role CRUD ─────────────────────────────────────────────────────────────────


def test_create_role_ok(mgr):
    mgr.zapi.role.create.return_value = {"roleids": ["4"]}
    result = mgr.create_role(name="Custom role", role_type=2)
    assert result == "4"


def test_create_role_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.create_role(name="x", role_type=1)


def test_create_role_error(mgr):
    mgr.zapi.role.create.side_effect = Exception("dup")
    with pytest.raises(RuntimeError):
        mgr.create_role(name="dup", role_type=1)


def test_update_role_ok(mgr):
    mgr.zapi.role.update.return_value = {"roleids": ["4"]}
    result = mgr.update_role("4", "Renamed role")
    assert result is True


def test_update_role_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.update_role("4", "x")


# ── User group CRUD ───────────────────────────────────────────────────────────


def test_create_user_group_ok(mgr):
    mgr.zapi.usergroup.create.return_value = {"usrgrpids": ["10"]}
    result = mgr.create_user_group(name="New Group")
    assert result == "10"


def test_create_user_group_with_rights(mgr):
    mgr.zapi.usergroup.create.return_value = {"usrgrpids": ["11"]}
    result = mgr.create_user_group(
        name="Ops",
        gui_access=0,
        users_status=0,
        hostgroup_rights=[{"id": "2", "permission": 2}],
    )
    assert result == "11"


def test_create_user_group_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.create_user_group(name="x")


def test_create_user_group_error(mgr):
    mgr.zapi.usergroup.create.side_effect = Exception("dup")
    with pytest.raises(RuntimeError):
        mgr.create_user_group(name="dup")


# ── Macro CRUD ────────────────────────────────────────────────────────────────


def test_create_global_macro_ok(mgr):
    mgr.zapi.usermacro.createglobal.return_value = {"globalmacroids": ["7"]}
    result = mgr.create_global_macro(macro="{$TIMEOUT}", value="30s")
    assert result == "7"


def test_create_global_macro_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.create_global_macro(macro="{$X}", value="1")


def test_update_global_macro_ok(mgr):
    mgr.zapi.usermacro.updateglobal.return_value = {"globalmacroids": ["7"]}
    result = mgr.update_global_macro("7", value="60s")
    assert result is True


def test_update_global_macro_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.update_global_macro("7", value="1")


# ── Token CRUD ────────────────────────────────────────────────────────────────


def test_create_api_token_ok(mgr):
    mgr.zapi.token.create.return_value = {"tokenids": ["3"]}
    mgr.zapi.token.generate.return_value = [{"tokenid": "3", "token": "abc123"}]
    tokenid, token_value = mgr.create_api_token(name="CI token", userid="1")
    assert tokenid == "3"
    assert token_value == "abc123"


def test_create_api_token_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.create_api_token(name="x", userid="1")


def test_create_api_token_error(mgr):
    mgr.zapi.token.create.side_effect = Exception("create error")
    with pytest.raises(RuntimeError):
        mgr.create_api_token(name="x", userid="1")


# ── System CRUD ───────────────────────────────────────────────────────────────


def test_update_housekeeping_ok(mgr):
    mgr.zapi.settings.update.return_value = {}
    result = mgr.update_housekeeping({"hk_events_mode": "1"})
    assert result is True


def test_update_housekeeping_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.update_housekeeping({})


def test_update_housekeeping_error(mgr):
    mgr.zapi.settings.update.side_effect = Exception("api error")
    with pytest.raises(RuntimeError):
        mgr.update_housekeeping({})
