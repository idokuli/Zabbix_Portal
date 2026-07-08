"""Tests for api/routes/triggers.py."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from api.limiter import limiter
from Auth import get_current_user, require_operator

FAKE_ROOT = {
    "id": 1,
    "username": "admin",
    "roles": ["root"],
    "team_id": 1,
    "display_name": "Admin",
}
FAKE_MEMBER = {
    "id": 2,
    "username": "member",
    "roles": ["operator"],
    "team_id": 1,
    "display_name": "Member",
}


def make_app(router, user=None):
    if user is None:
        user = FAKE_ROOT
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_operator] = lambda: user
    return app


@pytest.fixture()
def mock_bot():
    return MagicMock()


@pytest.fixture()
def client(mock_bot):
    from api.routes.triggers import router

    with (
        patch("api.routes.triggers.item_bot", mock_bot),
        patch("api.routes.triggers.team_hostname_filter", return_value=None),
        TestClient(make_app(router)) as c,
    ):
        yield c, mock_bot


@pytest.fixture()
def client_restricted(mock_bot):
    """Client where team_hostname_filter returns a restricted set."""
    from api.routes.triggers import router

    with (
        patch("api.routes.triggers.item_bot", mock_bot),
        patch(
            "api.routes.triggers.team_hostname_filter", return_value={"allowed-host"}
        ),
        TestClient(make_app(router, user=FAKE_MEMBER)) as c,
    ):
        yield c, mock_bot


# ── list_all_triggers ─────────────────────────────────────────────────────────


def test_list_all_triggers_ok(client):
    c, bot = client
    bot.list_all_triggers.return_value = [
        {"triggerid": "1", "description": "High CPU", "hostname": "h1"},
        {"triggerid": "2", "description": "Low disk", "hostname": "h2"},
    ]
    r = c.get("/triggers")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 2
    assert len(data["triggers"]) == 2


def test_list_all_triggers_with_search(client):
    c, bot = client
    bot.list_all_triggers.return_value = [{"triggerid": "1", "hostname": "h1"}]
    r = c.get("/triggers?search=cpu&limit=100")
    assert r.status_code == 200
    bot.list_all_triggers.assert_called_once_with(search="cpu", hostname="", limit=100)


def test_list_all_triggers_filtered_by_team(client_restricted):
    c, bot = client_restricted
    bot.list_all_triggers.return_value = [
        {"triggerid": "1", "hostname": "allowed-host"},
        {"triggerid": "2", "hostname": "other-host"},
    ]
    r = c.get("/triggers")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert data["triggers"][0]["hostname"] == "allowed-host"


def test_list_all_triggers_zabbix_error(client):
    c, bot = client
    bot.list_all_triggers.side_effect = RuntimeError("zabbix down")
    r = c.get("/triggers")
    assert r.status_code == 502


# ── list_triggers ─────────────────────────────────────────────────────────────


def test_list_triggers_ok(client):
    c, bot = client
    bot.list_triggers.return_value = ([{"triggerid": "1"}], True)
    r = c.get("/triggers/myhost")
    assert r.status_code == 200
    data = r.json()
    assert data["host_available"] is True
    assert len(data["triggers"]) == 1


def test_list_triggers_host_unavailable(client):
    c, bot = client
    bot.list_triggers.return_value = ([], False)
    r = c.get("/triggers/myhost")
    assert r.status_code == 200
    assert r.json()["host_available"] is False


def test_list_triggers_forbidden(client_restricted):
    c, bot = client_restricted
    r = c.get("/triggers/blocked-host")
    assert r.status_code == 403


def test_list_triggers_allowed_host(client_restricted):
    c, bot = client_restricted
    bot.list_triggers.return_value = ([{"triggerid": "5"}], True)
    r = c.get("/triggers/allowed-host")
    assert r.status_code == 200


# ── delete_trigger ────────────────────────────────────────────────────────────


def test_delete_trigger_ok(client):
    c, bot = client
    bot.delete_trigger.return_value = True
    r = c.delete("/triggers/99")
    assert r.status_code == 200
    assert "deleted" in r.json()["message"].lower()


def test_delete_trigger_not_found(client):
    c, bot = client
    bot.delete_trigger.return_value = False
    r = c.delete("/triggers/99")
    assert r.status_code == 404


def test_delete_trigger_team_restriction(client_restricted):
    c, bot = client_restricted
    bot.get_trigger_hostname.return_value = "other-host"
    r = c.delete("/triggers/99")
    assert r.status_code == 403


def test_delete_trigger_no_hostname(client_restricted):
    c, bot = client_restricted
    bot.get_trigger_hostname.return_value = None
    r = c.delete("/triggers/99")
    assert r.status_code == 403


def test_delete_trigger_allowed(client_restricted):
    c, bot = client_restricted
    bot.get_trigger_hostname.return_value = "allowed-host"
    bot.delete_trigger.return_value = True
    r = c.delete("/triggers/99")
    assert r.status_code == 200


# ── update_trigger ────────────────────────────────────────────────────────────


def test_update_trigger_ok(client):
    c, bot = client
    r = c.put("/triggers/10", json={"description": "new name", "priority": 4})
    assert r.status_code == 200
    assert "updated" in r.json()["message"].lower()
    bot.update_trigger.assert_called_once()


def test_update_trigger_zabbix_error(client):
    c, bot = client
    bot.update_trigger.side_effect = RuntimeError("invalid expression")
    r = c.put("/triggers/10", json={"expression": "bad expr"})
    assert r.status_code == 400


def test_update_trigger_team_restriction(client_restricted):
    c, bot = client_restricted
    bot.get_trigger_hostname.return_value = "other-host"
    r = c.put("/triggers/10", json={"description": "x"})
    assert r.status_code == 403


def test_update_trigger_allowed_host(client_restricted):
    c, bot = client_restricted
    bot.get_trigger_hostname.return_value = "allowed-host"
    r = c.put("/triggers/10", json={"description": "x"})
    assert r.status_code == 200


# ── add_trigger (numeric) ─────────────────────────────────────────────────────


def test_add_trigger_numeric_ok(client):
    c, bot = client
    bot.add_trigger.return_value = ("trigger-99", None)
    r = c.post(
        "/triggers",
        json={
            "hostname": "h1",
            "item_key": "system.cpu.load",
            "trigger_name": "High CPU",
            "threshold": 90.0,
            "operator": ">",
            "severity": 4,
        },
    )
    assert r.status_code == 201
    assert r.json()["triggerid"] == "trigger-99"


def test_add_trigger_numeric_fail(client):
    c, bot = client
    bot.add_trigger.return_value = (None, "item not found")
    r = c.post(
        "/triggers",
        json={
            "hostname": "h1",
            "item_key": "system.cpu.load",
            "trigger_name": "High CPU",
            "threshold": 90.0,
        },
    )
    assert r.status_code == 400


def test_add_trigger_missing_threshold(client):
    c, bot = client
    r = c.post(
        "/triggers",
        json={
            "hostname": "h1",
            "item_key": "system.cpu.load",
            "trigger_name": "High CPU",
            # no threshold, no string_pattern → should 422
        },
    )
    assert r.status_code == 422


# ── add_trigger (string pattern) ──────────────────────────────────────────────


def test_add_trigger_string_pattern_ok(client):
    c, bot = client
    bot.add_string_trigger.return_value = ("trigger-42", None)
    r = c.post(
        "/triggers",
        json={
            "hostname": "h1",
            "item_key": "system.run[cat /etc/hostname]",
            "trigger_name": "Bad output",
            "string_pattern": "ERROR",
            "match_type": "like",
        },
    )
    assert r.status_code == 201
    assert r.json()["triggerid"] == "trigger-42"
    bot.add_string_trigger.assert_called_once()
    bot.add_trigger.assert_not_called()


def test_add_trigger_string_pattern_fail(client):
    c, bot = client
    bot.add_string_trigger.return_value = (None, "host not found")
    r = c.post(
        "/triggers",
        json={
            "hostname": "h1",
            "item_key": "key",
            "trigger_name": "T",
            "string_pattern": "ERR",
        },
    )
    assert r.status_code == 400


# ── bulk_add_triggers ─────────────────────────────────────────────────────────


def test_bulk_add_triggers_ok(client):
    c, bot = client
    bot.bulk_add_triggers.return_value = [
        {"hostname": "h1", "triggerid": "1", "error": None},
        {"hostname": "h2", "triggerid": "2", "error": None},
    ]
    r = c.post(
        "/triggers/bulk",
        json={
            "hostnames": ["h1", "h2"],
            "item_key": "system.cpu.load",
            "trigger_name": "High CPU",
            "threshold": 90.0,
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert "2/2" in data["message"]
    assert len(data["results"]) == 2


def test_bulk_add_triggers_empty_hostnames(client):
    c, bot = client
    r = c.post(
        "/triggers/bulk",
        json={
            "hostnames": [],
            "item_key": "system.cpu.load",
            "trigger_name": "High CPU",
            "threshold": 90.0,
        },
    )
    assert r.status_code == 400


def test_bulk_add_triggers_partial_failure(client):
    c, bot = client
    bot.bulk_add_triggers.return_value = [
        {"hostname": "h1", "triggerid": "1", "error": None},
        {"hostname": "h2", "triggerid": None, "error": "host not found"},
    ]
    r = c.post(
        "/triggers/bulk",
        json={
            "hostnames": ["h1", "h2"],
            "item_key": "system.cpu.load",
            "trigger_name": "High CPU",
            "threshold": 90.0,
        },
    )
    assert r.status_code == 201
    assert "1/2" in r.json()["message"]
