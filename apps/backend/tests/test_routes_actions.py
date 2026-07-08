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
    from api.routes.actions import router

    mock = MagicMock()
    app = make_app(router)
    return mock, app


# ── actions ──────────────────────────────────────────────────────────────────


def test_list_actions_success():
    mock, app = _bot()
    mock.list_actions.return_value = [{"actionid": "1"}]
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.get("/actions")
    assert r.status_code == 200
    assert r.json()["actions"] == [{"actionid": "1"}]


def test_create_action_success():
    mock, app = _bot()
    mock.create_action.return_value = "10"
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.post(
                "/actions", json={"name": "A", "eventsource": 0, "esc_period": "1m"}
            )
    assert r.status_code == 200
    assert r.json()["actionid"] == "10"


def test_create_action_zabbix_error():
    mock, app = _bot()
    mock.create_action.side_effect = RuntimeError("zabbix error")
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.post(
                "/actions", json={"name": "A", "eventsource": 0, "esc_period": "1m"}
            )
    assert r.status_code == 422


def test_delete_action_success():
    mock, app = _bot()
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/actions/10")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_delete_action_zabbix_error():
    mock, app = _bot()
    mock.delete_action.side_effect = RuntimeError("zabbix error")
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/actions/10")
    assert r.status_code == 422


def test_toggle_action_success():
    mock, app = _bot()
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.put("/actions/10/toggle", json={"status": 1})
    assert r.status_code == 200


# ── media types ───────────────────────────────────────────────────────────────


def test_list_media_types_success():
    mock, app = _bot()
    mock.list_media_types.return_value = [{"mediatypeid": "1"}]
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.get("/media-types")
    assert r.status_code == 200
    assert "media_types" in r.json()


def test_create_media_type_success():
    mock, app = _bot()
    mock.create_media_type.return_value = "5"
    payload = {
        "name": "Email",
        "type": 0,
        "description": "",
        "smtp_server": "",
        "smtp_helo": "",
        "smtp_email": "",
        "script": "",
        "webhook_script": "",
    }
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.post("/media-types", json=payload)
    assert r.status_code == 200
    assert r.json()["mediatypeid"] == "5"


def test_create_media_type_zabbix_error():
    mock, app = _bot()
    mock.create_media_type.side_effect = RuntimeError("err")
    payload = {
        "name": "Email",
        "type": 0,
        "description": "",
        "smtp_server": "",
        "smtp_helo": "",
        "smtp_email": "",
        "script": "",
        "webhook_script": "",
    }
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.post("/media-types", json=payload)
    assert r.status_code == 422


def test_delete_media_type_success():
    mock, app = _bot()
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/media-types/5")
    assert r.status_code == 200


def test_delete_media_type_zabbix_error():
    mock, app = _bot()
    mock.delete_media_type.side_effect = RuntimeError("err")
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/media-types/5")
    assert r.status_code == 422


# ── scripts ───────────────────────────────────────────────────────────────────


def test_list_scripts_success():
    mock, app = _bot()
    mock.list_scripts.return_value = [{"scriptid": "1"}]
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.get("/scripts")
    assert r.status_code == 200
    assert "scripts" in r.json()


def test_create_script_success():
    mock, app = _bot()
    mock.create_script.return_value = "7"
    payload = {
        "name": "Ping",
        "command": "ping -c 1 {HOST.IP}",
        "execute_on": 0,
        "scope": 2,
        "description": "",
    }
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.post("/scripts", json=payload)
    assert r.status_code == 200
    assert r.json()["scriptid"] == "7"


def test_create_script_zabbix_error():
    mock, app = _bot()
    mock.create_script.side_effect = RuntimeError("err")
    payload = {
        "name": "Ping",
        "command": "ping",
        "execute_on": 0,
        "scope": 2,
        "description": "",
    }
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.post("/scripts", json=payload)
    assert r.status_code == 422


def test_delete_script_success():
    mock, app = _bot()
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/scripts/7")
    assert r.status_code == 200


def test_delete_script_zabbix_error():
    mock, app = _bot()
    mock.delete_script.side_effect = RuntimeError("err")
    with patch("api.routes.actions.actions_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/scripts/7")
    assert r.status_code == 422
