"""Tests for Item_Manager/zabbix_native.py — internal, trapper, external, calculated,
dependent, script, browser item types."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://fake-zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

from unittest.mock import MagicMock, patch

import pytest

from api.schemas.items import BrowserItemRequest, ZabbixScriptItemRequest


@pytest.fixture()
def mgr():
    with patch("zabbix_utils.ZabbixAPI"):
        from Item_Manager import Item_Manager

        m = Item_Manager()
        m.zapi = MagicMock()
        m._zabbix_version = (6, 4)
        return m


def _host_ok(mgr, hostid="10"):
    mgr.zapi.host.get.return_value = [{"hostid": hostid}]


# ── add_internal_item ─────────────────────────────────────────────────────────


def test_add_internal_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["1"]}
    item_id, err = mgr.add_internal_item("h1", "Queue size", "zabbix[queue]")
    assert item_id == "1"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 5


def test_add_internal_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_internal_item("ghost", "x", "key")
    assert item_id is None
    assert "not found" in err


def test_add_internal_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_internal_item("h1", "x", "key")
    assert item_id is None


def test_add_internal_item_with_team_tag(mgr):
    _host_ok(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["2"]}
    item_id, _ = mgr.add_internal_item("h1", "Q", "zabbix[queue]", team_name="ops")
    assert item_id == "2"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["tags"] == [{"tag": "team", "value": "ops"}]


# ── add_trapper_item ──────────────────────────────────────────────────────────


def test_add_trapper_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["10"]}
    item_id, err = mgr.add_trapper_item("h1", "My trap", "my.trap.key", value_type=3)
    assert item_id == "10"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 2


def test_add_trapper_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_trapper_item("h1", "x", "k", value_type=3)
    assert item_id is None


def test_add_trapper_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_trapper_item("ghost", "x", "k", value_type=3)
    assert item_id is None


# ── add_external_item ─────────────────────────────────────────────────────────


def test_add_external_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5"}]
    mgr.zapi.item.create.return_value = {"itemids": ["20"]}
    item_id, err = mgr.add_external_item("h1", "Ext check", "check.sh[arg]", value_type=1)
    assert item_id == "20"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 10


def test_add_external_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_external_item("h1", "x", "k", value_type=1)
    assert item_id is None


# ── add_calculated_item ───────────────────────────────────────────────────────


def test_add_calculated_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["30"]}
    item_id, err = mgr.add_calculated_item(
        "h1", "Avg CPU", "avg.cpu", "avg(//system.cpu.load,1m)", value_type=0
    )
    assert item_id == "30"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 15
    assert call_kwargs["params"] == "avg(//system.cpu.load,1m)"


def test_add_calculated_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_calculated_item("h1", "x", "k", "formula", value_type=0)
    assert item_id is None


def test_add_calculated_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_calculated_item("ghost", "x", "k", "f", value_type=0)
    assert item_id is None


# ── add_dependent_item ────────────────────────────────────────────────────────


def test_add_dependent_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["40"]}
    item_id, err = mgr.add_dependent_item("h1", "Dep item", "dep.key", "100", value_type=4)
    assert item_id == "40"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 18
    assert call_kwargs["master_itemid"] == "100"


def test_add_dependent_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_dependent_item("h1", "x", "k", "1", value_type=4)
    assert item_id is None


# ── add_zabbix_script_item ────────────────────────────────────────────────────


def test_add_zabbix_script_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5"}]
    mgr.zapi.item.create.return_value = {"itemids": ["50"]}
    req = ZabbixScriptItemRequest(
        hostname="h1",
        item_name="Script check",
        item_key="script.key",
        params="return 'ok';",
        value_type=4,
    )
    item_id, err = mgr.add_zabbix_script_item(req)
    assert item_id == "50"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 21


def test_add_zabbix_script_item_zapi_none(mgr):
    mgr.zapi = None
    req = ZabbixScriptItemRequest(
        hostname="h1", item_name="x", item_key="k", params="script", value_type=4
    )
    item_id, err = mgr.add_zabbix_script_item(req)
    assert item_id is None


# ── add_browser_item ──────────────────────────────────────────────────────────


def test_add_browser_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["60"]}
    req = BrowserItemRequest(
        hostname="h1",
        item_name="Browser check",
        item_key="browser.key",
        params="return 'ok';",
        value_type=4,
    )
    item_id, err = mgr.add_browser_item(req)
    assert item_id == "60"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 26


def test_add_browser_item_zapi_none(mgr):
    mgr.zapi = None
    req = BrowserItemRequest(
        hostname="h1", item_name="x", item_key="k", params="script", value_type=4
    )
    item_id, err = mgr.add_browser_item(req)
    assert item_id is None
