"""Tests for ItemManager/zabbix_native.py — internal, trapper, external, calculated, dependent, script, browser."""

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


def _mock_host(mgr, hostid="10"):
    mgr.zapi.host.get.return_value = [{"hostid": hostid}]


def _mock_host_iface(mgr, hostid="10", ifaceid="5"):
    mgr.zapi.host.get.return_value = [{"hostid": hostid}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": ifaceid}]


# ── add_internal_item ─────────────────────────────────────────────────────────


def test_add_internal_item_success(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["1"]}
    req = InternalItemRequest(hostname="h1", item_name="Uptime", item_key="system.uptime")
    item_id, err = mgr.add_internal_item(req)
    assert item_id == "1"
    assert err is None


def test_add_internal_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = InternalItemRequest(hostname="ghost", item_name="Uptime", item_key="system.uptime")
    item_id, err = mgr.add_internal_item(req)
    assert item_id is None
    assert err is not None


def test_add_internal_item_with_team(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["2"]}
    req = InternalItemRequest(hostname="h1", item_name="Uptime", item_key="system.uptime")
    item_id, err = mgr.add_internal_item(req, team_name="ops")
    assert item_id == "2"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["tags"] == [{"tag": "team", "value": "ops"}]


def test_add_internal_item_zapi_none(mgr):
    mgr.zapi = None
    req = InternalItemRequest(hostname="h1", item_name="x", item_key="k")
    item_id, err = mgr.add_internal_item(req)
    assert item_id is None
    assert err is not None


# ── add_trapper_item ──────────────────────────────────────────────────────────


def test_add_trapper_item_success(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["3"]}
    req = TrapperItemRequest(hostname="h1", item_name="Trap item", item_key="trap.key")
    item_id, err = mgr.add_trapper_item(req)
    assert item_id == "3"
    assert err is None


def test_add_trapper_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = TrapperItemRequest(hostname="ghost", item_name="x", item_key="k")
    item_id, err = mgr.add_trapper_item(req)
    assert item_id is None


def test_add_trapper_item_zapi_none(mgr):
    mgr.zapi = None
    req = TrapperItemRequest(hostname="h1", item_name="x", item_key="k")
    item_id, err = mgr.add_trapper_item(req)
    assert item_id is None


# ── add_external_item ─────────────────────────────────────────────────────────


def test_add_external_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["4"]}
    req = ExternalItemRequest(
        hostname="h1", item_name="Ext check", item_key="check.sh[{HOST.CONN}]"
    )
    item_id, err = mgr.add_external_item(req)
    assert item_id == "4"
    assert err is None


def test_add_external_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = ExternalItemRequest(hostname="ghost", item_name="x", item_key="k")
    item_id, err = mgr.add_external_item(req)
    assert item_id is None


def test_add_external_item_no_interface(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = []
    req = ExternalItemRequest(hostname="h1", item_name="x", item_key="k")
    item_id, err = mgr.add_external_item(req)
    assert item_id is None
    assert "interface" in (err or "").lower()


def test_add_external_item_zapi_none(mgr):
    mgr.zapi = None
    req = ExternalItemRequest(hostname="h1", item_name="x", item_key="k")
    item_id, err = mgr.add_external_item(req)
    assert item_id is None


# ── add_calculated_item ───────────────────────────────────────────────────────


def test_add_calculated_item_success(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["5"]}
    req = CalculatedItemRequest(
        hostname="h1", item_name="Avg CPU", item_key="avg.cpu", formula="avg(last_value(...))"
    )
    item_id, err = mgr.add_calculated_item(req)
    assert item_id == "5"
    assert err is None


def test_add_calculated_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = CalculatedItemRequest(hostname="ghost", item_name="x", item_key="k", formula="formula")
    item_id, err = mgr.add_calculated_item(req)
    assert item_id is None


def test_add_calculated_item_zapi_none(mgr):
    mgr.zapi = None
    req = CalculatedItemRequest(hostname="h1", item_name="x", item_key="k", formula="f")
    item_id, err = mgr.add_calculated_item(req)
    assert item_id is None


# ── add_dependent_item ────────────────────────────────────────────────────────


def test_add_dependent_item_success(mgr):
    _mock_host(mgr)
    mgr.zapi.item.get.return_value = [{"itemid": "99"}]
    mgr.zapi.item.create.return_value = {"itemids": ["6"]}
    req = DependentItemRequest(
        hostname="h1", item_name="Parsed field", item_key="dep.key", master_itemid="99"
    )
    item_id, err = mgr.add_dependent_item(req)
    assert item_id == "6"
    assert err is None


def test_add_dependent_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = DependentItemRequest(hostname="h1", item_name="x", item_key="k", master_itemid="999")
    item_id, err = mgr.add_dependent_item(req)
    assert item_id is None
    assert err is not None


def test_add_dependent_item_zapi_none(mgr):
    mgr.zapi = None
    req = DependentItemRequest(hostname="h1", item_name="x", item_key="k", master_itemid="1")
    item_id, err = mgr.add_dependent_item(req)
    assert item_id is None


# ── add_zabbix_script_item ────────────────────────────────────────────────────


def test_add_zabbix_script_item_success(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["7"]}
    req = ZabbixScriptItemRequest(
        hostname="h1", item_name="Script item", item_key="script.key", params="return 1;"
    )
    item_id, err = mgr.add_zabbix_script_item(req)
    assert item_id == "7"
    assert err is None


def test_add_zabbix_script_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = ZabbixScriptItemRequest(hostname="ghost", item_name="x", item_key="k", params="s")
    item_id, err = mgr.add_zabbix_script_item(req)
    assert item_id is None


def test_add_zabbix_script_item_zapi_none(mgr):
    mgr.zapi = None
    req = ZabbixScriptItemRequest(hostname="h1", item_name="x", item_key="k", params="s")
    item_id, err = mgr.add_zabbix_script_item(req)
    assert item_id is None


# ── add_browser_item ──────────────────────────────────────────────────────────


def test_add_browser_item_success(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["8"]}
    req = BrowserItemRequest(
        hostname="h1",
        item_name="Browser check",
        item_key="browser.key",
        params="return performance.timing;",
    )
    item_id, err = mgr.add_browser_item(req)
    assert item_id == "8"
    assert err is None


def test_add_browser_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = BrowserItemRequest(hostname="ghost", item_name="x", item_key="k", params="s")
    item_id, err = mgr.add_browser_item(req)
    assert item_id is None


def test_add_browser_item_zapi_none(mgr):
    mgr.zapi = None
    req = BrowserItemRequest(hostname="h1", item_name="x", item_key="k", params="s")
    item_id, err = mgr.add_browser_item(req)
    assert item_id is None
