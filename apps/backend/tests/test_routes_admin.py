import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from api.limiter import limiter
from Auth import get_current_user, require_admin, require_operator, require_root

FAKE_ROOT = {
    "id": 1,
    "username": "admin",
    "roles": ["root"],
    "team_id": 1,
    "display_name": "Admin",
}


def make_app(router):
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: FAKE_ROOT
    app.dependency_overrides[require_admin] = lambda: FAKE_ROOT
    app.dependency_overrides[require_operator] = lambda: FAKE_ROOT
    app.dependency_overrides[require_root] = lambda: FAKE_ROOT
    return app


def _bot():
    from api.routes.admin import router

    mock = MagicMock()
    app = make_app(router)
    return mock, app


# ── user groups ───────────────────────────────────────────────────────────────


def test_list_user_groups():
    mock, app = _bot()
    mock.list_user_groups.return_value = []
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/user-groups")
    assert r.status_code == 200
    assert "groups" in r.json()


def test_create_user_group_success():
    mock, app = _bot()
    mock.create_user_group.return_value = "10"
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.post("/user-groups", json={"name": "Ops"})
    assert r.status_code == 200
    assert r.json()["usrgrpid"] == "10"


def test_create_user_group_zabbix_error():
    mock, app = _bot()
    mock.create_user_group.side_effect = RuntimeError("err")
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.post("/user-groups", json={"name": "Ops"})
    assert r.status_code == 422


def test_delete_user_group_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/user-groups/10")
    assert r.status_code == 200
    assert r.json()["ok"] is True


# ── roles ─────────────────────────────────────────────────────────────────────


def test_list_roles():
    mock, app = _bot()
    mock.list_roles.return_value = []
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/roles")
    assert r.status_code == 200
    assert "roles" in r.json()


def test_create_role_success():
    mock, app = _bot()
    mock.create_role.return_value = "5"
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.post("/roles", json={"name": "Viewer", "type": 1})
    assert r.status_code == 200
    assert r.json()["roleid"] == "5"


def test_update_role_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.put("/roles/5", json={"name": "Reader"})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_delete_role_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/roles/5")
    assert r.status_code == 200
    assert r.json()["ok"] is True


# ── api tokens ────────────────────────────────────────────────────────────────


def test_list_api_tokens():
    mock, app = _bot()
    mock.list_api_tokens.return_value = []
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/api-tokens")
    assert r.status_code == 200
    assert "tokens" in r.json()


def test_create_api_token_success():
    mock, app = _bot()
    mock.create_api_token.return_value = ("9", "abc123")
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.post(
                "/api-tokens", json={"name": "CI", "userid": "2", "expires_at": 0}
            )
    assert r.status_code == 200
    assert r.json()["tokenid"] == "9"


def test_delete_api_token_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/api-tokens/9")
    assert r.status_code == 200
    assert r.json()["ok"] is True


# ── proxies ───────────────────────────────────────────────────────────────────


def test_list_proxies():
    mock, app = _bot()
    mock.list_proxies.return_value = []
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/proxies")
    assert r.status_code == 200
    assert "proxies" in r.json()


def test_create_proxy_success():
    mock, app = _bot()
    mock.create_proxy.return_value = "15"
    payload = {"name": "Proxy1", "operating_mode": 0}
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.post("/proxies", json=payload)
    assert r.status_code == 200
    assert r.json()["proxyid"] == "15"


def test_delete_proxy_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/proxies/15")
    assert r.status_code == 200
    assert r.json()["ok"] is True


# ── proxy groups ──────────────────────────────────────────────────────────────


def test_list_proxy_groups():
    mock, app = _bot()
    mock.list_proxy_groups.return_value = []
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/proxy_groups")
    assert r.status_code == 200
    assert "proxy_groups" in r.json()


def test_create_proxy_group_success():
    mock, app = _bot()
    mock.create_proxy_group.return_value = "20"
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.post("/proxy_groups", json={"name": "Group1"})
    assert r.status_code == 200
    assert r.json()["proxygroupid"] == "20"


def test_delete_proxy_group_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/proxy_groups/20")
    assert r.status_code == 200


# ── macros ────────────────────────────────────────────────────────────────────


def test_list_macros():
    mock, app = _bot()
    mock.list_global_macros.return_value = []
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/macros")
    assert r.status_code == 200
    assert "macros" in r.json()


def test_create_macro_success():
    mock, app = _bot()
    mock.create_global_macro.return_value = "30"
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.post("/macros", json={"macro": "{$TIMEOUT}", "value": "30s"})
    assert r.status_code == 200
    assert r.json()["globalmacroid"] == "30"


def test_update_macro_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.put("/macros/30", json={"value": "60s"})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_delete_macro_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/macros/30")
    assert r.status_code == 200
    assert r.json()["ok"] is True


# ── admin settings/queue/housekeeping/auth ────────────────────────────────────


def test_get_queue():
    mock, app = _bot()
    mock.get_queue_overview.return_value = {"queue": []}
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/admin/queue")
    assert r.status_code == 200


def test_get_settings_success():
    mock, app = _bot()
    mock.get_settings.return_value = {"refresh_unsupported": "10"}
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/admin/settings")
    assert r.status_code == 200


def test_get_settings_zabbix_error():
    mock, app = _bot()
    mock.get_settings.side_effect = RuntimeError("err")
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/admin/settings")
    assert r.status_code == 502


def test_update_housekeeping_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.put("/admin/housekeeping", json={"hk_events_mode": 1})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_get_auth_settings_success():
    mock, app = _bot()
    mock.get_auth_settings.return_value = {"authentication_type": 0}
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/admin/auth")
    assert r.status_code == 200


def test_get_auth_settings_zabbix_error():
    mock, app = _bot()
    mock.get_auth_settings.side_effect = RuntimeError("err")
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/admin/auth")
    assert r.status_code == 502


# ── portal LDAP ───────────────────────────────────────────────────────────────


def test_get_portal_ldap():
    mock, app = _bot()
    with (
        patch("api.routes.admin.zadmin_bot", mock),
        patch(
            "api.routes.admin.get_portal_ldap_config",
            return_value={"host": "ldap.example.com", "bind_password": "secret"},
        ),
    ):
        with TestClient(app) as c:
            r = c.get("/admin/auth/portal-ldap")
    assert r.status_code == 200
    # bind_password must be scrubbed
    assert r.json().get("bind_password") == ""


def test_save_portal_ldap_disabled_skips_test():
    mock, app = _bot()
    payload = {"enabled": False, "host": "ldap.example.com", "port": 389}
    with (
        patch("api.routes.admin.zadmin_bot", mock),
        patch("api.routes.admin.get_portal_ldap_config", return_value={}),
        patch("api.routes.admin.save_portal_ldap_config") as mock_save,
        patch("api.routes.admin.test_portal_ldap_connection") as mock_test,
    ):
        with TestClient(app) as c:
            r = c.put("/admin/auth/portal-ldap", json=payload)
    assert r.status_code == 200
    mock_save.assert_called_once()
    mock_test.assert_not_called()


def test_save_portal_ldap_enabled_connection_fails():
    mock, app = _bot()
    payload = {"enabled": True, "host": "ldap.example.com", "port": 389}
    with (
        patch("api.routes.admin.zadmin_bot", mock),
        patch("api.routes.admin.get_portal_ldap_config", return_value={}),
        patch("api.routes.admin.save_portal_ldap_config"),
        patch(
            "api.routes.admin.test_portal_ldap_connection",
            return_value=(False, "timeout"),
        ),
    ):
        with TestClient(app) as c:
            r = c.put("/admin/auth/portal-ldap", json=payload)
    assert r.status_code == 422


# ── missing endpoints ─────────────────────────────────────────────────────────


def test_list_zabbix_users():
    mock, app = _bot()
    mock.list_zabbix_users.return_value = [{"userid": "1", "username": "Admin"}]
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/zabbix-users")
    assert r.status_code == 200
    assert len(r.json()["users"]) == 1


def test_update_proxy_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.put("/proxies/1", json={"name": "proxy1", "proxyMode": 0})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_update_auth_settings_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.put("/admin/auth", json={"authentication_type": 0})
    assert r.status_code == 200


def test_test_ldap_connection_success():
    mock, app = _bot()
    mock.test_ldap_connection.return_value = {"result": True}
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.post(
                "/admin/auth/ldap/test",
                json={
                    "host": "ldap.example.com",
                    "port": 389,
                    "base_dn": "dc=example,dc=com",
                    "search_attribute": "sAMAccountName",
                    "test_username": "joe",
                    "test_password": "secret",
                },
            )
    assert r.status_code == 200


def test_list_ldap_servers_success():
    mock, app = _bot()
    mock.list_ldap_userdirectories.return_value = [{"userdirectoryid": "1"}]
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/admin/auth/ldap/servers")
    assert r.status_code == 200
    assert len(r.json()["servers"]) == 1


def test_get_ldap_server_success():
    mock, app = _bot()
    mock.get_ldap_userdirectory.return_value = {"userdirectoryid": "1", "name": "AD"}
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.get("/admin/auth/ldap/servers/1")
    assert r.status_code == 200


def test_create_ldap_server_success():
    mock, app = _bot()
    mock.create_ldap_userdirectory.return_value = "5"
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.post(
                "/admin/auth/ldap/servers",
                json={
                    "name": "AD",
                    "host": "ldap.example.com",
                    "port": 389,
                    "base_dn": "dc=example,dc=com",
                    "search_attribute": "sAMAccountName",
                },
            )
    assert r.status_code == 200
    assert r.json()["userdirectoryid"] == "5"


def test_update_ldap_server_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.put(
                "/admin/auth/ldap/servers/1",
                json={
                    "name": "AD",
                    "host": "ldap.example.com",
                    "port": 389,
                    "base_dn": "dc=example,dc=com",
                    "search_attribute": "sAMAccountName",
                },
            )
    assert r.status_code == 200


def test_delete_ldap_server_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/admin/auth/ldap/servers/1")
    assert r.status_code == 200


def test_set_default_ldap_server_success():
    mock, app = _bot()
    with patch("api.routes.admin.zadmin_bot", mock):
        with TestClient(app) as c:
            r = c.post("/admin/auth/ldap/servers/1/default")
    assert r.status_code == 200


def test_test_portal_ldap_connection_ok():
    mock, app = _bot()
    with (
        patch("api.routes.admin.zadmin_bot", mock),
        patch("api.routes.admin.get_portal_ldap_config", return_value={}),
        patch(
            "api.routes.admin.test_portal_ldap_connection", return_value=(True, "ok")
        ),
    ):
        with TestClient(app) as c:
            r = c.post(
                "/admin/auth/portal-ldap/test",
                json={"host": "ldap.example.com", "port": 389},
            )
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_test_portal_ldap_connection_fails():
    mock, app = _bot()
    with (
        patch("api.routes.admin.zadmin_bot", mock),
        patch("api.routes.admin.get_portal_ldap_config", return_value={}),
        patch(
            "api.routes.admin.test_portal_ldap_connection",
            return_value=(False, "timeout"),
        ),
    ):
        with TestClient(app) as c:
            r = c.post(
                "/admin/auth/portal-ldap/test",
                json={"host": "ldap.example.com", "port": 389},
            )
    assert r.status_code == 422


def test_test_portal_ldap_with_user_ok():
    mock, app = _bot()

    with (
        patch("api.routes.admin.zadmin_bot", mock),
        patch("api.routes.admin.get_portal_ldap_config", return_value={}),
        patch(
            "api.routes.admin.test_portal_ldap_connection", return_value=(True, "ok")
        ),
        patch("ldap_auth._do_ldap_auth", return_value={"uid": "joe"}),
    ):
        with TestClient(app) as c:
            r = c.post(
                "/admin/auth/portal-ldap/test",
                json={
                    "host": "ldap.example.com",
                    "port": 389,
                    "test_username": "joe",
                    "test_password": "secret",
                },
            )
    assert r.status_code == 200
    assert "succeeded" in r.json()["message"]


def test_test_portal_ldap_user_not_found():
    mock, app = _bot()
    from ldap_auth import LdapUserNotFound

    with (
        patch("api.routes.admin.zadmin_bot", mock),
        patch("api.routes.admin.get_portal_ldap_config", return_value={}),
        patch(
            "api.routes.admin.test_portal_ldap_connection", return_value=(True, "ok")
        ),
        patch("ldap_auth._do_ldap_auth", side_effect=LdapUserNotFound("joe")),
    ):
        with TestClient(app) as c:
            r = c.post(
                "/admin/auth/portal-ldap/test",
                json={
                    "host": "ldap.example.com",
                    "port": 389,
                    "test_username": "joe",
                    "test_password": "wrong",
                },
            )
    assert r.status_code == 422


def test_test_portal_ldap_auth_returns_none():
    mock, app = _bot()
    with (
        patch("api.routes.admin.zadmin_bot", mock),
        patch("api.routes.admin.get_portal_ldap_config", return_value={}),
        patch(
            "api.routes.admin.test_portal_ldap_connection", return_value=(True, "ok")
        ),
        patch("ldap_auth._do_ldap_auth", return_value=None),
    ):
        with TestClient(app) as c:
            r = c.post(
                "/admin/auth/portal-ldap/test",
                json={
                    "host": "ldap.example.com",
                    "port": 389,
                    "test_username": "joe",
                    "test_password": "wrong",
                },
            )
    assert r.status_code == 422
