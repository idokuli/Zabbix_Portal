"""Tests for Services_Manager.py."""

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
        from Services_Manager import ServicesManager

        m = ServicesManager()
        m.zapi = MagicMock()
        return m


def _svc():
    return {
        "serviceid": "1",
        "name": "Web Portal",
        "algorithm": "1",
        "sortorder": "0",
        "weight": "0",
        "status": "0",
        "description": "",
        "tags": [],
        "children": [],
        "parents": [],
    }


def test_list_services_returns_list(mgr):
    mgr.zapi.service.get.return_value = [_svc()]
    result = mgr.list_services()
    assert isinstance(result, list)
    assert result[0]["serviceid"] == "1"
    assert result[0]["algorithm_label"] == "Most critical of children"


def test_list_services_with_parentid(mgr):
    mgr.zapi.service.get.return_value = []
    result = mgr.list_services(parentid="5")
    assert result == []


def test_list_services_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_services()
    assert result == []


def test_create_service_returns_id(mgr):
    mgr.zapi.service.create.return_value = {"serviceids": ["42"]}
    result = mgr.create_service(name="New Service")
    assert result == "42"


def test_create_service_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.create_service(name="X")


def test_delete_service_true(mgr):
    mgr.zapi.service.delete.return_value = {"serviceids": ["1"]}
    result = mgr.delete_service("1")
    assert result is True


def test_delete_service_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.delete_service("1")


def test_list_slas_returns_list(mgr):
    mgr.zapi.sla.get.return_value = [
        {
            "slaid": "1",
            "name": "SLA 99.9",
            "period": "PERIOD_MONTHLY",
            "slo": "99.9",
            "effective_date": "0",
            "timezone": "UTC",
            "status": "0",
            "description": "",
            "service_tags": [],
        }
    ]
    result = mgr.list_slas()
    assert isinstance(result, list)
    assert result[0]["slaid"] == "1"


def test_list_slas_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_slas()
    assert result == []


def test_delete_sla_true(mgr):
    mgr.zapi.sla.delete.return_value = {"slaids": ["1"]}
    result = mgr.delete_sla("1")
    assert result is True


def test_update_service_true(mgr):
    mgr.zapi.service.update.return_value = {"serviceids": ["1"]}
    result = mgr.update_service("1", name="Updated")
    assert result is True


# ── get_sla_report ────────────────────────────────────────────────────────────


def test_get_sla_report_returns_list(mgr):
    mgr.zapi.sla.getsli.return_value = [
        {
            "slaid": "1",
            "sli": [{"period": {"dateFrom": 1700000000, "dateTo": 1700086400}, "sli": 99.9}],
        }
    ]
    result = mgr.get_sla_report("1")
    assert isinstance(result, list)


def test_get_sla_report_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_sla_report("1")
    assert result == []


def test_get_sla_report_error_returns_empty(mgr):
    mgr.zapi.sla.getsli.side_effect = Exception("sla not supported")
    result = mgr.get_sla_report("1")
    assert result == []


# ── create_sla ────────────────────────────────────────────────────────────────


def test_create_sla_returns_id(mgr):
    mgr.zapi.sla.create.return_value = {"slaids": ["42"]}
    result = mgr.create_sla(name="99.9 SLA", slo=99.9, period="PERIOD_MONTHLY")
    assert result == "42"


def test_create_sla_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.create_sla(name="X", slo=99.0, period="PERIOD_MONTHLY")


# ── add_health_monitor ────────────────────────────────────────────────────────


def test_add_health_monitor_success(mgr):
    mgr.zapi.item.get.return_value = []
    mgr.zapi.item.create.return_value = {"itemids": ["55"]}
    result = mgr.add_health_monitor("10", "Web check", "http://example.com")
    assert result["itemid"] == "55"


def test_add_health_monitor_duplicate_raises(mgr):
    mgr.zapi.item.get.return_value = [{"itemid": "1"}]
    with pytest.raises(RuntimeError, match="already exists"):
        mgr.add_health_monitor("10", "Web check", "http://example.com")


def test_add_health_monitor_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.add_health_monitor("10", "x", "http://x")


# ── list_health_monitors ──────────────────────────────────────────────────────


def test_list_health_monitors_returns_list(mgr):
    mgr.zapi.item.get.return_value = [
        {
            "itemid": "1",
            "name": "[HealthMon] Web check",
            "key_": "health.http[web_check]",
            "lastvalue": "ok",
            "lastclock": "1700000000",
            "state": "0",
            "description": '{"health_monitor": true, "expected": "ok", "url": "http://x"}',
            "hostid": "10",
            "hosts": [{"hostid": "10", "host": "srv01"}],
        }
    ]
    result = mgr.list_health_monitors()
    assert isinstance(result, list)
    assert result[0]["name"] == "Web check"


def test_list_health_monitors_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_health_monitors()
    assert result == []


# ── delete_health_monitor ─────────────────────────────────────────────────────


def test_delete_health_monitor_success(mgr):
    mgr.zapi.item.get.return_value = [
        {
            "itemid": "1",
            "description": '{"health_monitor": true, "proc_itemid": null, "proc_created": false}',
        }
    ]
    result = mgr.delete_health_monitor("1")
    assert result is True


def test_delete_health_monitor_not_found_raises(mgr):
    mgr.zapi.item.get.return_value = []
    with pytest.raises(RuntimeError, match="not found"):
        mgr.delete_health_monitor("999")


def test_delete_health_monitor_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.delete_health_monitor("1")
