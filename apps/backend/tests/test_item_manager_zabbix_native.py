"""Tests for Item_Manager/zabbix_native.py — internal, trapper, external, calculated, dependent, script, browser."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://fake-zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture()
def mgr():
    with patch("zabbix_utils.ZabbixAPI"):
        from Item_Manager import Item_Manager

        m = Item_Manager()
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
    item_id, err = mgr.add_internal_item("h1", "Uptime", "system.uptime")
    assert item_id == "1"
    assert err is None


def test_add_internal_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_internal_item("ghost", "Uptime", "system.uptime")
    assert item_id is None
    assert err is not None


def test_add_internal_item_with_team(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["2"]}
    item_id, err = mgr.add_internal_item(
        "h1", "Uptime", "system.uptime", team_name="ops"
    )
    assert item_id == "2"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["tags"] == [{"tag": "team", "value": "ops"}]


def test_add_internal_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_internal_item("h1", "x", "k")
    assert item_id is None
    assert err is not None


# ── add_trapper_item ──────────────────────────────────────────────────────────


def test_add_trapper_item_success(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["3"]}
    item_id, err = mgr.add_trapper_item("h1", "Trap item", "trap.key")
    assert item_id == "3"
    assert err is None


def test_add_trapper_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_trapper_item("ghost", "x", "k")
    assert item_id is None


def test_add_trapper_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_trapper_item("h1", "x", "k")
    assert item_id is None


# ── add_external_item ─────────────────────────────────────────────────────────


def test_add_external_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["4"]}
    item_id, err = mgr.add_external_item("h1", "Ext check", "check.sh[{HOST.CONN}]")
    assert item_id == "4"
    assert err is None


def test_add_external_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_external_item("ghost", "x", "k")
    assert item_id is None


def test_add_external_item_no_interface(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = []
    item_id, err = mgr.add_external_item("h1", "x", "k")
    assert item_id is None
    assert "interface" in (err or "").lower()


def test_add_external_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_external_item("h1", "x", "k")
    assert item_id is None


# ── add_calculated_item ───────────────────────────────────────────────────────


def test_add_calculated_item_success(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["5"]}
    item_id, err = mgr.add_calculated_item(
        "h1", "Avg CPU", "avg.cpu", "avg(last_value(...))"
    )
    assert item_id == "5"
    assert err is None


def test_add_calculated_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_calculated_item("ghost", "x", "k", "formula")
    assert item_id is None


def test_add_calculated_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_calculated_item("h1", "x", "k", "f")
    assert item_id is None


# ── add_dependent_item ────────────────────────────────────────────────────────


def test_add_dependent_item_success(mgr):
    _mock_host(mgr)
    mgr.zapi.item.get.return_value = [{"itemid": "99"}]
    mgr.zapi.item.create.return_value = {"itemids": ["6"]}
    item_id, err = mgr.add_dependent_item("h1", "Parsed field", "dep.key", "99")
    assert item_id == "6"
    assert err is None


def test_add_dependent_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_dependent_item("h1", "x", "k", "999")
    assert item_id is None
    assert err is not None


def test_add_dependent_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_dependent_item("h1", "x", "k", "1")
    assert item_id is None


# ── add_zabbix_script_item ────────────────────────────────────────────────────


def test_add_zabbix_script_item_success(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["7"]}
    item_id, err = mgr.add_zabbix_script_item(
        "h1", "Script item", "script.key", "return 1;"
    )
    assert item_id == "7"
    assert err is None


def test_add_zabbix_script_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_zabbix_script_item("ghost", "x", "k", "s")
    assert item_id is None


def test_add_zabbix_script_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_zabbix_script_item("h1", "x", "k", "s")
    assert item_id is None


# ── add_browser_item ──────────────────────────────────────────────────────────


def test_add_browser_item_success(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["8"]}
    item_id, err = mgr.add_browser_item(
        "h1", "Browser check", "browser.key", "return performance.timing;"
    )
    assert item_id == "8"
    assert err is None


def test_add_browser_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_browser_item("ghost", "x", "k", "s")
    assert item_id is None


def test_add_browser_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_browser_item("h1", "x", "k", "s")
    assert item_id is None
