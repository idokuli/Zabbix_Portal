"""Tests for ItemManager (core, http, snmp, remote, triggers, bulk)."""

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
    DbAgent2Request,
    DbOdbcRequest,
    DependentItemRequest,
    ExternalItemRequest,
    HttpItemRequest,
    InternalItemRequest,
    ItemRequest,
    JmxItemRequest,
    ScriptItemRequest,
    ServiceItemRequest,
    SnmpItemRequest,
    SnmpTrapRequest,
    SshItemRequest,
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


def _mock_host_iface(mgr, hostid="10", ifaceid="5"):
    mgr.zapi.host.get.return_value = [{"hostid": hostid}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": ifaceid}]


# ── add_item (core) ──────────────────────────────────────────────────────────


def test_add_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["42"]}
    req = ItemRequest(hostname="h1", item_name="CPU", item_key="system.cpu.load")
    item_id, err = mgr.add_item(req)
    assert item_id == "42"
    assert err is None


def test_add_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = ItemRequest(hostname="ghost", item_name="CPU", item_key="key")
    item_id, err = mgr.add_item(req)
    assert item_id is None
    assert "not found" in err


def test_add_item_no_interfaces(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = []
    req = ItemRequest(hostname="h1", item_name="CPU", item_key="key")
    item_id, err = mgr.add_item(req)
    assert item_id is None
    assert "interfaces" in err


def test_add_item_zapi_none(mgr):
    mgr.zapi = None
    req = ItemRequest(hostname="h1", item_name="CPU", item_key="key")
    item_id, err = mgr.add_item(req)
    assert item_id is None


def test_add_item_with_team_tag(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["55"]}
    req = ItemRequest(hostname="h1", item_name="CPU", item_key="key")
    item_id, err = mgr.add_item(req, team_name="ops")
    assert item_id == "55"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["tags"] == [{"tag": "team", "value": "ops"}]


# ── list_items ────────────────────────────────────────────────────────────────


def test_list_items_returns_list(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.item.get.return_value = [{"itemid": "1", "name": "CPU", "key_": "k"}]
    result = mgr.list_items("h1")
    assert len(result) == 1


def test_list_items_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    result = mgr.list_items("ghost")
    assert result == []


# ── delete_item ───────────────────────────────────────────────────────────────


def test_delete_item_success(mgr):
    mgr.zapi.item.delete.return_value = {"itemids": ["1"]}
    result = mgr.delete_item("1")
    assert result is True


def test_delete_item_not_found(mgr):
    mgr.zapi.item.delete.side_effect = Exception("does not exist")
    result = mgr.delete_item("999")
    assert result is False


# ── update_item ───────────────────────────────────────────────────────────────


def test_update_item_success(mgr):
    mgr.zapi.item.update.return_value = {"itemids": ["1"]}
    mgr.update_item("1", name="NewName")
    mgr.zapi.item.update.assert_called_once()


def test_update_item_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.update_item("1", name="x")


# ── list_all_items ────────────────────────────────────────────────────────────


def test_list_all_items_returns_list(mgr):
    mgr.zapi.item.get.return_value = [
        {
            "itemid": "1",
            "name": "CPU",
            "key_": "k",
            "value_type": "0",
            "delay": "60",
            "status": "0",
            "state": "0",
            "lastvalue": "10",
            "lastclock": "1700000000",
            "templateid": "0",
            "hosts": [{"host": "h1"}],
            "tags": [],
        }
    ]
    result = mgr.list_all_items()
    assert isinstance(result, list)
    assert result[0]["name"] == "CPU"


def test_list_all_items_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.list_all_items()


# ── get_all_item_keys ─────────────────────────────────────────────────────────


def test_get_all_item_keys(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.template.get.return_value = [{"templateid": "99", "name": "Linux"}]
    mgr.zapi.item.get.return_value = [
        {
            "name": "CPU load",
            "key_": "system.cpu.load",
            "value_type": "0",
            "hostid": "99",
            "delay": "60",
            "units": "",
            "history": "90d",
            "trends": "365d",
            "description": "",
            "type": "0",
        }
    ]
    result = mgr.get_all_item_keys("myhost")
    keys = [item["key_"] for item in result] if result and isinstance(result[0], dict) else result
    assert "system.cpu.load" in keys or any("system.cpu.load" in str(r) for r in result)


def test_get_all_item_keys_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    assert mgr.get_all_item_keys("missinghost") == []


# ── list_template_items ───────────────────────────────────────────────────────


def test_list_template_items(mgr):
    mgr.zapi.item.get.return_value = [{"itemid": "1", "name": "CPU", "key_": "k"}]
    result = mgr.list_template_items("99")
    assert len(result) == 1


# ── add_item_to_template ──────────────────────────────────────────────────────


def test_add_item_to_template_success(mgr):
    mgr.zapi.item.create.return_value = {"itemids": ["42"]}
    item_id, err = mgr.add_item_to_template("99", "CPU", "system.cpu.load", type_=0, value_type=3)
    assert item_id == "42"
    assert err is None


def test_add_item_to_template_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_item_to_template("99", "CPU", "key", type_=0, value_type=3)
    assert item_id is None


# ── add_http_item ─────────────────────────────────────────────────────────────


def test_add_http_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["10"]}
    req = HttpItemRequest(hostname="h1", item_name="HTTP check", url="http://example.com")
    item_id, err = mgr.add_http_item(req)
    assert item_id == "10"
    assert err is None


def test_add_http_item_zapi_none(mgr):
    mgr.zapi = None
    req = HttpItemRequest(hostname="h1", item_name="x", url="http://x")
    item_id, err = mgr.add_http_item(req)
    assert item_id is None


# ── add_service_item ──────────────────────────────────────────────────────────


def test_add_service_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["20"]}
    req = ServiceItemRequest(hostname="h1", service_type="icmp_ping")
    item_id, err = mgr.add_service_item(req)
    assert item_id == "20"


# ── add_snmp_item ─────────────────────────────────────────────────────────────


def test_add_snmp_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "2"}]
    mgr.zapi.item.create.return_value = {"itemids": ["30"]}
    req = SnmpItemRequest(
        hostname="h1",
        item_name="SNMP item",
        item_key="snmp.key",
        snmp_oid="1.3.6.1.2.1.1.1.0",
        value_type=4,
    )
    item_id, err = mgr.add_snmp_item(req)
    assert item_id == "30"
    assert err is None


def test_add_snmp_item_zapi_none(mgr):
    mgr.zapi = None
    req = SnmpItemRequest(
        hostname="h1", item_name="x", item_key="k", snmp_oid="1.3.6", value_type=4
    )
    item_id, err = mgr.add_snmp_item(req)
    assert item_id is None


def test_add_snmp_item_no_oid(mgr):
    req = SnmpItemRequest(
        hostname="h1", item_name="SNMP", item_key="snmp.key", snmp_oid="", value_type=4
    )
    item_id, err = mgr.add_snmp_item(req)
    assert item_id is None
    assert "OID" in err


def test_add_snmp_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = SnmpItemRequest(
        hostname="ghost", item_name="SNMP", item_key="snmp.key", snmp_oid="1.3.6", value_type=4
    )
    item_id, err = mgr.add_snmp_item(req)
    assert item_id is None
    assert "not found" in err


def test_add_snmp_item_no_interface(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = []
    req = SnmpItemRequest(
        hostname="h1", item_name="SNMP", item_key="snmp.key", snmp_oid="1.3.6", value_type=4
    )
    item_id, err = mgr.add_snmp_item(req)
    assert item_id is None
    assert "interface" in err.lower()


def test_add_snmp_item_uses_first_iface_if_no_snmp(mgr):
    """Falls back to first interface when no SNMP interface exists."""
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "9", "type": "1"}]
    mgr.zapi.item.create.return_value = {"itemids": ["31"]}
    req = SnmpItemRequest(
        hostname="h1",
        item_name="SNMP",
        item_key="snmp.key",
        snmp_oid="1.3.6.1.2.1.1.1.0",
        value_type=4,
    )
    item_id, err = mgr.add_snmp_item(req)
    assert item_id == "31"


def test_add_snmp_item_v3_auth_priv(mgr):
    """SNMPv3 with security level 2 (authPriv) adds all auth/priv params."""
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "2"}]
    mgr.zapi.item.create.return_value = {"itemids": ["32"]}
    req = SnmpItemRequest(
        hostname="h1",
        item_name="SNMP v3",
        item_key="snmp.v3",
        snmp_oid="1.3.6.1.2.1.1.1.0",
        value_type=4,
        snmp_version=3,
        snmpv3_securityname="admin",
        snmpv3_securitylevel=2,
        snmpv3_authprotocol=0,
        snmpv3_authpassphrase="authpass",
        snmpv3_privprotocol=0,
        snmpv3_privpassphrase="privpass",
        snmpv3_contextname="ctx",
    )
    item_id, err = mgr.add_snmp_item(req)
    assert item_id == "32"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert "snmpv3_privpassphrase" in call_kwargs


def test_add_snmp_item_auto_key_and_name(mgr):
    """When item_name and item_key are empty, they are auto-generated."""
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "2"}]
    mgr.zapi.item.create.return_value = {"itemids": ["33"]}
    req = SnmpItemRequest(
        hostname="h1", item_name="", item_key="", snmp_oid="1.3.6.1.2.1.1.1.0", value_type=4
    )
    item_id, err = mgr.add_snmp_item(req)
    assert item_id == "33"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert "SNMP:" in call_kwargs["name"]
    assert call_kwargs["key_"].startswith("snmp.")


def test_add_snmp_trap_item_success(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "2"}]
    mgr.zapi.item.create.return_value = {"itemids": ["35"]}
    req = SnmpTrapRequest(hostname="h1", item_name="SNMP Trap")
    item_id, err = mgr.add_snmp_trap_item(req)
    assert item_id == "35"
    assert err is None


def test_add_snmp_trap_item_zapi_none(mgr):
    mgr.zapi = None
    req = SnmpTrapRequest(hostname="h1", item_name="Trap")
    item_id, err = mgr.add_snmp_trap_item(req)
    assert item_id is None
    assert err is not None


def test_add_snmp_trap_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = SnmpTrapRequest(hostname="ghost", item_name="Trap")
    item_id, err = mgr.add_snmp_trap_item(req)
    assert item_id is None


def test_add_snmp_trap_item_no_interface(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = []
    req = SnmpTrapRequest(hostname="h1", item_name="Trap")
    item_id, err = mgr.add_snmp_trap_item(req)
    assert item_id is None


def test_add_snmp_trap_item_with_team(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "2"}]
    mgr.zapi.item.create.return_value = {"itemids": ["36"]}
    req = SnmpTrapRequest(hostname="h1", item_name="Trap")
    item_id, err = mgr.add_snmp_trap_item(req, team_name="ops")
    assert item_id == "36"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["tags"][0]["value"] == "ops"


# ── add_ssh_item ──────────────────────────────────────────────────────────────


def test_add_ssh_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["40"]}
    req = SshItemRequest(
        hostname="h1",
        item_name="SSH uptime",
        params="uptime",
        item_key="ssh.run[uptime]",
        username="root",
    )
    item_id, err = mgr.add_ssh_item(req)
    assert item_id == "40"
    assert err is None


# ── add_jmx_item ──────────────────────────────────────────────────────────────


def test_add_jmx_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "4"}]
    mgr.zapi.item.create.return_value = {"itemids": ["50"]}
    req = JmxItemRequest(
        hostname="h1",
        item_name="JMX heap",
        item_key="jmx.heap",
        jmx_endpoint="service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi",
    )
    item_id, err = mgr.add_jmx_item(req)
    assert item_id == "50"


# ── add_trigger ───────────────────────────────────────────────────────────────


def test_add_trigger_success(mgr):
    # add_trigger takes hostname, item_key, trigger_name, threshold, operator, priority (in that order)
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["100"]}
    trigger_id, err = mgr.add_trigger("h1", "system.cpu.load", "High CPU", "90", ">", 4)
    assert trigger_id == "100"
    assert err is None


def test_add_trigger_zapi_none(mgr):
    mgr.zapi = None
    trigger_id, err = mgr.add_trigger("h1", "k", "High CPU", "90", ">", 4)
    assert trigger_id is None


# ── add_nodata_trigger ────────────────────────────────────────────────────────


def test_add_nodata_trigger_success_modern_syntax(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["200"]}
    trigger_id, err = mgr.add_nodata_trigger("h1", "system.cpu.load", "No data")
    assert trigger_id == "200"
    assert err is None
    expression = mgr.zapi.trigger.create.call_args.kwargs["expression"]
    assert expression == "nodata(/h1/system.cpu.load,5m)=1"


def test_add_nodata_trigger_classic_syntax(mgr):
    mgr._zabbix_version = (5, 0)
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["201"]}
    trigger_id, err = mgr.add_nodata_trigger("h1", "system.cpu.load", "No data")
    assert trigger_id == "201"
    expression = mgr.zapi.trigger.create.call_args.kwargs["expression"]
    assert expression == "{h1:system.cpu.load.nodata(5m)}=1"


def test_add_nodata_trigger_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    trigger_id, err = mgr.add_nodata_trigger("ghost", "key", "No data")
    assert trigger_id is None
    assert "not found" in err


def test_add_nodata_trigger_zapi_none(mgr):
    mgr.zapi = None
    trigger_id, err = mgr.add_nodata_trigger("h1", "key", "No data")
    assert trigger_id is None


# ── maybe_create_trigger ──────────────────────────────────────────────────────


def test_maybe_create_trigger_disabled_returns_none(mgr):
    trigger_id, err = mgr.maybe_create_trigger("h1", "key", "Item", 3, False)
    assert trigger_id is None
    assert err is None
    mgr.zapi.trigger.create.assert_not_called()


def test_maybe_create_trigger_numeric_with_threshold(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["300"]}
    trigger_id, err = mgr.maybe_create_trigger(
        "h1", "cpu.load", "CPU", 3, True, trigger_operator=">", trigger_threshold=90
    )
    assert trigger_id == "300"
    expression = mgr.zapi.trigger.create.call_args.kwargs["expression"]
    assert expression == "last(/h1/cpu.load)>90"


def test_maybe_create_trigger_numeric_without_threshold_falls_back_to_nodata(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["301"]}
    trigger_id, err = mgr.maybe_create_trigger("h1", "cpu.load", "CPU", 3, True)
    expression = mgr.zapi.trigger.create.call_args.kwargs["expression"]
    assert "nodata(" in expression


def test_maybe_create_trigger_string_with_pattern(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["302"]}
    trigger_id, err = mgr.maybe_create_trigger(
        "h1", "log.file", "Log", 2, True, trigger_pattern="ERROR"
    )
    expression = mgr.zapi.trigger.create.call_args.kwargs["expression"]
    assert "find(" in expression
    assert "ERROR" in expression


def test_maybe_create_trigger_string_without_pattern_falls_back_to_nodata(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["303"]}
    trigger_id, err = mgr.maybe_create_trigger("h1", "log.file", "Log", 2, True)
    expression = mgr.zapi.trigger.create.call_args.kwargs["expression"]
    assert "nodata(" in expression


# ── list_triggers ─────────────────────────────────────────────────────────────


def test_list_triggers_returns_list(mgr):
    mgr.zapi.host.get.return_value = [
        {"hostid": "10", "interfaces": [{"type": "1", "available": "1"}]}
    ]
    mgr.zapi.trigger.get.return_value = [
        {
            "triggerid": "1",
            "description": "High CPU",
            "priority": "4",
            "status": "0",
            "value": "1",
            "lastchange": "1700000000",
            "expression": "{h1:cpu.last()}>90",
        }
    ]
    triggers, host_available = mgr.list_triggers("h1")
    assert isinstance(triggers, list)
    assert host_available in ("0", "1", "2")


def test_list_triggers_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    triggers, host_available = mgr.list_triggers("ghost")
    assert triggers == []
    assert host_available == "0"


# ── delete_trigger ────────────────────────────────────────────────────────────


def test_delete_trigger_success(mgr):
    mgr.zapi.trigger.delete.return_value = {"triggerids": ["1"]}
    result = mgr.delete_trigger("1")
    assert result is True


def test_delete_trigger_fails(mgr):
    mgr.zapi.trigger.delete.side_effect = Exception("not found")
    result = mgr.delete_trigger("999")
    assert result is False


# ── update_trigger ─────────────────────────────────────────────────────────────


def test_update_trigger_success(mgr):
    mgr.zapi.trigger.update.return_value = {"triggerids": ["1"]}
    result = mgr.update_trigger("1", description="Updated")
    assert result is True


# ── list_all_triggers ─────────────────────────────────────────────────────────


def test_list_all_triggers_returns_list(mgr):
    mgr.zapi.trigger.get.return_value = [
        {
            "triggerid": "1",
            "description": "High CPU",
            "priority": "4",
            "status": "0",
            "value": "1",
            "lastchange": "1700000000",
            "expression": "{h1:cpu.last()}>90",
            "hosts": [{"host": "h1"}],
        }
    ]
    result = mgr.list_all_triggers()
    assert isinstance(result, list)


# ── bulk_add_items ────────────────────────────────────────────────────────────


def test_bulk_add_items_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["1"]}
    results = mgr.bulk_add_items(
        ["h1"],
        {
            "item_name": "CPU",
            "item_key": "system.cpu.load",
            "item_type": "agent",
            "value_type": 3,
        },
    )
    assert len(results) == 1
    assert results[0]["error"] is None


def test_bulk_add_items_service_type(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["2"]}
    results = mgr.bulk_add_items(
        ["h1"],
        {
            "item_type": "service",
            "service_type": "icmp_ping",
        },
    )
    assert len(results) == 1
    assert results[0]["error"] is None
    assert results[0]["item_id"] == "2"


# ── add_string_trigger ────────────────────────────────────────────────────────


def test_add_string_trigger_success(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["200"]}
    trigger_id, err = mgr.add_string_trigger("h1", "log[app.log]", "Error found", "ERROR")
    assert trigger_id == "200"
    assert err is None


def test_add_string_trigger_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    trigger_id, err = mgr.add_string_trigger("ghost", "log[app.log]", "Error", "ERR")
    assert trigger_id is None
    assert "not found" in err


def test_add_string_trigger_zapi_none(mgr):
    mgr.zapi = None
    trigger_id, err = mgr.add_string_trigger("h1", "k", "t", "pattern")
    assert trigger_id is None


def test_add_string_trigger_notlike(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["201"]}
    trigger_id, err = mgr.add_string_trigger("h1", "log[f]", "No OK", "OK", match_type="notlike")
    assert trigger_id == "201"


def test_add_string_trigger_classic_syntax(mgr):
    mgr._zabbix_version = (5, 4)
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["202"]}
    trigger_id, err = mgr.add_string_trigger("h1", "log[f]", "Found", "ERROR")
    assert trigger_id == "202"


# ── get_trigger_hostname ──────────────────────────────────────────────────────


def test_get_trigger_hostname_found(mgr):
    mgr.zapi.trigger.get.return_value = [{"triggerid": "1", "hosts": [{"host": "server1"}]}]
    result = mgr.get_trigger_hostname("1")
    assert result == "server1"


def test_get_trigger_hostname_not_found(mgr):
    mgr.zapi.trigger.get.return_value = []
    result = mgr.get_trigger_hostname("999")
    assert result == ""


def test_get_trigger_hostname_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_trigger_hostname("1")
    assert result == ""


def test_get_trigger_hostname_error(mgr):
    mgr.zapi.trigger.get.side_effect = Exception("api error")
    result = mgr.get_trigger_hostname("1")
    assert result == ""


# ── add_change_trigger ────────────────────────────────────────────────────────


def test_add_change_trigger_success(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["300"]}
    trigger_id, err = mgr.add_change_trigger("h1", "system.hostname", "Hostname changed")
    assert trigger_id == "300"
    assert err is None


def test_add_change_trigger_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    trigger_id, err = mgr.add_change_trigger("ghost", "key", "name")
    assert trigger_id is None
    assert "not found" in err


def test_add_change_trigger_zapi_none(mgr):
    mgr.zapi = None
    trigger_id, err = mgr.add_change_trigger("h1", "k", "t")
    assert trigger_id is None


def test_add_change_trigger_classic_syntax(mgr):
    mgr._zabbix_version = (5, 4)
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["301"]}
    trigger_id, err = mgr.add_change_trigger("h1", "system.hostname", "Changed")
    assert trigger_id == "301"


# ── add_file_age_trigger ──────────────────────────────────────────────────────


def test_add_file_age_trigger_success(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["400"]}
    trigger_id, err = mgr.add_file_age_trigger("h1", "/var/log/app.log", "File stale", 60)
    assert trigger_id == "400"
    assert err is None


def test_add_file_age_trigger_old_version(mgr):
    mgr._zabbix_version = (5, 2)
    trigger_id, err = mgr.add_file_age_trigger("h1", "/log", "stale", 30)
    assert trigger_id is None
    assert "5.4" in err


def test_add_file_age_trigger_zapi_none(mgr):
    mgr.zapi = None
    trigger_id, err = mgr.add_file_age_trigger("h1", "/log", "stale", 30)
    assert trigger_id is None


def test_add_file_age_trigger_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    trigger_id, err = mgr.add_file_age_trigger("ghost", "/log", "stale", 30)
    assert trigger_id is None
    assert "not found" in err


# ── bulk_add_triggers ─────────────────────────────────────────────────────────


def test_bulk_add_triggers_success(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["500"]}
    results = mgr.bulk_add_triggers(
        ["h1", "h2"],
        {
            "item_key": "system.cpu.load",
            "trigger_name": "High CPU",
            "threshold": 90,
            "operator": ">",
        },
    )
    assert len(results) == 2
    assert all(r["trigger_id"] == "500" for r in results)


def test_bulk_add_triggers_partial_failure(mgr):
    def host_get_side_effect(**kwargs):
        hostname = kwargs["filter"]["host"][0]
        return [{"hostid": "10"}] if hostname == "h1" else []

    mgr.zapi.host.get.side_effect = host_get_side_effect
    mgr.zapi.trigger.create.return_value = {"triggerids": ["500"]}
    results = mgr.bulk_add_triggers(
        ["h1", "ghost"],
        {"item_key": "key", "trigger_name": "t", "threshold": 90, "operator": ">"},
    )
    assert results[0]["trigger_id"] == "500"
    assert results[1]["trigger_id"] is None


# ── Zabbix-native items (internal, trapper, external, calculated, dependent) ──


def _mock_host(mgr, hostid="10"):
    mgr.zapi.host.get.return_value = [{"hostid": hostid}]


def test_add_internal_item_success(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["100"]}
    req = InternalItemRequest(hostname="h1", item_name="Queue size", item_key="zabbix[queue,6,60]")
    item_id, err = mgr.add_internal_item(req)
    assert item_id == "100"
    assert err is None


def test_add_internal_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = InternalItemRequest(hostname="ghost", item_name="Queue", item_key="zabbix[queue]")
    item_id, err = mgr.add_internal_item(req)
    assert item_id is None
    assert "not found" in err


def test_add_internal_item_zapi_none(mgr):
    mgr.zapi = None
    req = InternalItemRequest(hostname="h1", item_name="Queue", item_key="zabbix[queue]")
    item_id, err = mgr.add_internal_item(req)
    assert item_id is None


def test_add_trapper_item_ok(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["101"]}
    req = TrapperItemRequest(hostname="h1", item_name="Trap", item_key="trap.key")
    item_id, err = mgr.add_trapper_item(req)
    assert item_id == "101"
    assert err is None


def test_add_trapper_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = TrapperItemRequest(hostname="ghost", item_name="Trap", item_key="trap.key")
    item_id, err = mgr.add_trapper_item(req)
    assert item_id is None


def test_add_trapper_item_zapi_none(mgr):
    mgr.zapi = None
    req = TrapperItemRequest(hostname="h1", item_name="Trap", item_key="k")
    item_id, err = mgr.add_trapper_item(req)
    assert item_id is None


def test_add_external_item_ok(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["102"]}
    req = ExternalItemRequest(hostname="h1", item_name="Ext check", item_key="check.sh[arg]")
    item_id, err = mgr.add_external_item(req)
    assert item_id == "102"
    assert err is None


def test_add_external_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = ExternalItemRequest(hostname="ghost", item_name="Ext", item_key="check.sh")
    item_id, err = mgr.add_external_item(req)
    assert item_id is None


def test_add_external_item_zapi_none(mgr):
    mgr.zapi = None
    req = ExternalItemRequest(hostname="h1", item_name="Ext", item_key="k")
    item_id, err = mgr.add_external_item(req)
    assert item_id is None


def test_add_calculated_item_ok(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["103"]}
    req = CalculatedItemRequest(
        hostname="h1", item_name="Calc", item_key="calc.key", formula="avg(//cpu.load,1m)"
    )
    item_id, err = mgr.add_calculated_item(req)
    assert item_id == "103"
    assert err is None


def test_add_calculated_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = CalculatedItemRequest(hostname="ghost", item_name="Calc", item_key="k", formula="formula")
    item_id, err = mgr.add_calculated_item(req)
    assert item_id is None


def test_add_calculated_item_zapi_none(mgr):
    mgr.zapi = None
    req = CalculatedItemRequest(hostname="h1", item_name="Calc", item_key="k", formula="formula")
    item_id, err = mgr.add_calculated_item(req)
    assert item_id is None


def test_add_dependent_item_ok(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["104"]}
    req = DependentItemRequest(
        hostname="h1", item_name="Dep", item_key="dep.key", master_itemid="5"
    )
    item_id, err = mgr.add_dependent_item(req)
    assert item_id == "104"
    assert err is None


def test_add_dependent_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = DependentItemRequest(hostname="ghost", item_name="Dep", item_key="k", master_itemid="5")
    item_id, err = mgr.add_dependent_item(req)
    assert item_id is None


def test_add_dependent_item_zapi_none(mgr):
    mgr.zapi = None
    req = DependentItemRequest(hostname="h1", item_name="Dep", item_key="k", master_itemid="5")
    item_id, err = mgr.add_dependent_item(req)
    assert item_id is None


def test_add_zabbix_script_item_ok(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["105"]}
    req = ZabbixScriptItemRequest(
        hostname="h1", item_name="Script", item_key="script.key", params="return 1;"
    )
    item_id, err = mgr.add_zabbix_script_item(req)
    assert item_id == "105"
    assert err is None


def test_add_zabbix_script_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = ZabbixScriptItemRequest(hostname="ghost", item_name="Script", item_key="k", params="code")
    item_id, err = mgr.add_zabbix_script_item(req)
    assert item_id is None


def test_add_zabbix_script_item_zapi_none(mgr):
    mgr.zapi = None
    req = ZabbixScriptItemRequest(hostname="h1", item_name="Script", item_key="k", params="code")
    item_id, err = mgr.add_zabbix_script_item(req)
    assert item_id is None


def test_add_browser_item_ok(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["106"]}
    req = BrowserItemRequest(
        hostname="h1", item_name="Browser", item_key="browser.key", params="return 1;"
    )
    item_id, err = mgr.add_browser_item(req)
    assert item_id == "106"
    assert err is None


def test_add_browser_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = BrowserItemRequest(hostname="ghost", item_name="Browser", item_key="k", params="code")
    item_id, err = mgr.add_browser_item(req)
    assert item_id is None


def test_add_browser_item_zapi_none(mgr):
    mgr.zapi = None
    req = BrowserItemRequest(hostname="h1", item_name="Browser", item_key="k", params="code")
    item_id, err = mgr.add_browser_item(req)
    assert item_id is None


# ── add_file_watch_item / add_script_item ──────────────────────────────────────


def test_add_file_watch_item_ok(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["107"]}
    # file_path is 2nd arg, check_type defaults to "checksum"
    item_id, err = mgr.add_file_watch_item("h1", "/var/log/app.log")
    assert item_id == "107"
    assert err is None


def test_add_file_watch_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_file_watch_item("ghost", "/var/log/app.log")
    assert item_id is None


def test_add_file_watch_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_file_watch_item("h1", "/var/log/app.log")
    assert item_id is None


def test_add_script_item_ok(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["108"]}
    req = ScriptItemRequest(
        hostname="h1", script_type="bash", script_mode="command", script="uptime"
    )
    item_id, err = mgr.add_script_item(req)
    assert item_id == "108"
    assert err is None


def test_add_script_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = ScriptItemRequest(
        hostname="ghost", script_type="bash", script_mode="command", script="uptime"
    )
    item_id, err = mgr.add_script_item(req)
    assert item_id is None


def test_add_script_item_zapi_none(mgr):
    mgr.zapi = None
    req = ScriptItemRequest(
        hostname="h1", script_type="bash", script_mode="command", script="uptime"
    )
    item_id, err = mgr.add_script_item(req)
    assert item_id is None


# ── DB items (ODBC, Agent2) ────────────────────────────────────────────────────


def test_add_db_odbc_item_ok(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["109"]}
    req = DbOdbcRequest(
        hostname="h1",
        dsn="DB query",
        sql_query="db.odbc.select[rows,dsn]",
        description="SELECT 1",
        item_name="mydsn",
    )
    item_id, err = mgr.add_db_odbc_item(req)
    assert item_id == "109"
    assert err is None


def test_add_db_odbc_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = DbOdbcRequest(
        hostname="ghost", dsn="DB", sql_query="key", description="SELECT 1", item_name="dsn"
    )
    item_id, err = mgr.add_db_odbc_item(req)
    assert item_id is None


def test_add_db_odbc_item_zapi_none(mgr):
    mgr.zapi = None
    req = DbOdbcRequest(
        hostname="h1", dsn="DB", sql_query="key", description="SELECT 1", item_name="dsn"
    )
    item_id, err = mgr.add_db_odbc_item(req)
    assert item_id is None


def test_add_db_agent2_item_ok(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["110"]}
    req = DbAgent2Request(
        hostname="h1", engine="mysql", conn_string="localhost:3306", metric="ping"
    )
    item_id, err = mgr.add_db_agent2_item(req)
    assert item_id == "110"
    assert err is None


def test_add_db_agent2_item_unsupported_engine(mgr):
    req = DbAgent2Request(hostname="h1", engine="oracle", conn_string="conn", metric="ping")
    item_id, err = mgr.add_db_agent2_item(req)
    assert item_id is None
    assert "oracle" in err


def test_add_db_agent2_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    req = DbAgent2Request(hostname="ghost", engine="mysql", conn_string="conn", metric="ping")
    item_id, err = mgr.add_db_agent2_item(req)
    assert item_id is None


def test_add_db_agent2_item_zapi_none(mgr):
    mgr.zapi = None
    req = DbAgent2Request(hostname="h1", engine="mysql", conn_string="k", metric="ping")
    item_id, err = mgr.add_db_agent2_item(req)
    assert item_id is None
