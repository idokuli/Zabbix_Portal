"""Tests for api/routes/items.py."""

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


def make_app(router):
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: FAKE_ROOT
    app.dependency_overrides[require_operator] = lambda: FAKE_ROOT
    return app


@pytest.fixture()
def mock_bot():
    return MagicMock()


@pytest.fixture()
def client(mock_bot):
    from api.routes.items import router

    with (
        patch("api.routes.items.item_bot", mock_bot),
        patch("api.deps.resolve_team", return_value="test-team"),
        patch("api.routes.items.team_hostname_filter", return_value=None),
        TestClient(make_app(router)) as c,
    ):
        yield c, mock_bot


# ── list_all_items ────────────────────────────────────────────────────────────


def test_list_all_items_ok(client):
    c, bot = client
    bot.list_all_items.return_value = [{"hostname": "h1", "itemid": "1", "name": "cpu"}]
    r = c.get("/items")
    assert r.status_code == 200
    assert r.json()["total"] == 1


def test_list_all_items_zabbix_error(client):
    c, bot = client
    bot.list_all_items.side_effect = RuntimeError("zabbix down")
    r = c.get("/items")
    assert r.status_code == 502


# ── list_template_items ───────────────────────────────────────────────────────


def test_list_template_items_ok(client):
    c, bot = client
    bot.list_template_items.return_value = [{"itemid": "1"}]
    r = c.get("/templates/99/items")
    assert r.status_code == 200
    assert r.json()["items"] == [{"itemid": "1"}]


def test_list_template_items_zabbix_error(client):
    c, bot = client
    bot.list_template_items.side_effect = RuntimeError("zabbix error")
    r = c.get("/templates/99/items")
    assert r.status_code == 422


# ── add_template_item ─────────────────────────────────────────────────────────


def test_add_template_item_ok(client):
    c, bot = client
    bot.add_item_to_template.return_value = ("42", None)
    r = c.post(
        "/templates/99/items",
        json={
            "name": "cpu load",
            "key_": "system.cpu.load",
            "type_": 0,
            "value_type": 3,
        },
    )
    assert r.status_code == 201
    assert r.json()["itemid"] == "42"


def test_add_template_item_fail(client):
    c, bot = client
    bot.add_item_to_template.return_value = (None, "already exists")
    r = c.post(
        "/templates/99/items",
        json={
            "name": "cpu load",
            "key_": "system.cpu.load",
            "type_": 0,
            "value_type": 3,
        },
    )
    assert r.status_code == 400


# ── update_template_item ──────────────────────────────────────────────────────


def test_update_template_item_ok(client):
    c, bot = client
    r = c.put("/templates/99/items/10", json={"name": "new name"})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_update_template_item_zabbix_error(client):
    c, bot = client
    bot.update_item.side_effect = RuntimeError("fail")
    r = c.put("/templates/99/items/10", json={"name": "new name"})
    assert r.status_code == 422


# ── delete_template_item ──────────────────────────────────────────────────────


def test_delete_template_item_ok(client):
    c, bot = client
    bot.delete_item.return_value = True
    r = c.delete("/templates/99/items/10")
    assert r.status_code == 200


def test_delete_template_item_not_found(client):
    c, bot = client
    bot.delete_item.return_value = False
    r = c.delete("/templates/99/items/10")
    assert r.status_code == 404


# ── list_item_keys ────────────────────────────────────────────────────────────


def test_list_item_keys_ok(client):
    c, bot = client
    bot.get_all_item_keys.return_value = ["system.cpu.load", "agent.ping"]
    r = c.get("/items/keys?hostname=myhost")
    assert r.status_code == 200
    assert "items" in r.json()
    bot.get_all_item_keys.assert_called_once_with("myhost")


def test_list_item_keys_forbidden_for_other_team_host(client):
    c, bot = client
    with patch("api.routes.items.team_hostname_filter", return_value={"otherhost"}):
        r = c.get("/items/keys?hostname=myhost")
    assert r.status_code == 403


# ── list_items ────────────────────────────────────────────────────────────────


def test_list_items_ok(client):
    c, bot = client
    bot.list_items.return_value = [{"itemid": "1"}]
    r = c.get("/items/myhost")
    assert r.status_code == 200


# ── update_item ───────────────────────────────────────────────────────────────


def test_update_item_ok(client):
    c, bot = client
    r = c.put("/items/10", json={"name": "updated"})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_update_item_zabbix_error(client):
    c, bot = client
    bot.update_item.side_effect = RuntimeError("zabbix")
    r = c.put("/items/10", json={"name": "updated"})
    assert r.status_code == 422


# ── delete_item ───────────────────────────────────────────────────────────────


def test_delete_item_ok(client):
    c, bot = client
    bot.delete_item.return_value = True
    r = c.delete("/items/10")
    assert r.status_code == 200


def test_delete_item_not_found(client):
    c, bot = client
    bot.delete_item.return_value = False
    r = c.delete("/items/10")
    assert r.status_code == 404


# ── add_item (generic agent) ──────────────────────────────────────────────────


def test_add_item_ok(client):
    c, bot = client
    bot.add_item.return_value = ("55", None)
    r = c.post(
        "/items",
        json={
            "hostname": "h1",
            "item_name": "CPU",
            "item_key": "system.cpu.load",
            "value_type": 3,
        },
    )
    assert r.status_code == 201
    assert r.json()["itemid"] == "55"


def test_add_item_fail(client):
    c, bot = client
    bot.add_item.return_value = (None, "host not found")
    r = c.post(
        "/items",
        json={
            "hostname": "h1",
            "item_name": "CPU",
            "item_key": "system.cpu.load",
            "value_type": 3,
        },
    )
    assert r.status_code == 400


# ── add_http_item ─────────────────────────────────────────────────────────────


def test_add_http_item_ok(client):
    c, bot = client
    bot.add_http_item.return_value = ("10", None)
    r = c.post(
        "/items/http",
        json={"hostname": "h1", "item_name": "HTTP check", "url": "http://example.com"},
    )
    assert r.status_code == 201
    assert r.json()["itemid"] == "10"


def test_add_http_item_fail(client):
    c, bot = client
    bot.add_http_item.return_value = (None, "error")
    r = c.post(
        "/items/http",
        json={"hostname": "h1", "item_name": "HTTP check", "url": "http://example.com"},
    )
    assert r.status_code == 400


# ── add_snmp_item ─────────────────────────────────────────────────────────────


def test_add_snmp_item_ok(client):
    c, bot = client
    bot.add_snmp_item.return_value = ("20", None)
    r = c.post(
        "/items/snmp",
        json={
            "hostname": "h1",
            "item_name": "SNMP",
            "item_key": "snmp.key",
            "snmp_oid": "1.3.6.1.2.1.1.1.0",
            "value_type": 4,
        },
    )
    assert r.status_code == 201
    assert r.json()["itemid"] == "20"


def test_add_snmp_item_fail(client):
    c, bot = client
    bot.add_snmp_item.return_value = (None, "snmp error")
    r = c.post(
        "/items/snmp",
        json={
            "hostname": "h1",
            "item_name": "SNMP",
            "item_key": "snmp.key",
            "snmp_oid": "1.3.6.1.2.1.1.1.0",
            "value_type": 4,
        },
    )
    assert r.status_code == 400


# ── add_ssh_item ──────────────────────────────────────────────────────────────


def test_add_ssh_item_ok(client):
    c, bot = client
    bot.add_ssh_item.return_value = ("30", None)
    r = c.post(
        "/items/ssh",
        json={
            "hostname": "h1",
            "item_name": "SSH check",
            "params": "uptime",
            "item_key": "ssh.run[uptime]",
            "username": "root",
        },
    )
    assert r.status_code == 201


def test_add_ssh_item_fail(client):
    c, bot = client
    bot.add_ssh_item.return_value = (None, "ssh error")
    r = c.post(
        "/items/ssh",
        json={
            "hostname": "h1",
            "item_name": "SSH check",
            "params": "uptime",
            "item_key": "ssh.run[uptime]",
            "username": "root",
        },
    )
    assert r.status_code == 400


# ── add_trapper_item ──────────────────────────────────────────────────────────


def test_add_trapper_item_ok(client):
    c, bot = client
    bot.add_trapper_item.return_value = ("40", None)
    r = c.post(
        "/items/trapper",
        json={
            "hostname": "h1",
            "item_name": "Trap",
            "item_key": "trap.key",
            "value_type": 3,
        },
    )
    assert r.status_code == 201


# ── add_internal_item ─────────────────────────────────────────────────────────


def test_add_internal_item_ok(client):
    c, bot = client
    bot.add_internal_item.return_value = ("50", None)
    r = c.post(
        "/items/internal",
        json={
            "hostname": "h1",
            "item_name": "Internal",
            "item_key": "zabbix[host,agent,available]",
            "value_type": 3,
        },
    )
    assert r.status_code == 201


# ── add_service_item ──────────────────────────────────────────────────────────


def test_add_service_item_ok(client):
    c, bot = client
    bot.add_service_item.return_value = ("60", None)
    r = c.post("/items/service", json={"hostname": "h1", "service_type": "icmp_ping"})
    assert r.status_code == 201


# ── bulk_add_items ────────────────────────────────────────────────────────────


def test_bulk_add_items_ok(client):
    c, bot = client
    bot.bulk_add_items.return_value = [
        {"hostname": "h1", "itemid": "1", "error": None},
        {"hostname": "h2", "itemid": "2", "error": None},
    ]
    r = c.post(
        "/items/bulk",
        json={
            "hostnames": ["h1", "h2"],
            "item_name": "CPU",
            "item_key": "system.cpu.load",
            "item_type": "agent",
            "value_type": 3,
        },
    )
    assert r.status_code == 201
    assert "2/2" in r.json()["message"]


def test_bulk_add_items_empty_hostnames(client):
    c, bot = client
    r = c.post(
        "/items/bulk",
        json={"hostnames": [], "item_key": "k", "item_name": "n", "item_type": "agent"},
    )
    assert r.status_code == 400


# ── add_jmx_item ──────────────────────────────────────────────────────────────


def test_add_jmx_item_ok(client):
    c, bot = client
    bot.add_jmx_item.return_value = ("70", None)
    r = c.post(
        "/items/jmx",
        json={
            "hostname": "h1",
            "item_name": "JMX",
            "item_key": "jmx.key",
            "jmx_endpoint": "service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi",
        },
    )
    assert r.status_code == 201


# ── add_calculated_item ────────────────────────────────────────────────────────


def test_add_calculated_item_ok(client):
    c, bot = client
    bot.add_calculated_item.return_value = ("80", None)
    r = c.post(
        "/items/calculated",
        json={
            "hostname": "h1",
            "item_name": "Calc",
            "item_key": "calc.key",
            "formula": "avg(//system.cpu.load,1m)",
        },
    )
    assert r.status_code == 201


# ── add_dependent_item ─────────────────────────────────────────────────────────


def test_add_dependent_item_ok(client):
    c, bot = client
    bot.add_dependent_item.return_value = ("90", None)
    r = c.post(
        "/items/dependent",
        json={
            "hostname": "h1",
            "item_name": "Dep",
            "item_key": "dep.key",
            "master_itemid": "5",
        },
    )
    assert r.status_code == 201
