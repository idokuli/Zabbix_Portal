"""Tests for Item_Manager/snmp.py — SNMP agent and trap items."""

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


def _host_ok(mgr, hostid="10"):
    mgr.zapi.host.get.return_value = [{"hostid": hostid}]


def _iface(iface_type="2", ifaceid="5"):
    return [{"interfaceid": ifaceid, "type": iface_type}]


# ── add_snmp_item ──────────────────────────────────────────────────────────────


def test_add_snmp_item_success_v2c(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.return_value = {"itemids": ["20"]}
    item_id, err = mgr.add_snmp_item(
        "h1", "CPU via SNMP", "snmp.cpu", ".1.3.6.1.4.1.2021.11.11.0"
    )
    assert item_id == "20"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 20
    assert call_kwargs["snmp_version"] == 2
    assert call_kwargs["snmp_community"] == "public"


def test_add_snmp_item_success_v3(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.return_value = {"itemids": ["21"]}
    item_id, err = mgr.add_snmp_item(
        "h1",
        "CPU v3",
        "snmp.cpu.v3",
        ".1.3.6.1.4.1.2021.11.11.0",
        snmp_version=3,
        snmpv3_securityname="admin",
        snmpv3_securitylevel=2,
        snmpv3_authprotocol=1,
        snmpv3_authpassphrase="authpass",
        snmpv3_privprotocol=1,
        snmpv3_privpassphrase="privpass",
        snmpv3_contextname="ctx",
    )
    assert item_id == "21"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["snmpv3_securitylevel"] == 2
    assert call_kwargs["snmpv3_authpassphrase"] == "authpass"
    assert call_kwargs["snmpv3_privpassphrase"] == "privpass"
    assert call_kwargs["snmpv3_contextname"] == "ctx"


def test_add_snmp_item_v3_auth_only(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.return_value = {"itemids": ["22"]}
    item_id, err = mgr.add_snmp_item(
        "h1",
        "CPU auth",
        "snmp.cpu.auth",
        ".1.3.6",
        snmp_version=3,
        snmpv3_securitylevel=1,
        snmpv3_authprotocol=0,
        snmpv3_authpassphrase="authonly",
    )
    assert item_id == "22"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["snmpv3_authpassphrase"] == "authonly"
    assert "snmpv3_privpassphrase" not in call_kwargs


def test_add_snmp_item_auto_names(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.return_value = {"itemids": ["23"]}
    # Pass empty name and key — should be auto-generated
    item_id, err = mgr.add_snmp_item("h1", "", "", ".1.3.6.1.4.1.2021.11.11.0")
    assert item_id == "23"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert "SNMP:" in call_kwargs["name"]
    assert call_kwargs["key_"].startswith("snmp.")


def test_add_snmp_item_with_units_description_team(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.return_value = {"itemids": ["24"]}
    item_id, err = mgr.add_snmp_item(
        "h1",
        "CPU",
        "snmp.cpu",
        ".1.3.6",
        units="%",
        description="CPU load",
        team_name="ops",
    )
    assert item_id == "24"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["units"] == "%"
    assert call_kwargs["description"] == "CPU load"
    assert call_kwargs["tags"] == [{"tag": "team", "value": "ops"}]


def test_add_snmp_item_no_oid_returns_error(mgr):
    item_id, err = mgr.add_snmp_item("h1", "CPU", "snmp.cpu", "")
    assert item_id is None
    assert "OID" in err


def test_add_snmp_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_snmp_item("h1", "CPU", "key", ".1.3.6")
    assert item_id is None
    assert err is not None


def test_add_snmp_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_snmp_item("ghost", "CPU", "key", ".1.3.6")
    assert item_id is None
    assert "not found" in err


def test_add_snmp_item_no_interface(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = []
    item_id, err = mgr.add_snmp_item("h1", "CPU", "key", ".1.3.6")
    assert item_id is None
    assert "interface" in err.lower()


def test_add_snmp_item_fallback_to_first_interface(mgr):
    _host_ok(mgr)
    # No type-2 interface, should use first available
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "9", "type": "1"}]
    mgr.zapi.item.create.return_value = {"itemids": ["25"]}
    item_id, err = mgr.add_snmp_item("h1", "CPU", "snmp.cpu", ".1.3.6")
    assert item_id == "25"


def test_add_snmp_item_api_exception(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.side_effect = Exception("zabbix error")
    item_id, err = mgr.add_snmp_item("h1", "CPU", "snmp.cpu", ".1.3.6")
    assert item_id is None
    assert err is not None


# ── add_snmp_trap_item ─────────────────────────────────────────────────────────


def test_add_snmp_trap_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.return_value = {"itemids": ["30"]}
    item_id, err = mgr.add_snmp_trap_item("h1", "SNMP Trap")
    assert item_id == "30"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 17


def test_add_snmp_trap_item_with_description_and_team(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.return_value = {"itemids": ["31"]}
    item_id, err = mgr.add_snmp_trap_item(
        "h1", "Trap", description="Trap desc", team_name="ops"
    )
    assert item_id == "31"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["description"] == "Trap desc"
    assert call_kwargs["tags"] == [{"tag": "team", "value": "ops"}]


def test_add_snmp_trap_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_snmp_trap_item("h1", "Trap")
    assert item_id is None


def test_add_snmp_trap_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_snmp_trap_item("ghost", "Trap")
    assert item_id is None
    assert "not found" in err


def test_add_snmp_trap_item_no_interface(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = []
    item_id, err = mgr.add_snmp_trap_item("h1", "Trap")
    assert item_id is None
    assert "interface" in err.lower()


def test_add_snmp_trap_item_exception(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.side_effect = Exception("zabbix error")
    item_id, err = mgr.add_snmp_trap_item("h1", "Trap")
    assert item_id is None
    assert err is not None
