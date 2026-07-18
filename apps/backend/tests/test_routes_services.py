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
    from api.routes.services import router

    mock = MagicMock()
    app = make_app(router)
    return mock, app


# ── services ──────────────────────────────────────────────────────────────────


def test_list_services_success():
    mock, app = _bot()
    mock.list_services.return_value = [{"serviceid": "1"}]
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.get("/services")
    assert r.status_code == 200
    assert "services" in r.json()


def test_create_service_success():
    mock, app = _bot()
    mock.create_service.return_value = "3"
    payload = {
        "name": "Web",
        "algorithm": 1,
        "sortorder": 0,
        "weight": 1,
        "description": "",
    }
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.post("/services", json=payload)
    assert r.status_code == 200
    assert r.json()["serviceid"] == "3"


def test_create_service_zabbix_error():
    mock, app = _bot()
    mock.create_service.side_effect = RuntimeError("err")
    payload = {
        "name": "Web",
        "algorithm": 1,
        "sortorder": 0,
        "weight": 1,
        "description": "",
    }
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.post("/services", json=payload)
    assert r.status_code == 422


def test_update_service_success():
    mock, app = _bot()
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.put("/services/3", json={"name": "Web2", "algorithm": 1, "description": ""})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_update_service_zabbix_error():
    mock, app = _bot()
    mock.update_service.side_effect = RuntimeError("err")
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.put("/services/3", json={"name": "Web2", "algorithm": 1, "description": ""})
    assert r.status_code == 422


def test_delete_service_success():
    mock, app = _bot()
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.delete("/services/3")
    assert r.status_code == 200


def test_delete_service_zabbix_error():
    mock, app = _bot()
    mock.delete_service.side_effect = RuntimeError("err")
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.delete("/services/3")
    assert r.status_code == 422


# ── SLA ───────────────────────────────────────────────────────────────────────


def test_list_slas_success():
    mock, app = _bot()
    mock.list_slas.return_value = []
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.get("/sla")
    assert r.status_code == 200


def test_create_sla_success():
    mock, app = _bot()
    mock.create_sla.return_value = "9"
    payload = {
        "name": "SLA1",
        "slo": 99.9,
        "period": "PERIOD_MONTHLY",
        "timezone": "UTC",
        "description": "",
        "service_tags": [],
    }
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.post("/sla", json=payload)
    assert r.status_code == 200
    assert r.json()["slaid"] == "9"


def test_create_sla_zabbix_error():
    mock, app = _bot()
    mock.create_sla.side_effect = RuntimeError("err")
    payload = {
        "name": "SLA1",
        "slo": 99.9,
        "period": "PERIOD_MONTHLY",
        "timezone": "UTC",
        "description": "",
        "service_tags": [],
    }
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.post("/sla", json=payload)
    assert r.status_code == 422


def test_delete_sla_success():
    mock, app = _bot()
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.delete("/sla/9")
    assert r.status_code == 200


def test_get_sla_report_success():
    mock, app = _bot()
    mock.get_sla_report.return_value = {"periods": []}
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.get("/sla/9/report")
    assert r.status_code == 200


# ── health monitors ───────────────────────────────────────────────────────────


def test_list_health_monitors_success():
    mock, app = _bot()
    mock.list_health_monitors.return_value = []
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.get("/health-monitors")
    assert r.status_code == 200


def test_create_health_monitor_success():
    mock, app = _bot()
    mock.add_health_monitor.return_value = {"itemid": "20"}
    payload = {
        "hostid": "1",
        "name": "Check",
        "url": "http://x",
        "expected_contains": "",
        "process_name": "",
    }
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.post("/health-monitors", json=payload)
    assert r.status_code == 200


def test_delete_health_monitor_success():
    mock, app = _bot()
    with patch("api.routes.services.services_bot", mock), TestClient(app) as c:
        r = c.delete("/health-monitors/20")
    assert r.status_code == 200
