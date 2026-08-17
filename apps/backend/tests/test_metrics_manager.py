"""Tests for Metrics_Manager.py."""

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
        from Metrics_Manager import MetricsManager

        m = MetricsManager()
        m.zapi = MagicMock()
        m._cache = {}
        return m


def test_get_problems_returns_list(mgr):
    mgr.zapi.problem.get.return_value = [
        {
            "eventid": "1",
            "objectid": "10",
            "severity": "3",
            "name": "High load",
            "clock": "1700000000",
            "acknowledged": "0",
        }
    ]
    mgr.zapi.trigger.get.return_value = [
        {"triggerid": "10", "hosts": [{"host": "web01", "hostid": "5"}]}
    ]
    mgr.zapi.host.get.return_value = [{"hostid": "5", "hostgroups": [{"name": "Linux"}]}]
    result = mgr.get_problems()
    assert isinstance(result, list)
    assert result[0]["hostname"] == "web01"
    assert result[0]["severity"] == 3


def test_get_problems_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_problems()
    assert result == []


def test_get_problems_empty(mgr):
    mgr.zapi.problem.get.return_value = []
    result = mgr.get_problems()
    assert result == []


def test_acknowledge_problem(mgr):
    mgr.zapi.event.acknowledge.return_value = {"eventids": ["1"]}
    result = mgr.acknowledge_problem("1", "Acknowledged by test")
    assert result is True


def test_acknowledge_problem_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.acknowledge_problem("1", "msg")
    assert result is False


def test_unacknowledge_problem(mgr):
    mgr.zapi.event.acknowledge.return_value = {"eventids": ["1"]}
    result = mgr.unacknowledge_problem("1", "test", "reopening")
    assert result is True
    _, kwargs = mgr.zapi.event.acknowledge.call_args
    assert kwargs["action"] == 20
    assert "reopening" in kwargs["message"]


def test_unacknowledge_problem_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.unacknowledge_problem("1", "test")
    assert result is False


def test_get_item_history_returns_dict(mgr):
    mgr.zapi.item.get.return_value = [
        {
            "itemid": "42",
            "value_type": "0",
            "name": "CPU",
            "units": "%",
            "hosts": [{"host": "srv01"}],
        }
    ]
    mgr.zapi.history.get.return_value = [
        {"clock": "1700000000", "value": "75.5"},
        {"clock": "1700000060", "value": "80.0"},
    ]
    result = mgr.get_item_history("42", minutes=60)
    assert "history" in result


def test_get_item_history_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_item_history("42")
    assert result == {"history": [], "item_name": "", "units": ""}


def test_get_problem_history_returns_list(mgr):
    mgr.zapi.event.get.return_value = [
        {
            "eventid": "1",
            "name": "Test problem",
            "severity": "3",
            "clock": "1700000000",
            "r_eventid": "2",
            "hosts": [{"host": "srv01"}],
        }
    ]
    result = mgr.get_problem_history()
    assert isinstance(result, list)


def test_get_problem_history_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_problem_history()
    assert result == []


def test_get_problem_history_with_resolution(mgr):
    """Tests the recovery_clock path when r_eventid is non-zero."""
    mgr.zapi.event.get.return_value = [
        {
            "eventid": "1",
            "objectid": "10",
            "name": "High load",
            "severity": "3",
            "clock": "1700000000",
            "r_eventid": "2",
            "acknowledged": "0",
            "acknowledges": [],
            "hosts": [{"host": "srv01"}],
        }
    ]
    mgr.zapi.trigger.get.return_value = [{"triggerid": "10", "hosts": [{"host": "srv01"}]}]
    # recovery event
    mgr.zapi.event.get.side_effect = None
    call_count = 0

    def _event_get(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [
                {
                    "eventid": "1",
                    "objectid": "10",
                    "name": "High load",
                    "severity": "3",
                    "clock": "1700000000",
                    "r_eventid": "2",
                    "acknowledged": "0",
                    "acknowledges": [],
                }
            ]
        return [{"eventid": "2", "clock": "1700003600"}]

    mgr.zapi.event.get.side_effect = _event_get
    mgr.zapi.trigger.get.return_value = [{"triggerid": "10", "hosts": [{"host": "srv01"}]}]
    result = mgr.get_problem_history()
    assert isinstance(result, list)


def test_get_problem_history_with_acks(mgr):
    """Tests acknowledgement user enrichment path."""
    mgr.zapi.event.get.return_value = [
        {
            "eventid": "1",
            "objectid": "10",
            "name": "High load",
            "severity": "3",
            "clock": "1700000000",
            "r_eventid": "0",
            "acknowledged": "1",
            "acknowledges": [{"userid": "5", "message": "Looking into it", "clock": "1700001000"}],
        }
    ]
    mgr.zapi.trigger.get.return_value = [{"triggerid": "10", "hosts": [{"host": "srv01"}]}]
    mgr.zapi.user.get.return_value = [{"userid": "5", "username": "jsmith"}]
    result = mgr.get_problem_history()
    assert isinstance(result, list)
    if result:
        assert result[0]["ack_user"] == "jsmith"


def test_get_problem_history_hostname_filter(mgr):
    mgr.zapi.event.get.return_value = [
        {
            "eventid": "1",
            "objectid": "10",
            "name": "Alert",
            "severity": "3",
            "clock": "1700000000",
            "r_eventid": "0",
            "acknowledged": "0",
            "acknowledges": [],
        }
    ]
    mgr.zapi.trigger.get.return_value = [{"triggerid": "10", "hosts": [{"host": "db01"}]}]
    # Only srv01 allowed; db01 should be filtered out
    result = mgr.get_problem_history(hostname_filter={"srv01"})
    assert result == []


def test_get_problem_history_severity_filter(mgr):
    mgr.zapi.event.get.return_value = [
        {
            "eventid": "1",
            "objectid": "10",
            "name": "Alert",
            "severity": "1",  # information
            "clock": "1700000000",
            "r_eventid": "0",
            "acknowledged": "0",
            "acknowledges": [],
        }
    ]
    mgr.zapi.trigger.get.return_value = [{"triggerid": "10", "hosts": [{"host": "srv01"}]}]
    # Require severity >= 3
    result = mgr.get_problem_history(severity_min=3)
    assert result == []


def test_get_problem_history_no_hosts(mgr):
    """Events whose trigger has no hosts are skipped."""
    mgr.zapi.event.get.return_value = [
        {
            "eventid": "1",
            "objectid": "10",
            "name": "Alert",
            "severity": "3",
            "clock": "1700000000",
            "r_eventid": "0",
            "acknowledged": "0",
            "acknowledges": [],
        }
    ]
    mgr.zapi.trigger.get.return_value = [
        {"triggerid": "10", "hosts": []}  # no hosts
    ]
    result = mgr.get_problem_history()
    assert result == []


def test_get_item_history_item_not_found(mgr):
    mgr.zapi.item.get.return_value = []
    result = mgr.get_item_history("99")
    assert result["history"] == []
    assert result["item_name"] == ""


def test_get_item_history_non_numeric_type(mgr):
    """Text items (value_type=1) should return empty history."""
    mgr.zapi.item.get.return_value = [
        {
            "itemid": "1",
            "name": "Status",
            "value_type": "1",
            "units": "",
            "hosts": [{"host": "srv01"}],
        }
    ]
    result = mgr.get_item_history("1")
    assert result["history"] == []
    assert result["item_name"] == "Status"


def test_get_item_history_long_period_uses_trends(mgr):
    """Minutes > 1440 should use trend.get."""
    mgr.zapi.item.get.return_value = [
        {
            "itemid": "1",
            "name": "CPU",
            "value_type": "0",
            "units": "%",
            "hosts": [{"host": "srv01"}],
        }
    ]
    mgr.zapi.trend.get.return_value = [
        {"clock": "1700000000", "value_avg": "55.0"},
    ]
    result = mgr.get_item_history("1", minutes=2880)
    assert len(result["history"]) == 1
    assert result["history"][0]["value"] == 55.0
    mgr.zapi.trend.get.assert_called_once()


def test_get_item_history_error(mgr):
    mgr.zapi.item.get.side_effect = Exception("db error")
    result = mgr.get_item_history("1")
    assert result["history"] == []
