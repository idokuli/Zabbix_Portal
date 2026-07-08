"""Tests for Database.py — all psycopg2 calls are mocked."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from unittest.mock import MagicMock, patch

import pytest


# ── _PooledConn ───────────────────────────────────────────────────────────────


def test_pooled_conn_close_returns_to_pool():
    import Database

    raw = MagicMock()
    raw.closed = False
    pool = MagicMock()
    pc = Database._PooledConn(raw, pool)
    pc.close()
    raw.rollback.assert_called_once()
    pool.putconn.assert_called_once_with(raw)


def test_pooled_conn_close_skips_rollback_when_already_closed():
    import Database

    raw = MagicMock()
    raw.closed = True
    pool = MagicMock()
    pc = Database._PooledConn(raw, pool)
    pc.close()
    raw.rollback.assert_not_called()
    pool.putconn.assert_called_once_with(raw)


def test_pooled_conn_close_handles_rollback_error():
    import Database

    raw = MagicMock()
    raw.closed = False
    raw.rollback.side_effect = Exception("rollback failed")
    pool = MagicMock()
    pc = Database._PooledConn(raw, pool)
    pc.close()  # must not raise
    pool.putconn.assert_called_once_with(raw)


def test_pooled_conn_getattr_delegates_to_raw():
    import Database

    raw = MagicMock()
    raw.some_attr = "value"
    pool = MagicMock()
    pc = Database._PooledConn(raw, pool)
    assert pc.some_attr == "value"


# ── get_conn ──────────────────────────────────────────────────────────────────


def test_get_conn_raises_when_pool_none():
    import Database

    original = Database._pool
    try:
        Database._pool = None
        with pytest.raises(RuntimeError, match="pool not initialised"):
            Database.get_conn()
    finally:
        Database._pool = original


def test_get_conn_returns_pooled_conn():
    import Database

    mock_pool = MagicMock()
    mock_raw = MagicMock()
    mock_pool.getconn.return_value = mock_raw

    original = Database._pool
    try:
        Database._pool = mock_pool
        conn = Database.get_conn()
        assert isinstance(conn, Database._PooledConn)
        assert conn._conn is mock_raw
    finally:
        Database._pool = original


# ── get_setting ───────────────────────────────────────────────────────────────


@pytest.fixture
def mock_conn_fixture():
    """Returns (conn_mock, cursor_mock). Cursor is the value yielded by `with conn.cursor()`."""
    cur = MagicMock()
    conn = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cur)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return conn, cur


def test_get_setting_returns_value(mock_conn_fixture):
    import Database

    conn, cur = mock_conn_fixture
    cur.fetchone.return_value = {"value": "42069"}
    with patch("Database.get_conn", return_value=conn):
        result = Database.get_setting("REFRESH_INTERVAL")
    assert result == "42069"
    conn.close.assert_called_once()


def test_get_setting_returns_none_when_missing(mock_conn_fixture):
    import Database

    conn, cur = mock_conn_fixture
    cur.fetchone.return_value = None
    with patch("Database.get_conn", return_value=conn):
        result = Database.get_setting("MISSING_KEY")
    assert result is None
    conn.close.assert_called_once()


# ── set_setting ───────────────────────────────────────────────────────────────


def test_set_setting_commits(mock_conn_fixture):
    import Database

    conn, cur = mock_conn_fixture
    with patch("Database.get_conn", return_value=conn):
        Database.set_setting("MY_KEY", "hello")
    conn.commit.assert_called_once()
    conn.close.assert_called_once()
    assert cur.execute.called


def test_set_setting_passes_key_and_value(mock_conn_fixture):
    import Database

    conn, cur = mock_conn_fixture
    with patch("Database.get_conn", return_value=conn):
        Database.set_setting("FOO", "bar")
    call_args = cur.execute.call_args
    assert "FOO" in call_args[0][1]
    assert "bar" in call_args[0][1]


# ── install_notify_triggers ───────────────────────────────────────────────────


def test_install_notify_triggers_commits(mock_conn_fixture):
    import Database

    conn, cur = mock_conn_fixture
    with patch("Database.get_conn", return_value=conn):
        Database.install_notify_triggers()
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_install_notify_triggers_handles_exception(mock_conn_fixture):
    import Database

    conn, cur = mock_conn_fixture
    cur.execute.side_effect = Exception("pg error")
    with patch("Database.get_conn", return_value=conn):
        # Should not raise — logs a warning and rolls back
        Database.install_notify_triggers()
    conn.rollback.assert_called()
    conn.close.assert_called_once()


# ── init_db ───────────────────────────────────────────────────────────────────


def test_init_db_creates_pool_and_commits(mock_conn_fixture):
    import Database

    conn, cur = mock_conn_fixture
    mock_pool = MagicMock()

    original = Database._pool
    try:
        with (
            patch(
                "Database.psycopg2.pool.ThreadedConnectionPool", return_value=mock_pool
            ),
            patch("Database.get_conn", return_value=conn),
        ):
            Database.init_db()
        conn.commit.assert_called_once()
        conn.close.assert_called_once()
    finally:
        Database._pool = original


def test_init_db_rolls_back_on_error(mock_conn_fixture):
    import Database

    conn, cur = mock_conn_fixture
    cur.execute.side_effect = Exception("schema error")
    mock_pool = MagicMock()

    original = Database._pool
    try:
        with (
            patch(
                "Database.psycopg2.pool.ThreadedConnectionPool", return_value=mock_pool
            ),
            patch("Database.get_conn", return_value=conn),
        ):
            with pytest.raises(Exception, match="schema error"):
                Database.init_db()
        conn.rollback.assert_called_once()
        conn.close.assert_called_once()
    finally:
        Database._pool = original
