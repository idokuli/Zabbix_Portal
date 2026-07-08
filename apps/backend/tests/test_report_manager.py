"""Tests for Report_Manager.py."""

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
        from Report_Manager import Report_Manager

        m = Report_Manager()
        m.zapi = MagicMock()
        return m


def test_get_top_triggers_returns_list(mgr):
    mgr.zapi.trigger.get.return_value = [
        {
            "triggerid": "1",
            "description": "CPU > 90%",
            "priority": "4",
            "lastchange": "1700000000",
            "status": "0",
            "value": "1",
            "hosts": [{"hostid": "5", "host": "srv01", "name": "srv01"}],
        }
    ]
    result = mgr.get_top_triggers()
    assert isinstance(result, list)
    assert result[0]["triggerid"] == "1"


def test_get_top_triggers_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_top_triggers()
    assert result == []


def test_get_audit_log_returns_list(mgr):
    mgr.zapi.auditlog.get.return_value = [
        {
            "auditid": "1",
            "userid": "2",
            "username": "admin",
            "clock": "1700000000",
            "action": "1",
            "resourcetype": "0",
            "resourcename": "testuser",
            "ip": "127.0.0.1",
            "details": "",
        }
    ]
    result = mgr.get_audit_log()
    assert isinstance(result, list)
    assert result[0]["auditid"] == "1"


def test_get_audit_log_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_audit_log()
    assert result == []


def test_get_action_log_returns_list(mgr):
    mgr.zapi.alert.get.return_value = [
        {
            "alertid": "1",
            "actionid": "2",
            "clock": "1700000000",
            "message": "Sent OK",
            "retries": "0",
            "status": "1",
            "error": "",
            "mediatypeid": "1",
            "userid": "1",
            "sendto": "ops@example.com",
            "subject": "Problem",
        }
    ]
    mgr.zapi.action.get.return_value = [{"actionid": "2", "name": "Notify"}]
    result = mgr.get_action_log()
    assert isinstance(result, list)


def test_get_action_log_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_action_log()
    assert result == []


def test_get_notification_history_returns_list(mgr):
    mgr.zapi.alert.get.return_value = [
        {
            "alertid": "1",
            "clock": "1700000000",
            "status": "1",
            "retries": "0",
            "error": "",
            "sendto": "ops@example.com",
            "subject": "Problem: CPU",
            "message": "Server srv01 CPU > 90%",
            "mediatypeid": "1",
            "userid": "1",
        }
    ]
    mgr.zapi.mediatype.get.return_value = [{"mediatypeid": "1", "name": "Email"}]
    result = mgr.get_notification_history()
    assert isinstance(result, list)


def test_get_notification_history_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_notification_history()
    assert result == []


def test_get_availability_returns_list(mgr):
    mgr.zapi.hostgroup.get.return_value = [{"groupid": "1", "name": "Linux"}]
    mgr.zapi.host.get.return_value = [
        {"hostid": "1", "host": "srv01", "available": "1", "error": ""}
    ]
    result = mgr.get_availability()
    assert isinstance(result, list)


def test_get_availability_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_availability()
    assert result == []
