"""Tests for ldap_auth.py — all ldap3 calls are mocked."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from unittest.mock import MagicMock, patch

import pytest


# ── get_portal_ldap_config ─────────────────────────────────────────────────────


def test_get_portal_ldap_config_returns_dict():
    with patch(
        "Database.get_setting", return_value='{"host": "ldap.corp", "enabled": true}'
    ):
        from ldap_auth import get_portal_ldap_config

        result = get_portal_ldap_config()
    assert result["host"] == "ldap.corp"
    assert result["enabled"] is True


def test_get_portal_ldap_config_no_config():
    with patch("Database.get_setting", return_value=None):
        from ldap_auth import get_portal_ldap_config

        result = get_portal_ldap_config()
    assert result is None


def test_get_portal_ldap_config_invalid_json():
    with patch("Database.get_setting", return_value="not-json"):
        from ldap_auth import get_portal_ldap_config

        result = get_portal_ldap_config()
    assert result is None


# ── save_portal_ldap_config ────────────────────────────────────────────────────


def test_save_portal_ldap_config_calls_set_setting():
    with patch("Database.set_setting") as mock_set:
        from ldap_auth import save_portal_ldap_config

        save_portal_ldap_config({"host": "ldap.corp"})
    mock_set.assert_called_once()
    args = mock_set.call_args[0]
    assert args[0] == "portal_ldap_config"
    assert "ldap.corp" in args[1]


# ── is_ldap_enabled ────────────────────────────────────────────────────────────


def test_is_ldap_enabled_true():
    with patch("Database.get_setting", return_value='{"enabled": true, "host": "h"}'):
        from ldap_auth import is_ldap_enabled

        assert is_ldap_enabled() is True


def test_is_ldap_enabled_false_when_disabled():
    with patch("Database.get_setting", return_value='{"enabled": false}'):
        from ldap_auth import is_ldap_enabled

        assert is_ldap_enabled() is False


def test_is_ldap_enabled_false_when_no_config():
    with patch("Database.get_setting", return_value=None):
        from ldap_auth import is_ldap_enabled

        assert is_ldap_enabled() is False


# ── test_portal_ldap_connection ────────────────────────────────────────────────


def _ldap3_mock(bind_ok=True, last_error=""):
    ldap3 = MagicMock()
    ldap3.AUTO_BIND_NONE = "AUTO_BIND_NONE"
    ldap3.NONE = "NONE"
    conn = MagicMock()
    conn.bind.return_value = bind_ok
    conn.last_error = last_error
    ldap3.Server.return_value = MagicMock()
    ldap3.Connection.return_value = conn
    return ldap3, conn


def test_test_portal_ldap_connection_success():
    ldap3, conn = _ldap3_mock(bind_ok=True)
    with patch.dict("sys.modules", {"ldap3": ldap3}):
        from ldap_auth import test_portal_ldap_connection

        ok, msg = test_portal_ldap_connection(
            {"host": "ldap.corp", "port": 389, "use_ssl": False}
        )
    assert ok is True
    assert msg == "ok"


def test_test_portal_ldap_connection_bind_rejected():
    ldap3, conn = _ldap3_mock(bind_ok=False, last_error="Invalid credentials")
    with patch.dict("sys.modules", {"ldap3": ldap3}):
        from ldap_auth import test_portal_ldap_connection

        ok, msg = test_portal_ldap_connection({"host": "ldap.corp"})
    assert ok is False
    assert "Invalid credentials" in msg


def test_test_portal_ldap_connection_no_host():
    with patch.dict("sys.modules", {"ldap3": MagicMock()}):
        from ldap_auth import test_portal_ldap_connection

        ok, msg = test_portal_ldap_connection({"host": ""})
    assert ok is False
    assert "required" in msg


def test_test_portal_ldap_connection_exception():
    ldap3 = MagicMock()
    ldap3.NONE = "NONE"
    ldap3.AUTO_BIND_NONE = "AUTO_BIND_NONE"
    ldap3.Server.side_effect = Exception("connection refused")
    with patch.dict("sys.modules", {"ldap3": ldap3}):
        from ldap_auth import test_portal_ldap_connection

        ok, msg = test_portal_ldap_connection({"host": "bad.host"})
    assert ok is False
    assert "connection refused" in msg


def test_test_portal_ldap_connection_ldap3_missing():
    import sys

    saved = sys.modules.get("ldap3")
    sys.modules["ldap3"] = None  # causes ImportError on next `import ldap3`
    try:
        from ldap_auth import test_portal_ldap_connection

        ok, msg = test_portal_ldap_connection({"host": "h"})
        assert ok is False
        assert "not installed" in msg
    finally:
        if saved is not None:
            sys.modules["ldap3"] = saved
        else:
            del sys.modules["ldap3"]


# ── _do_ldap_auth ──────────────────────────────────────────────────────────────


def _make_ldap3_for_auth(
    service_bind=True,
    entries=None,
    user_bind=True,
    display_name="John Doe",
    cn="jdoe",
):
    ldap3 = MagicMock()
    ldap3.AUTO_BIND_NONE = "AUTO_BIND_NONE"
    ldap3.NONE = "NONE"

    server = MagicMock()
    ldap3.Server.return_value = server

    service_conn = MagicMock()
    service_conn.bind.return_value = service_bind
    service_conn.last_error = "mock error"

    if entries is None:
        entry = MagicMock()
        entry.entry_dn = "cn=jdoe,dc=corp,dc=com"
        entry.__getitem__ = lambda self, key: MagicMock(
            value=display_name if key == "displayName" else cn
        )
        service_conn.entries = [entry]
    else:
        service_conn.entries = entries

    user_conn = MagicMock()
    user_conn.bind.return_value = user_bind

    ldap3.Connection.side_effect = [service_conn, user_conn]
    return ldap3, service_conn, user_conn


def _cfg():
    return {
        "host": "ldap.corp",
        "base_dn": "dc=corp,dc=com",
        "port": 389,
        "use_ssl": False,
        "start_tls": False,
        "bind_dn": "cn=svc,dc=corp",
        "bind_password": "svcpass",
        "search_attribute": "sAMAccountName",
        "search_filter": "",
    }


def test_do_ldap_auth_success():
    ldap3, _, _ = _make_ldap3_for_auth(service_bind=True, user_bind=True)
    with patch.dict("sys.modules", {"ldap3": ldap3, "ldap3.utils.conv": MagicMock()}):
        ldap3.utils = MagicMock()
        ldap3.utils.conv.escape_filter_chars = lambda x: x
        from ldap_auth import _do_ldap_auth

        ok, display = _do_ldap_auth(_cfg(), "alice", "password")
    assert ok is True


def test_do_ldap_auth_wrong_password():
    ldap3, _, _ = _make_ldap3_for_auth(service_bind=True, user_bind=False)
    with patch.dict("sys.modules", {"ldap3": ldap3, "ldap3.utils.conv": MagicMock()}):
        ldap3.utils = MagicMock()
        ldap3.utils.conv.escape_filter_chars = lambda x: x
        from ldap_auth import _do_ldap_auth

        ok, display = _do_ldap_auth(_cfg(), "alice", "wrongpass")
    assert ok is False


def test_do_ldap_auth_user_not_found():
    ldap3, _, _ = _make_ldap3_for_auth(service_bind=True, entries=[])
    with patch.dict("sys.modules", {"ldap3": ldap3, "ldap3.utils.conv": MagicMock()}):
        ldap3.utils = MagicMock()
        ldap3.utils.conv.escape_filter_chars = lambda x: x
        from ldap_auth import _do_ldap_auth, LdapUserNotFound

        with pytest.raises(LdapUserNotFound):
            _do_ldap_auth(_cfg(), "ghost", "pass")


def test_do_ldap_auth_service_bind_fails():
    ldap3, _, _ = _make_ldap3_for_auth(service_bind=False)
    with patch.dict("sys.modules", {"ldap3": ldap3, "ldap3.utils.conv": MagicMock()}):
        ldap3.utils = MagicMock()
        ldap3.utils.conv.escape_filter_chars = lambda x: x
        from ldap_auth import _do_ldap_auth

        with pytest.raises(RuntimeError, match="service-account bind failed"):
            _do_ldap_auth(_cfg(), "alice", "pass")


def test_do_ldap_auth_no_host_raises():
    cfg = _cfg()
    cfg["host"] = ""
    with patch.dict(
        "sys.modules", {"ldap3": MagicMock(), "ldap3.utils.conv": MagicMock()}
    ):
        from ldap_auth import _do_ldap_auth

        with pytest.raises(RuntimeError, match="must be configured"):
            _do_ldap_auth(cfg, "alice", "pass")


def test_do_ldap_auth_custom_search_filter():
    ldap3, _, _ = _make_ldap3_for_auth(service_bind=True, user_bind=True)
    cfg = _cfg()
    cfg["search_filter"] = "(&(%(attr)s=%(user)s)(objectClass=person))"
    conv_mod = MagicMock()
    conv_mod.escape_filter_chars = lambda x: str(x)
    with patch.dict(
        "sys.modules",
        {"ldap3": ldap3, "ldap3.utils": MagicMock(), "ldap3.utils.conv": conv_mod},
    ):
        from ldap_auth import _do_ldap_auth

        ok, _ = _do_ldap_auth(cfg, "alice", "pass")
    assert ok is True


def test_do_ldap_auth_ldap3_not_installed():
    import sys

    saved = sys.modules.get("ldap3")
    saved_conv = sys.modules.get("ldap3.utils.conv")
    sys.modules["ldap3"] = None  # causes ImportError on next `import ldap3`
    sys.modules["ldap3.utils.conv"] = None
    try:
        from ldap_auth import _do_ldap_auth

        with pytest.raises(RuntimeError, match="not installed"):
            _do_ldap_auth(_cfg(), "alice", "pass")
    finally:
        if saved is not None:
            sys.modules["ldap3"] = saved
        elif "ldap3" in sys.modules:
            del sys.modules["ldap3"]
        if saved_conv is not None:
            sys.modules["ldap3.utils.conv"] = saved_conv
        elif "ldap3.utils.conv" in sys.modules:
            del sys.modules["ldap3.utils.conv"]


# ── authenticate_ldap ──────────────────────────────────────────────────────────


def test_authenticate_ldap_disabled_raises():
    with patch("Database.get_setting", return_value='{"enabled": false}'):
        from ldap_auth import authenticate_ldap

        with pytest.raises(RuntimeError, match="not enabled"):
            authenticate_ldap("alice", "pass")


def test_authenticate_ldap_no_config_raises():
    with patch("Database.get_setting", return_value=None):
        from ldap_auth import authenticate_ldap

        with pytest.raises(RuntimeError, match="not enabled"):
            authenticate_ldap("alice", "pass")


def test_authenticate_ldap_delegates_to_do_ldap_auth():
    cfg = _cfg()
    cfg["enabled"] = True
    with (
        patch("ldap_auth.get_portal_ldap_config", return_value=cfg),
        patch("ldap_auth._do_ldap_auth", return_value=(True, "Alice")) as mock_auth,
    ):
        from ldap_auth import authenticate_ldap

        ok, name = authenticate_ldap("alice", "pass")
    assert ok is True
    assert name == "Alice"
    mock_auth.assert_called_once_with(cfg, "alice", "pass")
