"""Tests for ItemManager/zabbix_native.py — internal, trapper, external, calculated,
dependent, script, browser item types."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://fake-zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

from unittest.mock import MagicMock, patch

import pytest

from api.schemas.items import (
    BrowserItemRequest,
    CalculatedItemRequest,
    DependentItemRequest,
    ExternalItemRequest,
    InternalItemRequest,
    TrapperItemRequest,
    ZabbixScriptItemRequest,
)


@pytest.fixture()
def mgr():
    with patch("zabbix_utils.ZabbixAPI"):
        from Item_Manager import ItemManager

        m = ItemManager()
        m.zapi = MagicMock()
        m._zabbix_version = (6, 4)
        return m


def _host_ok(mgr, hostid="10"):
    mgr.zapi.host.get.return_value = [{"hostid": hostid}]


# ── add_internal_item ─────────────────────────────────────────────────────────


def test_add_internal_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["1"]}
    req = InternalItemRequest(hostname="h1", item_name="Queue size", item_key="zabbix[queue]")
    item_id, err = mgr.add_internal_item(req)
    assert item_id == "1"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 5


def test_add_internal_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = InternalItemRequest(hostname="ghost", item_name="x", item_key="key")
    item_id, err = mgr.add_internal_item(req)
    assert item_id is None
    assert "not found" in err


def test_add_internal_item_zapi_none(mgr):
    mgr.zapi = None
    req = InternalItemRequest(hostname="h1", item_name="x", item_key="key")
    item_id, err = mgr.add_internal_item(req)
    assert item_id is None


def test_add_internal_item_with_team_tag(mgr):
    _host_ok(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["2"]}
    req = InternalItemRequest(hostname="h1", item_name="Q", item_key="zabbix[queue]")
    item_id, _ = mgr.add_internal_item(req, team_name="ops")
    assert item_id == "2"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["tags"] == [{"tag": "team", "value": "ops"}]


# ── add_trapper_item ──────────────────────────────────────────────────────────


def test_add_trapper_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["10"]}
    req = TrapperItemRequest(
        hostname="h1", item_name="My trap", item_key="my.trap.key", value_type=3
    )
    item_id, err = mgr.add_trapper_item(req)
    assert item_id == "10"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 2


def test_add_trapper_item_zapi_none(mgr):
    mgr.zapi = None
    req = TrapperItemRequest(hostname="h1", item_name="x", item_key="k", value_type=3)
    item_id, err = mgr.add_trapper_item(req)
    assert item_id is None


def test_add_trapper_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = TrapperItemRequest(hostname="ghost", item_name="x", item_key="k", value_type=3)
    item_id, err = mgr.add_trapper_item(req)
    assert item_id is None


# ── add_external_item ─────────────────────────────────────────────────────────


def test_add_external_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5"}]
    mgr.zapi.item.create.return_value = {"itemids": ["20"]}
    req = ExternalItemRequest(
        hostname="h1", item_name="Ext check", item_key="check.sh[arg]", value_type=1
    )
    item_id, err = mgr.add_external_item(req)
    assert item_id == "20"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 10


def test_add_external_item_zapi_none(mgr):
    mgr.zapi = None
    req = ExternalItemRequest(hostname="h1", item_name="x", item_key="k", value_type=1)
    item_id, err = mgr.add_external_item(req)
    assert item_id is None


# ── add_calculated_item ───────────────────────────────────────────────────────


def test_add_calculated_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["30"]}
    req = CalculatedItemRequest(
        hostname="h1",
        item_name="Avg CPU",
        item_key="avg.cpu",
        formula="avg(//system.cpu.load,1m)",
        value_type=0,
    )
    item_id, err = mgr.add_calculated_item(req)
    assert item_id == "30"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 15
    assert call_kwargs["params"] == "avg(//system.cpu.load,1m)"


def test_add_calculated_item_zapi_none(mgr):
    mgr.zapi = None
    req = CalculatedItemRequest(
        hostname="h1", item_name="x", item_key="k", formula="formula", value_type=0
    )
    item_id, err = mgr.add_calculated_item(req)
    assert item_id is None


def test_add_calculated_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = CalculatedItemRequest(
        hostname="ghost", item_name="x", item_key="k", formula="f", value_type=0
    )
    item_id, err = mgr.add_calculated_item(req)
    assert item_id is None


# ── add_dependent_item ────────────────────────────────────────────────────────


def test_add_dependent_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["40"]}
    req = DependentItemRequest(
        hostname="h1", item_name="Dep item", item_key="dep.key", master_itemid="100", value_type=4
    )
    item_id, err = mgr.add_dependent_item(req)
    assert item_id == "40"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 18
    assert call_kwargs["master_itemid"] == "100"


def test_add_dependent_item_zapi_none(mgr):
    mgr.zapi = None
    req = DependentItemRequest(
        hostname="h1", item_name="x", item_key="k", master_itemid="1", value_type=4
    )
    item_id, err = mgr.add_dependent_item(req)
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
