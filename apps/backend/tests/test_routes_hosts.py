"""Route tests for api/routes/hosts.py."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from Auth import get_current_user, require_admin, require_operator, require_root
from api.limiter import limiter

FAKE_ROOT = {
    "id": 1,
    "username": "admin",
    "roles": ["root"],
    "team_id": 1,
    "display_name": "Admin",
}

FAKE_HOSTS = [{"host": "server1", "name": "Server 1", "tags": []}]


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


def _client():
    from api.routes.hosts import router

    return TestClient(make_app(router), raise_server_exceptions=True)


# ── GET /hosts ────────────────────────────────────────────────────────────────


def test_get_all_hosts_root_sees_all():
    with patch("api.routes.hosts.host_bot") as m:
        m.get_hosts.return_value = FAKE_HOSTS
        r = _client().get("/hosts")
    assert r.status_code == 200
    assert r.json()["count"] == 1


def test_get_all_hosts_returns_hosts_key():
    with patch("api.routes.hosts.host_bot") as m:
        m.get_hosts.return_value = FAKE_HOSTS
        r = _client().get("/hosts")
    assert "hosts" in r.json()


# ── GET /templates ────────────────────────────────────────────────────────────


def test_list_templates_returns_200():
    with patch("api.routes.hosts.host_bot") as m:
        m.list_templates.return_value = [{"templateid": "1", "name": "Linux"}]
        r = _client().get("/templates")
    assert r.status_code == 200
    assert "templates" in r.json()


# ── POST /hosts ───────────────────────────────────────────────────────────────


def test_create_host_success():
    with (
        patch("api.routes.hosts.host_bot") as m,
        patch("api.routes.hosts.um"),
        patch("api.routes.hosts.live_team_id", return_value=None),
    ):
        m.create_server.return_value = ("10001", None)
        r = _client().post(
            "/hosts",
            json={"hostname": "newhost", "ip": "192.168.1.1"},
        )
    assert r.status_code == 201
    assert r.json()["hostid"] == "10001"


def test_create_host_failure_returns_400():
    with (
        patch("api.routes.hosts.host_bot") as m,
        patch("api.routes.hosts.live_team_id", return_value=None),
    ):
        m.create_server.return_value = (None, "Already exists")
        r = _client().post(
            "/hosts",
            json={"hostname": "newhost", "ip": "192.168.1.1"},
        )
    assert r.status_code == 400


# ── DELETE /hosts/{hostname} ──────────────────────────────────────────────────


def test_delete_host_root_success():
    with (
        patch("api.routes.hosts.host_bot") as m,
        patch("api.routes.hosts.um") as um_mock,
    ):
        m.delete_server.return_value = True
        um_mock.unassign_host_all.return_value = None
        r = _client().delete("/hosts/server1")
    assert r.status_code == 200


def test_delete_host_not_found_returns_404():
    with (
        patch("api.routes.hosts.host_bot") as m,
        patch("api.routes.hosts.um") as um_mock,
    ):
        m.delete_server.return_value = False
        um_mock.unassign_host_all.return_value = None
        r = _client().delete("/hosts/ghost")
    assert r.status_code == 404


# ── GET /hosts/{hostname}/templates ──────────────────────────────────────────


def test_get_host_templates_200():
    with patch("api.routes.hosts.host_bot") as m:
        m.get_host_templates.return_value = [{"templateid": "1", "name": "T"}]
        r = _client().get("/hosts/server1/templates")
    assert r.status_code == 200
    assert "templates" in r.json()


# ── POST /hosts/{hostname}/templates ─────────────────────────────────────────


def test_link_template_success():
    with patch("api.routes.hosts.host_bot") as m:
        m.link_template.return_value = (True, None)
        r = _client().post("/hosts/server1/templates", json={"templateid": "42"})
    assert r.status_code == 201


def test_link_template_failure_400():
    with patch("api.routes.hosts.host_bot") as m:
        m.link_template.return_value = (False, "Not found")
        r = _client().post("/hosts/server1/templates", json={"templateid": "99"})
    assert r.status_code == 400


# ── DELETE /hosts/{hostname}/templates/{id} ───────────────────────────────────


def test_unlink_template_success():
    with patch("api.routes.hosts.host_bot") as m:
        m.unlink_template.return_value = (True, None)
        r = _client().delete("/hosts/server1/templates/42")
    assert r.status_code == 200


# ── PUT /hosts/{hostname} ─────────────────────────────────────────────────────


def test_update_host_success():
    with patch("api.routes.hosts.host_bot") as m:
        m.update_host.return_value = (True, None)
        r = _client().put("/hosts/server1", json={"ip": "10.0.0.1"})
    assert r.status_code == 200


def test_update_host_failure_422():
    with patch("api.routes.hosts.host_bot") as m:
        m.update_host.return_value = (False, "Not found")
        r = _client().put("/hosts/ghost", json={"ip": "10.0.0.2"})
    assert r.status_code == 422


# ── PUT /hosts/{hostname}/tags ────────────────────────────────────────────────


def test_update_host_tags_success():
    with (
        patch("api.routes.hosts.host_bot") as m,
        patch("api.routes.hosts.team_hostname_filter", return_value=None),
    ):
        m.update_host_tags.return_value = (True, None)
        r = _client().put(
            "/hosts/server1/tags",
            json={"tags": [{"tag": "env", "value": "prod"}]},
        )
    assert r.status_code == 200


# ── GET /hosts/download ───────────────────────────────────────────────────────


def test_download_inventory_xlsx():
    with (
        patch("api.routes.hosts.host_bot") as m,
        patch("api.routes.hosts.team_hostname_filter", return_value=None),
    ):
        m.export_hosts_to_excel_bytes.return_value = b"PKfakeexcel"
        r = _client().get("/hosts/download")
    assert r.status_code == 200


def test_download_inventory_csv():
    with (
        patch("api.routes.hosts.host_bot") as m,
        patch("api.routes.hosts.team_hostname_filter", return_value=None),
    ):
        m.export_hosts_to_csv_bytes.return_value = b"hostname,ip\nserver1,1.2.3.4"
        r = _client().get("/hosts/download?format=csv")
    assert r.status_code == 200
