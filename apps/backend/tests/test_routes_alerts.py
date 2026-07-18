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
from Auth import get_current_user

FAKE_USER = {
    "id": 1,
    "sub": "1",
    "username": "admin",
    "roles": ["root"],
    "team_id": 1,
    "display_name": "Admin",
}


def make_app():
    from api.routes.alerts import router

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: FAKE_USER
    return app


# ── list alert rules ──────────────────────────────────────────────────────────


def test_list_alert_rules_returns_rules():
    mock_bot = MagicMock()
    mock_bot.get_rules.return_value = [{"id": 1, "name": "cpu"}]
    with patch("api.routes.alerts.alert_bot", mock_bot), TestClient(make_app()) as c:
        r = c.get("/alerts/rules")
    assert r.status_code == 200
    assert r.json()["rules"][0]["id"] == 1


def test_list_alert_rules_empty():
    mock_bot = MagicMock()
    mock_bot.get_rules.return_value = []
    with patch("api.routes.alerts.alert_bot", mock_bot), TestClient(make_app()) as c:
        r = c.get("/alerts/rules")
    assert r.status_code == 200
    assert r.json()["rules"] == []


# ── create alert rule ─────────────────────────────────────────────────────────

ITEM_RULE = {
    "rule_type": "item",
    "item_id": "42",
    "item_name": "cpu",
    "hostname": "web01",
    "operator": ">",
    "threshold": 90.0,
    "severity": 3,
}


def test_create_item_rule_success():
    mock_bot = MagicMock()
    mock_bot.create_rule.return_value = {"id": 10}
    with patch("api.routes.alerts.alert_bot", mock_bot), TestClient(make_app()) as c:
        r = c.post("/alerts/rules", json=ITEM_RULE)
    assert r.status_code == 201
    assert r.json()["id"] == 10


def test_create_rule_bad_severity():
    with patch("api.routes.alerts.alert_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.post("/alerts/rules", json={**ITEM_RULE, "severity": 9})
    assert r.status_code == 400


def test_create_rule_bad_rule_type():
    with patch("api.routes.alerts.alert_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.post("/alerts/rules", json={**ITEM_RULE, "rule_type": "bad"})
    assert r.status_code == 400


def test_create_service_rule_success():
    mock_bot = MagicMock()
    mock_bot.create_rule.return_value = {"id": 11}
    payload = {
        "rule_type": "service",
        "item_id": "5",
        "item_name": "http",
        "hostname": "web01",
        "severity": 2,
    }
    with patch("api.routes.alerts.alert_bot", mock_bot), TestClient(make_app()) as c:
        r = c.post("/alerts/rules", json=payload)
    assert r.status_code == 201


# ── update alert rule ─────────────────────────────────────────────────────────


def test_update_rule_success():
    mock_bot = MagicMock()
    mock_bot.update_rule.return_value = True
    with patch("api.routes.alerts.alert_bot", mock_bot), TestClient(make_app()) as c:
        r = c.put("/alerts/rules/1", json={"severity": 2})
    assert r.status_code == 200


def test_update_rule_not_found():
    mock_bot = MagicMock()
    mock_bot.update_rule.return_value = False
    with patch("api.routes.alerts.alert_bot", mock_bot), TestClient(make_app()) as c:
        r = c.put("/alerts/rules/99", json={"severity": 2})
    assert r.status_code == 404


# ── delete alert rule ─────────────────────────────────────────────────────────


def test_delete_rule_success():
    mock_bot = MagicMock()
    mock_bot.delete_rule.return_value = True
    with patch("api.routes.alerts.alert_bot", mock_bot), TestClient(make_app()) as c:
        r = c.delete("/alerts/rules/1")
    assert r.status_code == 200


def test_delete_rule_not_found():
    mock_bot = MagicMock()
    mock_bot.delete_rule.return_value = False
    with patch("api.routes.alerts.alert_bot", mock_bot), TestClient(make_app()) as c:
        r = c.delete("/alerts/rules/99")
    assert r.status_code == 404


# ── toggle alert rule ─────────────────────────────────────────────────────────


def test_toggle_rule_success():
    mock_bot = MagicMock()
    mock_bot.toggle_rule.return_value = True
    with patch("api.routes.alerts.alert_bot", mock_bot), TestClient(make_app()) as c:
        r = c.patch("/alerts/rules/1/toggle")
    assert r.status_code == 200
    assert r.json()["enabled"] is True


def test_toggle_rule_not_found():
    mock_bot = MagicMock()
    mock_bot.toggle_rule.return_value = None
    with patch("api.routes.alerts.alert_bot", mock_bot), TestClient(make_app()) as c:
        r = c.patch("/alerts/rules/99/toggle")
    assert r.status_code == 404


# ── alert events ─────────────────────────────────────────────────────────────


def test_get_alert_events():
    mock_bot = MagicMock()
    mock_bot.get_events.return_value = [{"id": 1}]
    with patch("api.routes.alerts.alert_bot", mock_bot), TestClient(make_app()) as c:
        r = c.get("/alerts/events")
    assert r.status_code == 200
    assert len(r.json()["events"]) == 1


def test_get_alert_events_limit_clamped():
    mock_bot = MagicMock()
    mock_bot.get_events.return_value = []
    with patch("api.routes.alerts.alert_bot", mock_bot), TestClient(make_app()) as c:
        c.get("/alerts/events?limit=9999")
    mock_bot.get_events.assert_called_once_with(1, limit=500)


# ── notification history ──────────────────────────────────────────────────────


def test_get_notification_history():
    with patch("api.routes.alerts.um") as mock_um:
        mock_um.get_notification_history.return_value = []
        with patch("api.routes.alerts.alert_bot", MagicMock()), TestClient(make_app()) as c:
            r = c.get("/alerts/notification-history")
    assert r.status_code == 200


def test_save_notification_history():
    with patch("api.routes.alerts.um"), patch("api.routes.alerts.alert_bot", MagicMock()):
        with TestClient(make_app()) as c:
            r = c.post("/alerts/notification-history", json=[])
    assert r.status_code == 204
