"""Tests for Alert_Manager.py — DB operations mocked via patch."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://fake-zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

from unittest.mock import MagicMock, patch

import pytest


def _make_mock_conn(rows=None, rowcount=1, lastrow=None):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_cur.fetchall.return_value = rows or []
    mock_cur.fetchone.return_value = lastrow or {"id": 1}
    mock_cur.rowcount = rowcount
    mock_cur.__enter__ = lambda s: mock_cur
    mock_cur.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value = mock_cur
    mock_conn.__enter__ = lambda s: mock_conn
    mock_conn.__exit__ = MagicMock(return_value=False)
    return mock_conn, mock_cur


@pytest.fixture()
def mgr():
    with patch("zabbix_utils.ZabbixAPI"):
        from Alert_Manager import AlertManager

        m = AlertManager()
        m.zapi = MagicMock()
        return m


def test_get_rules_returns_list(mgr):
    row = {
        "id": 1,
        "rule_type": "item",
        "item_id": "42",
        "item_name": "CPU",
        "hostname": "srv01",
        "operator": ">",
        "threshold": 90.0,
        "severity": 3,
        "enabled": True,
        "is_firing": False,
        "created_at": "2025-01-01",
        "expected_contains": "ok",
    }
    mock_conn, mock_cur = _make_mock_conn(rows=[row])
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        result = mgr.get_rules(user_id=1)
    assert isinstance(result, list)


def test_get_rules_db_error_returns_empty(mgr):
    mock_conn = MagicMock()
    mock_conn.cursor.side_effect = Exception("db error")
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        result = mgr.get_rules(user_id=1)
    assert result == []


def test_create_rule_returns_id(mgr):
    mock_conn, mock_cur = _make_mock_conn(lastrow={"id": 7})
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        result = mgr.create_rule(
            user_id=1,
            item_id="42",
            item_name="CPU",
            hostname="srv01",
            operator=">",
            threshold=90.0,
            severity=3,
        )
    assert result["id"] == 7


def test_delete_rule_true(mgr):
    mock_conn, mock_cur = _make_mock_conn(rowcount=1)
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        result = mgr.delete_rule(rule_id=1, user_id=1)
    assert result is True


def test_delete_rule_not_found(mgr):
    mock_conn, mock_cur = _make_mock_conn(rowcount=0)
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        result = mgr.delete_rule(rule_id=99, user_id=1)
    assert result is False


def test_toggle_rule_returns_value(mgr):
    row = {
        "id": 1,
        "rule_type": "item",
        "item_id": "42",
        "item_name": "CPU",
        "hostname": "srv01",
        "operator": ">",
        "threshold": 90.0,
        "severity": 3,
        "enabled": False,
        "is_firing": False,
        "created_at": "2025-01-01",
        "expected_contains": "ok",
    }
    mock_conn, mock_cur = _make_mock_conn(rows=[row], lastrow={"enabled": True})
    mock_cur.fetchone.return_value = {"enabled": True}
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        result = mgr.toggle_rule(rule_id=1, user_id=1)
    assert result is not None


def test_get_events_returns_list(mgr):
    mock_conn, mock_cur = _make_mock_conn(
        rows=[
            {
                "id": 1,
                "rule_id": 1,
                "fired_at": "2025-01-01",
                "resolved_at": None,
                "value": "95.0",
                "item_name": "CPU",
                "hostname": "srv01",
                "severity": 3,
            }
        ]
    )
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        result = mgr.get_events(user_id=1)
    assert isinstance(result, list)


def test_get_events_error_returns_empty(mgr):
    mock_conn = MagicMock()
    mock_conn.cursor.side_effect = Exception("db error")
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        result = mgr.get_events(user_id=1)
    assert result == []


def test_update_rule_item_type(mgr):
    mock_conn, mock_cur = _make_mock_conn(lastrow={"rule_type": "item"})
    # First fetchone returns rule_type, second would be the rowcount
    mock_cur.fetchone.side_effect = [{"rule_type": "item"}, None]
    mock_cur.rowcount = 1
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        result = mgr.update_rule(
            rule_id=1,
            user_id=1,
            severity=4,
            operator=">",
            threshold=95.0,
            item_id="42",
            item_name="CPU",
            hostname="srv01",
        )
    assert result is True


def test_update_rule_service_type(mgr):
    mock_conn, mock_cur = _make_mock_conn(lastrow={"rule_type": "service"})
    mock_cur.fetchone.side_effect = [{"rule_type": "service"}, None]
    mock_cur.rowcount = 1
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        result = mgr.update_rule(rule_id=1, user_id=1, severity=3, expected_contains="ok")
    assert result is True


def test_update_rule_not_found(mgr):
    mock_conn, mock_cur = _make_mock_conn()
    mock_cur.fetchone.return_value = None
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        result = mgr.update_rule(rule_id=99, user_id=1, severity=3)
    assert result is False


def test_update_rule_partial_params(mgr):
    mock_conn, mock_cur = _make_mock_conn()
    mock_cur.fetchone.side_effect = [{"rule_type": "item"}, None]
    mock_cur.rowcount = 1
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        # Only severity provided — falls back to COALESCE update
        result = mgr.update_rule(rule_id=1, user_id=1, severity=5)
    assert result is True


def test_create_rule_db_error_raises(mgr):
    mock_conn = MagicMock()
    mock_conn.cursor.side_effect = Exception("constraint error")
    with (
        patch("Alert_Manager.get_conn", return_value=mock_conn),
        pytest.raises(Exception, match="constraint error"),
    ):
        mgr.create_rule(
            user_id=1,
            item_id="42",
            item_name="CPU",
            hostname="srv01",
            operator=">",
            threshold=90.0,
            severity=3,
        )


def test_delete_rule_raises_on_error(mgr):
    mock_conn = MagicMock()
    mock_conn.cursor.side_effect = Exception("db error")
    with (
        patch("Alert_Manager.get_conn", return_value=mock_conn),
        pytest.raises(Exception, match="db error"),
    ):
        mgr.delete_rule(rule_id=1, user_id=1)


def test_run_checks_no_rules(mgr):
    mock_conn, mock_cur = _make_mock_conn(rows=[])
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        mgr.run_checks()  # Must not raise


def test_run_checks_item_rule_fires(mgr):
    rule_row = {
        "id": 1,
        "rule_type": "item",
        "item_id": "42",
        "item_name": "CPU",
        "hostname": "srv01",
        "operator": ">",
        "threshold": 90.0,
        "severity": 3,
        "enabled": True,
        "is_firing": False,
        "expected_contains": "ok",
        "user_id": 1,
    }
    mock_conn, mock_cur = _make_mock_conn(rows=[rule_row])
    # Simulate Zabbix returning a value that exceeds threshold
    mgr.zapi.item.get.return_value = [{"lastvalue": "95.5"}]
    mock_cur.fetchone.return_value = None  # no existing firing

    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        mgr.run_checks()
    # Should have called zapi.item.get
    mgr.zapi.item.get.assert_called()


def test_run_checks_zapi_none(mgr):
    mgr.zapi = None
    rule_row = {
        "id": 1,
        "rule_type": "item",
        "item_id": "42",
        "item_name": "CPU",
        "hostname": "srv01",
        "operator": ">",
        "threshold": 90.0,
        "severity": 3,
        "enabled": True,
        "is_firing": False,
        "expected_contains": "ok",
        "user_id": 1,
    }
    mock_conn, mock_cur = _make_mock_conn(rows=[rule_row])
    with patch("Alert_Manager.get_conn", return_value=mock_conn):
        mgr.run_checks()  # Must not raise even without zapi
