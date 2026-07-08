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
    from api.routes.data_collection import router

    mock = MagicMock()
    app = make_app(router)
    return mock, app


# ── template groups ───────────────────────────────────────────────────────────


def test_list_template_groups():
    mock, app = _bot()
    mock.list_template_groups.return_value = []
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.get("/dc/template-groups")
    assert r.status_code == 200
    assert "groups" in r.json()


def test_create_template_group_success():
    mock, app = _bot()
    mock.create_template_group.return_value = ("5", None)
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.post("/dc/template-groups", json={"name": "Linux"})
    assert r.status_code == 201
    assert r.json()["groupid"] == "5"


def test_create_template_group_missing_name():
    mock, app = _bot()
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.post("/dc/template-groups", json={"name": ""})
    assert r.status_code == 400


def test_create_template_group_zabbix_error():
    mock, app = _bot()
    mock.create_template_group.return_value = (None, "already exists")
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.post("/dc/template-groups", json={"name": "Linux"})
    assert r.status_code == 400


def test_update_template_group_success():
    mock, app = _bot()
    mock.update_template_group.return_value = True
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.put("/dc/template-groups/5", json={"name": "Linux2"})
    assert r.status_code == 200


def test_update_template_group_failure():
    mock, app = _bot()
    mock.update_template_group.return_value = False
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.put("/dc/template-groups/5", json={"name": "Linux2"})
    assert r.status_code == 400


def test_delete_template_group_success():
    mock, app = _bot()
    mock.delete_template_group.return_value = True
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/dc/template-groups/5")
    assert r.status_code == 200


def test_delete_template_group_not_found():
    mock, app = _bot()
    mock.delete_template_group.return_value = False
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/dc/template-groups/5")
    assert r.status_code == 404


# ── host groups ───────────────────────────────────────────────────────────────


def test_list_host_groups():
    mock, app = _bot()
    mock.list_host_groups.return_value = []
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.get("/dc/host-groups")
    assert r.status_code == 200
    assert "groups" in r.json()


def test_create_host_group_success():
    mock, app = _bot()
    mock.create_host_group.return_value = ("8", None)
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.post("/dc/host-groups", json={"name": "Servers"})
    assert r.status_code == 201
    assert r.json()["groupid"] == "8"


def test_create_host_group_missing_name():
    mock, app = _bot()
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.post("/dc/host-groups", json={"name": "  "})
    assert r.status_code == 400


def test_delete_host_group_not_found():
    mock, app = _bot()
    mock.delete_host_group.return_value = False
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/dc/host-groups/8")
    assert r.status_code == 404


# ── templates ─────────────────────────────────────────────────────────────────


def test_list_templates():
    mock, app = _bot()
    mock.list_templates.return_value = []
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.get("/dc/templates")
    assert r.status_code == 200
    assert "templates" in r.json()


def test_create_template_success():
    mock, app = _bot()
    mock.create_template.return_value = ("20", None)
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.post("/dc/templates", json={"name": "Tmpl", "group_ids": ["5"]})
    assert r.status_code == 201
    assert r.json()["templateid"] == "20"


def test_create_template_missing_name():
    mock, app = _bot()
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.post("/dc/templates", json={"name": "", "group_ids": []})
    assert r.status_code == 400


def test_get_template_not_found():
    mock, app = _bot()
    mock.get_template_detail.return_value = None
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.get("/dc/templates/999")
    assert r.status_code == 404


def test_delete_template_success():
    mock, app = _bot()
    mock.delete_template.return_value = True
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/dc/templates/20")
    assert r.status_code == 200


# ── maintenances ──────────────────────────────────────────────────────────────


def test_list_maintenances():
    mock, app = _bot()
    mock.list_maintenances.return_value = []
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.get("/dc/maintenances")
    assert r.status_code == 200


def test_create_maintenance_success():
    mock, app = _bot()
    mock.create_maintenance.return_value = ("30", None)
    payload = {
        "name": "Maint",
        "maintenance_type": 0,
        "active_since": 0,
        "active_till": 3600,
    }
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.post("/dc/maintenances", json=payload)
    assert r.status_code == 201
    assert r.json()["maintenanceid"] == "30"


def test_delete_maintenance_not_found():
    mock, app = _bot()
    mock.delete_maintenance.return_value = False
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/dc/maintenances/30")
    assert r.status_code == 404


# ── correlations ──────────────────────────────────────────────────────────────


def test_list_correlations():
    mock, app = _bot()
    mock.list_correlations.return_value = []
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.get("/dc/correlations")
    assert r.status_code == 200


def test_create_correlation_success():
    mock, app = _bot()
    mock.create_correlation.return_value = ("40", None)
    payload = {
        "name": "Corr",
        "description": "",
        "status": 0,
        "conditions": [],
        "evaltype": 0,
        "operation_type": 0,
    }
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.post("/dc/correlations", json=payload)
    assert r.status_code == 201
    assert r.json()["correlationid"] == "40"


def test_delete_correlation_not_found():
    mock, app = _bot()
    mock.delete_correlation.return_value = False
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/dc/correlations/40")
    assert r.status_code == 404


# ── discovery rules ───────────────────────────────────────────────────────────


def test_list_discovery_rules():
    mock, app = _bot()
    mock.list_discovery_rules.return_value = []
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.get("/dc/discovery-rules")
    assert r.status_code == 200
    assert "rules" in r.json()


def test_create_discovery_rule_success():
    mock, app = _bot()
    mock.create_discovery_rule.return_value = ("50", None)
    payload = {
        "name": "LAN Scan",
        "iprange": "192.168.1.1-254",
        "delay": "1h",
        "check_types": ["icmp"],
    }
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.post("/dc/discovery-rules", json=payload)
    assert r.status_code == 201
    assert r.json()["druleid"] == "50"


def test_delete_discovery_rule_not_found():
    mock, app = _bot()
    mock.delete_discovery_rule.return_value = False
    with patch("api.routes.data_collection.dc_bot", mock):
        with TestClient(app) as c:
            r = c.delete("/dc/discovery-rules/50")
    assert r.status_code == 404
