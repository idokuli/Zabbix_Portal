"""Tests for Item_Manager (core, http, snmp, remote, triggers, bulk)."""

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


def _mock_host_iface(mgr, hostid="10", ifaceid="5"):
    mgr.zapi.host.get.return_value = [{"hostid": hostid}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": ifaceid}]


# ── add_item (core) ──────────────────────────────────────────────────────────


def test_add_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["42"]}
    item_id, err = mgr.add_item("h1", "CPU", "system.cpu.load")
    assert item_id == "42"
    assert err is None


def test_add_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_item("ghost", "CPU", "key")
    assert item_id is None
    assert "not found" in err


def test_add_item_no_interfaces(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = []
    item_id, err = mgr.add_item("h1", "CPU", "key")
    assert item_id is None
    assert "interfaces" in err


def test_add_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_item("h1", "CPU", "key")
    assert item_id is None


def test_add_item_with_team_tag(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["55"]}
    item_id, err = mgr.add_item("h1", "CPU", "key", team_name="ops")
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
    item_id, err = mgr.add_http_item("h1", "HTTP check", "http://example.com")
    assert item_id == "10"
    assert err is None


def test_add_http_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_http_item("h1", "x", "http://x")
    assert item_id is None


# ── add_service_item ──────────────────────────────────────────────────────────


def test_add_service_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["20"]}
    item_id, err = mgr.add_service_item("h1", "icmp_ping")
    assert item_id == "20"


# ── add_snmp_item ─────────────────────────────────────────────────────────────


def test_add_snmp_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "2"}]
    mgr.zapi.item.create.return_value = {"itemids": ["30"]}
    item_id, err = mgr.add_snmp_item(
        "h1", "SNMP item", "snmp.key", "1.3.6.1.2.1.1.1.0", value_type=4
    )
    assert item_id == "30"
    assert err is None


def test_add_snmp_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_snmp_item("h1", "x", "k", "1.3.6", value_type=4)
    assert item_id is None


def test_add_snmp_item_no_oid(mgr):
    item_id, err = mgr.add_snmp_item("h1", "SNMP", "snmp.key", "", value_type=4)
    assert item_id is None
    assert "OID" in err


def test_add_snmp_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_snmp_item("ghost", "SNMP", "snmp.key", "1.3.6", value_type=4)
    assert item_id is None
    assert "not found" in err


def test_add_snmp_item_no_interface(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = []
    item_id, err = mgr.add_snmp_item("h1", "SNMP", "snmp.key", "1.3.6", value_type=4)
    assert item_id is None
    assert "interface" in err.lower()


def test_add_snmp_item_uses_first_iface_if_no_snmp(mgr):
    """Falls back to first interface when no SNMP interface exists."""
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "9", "type": "1"}]
    mgr.zapi.item.create.return_value = {"itemids": ["31"]}
    item_id, err = mgr.add_snmp_item("h1", "SNMP", "snmp.key", "1.3.6.1.2.1.1.1.0", value_type=4)
    assert item_id == "31"


def test_add_snmp_item_v3_auth_priv(mgr):
    """SNMPv3 with security level 2 (authPriv) adds all auth/priv params."""
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "2"}]
    mgr.zapi.item.create.return_value = {"itemids": ["32"]}
    item_id, err = mgr.add_snmp_item(
        "h1",
        "SNMP v3",
        "snmp.v3",
        "1.3.6.1.2.1.1.1.0",
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
    assert item_id == "32"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert "snmpv3_privpassphrase" in call_kwargs


def test_add_snmp_item_auto_key_and_name(mgr):
    """When item_name and item_key are empty, they are auto-generated."""
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "2"}]
    mgr.zapi.item.create.return_value = {"itemids": ["33"]}
    item_id, err = mgr.add_snmp_item("h1", "", "", "1.3.6.1.2.1.1.1.0", value_type=4)
    assert item_id == "33"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert "SNMP:" in call_kwargs["name"]
    assert call_kwargs["key_"].startswith("snmp.")


def test_add_snmp_trap_item_success(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "2"}]
    mgr.zapi.item.create.return_value = {"itemids": ["35"]}
    item_id, err = mgr.add_snmp_trap_item("h1", "SNMP Trap")
    assert item_id == "35"
    assert err is None


def test_add_snmp_trap_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_snmp_trap_item("h1", "Trap")
    assert item_id is None
    assert err is not None


def test_add_snmp_trap_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_snmp_trap_item("ghost", "Trap")
    assert item_id is None


def test_add_snmp_trap_item_no_interface(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = []
    item_id, err = mgr.add_snmp_trap_item("h1", "Trap")
    assert item_id is None


def test_add_snmp_trap_item_with_team(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "2"}]
    mgr.zapi.item.create.return_value = {"itemids": ["36"]}
    item_id, err = mgr.add_snmp_trap_item("h1", "Trap", team_name="ops")
    assert item_id == "36"
    call_kwargs = mgr.zapi.item.create.call_args[1]
    assert call_kwargs["tags"][0]["value"] == "ops"


# ── add_ssh_item ──────────────────────────────────────────────────────────────


def test_add_ssh_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["40"]}
    item_id, err = mgr.add_ssh_item(
        "h1", "SSH uptime", "uptime", "ssh.run[uptime]", username="root"
    )
    assert item_id == "40"
    assert err is None


# ── add_jmx_item ──────────────────────────────────────────────────────────────


def test_add_jmx_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "4"}]
    mgr.zapi.item.create.return_value = {"itemids": ["50"]}
    item_id, err = mgr.add_jmx_item(
        "h1",
        "JMX heap",
        "jmx.heap",
        "service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi",
    )
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
    item_id, err = mgr.add_internal_item("h1", "Queue size", "zabbix[queue,6,60]")
    assert item_id == "100"
    assert err is None


def test_add_internal_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_internal_item("ghost", "Queue", "zabbix[queue]")
    assert item_id is None
    assert "not found" in err


def test_add_internal_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_internal_item("h1", "Queue", "zabbix[queue]")
    assert item_id is None


def test_add_trapper_item_ok(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["101"]}
    item_id, err = mgr.add_trapper_item("h1", "Trap", "trap.key")
    assert item_id == "101"
    assert err is None


def test_add_trapper_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_trapper_item("ghost", "Trap", "trap.key")
    assert item_id is None


def test_add_trapper_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_trapper_item("h1", "Trap", "k")
    assert item_id is None


def test_add_external_item_ok(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["102"]}
    item_id, err = mgr.add_external_item("h1", "Ext check", "check.sh[arg]")
    assert item_id == "102"
    assert err is None


def test_add_external_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_external_item("ghost", "Ext", "check.sh")
    assert item_id is None


def test_add_external_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_external_item("h1", "Ext", "k")
    assert item_id is None


def test_add_calculated_item_ok(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["103"]}
    item_id, err = mgr.add_calculated_item("h1", "Calc", "calc.key", "avg(//cpu.load,1m)")
    assert item_id == "103"
    assert err is None


def test_add_calculated_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_calculated_item("ghost", "Calc", "k", "formula")
    assert item_id is None


def test_add_calculated_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_calculated_item("h1", "Calc", "k", "formula")
    assert item_id is None


def test_add_dependent_item_ok(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["104"]}
    item_id, err = mgr.add_dependent_item("h1", "Dep", "dep.key", "5")
    assert item_id == "104"
    assert err is None


def test_add_dependent_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_dependent_item("ghost", "Dep", "k", "5")
    assert item_id is None


def test_add_dependent_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_dependent_item("h1", "Dep", "k", "5")
    assert item_id is None


def test_add_zabbix_script_item_ok(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["105"]}
    item_id, err = mgr.add_zabbix_script_item("h1", "Script", "script.key", "return 1;")
    assert item_id == "105"
    assert err is None


def test_add_zabbix_script_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_zabbix_script_item("ghost", "Script", "k", "code")
    assert item_id is None


def test_add_zabbix_script_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_zabbix_script_item("h1", "Script", "k", "code")
    assert item_id is None


def test_add_browser_item_ok(mgr):
    _mock_host(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["106"]}
    item_id, err = mgr.add_browser_item("h1", "Browser", "browser.key", "return 1;")
    assert item_id == "106"
    assert err is None


def test_add_browser_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_browser_item("ghost", "Browser", "k", "code")
    assert item_id is None


def test_add_browser_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_browser_item("h1", "Browser", "k", "code")
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
    # signature: hostname, script_type, script_mode, script
    item_id, err = mgr.add_script_item("h1", "bash", "command", "uptime")
    assert item_id == "108"
    assert err is None


def test_add_script_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_script_item("ghost", "bash", "command", "uptime")
    assert item_id is None


def test_add_script_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_script_item("h1", "bash", "command", "uptime")
    assert item_id is None


# ── DB items (ODBC, Agent2) ────────────────────────────────────────────────────


def test_add_db_odbc_item_ok(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["109"]}
    item_id, err = mgr.add_db_odbc_item(
        "h1", "DB query", "db.odbc.select[rows,dsn]", "SELECT 1", "mydsn"
    )
    assert item_id == "109"
    assert err is None


def test_add_db_odbc_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_db_odbc_item("ghost", "DB", "key", "SELECT 1", "dsn")
    assert item_id is None


def test_add_db_odbc_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_db_odbc_item("h1", "DB", "key", "SELECT 1", "dsn")
    assert item_id is None


def test_add_db_agent2_item_ok(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["110"]}
    # signature: hostname, engine, conn_string, metric
    item_id, err = mgr.add_db_agent2_item("h1", "mysql", "localhost:3306", "ping")
    assert item_id == "110"
    assert err is None


def test_add_db_agent2_item_unsupported_engine(mgr):
    item_id, err = mgr.add_db_agent2_item("h1", "oracle", "conn", "ping")
    assert item_id is None
    assert "oracle" in err


def test_add_db_agent2_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_db_agent2_item("ghost", "mysql", "conn", "ping")
    assert item_id is None


def test_add_db_agent2_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_db_agent2_item("h1", "MySQL", "k", "mysql", "SELECT 1", "localhost")
    assert item_id is None
