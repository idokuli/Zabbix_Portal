"""Tests for ItemManager/snmp.py — SNMP agent and trap items."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://fake-zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

from unittest.mock import MagicMock, patch

import pytest

from api.schemas.items import SnmpItemRequest, SnmpTrapRequest


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


def _iface(iface_type="2", ifaceid="5"):
    return [{"interfaceid": ifaceid, "type": iface_type}]


# ── add_snmp_item ──────────────────────────────────────────────────────────────


def test_add_snmp_item_success_v2c(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.return_value = {"itemids": ["20"]}
    req = SnmpItemRequest(
        hostname="h1",
        item_name="CPU via SNMP",
        item_key="snmp.cpu",
        snmp_oid=".1.3.6.1.4.1.2021.11.11.0",
    )
    item_id, err = mgr.add_snmp_item(req)
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
    req = SnmpItemRequest(
        hostname="h1",
        item_name="CPU v3",
        item_key="snmp.cpu.v3",
        snmp_oid=".1.3.6.1.4.1.2021.11.11.0",
        snmp_version=3,
        snmpv3_securityname="admin",
        snmpv3_securitylevel=2,
        snmpv3_authprotocol=1,
        snmpv3_authpassphrase="authpass",
        snmpv3_privprotocol=1,
        snmpv3_privpassphrase="privpass",
        snmpv3_contextname="ctx",
    )
    item_id, err = mgr.add_snmp_item(req)
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
    req = SnmpItemRequest(
        hostname="h1",
        item_name="CPU auth",
        item_key="snmp.cpu.auth",
        snmp_oid=".1.3.6",
        snmp_version=3,
        snmpv3_securitylevel=1,
        snmpv3_authprotocol=0,
        snmpv3_authpassphrase="authonly",
    )
    item_id, err = mgr.add_snmp_item(req)
    assert item_id == "22"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["snmpv3_authpassphrase"] == "authonly"
    assert "snmpv3_privpassphrase" not in call_kwargs


def test_add_snmp_item_auto_names(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.return_value = {"itemids": ["23"]}
    # Pass empty name and key — should be auto-generated
    req = SnmpItemRequest(
        hostname="h1", item_name="", item_key="", snmp_oid=".1.3.6.1.4.1.2021.11.11.0"
    )
    item_id, err = mgr.add_snmp_item(req)
    assert item_id == "23"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert "SNMP:" in call_kwargs["name"]
    assert call_kwargs["key_"].startswith("snmp.")


def test_add_snmp_item_with_units_description_team(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.return_value = {"itemids": ["24"]}
    req = SnmpItemRequest(
        hostname="h1",
        item_name="CPU",
        item_key="snmp.cpu",
        snmp_oid=".1.3.6",
        units="%",
        description="CPU load",
    )
    item_id, err = mgr.add_snmp_item(req, team_name="ops")
    assert item_id == "24"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["units"] == "%"
    assert call_kwargs["description"] == "CPU load"
    assert call_kwargs["tags"] == [{"tag": "team", "value": "ops"}]


def test_add_snmp_item_no_oid_returns_error(mgr):
    req = SnmpItemRequest(hostname="h1", item_name="CPU", item_key="snmp.cpu", snmp_oid="")
    item_id, err = mgr.add_snmp_item(req)
    assert item_id is None
    assert "OID" in err


def test_add_snmp_item_zapi_none(mgr):
    mgr.zapi = None
    req = SnmpItemRequest(hostname="h1", item_name="CPU", item_key="key", snmp_oid=".1.3.6")
    item_id, err = mgr.add_snmp_item(req)
    assert item_id is None
    assert err is not None


def test_add_snmp_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = SnmpItemRequest(hostname="ghost", item_name="CPU", item_key="key", snmp_oid=".1.3.6")
    item_id, err = mgr.add_snmp_item(req)
    assert item_id is None
    assert "not found" in err


def test_add_snmp_item_no_interface(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = []
    req = SnmpItemRequest(hostname="h1", item_name="CPU", item_key="key", snmp_oid=".1.3.6")
    item_id, err = mgr.add_snmp_item(req)
    assert item_id is None
    assert "interface" in err.lower()


def test_add_snmp_item_fallback_to_first_interface(mgr):
    _host_ok(mgr)
    # No type-2 interface, should use first available
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "9", "type": "1"}]
    mgr.zapi.item.create.return_value = {"itemids": ["25"]}
    req = SnmpItemRequest(hostname="h1", item_name="CPU", item_key="snmp.cpu", snmp_oid=".1.3.6")
    item_id, err = mgr.add_snmp_item(req)
    assert item_id == "25"


def test_add_snmp_item_api_exception(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.side_effect = Exception("zabbix error")
    req = SnmpItemRequest(hostname="h1", item_name="CPU", item_key="snmp.cpu", snmp_oid=".1.3.6")
    item_id, err = mgr.add_snmp_item(req)
    assert item_id is None
    assert err is not None


# ── add_snmp_trap_item ─────────────────────────────────────────────────────────


def test_add_snmp_trap_item_success(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.return_value = {"itemids": ["30"]}
    req = SnmpTrapRequest(hostname="h1", item_name="SNMP Trap")
    item_id, err = mgr.add_snmp_trap_item(req)
    assert item_id == "30"
    assert err is None
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["type"] == 17


def test_add_snmp_trap_item_with_description_and_team(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.return_value = {"itemids": ["31"]}
    req = SnmpTrapRequest(hostname="h1", item_name="Trap", description="Trap desc")
    item_id, err = mgr.add_snmp_trap_item(req, team_name="ops")
    assert item_id == "31"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["description"] == "Trap desc"
    assert call_kwargs["tags"] == [{"tag": "team", "value": "ops"}]


def test_add_snmp_trap_item_zapi_none(mgr):
    mgr.zapi = None
    req = SnmpTrapRequest(hostname="h1", item_name="Trap")
    item_id, err = mgr.add_snmp_trap_item(req)
    assert item_id is None


def test_add_snmp_trap_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = SnmpTrapRequest(hostname="ghost", item_name="Trap")
    item_id, err = mgr.add_snmp_trap_item(req)
    assert item_id is None
    assert "not found" in err


def test_add_snmp_trap_item_no_interface(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = []
    req = SnmpTrapRequest(hostname="h1", item_name="Trap")
    item_id, err = mgr.add_snmp_trap_item(req)
    assert item_id is None
    assert "interface" in err.lower()


def test_add_snmp_trap_item_exception(mgr):
    _host_ok(mgr)
    mgr.zapi.hostinterface.get.return_value = _iface("2")
    mgr.zapi.item.create.side_effect = Exception("zabbix error")
    req = SnmpTrapRequest(hostname="h1", item_name="Trap")
    item_id, err = mgr.add_snmp_trap_item(req)
    assert item_id is None
    assert err is not None
