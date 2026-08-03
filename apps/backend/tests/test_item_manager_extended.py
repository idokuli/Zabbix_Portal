"""Tests for Item_Manager/triggers.py, remote.py, http_service.py extended paths."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://fake-zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

from unittest.mock import MagicMock, patch

import pytest

from api.schemas.items import TelnetItemRequest


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
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": ifaceid, "type": "1"}]


# ── add_string_trigger ────────────────────────────────────────────────────────


def test_add_string_trigger_like(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["20"]}
    tid, err = mgr.add_string_trigger("h1", "log.content", "Error detected", "ERROR")
    assert tid == "20"
    assert err is None


def test_add_string_trigger_notlike(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["21"]}
    tid, err = mgr.add_string_trigger(
        "h1", "log.content", "No error", "ERROR", match_type="notlike"
    )
    assert tid == "21"
    assert err is None


def test_add_string_trigger_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    tid, err = mgr.add_string_trigger("ghost", "k", "T", "pat")
    assert tid is None
    assert err is not None


def test_add_string_trigger_zapi_none(mgr):
    mgr.zapi = None
    tid, err = mgr.add_string_trigger("h1", "k", "T", "pat")
    assert tid is None


def test_get_trigger_hostname_found(mgr):
    mgr.zapi.trigger.get.return_value = [{"triggerid": "1", "hosts": [{"host": "srv01"}]}]
    result = mgr.get_trigger_hostname("1")
    assert result == "srv01"


def test_get_trigger_hostname_not_found(mgr):
    mgr.zapi.trigger.get.return_value = []
    result = mgr.get_trigger_hostname("999")
    assert result == ""


def test_get_trigger_hostname_zapi_none(mgr):
    mgr.zapi = None
    assert mgr.get_trigger_hostname("1") == ""


def test_add_change_trigger_success(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["30"]}
    tid, err = mgr.add_change_trigger("h1", "system.sw.packages", "Package change", 3)
    assert tid == "30"
    assert err is None


def test_add_file_age_trigger_success(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    mgr.zapi.trigger.create.return_value = {"triggerids": ["31"]}
    tid, err = mgr.add_file_age_trigger("h1", "vfs.file.time", "Old file", 3600, 3)
    assert tid == "31"
    assert err is None


# ── add_ipmi_item (remote.py) ─────────────────────────────────────────────────


def test_add_ipmi_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.hostinterface.get.return_value = [{"interfaceid": "5", "type": "3"}]
    mgr.zapi.item.create.return_value = {"itemids": ["40"]}
    item_id, err = mgr.add_ipmi_item("h1", "Fan speed", "ipmi.fan", "0x23")
    assert item_id == "40"
    assert err is None


def test_add_ipmi_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_ipmi_item("ghost", "x", "k", "0x01")
    assert item_id is None


def test_add_ipmi_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_ipmi_item("h1", "x", "k", "0x01")
    assert item_id is None


def test_add_telnet_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["41"]}
    req = TelnetItemRequest(
        hostname="h1", item_name="Telnet check", params="uptime", item_key="telnet.run[uptime]"
    )
    item_id, err = mgr.add_telnet_item(req)
    assert item_id == "41"
    assert err is None


def test_add_telnet_item_zapi_none(mgr):
    mgr.zapi = None
    req = TelnetItemRequest(hostname="h1", item_name="x", params="cmd", item_key="k")
    item_id, err = mgr.add_telnet_item(req)
    assert item_id is None


# ── add_process_item (http_service.py) ───────────────────────────────────────


def test_add_process_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["50"]}
    item_id, err = mgr.add_process_item("h1", "nginx", "proc.num[nginx]", "count")
    assert item_id == "50"
    assert err is None


def test_add_process_item_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    item_id, err = mgr.add_process_item("ghost", "nginx", "k", "count")
    assert item_id is None


def test_add_windows_service_item_success(mgr):
    _mock_host_iface(mgr)
    mgr.zapi.item.create.return_value = {"itemids": ["51"]}
    item_id, err = mgr.add_windows_service_item("h1", "Spooler", "service.info[Spooler]")
    assert item_id == "51"
    assert err is None


def test_add_windows_service_item_zapi_none(mgr):
    mgr.zapi = None
    item_id, err = mgr.add_windows_service_item("h1", "x", "k")
    assert item_id is None
