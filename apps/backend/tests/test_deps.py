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
# ZabbixBase connection is attempted lazily; patch it to avoid a real network call.
with patch("zabbix_utils.ZabbixAPI"):
    pass  # noqa: E402

from api.deps import resolve_team, team_group_names, zabbix_call  # noqa: E402


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


# ── team_group_names ─────────────────────────────────────────────────────────


def test_team_group_names_none_for_root():
    user = {"sub": "1", "roles": ["root"]}
    assert team_group_names(user) is None


def test_team_group_names_none_for_auditor():
    user = {"sub": "1", "roles": ["auditor"]}
    assert team_group_names(user) is None


def test_team_group_names_empty_for_no_sub():
    user = {"sub": "0", "roles": ["operator"]}
    assert team_group_names(user) == []


def test_team_group_names_returns_ordered_team_names():
    user = {"sub": "1", "roles": ["operator"]}
    with (
        patch(
            "User_Management.get_user_teams_ordered",
            return_value=[
                {"id": 1, "name": "Alpha Team", "display_order": 0},
                {"id": 2, "name": "Beta Team", "display_order": 1},
            ],
        ),
        patch("User_Management.list_team_linked_groups", return_value=[]),
    ):
        assert team_group_names(user) == ["Alpha Team", "Beta Team"]


def test_team_group_names_includes_linked_groups_grouped_by_team():
    user = {"sub": "1", "roles": ["operator"]}
    with (
        patch(
            "User_Management.get_user_teams_ordered",
            return_value=[
                {"id": 1, "name": "Alpha Team", "display_order": 0},
                {"id": 2, "name": "Beta Team", "display_order": 1},
            ],
        ),
        patch(
            "User_Management.list_team_linked_groups",
            side_effect=lambda team_id: ["Applications"] if team_id == 1 else ["Linux servers"],
        ),
    ):
        assert team_group_names(user) == [
            "Alpha Team",
            "Applications",
            "Beta Team",
            "Linux servers",
        ]


def test_team_group_names_dedupes_repeated_names():
    user = {"sub": "1", "roles": ["operator"]}
    with (
        patch(
            "User_Management.get_user_teams_ordered",
            return_value=[{"id": 1, "name": "Alpha Team", "display_order": 0}],
        ),
        patch("User_Management.list_team_linked_groups", return_value=["Alpha Team", "Shared"]),
    ):
        assert team_group_names(user) == ["Alpha Team", "Shared"]
