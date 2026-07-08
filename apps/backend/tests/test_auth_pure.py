"""Pure-function unit tests for Auth.py — no DB or Zabbix connection needed."""

import os

import pytest

# Auth.py reads SECRET_KEY at import time — set it before importing.
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only")


from Auth import (  # noqa: E402
    _ROLE_LEVELS,
    can_grant_roles,
    create_token,
    hash_password,
    verify_password,
    _decode,
)


# ── hash_password / verify_password ──────────────────────────────────────────


def test_hash_password_returns_string():
    assert isinstance(hash_password("password"), str)


def test_hash_is_not_plaintext():
    assert hash_password("secret") != "secret"


def test_verify_password_correct():
    hashed = hash_password("mypassword")
    assert verify_password("mypassword", hashed) is True


def test_verify_password_wrong():
    hashed = hash_password("mypassword")
    assert verify_password("wrong", hashed) is False


def test_hash_different_each_call():
    # bcrypt generates a new salt each time
    assert hash_password("same") != hash_password("same")


# ── create_token / _decode ────────────────────────────────────────────────────


def test_create_token_returns_string():
    token = create_token(1, "alice", ["operator"], None)
    assert isinstance(token, str)
    assert len(token) > 10


def test_decode_returns_correct_sub():
    token = create_token(42, "alice", ["operator"], None)
    payload = _decode(token)
    assert payload["sub"] == "42"


def test_decode_returns_correct_username():
    token = create_token(1, "alice", ["operator"], None)
    assert _decode(token)["username"] == "alice"


def test_decode_returns_correct_roles():
    token = create_token(1, "alice", ["root", "team_lead"], None)
    assert _decode(token)["roles"] == ["root", "team_lead"]


def test_decode_returns_correct_team_id():
    token = create_token(1, "alice", ["operator"], 7)
    assert _decode(token)["team_id"] == 7


def test_decode_team_id_none():
    token = create_token(1, "alice", ["operator"], None)
    assert _decode(token)["team_id"] is None


def test_decode_display_name_defaults_to_username():
    token = create_token(1, "alice", ["operator"], None)
    assert _decode(token)["display_name"] == "alice"


def test_decode_display_name_explicit():
    token = create_token(1, "alice", ["operator"], None, display_name="Alice Smith")
    assert _decode(token)["display_name"] == "Alice Smith"


def test_decode_invalid_token_raises_401():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        _decode("not.a.valid.token")
    assert exc_info.value.status_code == 401


# ── can_grant_roles ───────────────────────────────────────────────────────────


def test_root_can_grant_any_role():
    for role in ["member", "operator", "team_lead", "root", "auditor"]:
        assert can_grant_roles(["root"], [role]) is True


def test_root_can_grant_multiple_roles():
    assert can_grant_roles(["root"], ["root", "auditor", "team_lead"]) is True


def test_team_lead_can_grant_operator():
    assert can_grant_roles(["team_lead"], ["operator"]) is True


def test_team_lead_can_grant_member():
    assert can_grant_roles(["team_lead"], ["member"]) is True


def test_team_lead_cannot_grant_root():
    assert can_grant_roles(["team_lead"], ["root"]) is False


def test_team_lead_cannot_grant_auditor():
    assert can_grant_roles(["team_lead"], ["auditor"]) is False


def test_operator_can_grant_member():
    assert can_grant_roles(["operator"], ["member"]) is True


def test_operator_cannot_grant_operator():
    # operator level == 2, requesting operator level == 2 → equal not exceeded → True
    assert can_grant_roles(["operator"], ["operator"]) is True


def test_operator_cannot_grant_team_lead():
    assert can_grant_roles(["operator"], ["team_lead"]) is False


def test_operator_cannot_grant_auditor():
    assert can_grant_roles(["operator"], ["auditor"]) is False


def test_member_cannot_grant_operator():
    assert can_grant_roles(["member"], ["operator"]) is False


def test_member_can_grant_member():
    assert can_grant_roles(["member"], ["member"]) is True


def test_empty_granter_roles_cannot_grant_anything():
    for role in ["member", "operator", "team_lead", "root", "auditor"]:
        assert can_grant_roles([], [role]) is False


def test_empty_requested_roles_always_allowed():
    # Granting nothing is always safe
    assert can_grant_roles([], []) is True
    assert can_grant_roles(["member"], []) is True


def test_multiple_granter_roles_use_highest_level():
    # member (1) + team_lead (3) → effective level 3 → can grant operator (2)
    assert can_grant_roles(["member", "team_lead"], ["operator"]) is True


def test_role_levels_are_ordered_correctly():
    assert _ROLE_LEVELS["member"] < _ROLE_LEVELS["operator"]
    assert _ROLE_LEVELS["operator"] < _ROLE_LEVELS["team_lead"]
    assert _ROLE_LEVELS["team_lead"] < _ROLE_LEVELS["root"]
