"""Extended Alert_Manager tests — update_rule and run_checks coverage."""

import os
import time

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://fake-zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

from unittest.mock import MagicMock, patch

import pytest


def _make_conn(rows=None, rowcount=1, fetchone=None):
    conn = MagicMock()
    cur = MagicMock()
    cur.fetchall.return_value = rows or []
    cur.fetchone.return_value = fetchone
    cur.rowcount = rowcount
    cur.__enter__ = lambda s: cur
    cur.__exit__ = MagicMock(return_value=False)
    conn.cursor.return_value = cur
    return conn, cur


@pytest.fixture()
def mgr():
    with patch("zabbix_utils.ZabbixAPI"):
        from Alert_Manager import Alert_Manager

        m = Alert_Manager()
        m.zapi = MagicMock()
        return m


# ── update_rule ────────────────────────────────────────────────────────────────


def test_update_rule_service_type(mgr):
    conn, cur = _make_conn(fetchone={"rule_type": "service"}, rowcount=1)
    with patch("Alert_Manager.get_conn", return_value=conn):
        result = mgr.update_rule(rule_id=1, user_id=1, severity=3, expected_contains="ok")
    assert result is True


def test_update_rule_item_type_full(mgr):
    conn, cur = _make_conn(fetchone={"rule_type": "item"}, rowcount=1)
    with patch("Alert_Manager.get_conn", return_value=conn):
        result = mgr.update_rule(
            rule_id=1,
            user_id=1,
            severity=3,
            operator=">",
            threshold=90.0,
            item_id="42",
            item_name="CPU",
            hostname="srv01",
        )
    assert result is True


def test_update_rule_item_partial(mgr):
    conn, cur = _make_conn(fetchone={"rule_type": "item"}, rowcount=1)
    with patch("Alert_Manager.get_conn", return_value=conn):
        result = mgr.update_rule(rule_id=1, user_id=1, severity=2)
    assert result is True


def test_update_rule_not_found(mgr):
    conn, cur = _make_conn(fetchone=None, rowcount=0)
    with patch("Alert_Manager.get_conn", return_value=conn):
        result = mgr.update_rule(rule_id=99, user_id=1, severity=1)
    assert result is False


def test_update_rule_db_error_raises(mgr):
    conn = MagicMock()
    conn.cursor.side_effect = Exception("db error")
    with (
        patch("Alert_Manager.get_conn", return_value=conn),
        pytest.raises(Exception, match="db error"),
    ):
        mgr.update_rule(rule_id=1, user_id=1, severity=1)


# ── run_checks — item rules ────────────────────────────────────────────────────


def _rule(
    rule_id=1,
    rule_type="item",
    item_id="10",
    op=">",
    threshold=90.0,
    is_firing=False,
    expected_contains="ok",
):
    return {
        "id": rule_id,
        "user_id": 1,
        "rule_type": rule_type,
        "item_id": item_id,
        "item_name": "CPU",
        "hostname": "srv01",
        "operator": op,
        "threshold": threshold,
        "severity": 3,
        "is_firing": is_firing,
        "expected_contains": expected_contains,
    }


def _item(item_id="10", value="95.0", value_type="0"):
    return {"itemid": item_id, "lastvalue": value, "value_type": value_type}


def test_run_checks_no_rules_early_exit(mgr):
    conn, cur = _make_conn(rows=[])
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()
    # No commit needed if no rules
    conn.commit.assert_not_called()


def test_run_checks_zapi_none(mgr):
    mgr.zapi = None
    conn, cur = _make_conn(rows=[_rule()])
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()
    # Returns immediately without touching DB for checks
    conn.cursor.assert_not_called()


def test_run_checks_item_fires_when_above_threshold(mgr):
    rules = [_rule(rule_id=1, item_id="10", op=">", threshold=90.0, is_firing=False)]
    mgr.zapi.item.get.return_value = [_item("10", "95.0", "0")]

    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()

    # Should INSERT an alert_event and UPDATE rule is_firing = TRUE
    assert cur.execute.call_count >= 3  # SELECT + INSERT + UPDATE


def test_run_checks_item_already_firing_no_double_insert(mgr):
    rules = [_rule(rule_id=1, item_id="10", op=">", threshold=90.0, is_firing=True)]
    mgr.zapi.item.get.return_value = [_item("10", "95.0", "0")]

    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()

    # No INSERT for already-firing rule — just the initial SELECT
    execute_calls = [str(c) for c in cur.execute.call_args_list]
    assert not any("INSERT INTO alert_events" in c for c in execute_calls)


def test_run_checks_item_clears_firing_when_below_threshold(mgr):
    rules = [_rule(rule_id=1, item_id="10", op=">", threshold=90.0, is_firing=True)]
    mgr.zapi.item.get.return_value = [_item("10", "50.0", "0")]

    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()

    execute_calls = [str(c) for c in cur.execute.call_args_list]
    assert any("is_firing = FALSE" in c for c in execute_calls)


def test_run_checks_item_contains_operator_fires(mgr):
    rules = [
        _rule(
            rule_id=1,
            item_id="10",
            op="contains",
            threshold=None,
            is_firing=False,
            expected_contains="error",
        )
    ]
    mgr.zapi.item.get.return_value = [
        {"itemid": "10", "lastvalue": "error: disk full", "value_type": "1"}
    ]

    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()

    execute_calls = [str(c) for c in cur.execute.call_args_list]
    assert any("INSERT INTO alert_events" in c for c in execute_calls)


def test_run_checks_item_not_contains_operator(mgr):
    rules = [
        _rule(
            rule_id=1,
            item_id="10",
            op="!contains",
            threshold=None,
            is_firing=False,
            expected_contains="ok",
        )
    ]
    mgr.zapi.item.get.return_value = [{"itemid": "10", "lastvalue": "error", "value_type": "1"}]

    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()

    execute_calls = [str(c) for c in cur.execute.call_args_list]
    assert any("INSERT INTO alert_events" in c for c in execute_calls)


def test_run_checks_item_less_than_operator(mgr):
    rules = [_rule(rule_id=1, item_id="10", op="<", threshold=10.0, is_firing=False)]
    mgr.zapi.item.get.return_value = [_item("10", "5.0", "0")]

    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()

    execute_calls = [str(c) for c in cur.execute.call_args_list]
    assert any("INSERT INTO alert_events" in c for c in execute_calls)


def test_run_checks_item_fetch_fails_gracefully(mgr):
    rules = [_rule(rule_id=1, item_id="10", op=">", threshold=90.0, is_firing=False)]
    mgr.zapi.item.get.side_effect = Exception("zabbix down")

    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()
    # Should not raise; just logs and proceeds with empty value_map


def test_run_checks_item_non_numeric_value_skipped(mgr):
    rules = [_rule(rule_id=1, item_id="10", op=">", threshold=90.0, is_firing=False)]
    mgr.zapi.item.get.return_value = [_item("10", "not-a-number", "0")]

    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()

    execute_calls = [str(c) for c in cur.execute.call_args_list]
    assert not any("INSERT INTO alert_events" in c for c in execute_calls)


def test_run_checks_item_gte_lte_operators(mgr):
    rules = [
        _rule(rule_id=1, item_id="10", op=">=", threshold=90.0, is_firing=False),
        _rule(rule_id=2, item_id="11", op="<=", threshold=10.0, is_firing=False),
    ]
    mgr.zapi.item.get.return_value = [
        _item("10", "90.0", "0"),
        _item("11", "5.0", "0"),
    ]

    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()

    execute_calls = [str(c) for c in cur.execute.call_args_list]
    assert any("INSERT INTO alert_events" in c for c in execute_calls)


# ── run_checks — service rules ─────────────────────────────────────────────────


def test_run_checks_service_fires_when_stale(mgr):
    rules = [
        _rule(
            rule_id=1,
            rule_type="service",
            item_id="20",
            op="contains",
            is_firing=False,
            expected_contains="ok",
        )
    ]
    mgr.zapi.item.get.return_value = [
        {
            "itemid": "20",
            "lastvalue": "ok",
            "lastclock": "0",  # stale: never updated
            "state": "0",
        }
    ]

    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()

    execute_calls = [str(c) for c in cur.execute.call_args_list]
    assert any("INSERT INTO alert_events" in c for c in execute_calls)


def test_run_checks_service_ok_clears_firing(mgr):
    rules = [
        _rule(
            rule_id=1,
            rule_type="service",
            item_id="20",
            is_firing=True,
            expected_contains="ok",
        )
    ]
    now_ts = int(time.time())
    mgr.zapi.item.get.return_value = [
        {
            "itemid": "20",
            "lastvalue": "ok",
            "lastclock": str(now_ts),
            "state": "0",
        }
    ]

    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()

    execute_calls = [str(c) for c in cur.execute.call_args_list]
    assert any("is_firing = FALSE" in c for c in execute_calls)


def test_run_checks_service_item_fetch_fails(mgr):
    rules = [_rule(rule_id=1, rule_type="service", item_id="20", is_firing=False)]
    # First call for item rules returns [], second for service rules raises
    call_count = {"n": 0}

    def side_effect(**kwargs):
        call_count["n"] += 1
        if call_count["n"] == 2:
            raise Exception("Zabbix gone")
        return []

    mgr.zapi.item.get.side_effect = side_effect
    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()
    # Should not crash


def test_run_checks_db_commit_error_handled(mgr):
    rules = [_rule(rule_id=1, item_id="10", op=">", threshold=90.0, is_firing=False)]
    mgr.zapi.item.get.return_value = [_item("10", "95.0", "0")]

    conn, cur = _make_conn(rows=rules)
    conn.commit.side_effect = Exception("commit failed")
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()
    conn.rollback.assert_called()


def test_run_checks_duplicate_item_id_only_fires_once(mgr):
    # Two rules for the same item_id — only first should insert
    rules = [
        _rule(rule_id=1, item_id="10", op=">", threshold=90.0, is_firing=False),
        _rule(rule_id=2, item_id="10", op=">", threshold=80.0, is_firing=False),
    ]
    mgr.zapi.item.get.return_value = [_item("10", "95.0", "0")]

    conn, cur = _make_conn(rows=rules)
    with patch("Alert_Manager.get_conn", return_value=conn):
        mgr.run_checks()

    insert_calls = [c for c in cur.execute.call_args_list if "INSERT INTO alert_events" in str(c)]
    assert len(insert_calls) == 1
