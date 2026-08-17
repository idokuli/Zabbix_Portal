"""Tests for Audit_Log.py — all DB calls are mocked via get_conn."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def mc():
    """Returns (conn, cursor). Cursor is what `with conn.cursor() as cur:` yields."""
    cur = MagicMock()
    conn = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cur)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return conn, cur


def _patch(conn):
    return patch("Audit_Log.get_conn", return_value=conn)


def test_record_action_ok(mc):
    import Audit_Log

    conn, cur = mc
    with _patch(conn):
        Audit_Log.record_action(
            user_id=1,
            username="jsmith",
            method="POST",
            path="/items",
            action="create",
            status_code=201,
            ip="127.0.0.1",
        )
    cur.execute.assert_called_once()
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_record_action_db_error_is_swallowed(mc):
    import Audit_Log

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        Audit_Log.record_action(
            user_id=1,
            username="jsmith",
            method="DELETE",
            path="/triggers/5",
            action="delete",
            status_code=403,
            ip="127.0.0.1",
        )
    conn.rollback.assert_called_once()
    conn.close.assert_called_once()


def test_list_actions_ok(mc):
    import Audit_Log

    conn, cur = mc
    cur.fetchall.return_value = [
        {
            "id": 1,
            "user_id": 1,
            "username": "jsmith",
            "method": "POST",
            "path": "/items",
            "action": "create",
            "status_code": 201,
            "ip": "127.0.0.1",
            "clock": 1700000000,
        }
    ]
    with _patch(conn):
        result = Audit_Log.list_actions(limit=200, hours=24)
    assert len(result) == 1
    assert result[0]["username"] == "jsmith"
    conn.close.assert_called_once()


def test_list_actions_error_returns_empty(mc):
    import Audit_Log

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = Audit_Log.list_actions()
    assert result == []
    conn.close.assert_called_once()
