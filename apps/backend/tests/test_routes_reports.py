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
    from api.routes.reports import router

    mock = MagicMock()
    app = make_app(router)
    return mock, app


def test_top_triggers_success():
    mock, app = _bot()
    mock.get_top_triggers.return_value = [{"description": "High CPU"}]
    with patch("api.routes.reports.report_bot", mock):
        with TestClient(app) as c:
            r = c.get("/reports/top-triggers")
    assert r.status_code == 200
    assert "triggers" in r.json()


def test_top_triggers_zabbix_error():
    mock, app = _bot()
    mock.get_top_triggers.side_effect = RuntimeError("err")
    with patch("api.routes.reports.report_bot", mock):
        with TestClient(app) as c:
            r = c.get("/reports/top-triggers")
    assert r.status_code == 502


def test_audit_log_success():
    mock, app = _bot()
    mock.get_audit_log.return_value = []
    with patch("api.routes.reports.report_bot", mock):
        with TestClient(app) as c:
            r = c.get("/reports/audit-log")
    assert r.status_code == 200
    assert "entries" in r.json()


def test_audit_log_zabbix_error():
    mock, app = _bot()
    mock.get_audit_log.side_effect = RuntimeError("err")
    with patch("api.routes.reports.report_bot", mock):
        with TestClient(app) as c:
            r = c.get("/reports/audit-log")
    assert r.status_code == 502


def test_action_log_success():
    mock, app = _bot()
    mock.get_action_log.return_value = []
    with patch("api.routes.reports.report_bot", mock):
        with TestClient(app) as c:
            r = c.get("/reports/action-log")
    assert r.status_code == 200
    assert "entries" in r.json()


def test_action_log_zabbix_error():
    mock, app = _bot()
    mock.get_action_log.side_effect = RuntimeError("err")
    with patch("api.routes.reports.report_bot", mock):
        with TestClient(app) as c:
            r = c.get("/reports/action-log")
    assert r.status_code == 502


def test_availability_success():
    mock, app = _bot()
    mock.get_availability.return_value = []
    with patch("api.routes.reports.report_bot", mock):
        with TestClient(app) as c:
            r = c.get("/reports/availability")
    assert r.status_code == 200
    assert "hosts" in r.json()


def test_availability_zabbix_error():
    mock, app = _bot()
    mock.get_availability.side_effect = RuntimeError("err")
    with patch("api.routes.reports.report_bot", mock):
        with TestClient(app) as c:
            r = c.get("/reports/availability")
    assert r.status_code == 502


def test_notifications_success():
    mock, app = _bot()
    mock.get_notification_history.return_value = []
    with patch("api.routes.reports.report_bot", mock):
        with TestClient(app) as c:
            r = c.get("/reports/notifications")
    assert r.status_code == 200
    assert "notifications" in r.json()


def test_notifications_zabbix_error():
    mock, app = _bot()
    mock.get_notification_history.side_effect = RuntimeError("err")
    with patch("api.routes.reports.report_bot", mock):
        with TestClient(app) as c:
            r = c.get("/reports/notifications")
    assert r.status_code == 502
