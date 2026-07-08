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
from Auth import get_current_user, require_root

FAKE_ROOT = {
    "id": 1,
    "sub": "1",
    "username": "admin",
    "roles": ["root"],
    "team_id": 1,
    "display_name": "Admin",
}


def make_app():
    from api.routes.status import router

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: FAKE_ROOT
    app.dependency_overrides[require_root] = lambda: FAKE_ROOT
    return app


def test_health_zabbix_connected():
    mock_host = MagicMock()
    mock_host.zapi = MagicMock()
    with patch("api.routes.status.host_bot", mock_host):
        with patch("api.routes.status.sync_bot", MagicMock()):
            with TestClient(make_app()) as c:
                r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["zabbix_connected"] is True


def test_health_zabbix_disconnected():
    mock_host = MagicMock()
    mock_host.zapi = None
    with patch("api.routes.status.host_bot", mock_host):
        with patch("api.routes.status.sync_bot", MagicMock()):
            with TestClient(make_app()) as c:
                r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["zabbix_connected"] is False


def test_trigger_sync():
    mock_sync = MagicMock()
    with patch("api.routes.status.sync_bot", mock_sync):
        with patch("api.routes.status.host_bot", MagicMock()):
            with TestClient(make_app()) as c:
                r = c.post("/sync")
    assert r.status_code == 200
    mock_sync.full_sync.assert_called_once()


def test_debug_team_sync_no_zabbix():
    mock_sync = MagicMock()
    mock_sync.zapi = None
    with patch("api.routes.status.sync_bot", mock_sync):
        with patch("api.routes.status.host_bot", MagicMock()):
            with TestClient(make_app()) as c:
                r = c.get("/sync/debug/myteam")
    assert r.status_code == 503


def test_debug_team_sync_with_zabbix():
    mock_sync = MagicMock()
    mock_sync.zapi = MagicMock()
    mock_sync._rights_field = "rights"
    mock_sync.zapi.usergroup.get.return_value = [{"usrgrpid": "1", "name": "myteam"}]
    mock_sync.zapi.hostgroup.get.return_value = [{"groupid": "5", "name": "myteam"}]
    mock_sync.zapi.host.get.return_value = [{"hostid": "10", "host": "srv01"}]
    with patch("api.routes.status.sync_bot", mock_sync):
        with patch("api.routes.status.host_bot", MagicMock()):
            with TestClient(make_app()) as c:
                r = c.get("/sync/debug/myteam")
    assert r.status_code == 200
    data = r.json()
    assert data["team"] == "myteam"
    assert data["user_group"]["usrgrpid"] == "1"
    assert len(data["hosts_in_group"]) == 1


def test_debug_team_sync_zabbix_usergroup_error():
    mock_sync = MagicMock()
    mock_sync.zapi = MagicMock()
    mock_sync._rights_field = "rights"
    mock_sync.zapi.usergroup.get.side_effect = Exception("zabbix error")
    mock_sync.zapi.hostgroup.get.return_value = []
    with patch("api.routes.status.sync_bot", mock_sync):
        with patch("api.routes.status.host_bot", MagicMock()):
            with TestClient(make_app()) as c:
                r = c.get("/sync/debug/myteam")
    assert r.status_code == 200
    assert "user_group_error" in r.json()


def test_debug_team_sync_empty_results():
    mock_sync = MagicMock()
    mock_sync.zapi = MagicMock()
    mock_sync._rights_field = "hostgroup_rights"
    mock_sync.zapi.usergroup.get.return_value = []
    mock_sync.zapi.hostgroup.get.return_value = []
    with patch("api.routes.status.sync_bot", mock_sync):
        with patch("api.routes.status.host_bot", MagicMock()):
            with TestClient(make_app()) as c:
                r = c.get("/sync/debug/myteam")
    assert r.status_code == 200
    assert r.json()["user_group"] is None
    assert r.json()["host_group"] is None
