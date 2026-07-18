"""Unit tests for api/deps.py helpers — no DB or Zabbix connection needed."""

import os
from unittest.mock import patch

import pytest

# Must be set before any import that loads Database.py or Auth.py
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://localhost/zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

# Import the module first so patch("api.deps.*") can resolve it via sys.modules.
# Zabbix_Base connection is attempted lazily; patch it to avoid a real network call.
with patch("zabbix_utils.ZabbixAPI"):
    pass  # noqa: E402

from api.deps import resolve_team, zabbix_call  # noqa: E402


# ── zabbix_call ───────────────────────────────────────────────────────────────


def test_zabbix_call_passes_through_on_success():
    result = []
    with zabbix_call():
        result.append(42)
    assert result == [42]


def test_zabbix_call_converts_runtime_error_to_422():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info, zabbix_call():
        raise RuntimeError("Zabbix error: host not found")
    assert exc_info.value.status_code == 422


def test_zabbix_call_custom_status_code():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info, zabbix_call(status=502):
        raise RuntimeError("upstream error")
    assert exc_info.value.status_code == 502


def test_zabbix_call_does_not_catch_other_exceptions():
    with pytest.raises(ValueError), zabbix_call():
        raise ValueError("not a zabbix error")


def test_zabbix_call_detail_contains_error_message():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info, zabbix_call():
        raise RuntimeError("No permissions")
    assert "No permissions" in str(exc_info.value.detail)


# ── resolve_team ──────────────────────────────────────────────────────────────
# Patch at the User_Management module level (where the functions are defined),
# since api.deps imports User_Management as `um` at import time.


def test_resolve_team_returns_team_name():
    user = {"sub": "1", "team_id": 5}
    with (
        patch("User_Management.get_user_by_id", return_value={"team_id": 5}),
        patch("User_Management.get_team_name", return_value="Alpha Team"),
    ):
        assert resolve_team(user) == "Alpha Team"


def test_resolve_team_returns_empty_for_no_team():
    user = {"sub": "1", "team_id": None}
    with patch("User_Management.get_user_by_id", return_value={"team_id": None}):
        assert resolve_team(user) == ""


def test_resolve_team_falls_back_to_jwt_on_db_error():
    user = {"sub": "1", "team_id": 3}
    with (
        patch("User_Management.get_user_by_id", side_effect=Exception("db down")),
        patch("User_Management.get_team_name", return_value="Fallback Team"),
    ):
        result = resolve_team(user)
    assert result == "Fallback Team"


def test_resolve_team_empty_string_for_rootless_user():
    user = {"sub": "0", "team_id": None}
    with patch("User_Management.get_user_by_id", return_value=None):
        assert resolve_team(user) == ""
