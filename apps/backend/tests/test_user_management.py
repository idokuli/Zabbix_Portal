"""Tests for User_Management.py — all DB calls are mocked via get_conn."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from unittest.mock import MagicMock, patch

import pytest


# ── helpers ───────────────────────────────────────────────────────────────────


@pytest.fixture
def mc():
    """Returns (conn, cursor). Cursor is what `with conn.cursor() as cur:` yields."""
    cur = MagicMock()
    conn = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cur)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return conn, cur


def _patch(conn):
    return patch("User_Management.get_conn", return_value=conn)


# ── Teams ─────────────────────────────────────────────────────────────────────


def test_create_team_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = {"id": 1, "name": "ops", "description": "Ops team"}
    with _patch(conn):
        result = um.create_team("ops", "Ops team")
    assert result == {"id": 1, "name": "ops", "description": "Ops team"}
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_create_team_db_error_returns_none(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("duplicate key")
    with _patch(conn):
        result = um.create_team("ops")
    assert result is None
    conn.rollback.assert_called_once()
    conn.close.assert_called_once()


def test_list_teams_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [{"id": 1, "name": "ops", "description": ""}]
    with _patch(conn):
        result = um.list_teams()
    assert len(result) == 1
    assert result[0]["name"] == "ops"
    conn.close.assert_called_once()


def test_list_teams_error_returns_empty(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.list_teams()
    assert result == []
    conn.close.assert_called_once()


def test_delete_team_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 1
    with _patch(conn):
        result = um.delete_team(1)
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_delete_team_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 0
    with _patch(conn):
        result = um.delete_team(999)
    assert result is False
    conn.close.assert_called_once()


def test_delete_team_db_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("constraint")
    with _patch(conn):
        result = um.delete_team(1)
    assert result is False
    conn.rollback.assert_called_once()
    conn.close.assert_called_once()


# ── Users ─────────────────────────────────────────────────────────────────────


def test_create_user_ok(mc):
    import User_Management as um

    conn, cur = mc
    # 1st fetchone = case-insensitive duplicate check (None → free), 2nd = INSERT RETURNING.
    cur.fetchone.side_effect = [
        None,
        {
            "id": 5,
            "username": "bob",
            "email": "b@b.com",
            "roles": ["member"],
            "team_id": 1,
            "source": "local",
            "display_name": "",
        },
    ]
    with _patch(conn):
        result = um.create_user("bob", "hash", email="b@b.com", team_id=1)
    assert result["id"] == 5
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_create_user_default_roles(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.side_effect = [
        None,
        {
            "id": 6,
            "username": "alice",
            "email": "",
            "roles": ["member"],
            "team_id": None,
            "source": "local",
            "display_name": "",
        },
    ]
    with _patch(conn):
        result = um.create_user("alice", "hash")
    assert result["roles"] == ["member"]
    conn.close.assert_called_once()


def test_create_user_rejects_case_insensitive_duplicate(mc):
    """A pre-existing `Shift_User` must block creating `shift_user`.

    The table's UNIQUE(username) is case-sensitive, so without the explicit guard both
    rows would coexist and a single login would match two rows via LOWER().
    """
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = (1,)  # duplicate check finds an existing row
    with _patch(conn):
        result = um.create_user("shift_user", "hash")
    assert result is None
    conn.commit.assert_not_called()
    conn.close.assert_called_once()


def test_create_user_db_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("unique")
    with _patch(conn):
        result = um.create_user("dup", "hash")
    assert result is None
    conn.rollback.assert_called_once()
    conn.close.assert_called_once()


def test_get_user_by_username_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [
        {
            "id": 1,
            "username": "admin",
            "email": "",
            "roles": ["root"],
            "team_id": None,
            "password_hash": "x",
            "source": "local",
            "display_name": "",
        }
    ]
    with _patch(conn):
        result = um.get_user_by_username("admin")
    assert result["username"] == "admin"
    conn.close.assert_called_once()


def test_get_user_by_username_case_insensitive_for_stored_casing(mc):
    """Typing 'admin' must reach the seeded root row stored as 'Admin'.

    Regression guard: lowercasing the login input instead of the comparison
    made this return None and 401'd the root account out of the portal.
    """
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [
        {
            "id": 1,
            "username": "Admin",
            "email": "",
            "roles": ["root"],
            "team_id": None,
            "password_hash": "x",
            "source": "local",
            "display_name": "",
        }
    ]
    with _patch(conn):
        result = um.get_user_by_username("admin")
    assert result is not None
    assert result["username"] == "Admin"  # stored casing preserved for display
    sql = cur.execute.call_args[0][0]
    assert "LOWER(username) = LOWER(" in sql


def test_get_user_by_username_warns_on_ambiguous_match(mc, caplog):
    """Several rows sharing a name must resolve deterministically AND be logged,
    so an admin can discover the duplicates instead of silently mis-assigning roles."""
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [
        {
            "id": 2,
            "username": "idokuli",
            "email": "",
            "roles": ["operator"],
            "team_id": 1,
            "password_hash": "x",
            "source": "ldap",
            "display_name": "",
        },
        {
            "id": 3,
            "username": "IdOkUlI",
            "email": "",
            "roles": ["member"],
            "team_id": None,
            "password_hash": "y",
            "source": "ldap",
            "display_name": "",
        },
    ]
    with _patch(conn), caplog.at_level("WARNING"):
        result = um.get_user_by_username("idokuli")
    assert result["id"] == 2  # first row wins, deterministically
    assert "matches multiple accounts" in caplog.text
    assert "find_duplicate_usernames" in caplog.text


def test_get_user_by_username_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = []
    with _patch(conn):
        result = um.get_user_by_username("nobody")
    assert result is None
    conn.close.assert_called_once()


def test_get_user_by_username_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.get_user_by_username("admin")
    assert result is None
    conn.close.assert_called_once()


def test_get_user_by_id_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = {
        "id": 1,
        "username": "admin",
        "email": "",
        "roles": ["root"],
        "team_id": None,
    }
    with _patch(conn):
        result = um.get_user_by_id(1)
    assert result["id"] == 1
    conn.close.assert_called_once()


def test_get_user_by_id_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = None
    with _patch(conn):
        result = um.get_user_by_id(999)
    assert result is None


def test_delete_user_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 1
    with _patch(conn):
        result = um.delete_user(1)
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_delete_user_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 0
    with _patch(conn):
        result = um.delete_user(999)
    assert result is False
    conn.close.assert_called_once()


def test_delete_user_db_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("fk constraint")
    with _patch(conn):
        result = um.delete_user(1)
    assert result is False
    conn.rollback.assert_called_once()
    conn.close.assert_called_once()


# ── Host assignments ──────────────────────────────────────────────────────────


def test_assign_host_ok(mc):
    import User_Management as um

    conn, cur = mc
    with _patch(conn):
        result = um.assign_host(1, "server1")
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_assign_host_db_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("error")
    with _patch(conn):
        result = um.assign_host(1, "server1")
    assert result is False
    conn.rollback.assert_called_once()
    conn.close.assert_called_once()


def test_unassign_host_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 1
    with _patch(conn):
        result = um.unassign_host(1, "server1")
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_unassign_host_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 0
    with _patch(conn):
        result = um.unassign_host(1, "ghost")
    assert result is False
    conn.close.assert_called_once()


def test_unassign_host_all_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 2
    with _patch(conn):
        result = um.unassign_host_all("server1")
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_unassign_host_all_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 0
    with _patch(conn):
        result = um.unassign_host_all("ghost")
    assert result is False
    conn.close.assert_called_once()


def test_get_host_teams_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [{"team_id": 1, "team_name": "ops"}]
    with _patch(conn):
        result = um.get_host_teams("server1")
    assert result == [{"team_id": 1, "team_name": "ops"}]
    conn.close.assert_called_once()


def test_get_host_teams_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.get_host_teams("server1")
    assert result == []
    conn.close.assert_called_once()


# ── Team memberships ──────────────────────────────────────────────────────────


def test_add_team_membership_ok(mc):
    import User_Management as um

    conn, cur = mc
    with _patch(conn):
        result = um.add_team_membership(5, 1)
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_add_team_membership_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("fk error")
    with _patch(conn):
        result = um.add_team_membership(5, 999)
    assert result is False
    conn.rollback.assert_called_once()
    conn.close.assert_called_once()


def test_remove_team_membership_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 1
    with _patch(conn):
        result = um.remove_team_membership(5, 1)
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_remove_team_membership_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 0
    with _patch(conn):
        result = um.remove_team_membership(5, 999)
    assert result is False
    conn.close.assert_called_once()


# ── Overview ──────────────────────────────────────────────────────────────────


def test_get_overview_all_teams(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [
        {"id": 1, "name": "ops", "description": "", "users": [], "hosts": []}
    ]
    with _patch(conn):
        result = um.get_overview()
    assert len(result) == 1
    assert result[0]["name"] == "ops"
    conn.close.assert_called_once()


def test_get_overview_filtered_by_team(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [
        {"id": 2, "name": "dev", "description": "", "users": [], "hosts": []}
    ]
    with _patch(conn):
        result = um.get_overview(team_id=2)
    assert result[0]["id"] == 2
    conn.close.assert_called_once()


def test_get_overview_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.get_overview()
    assert result == []
    conn.close.assert_called_once()


# ── User profile ──────────────────────────────────────────────────────────────


def test_update_password_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 1
    with _patch(conn):
        result = um.update_password(1, "newhash")
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_update_password_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 0
    with _patch(conn):
        result = um.update_password(999, "hash")
    assert result is False
    conn.close.assert_called_once()


def test_list_users_all(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [
        {
            "id": 1,
            "username": "admin",
            "email": "",
            "roles": ["root"],
            "team_id": None,
            "source": "local",
            "display_name": "",
            "team_name": None,
        }
    ]
    with _patch(conn):
        result = um.list_users()
    assert len(result) == 1
    conn.close.assert_called_once()


def test_list_users_by_team(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = []
    with _patch(conn):
        result = um.list_users(team_id=99)
    assert result == []
    # Verify team_id was used in the query
    call_args = cur.execute.call_args
    assert 99 in call_args[0][1]
    conn.close.assert_called_once()


def test_update_user_profile_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 1
    with _patch(conn):
        result = um.update_user_profile(1, ["admin"], 2)
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_update_user_profile_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 0
    with _patch(conn):
        result = um.update_user_profile(999, ["member"], None)
    assert result is False
    conn.close.assert_called_once()


# ── Team roles ────────────────────────────────────────────────────────────────


def test_get_team_roles_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = {"roles": ["admin", "member"]}
    with _patch(conn):
        result = um.get_team_roles(1)
    assert "admin" in result
    conn.close.assert_called_once()


def test_get_team_roles_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = None
    with _patch(conn):
        result = um.get_team_roles(999)
    assert result == []
    conn.close.assert_called_once()


def test_get_team_roles_null_roles(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = {"roles": None}
    with _patch(conn):
        result = um.get_team_roles(1)
    assert result == []
    conn.close.assert_called_once()


def test_get_team_roles_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.get_team_roles(1)
    assert result == []
    conn.close.assert_called_once()


def test_set_team_roles_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 1
    with _patch(conn):
        result = um.set_team_roles(1, ["admin"])
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_set_team_roles_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 0
    with _patch(conn):
        result = um.set_team_roles(999, ["admin"])
    assert result is False
    conn.close.assert_called_once()


def test_get_effective_roles_union(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [{"role": "admin"}]
    with _patch(conn):
        result = um.get_effective_roles(1, ["member"])
    assert "admin" in result
    assert "member" in result
    conn.close.assert_called_once()


def test_get_effective_roles_error_returns_personal(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.get_effective_roles(1, ["member"])
    # Falls back to personal roles on error
    assert result == ["member"]
    conn.close.assert_called_once()


# ── Team hostnames ────────────────────────────────────────────────────────────


def test_get_team_hostnames_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [{"hostname": "server1"}, {"hostname": "server2"}]
    with _patch(conn):
        result = um.get_team_hostnames(1)
    assert result == {"server1", "server2"}
    conn.close.assert_called_once()


def test_get_team_hostnames_empty(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = []
    with _patch(conn):
        result = um.get_team_hostnames(1)
    assert result == set()
    conn.close.assert_called_once()


def test_get_team_hostnames_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.get_team_hostnames(1)
    assert result == set()
    conn.close.assert_called_once()


# ── Team display order ───────────────────────────────────────────────────────


def test_set_team_display_order_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 1
    with _patch(conn):
        result = um.set_team_display_order(1, 3)
    assert result is True
    conn.commit.assert_called_once()


def test_set_team_display_order_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 0
    with _patch(conn):
        result = um.set_team_display_order(1, 3)
    assert result is False


def test_set_team_display_order_error_rolls_back(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.set_team_display_order(1, 3)
    assert result is False
    conn.rollback.assert_called_once()


# ── Team-linked host groups ───────────────────────────────────────────────────


def test_list_team_linked_groups_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [{"group_name": "Applications"}, {"group_name": "Linux servers"}]
    with _patch(conn):
        result = um.list_team_linked_groups(1)
    assert result == ["Applications", "Linux servers"]
    conn.close.assert_called_once()


def test_list_team_linked_groups_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.list_team_linked_groups(1)
    assert result == []


def test_link_team_group_ok(mc):
    import User_Management as um

    conn, cur = mc
    with _patch(conn):
        result = um.link_team_group(1, "Applications")
    assert result is True
    conn.commit.assert_called_once()


def test_link_team_group_error_rolls_back(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.link_team_group(1, "Applications")
    assert result is False
    conn.rollback.assert_called_once()


def test_unlink_team_group_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 1
    with _patch(conn):
        result = um.unlink_team_group(1, "Applications")
    assert result is True
    conn.commit.assert_called_once()


def test_unlink_team_group_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 0
    with _patch(conn):
        result = um.unlink_team_group(1, "Applications")
    assert result is False


def test_unlink_team_group_error_rolls_back(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.unlink_team_group(1, "Applications")
    assert result is False
    conn.rollback.assert_called_once()


def test_get_user_teams_ordered_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [{"id": 1, "name": "Alpha", "display_order": 0}]
    with _patch(conn):
        result = um.get_user_teams_ordered(2)
    assert result == [{"id": 1, "name": "Alpha", "display_order": 0}]
    conn.close.assert_called_once()


def test_get_user_teams_ordered_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.get_user_teams_ordered(2)
    assert result == []


def test_get_team_name_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = {"name": "ops"}
    with _patch(conn):
        result = um.get_team_name(1)
    assert result == "ops"
    conn.close.assert_called_once()


def test_get_team_name_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = None
    with _patch(conn):
        result = um.get_team_name(999)
    assert result is None
    conn.close.assert_called_once()


def test_get_team_name_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.get_team_name(1)
    assert result is None
    conn.close.assert_called_once()


# ── seed_root ─────────────────────────────────────────────────────────────────


def test_seed_root_empty_db(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = {"cnt": 0}
    with (
        _patch(conn),
        patch.dict(os.environ, {"ADMIN_USERNAME": "Admin", "ADMIN_PASSWORD": "secret"}),
        patch("Auth.hash_password", return_value="hashed"),
    ):
        um.seed_root()
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_seed_root_existing_users_syncs_password(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = {"cnt": 5}
    with (
        _patch(conn),
        patch.dict(os.environ, {"ADMIN_USERNAME": "Admin", "ADMIN_PASSWORD": "newsecret"}),
        patch("Auth.hash_password", return_value="newhash"),
    ):
        um.seed_root()
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_seed_root_handles_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with (
        _patch(conn),
        patch.dict(os.environ, {"ADMIN_USERNAME": "Admin", "ADMIN_PASSWORD": "secret"}),
        patch("Auth.hash_password", return_value="hashed"),
    ):
        um.seed_root()  # must not raise
    conn.rollback.assert_called_once()
    conn.close.assert_called_once()


# ── Dashboard layouts ─────────────────────────────────────────────────────────


def test_get_dashboard_layout_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = {"layout": [{"id": "widget1"}]}
    with _patch(conn):
        result = um.get_dashboard_layout("user", 1)
    assert result == [{"id": "widget1"}]
    conn.close.assert_called_once()


def test_get_dashboard_layout_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchone.return_value = None
    with _patch(conn):
        result = um.get_dashboard_layout("user", 1)
    assert result == []
    conn.close.assert_called_once()


def test_get_dashboard_layout_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.get_dashboard_layout("user", 1)
    assert result == []
    conn.close.assert_called_once()


def test_save_dashboard_layout_ok(mc):
    import User_Management as um

    conn, cur = mc
    with _patch(conn):
        result = um.save_dashboard_layout("user", 1, [{"id": "w1"}])
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_save_dashboard_layout_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.save_dashboard_layout("user", 1, [])
    assert result is False
    conn.rollback.assert_called_once()
    conn.close.assert_called_once()


# ── Dashboard pages ───────────────────────────────────────────────────────────


def test_list_dashboard_pages_returns_default_plus_custom(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [{"page_key": "dashboard-abc", "name": "Custom"}]
    with _patch(conn):
        result = um.list_dashboard_pages("user", 1, "dashboard")
    assert result[0]["is_default"] is True
    assert result[1]["name"] == "Custom"
    conn.close.assert_called_once()


def test_list_dashboard_pages_error_returns_default(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.list_dashboard_pages("user", 1, "dashboard")
    # Should return the default page even on error
    assert len(result) >= 1
    assert result[0]["is_default"] is True
    conn.close.assert_called_once()


def test_create_dashboard_page_ok(mc):
    import User_Management as um

    conn, cur = mc
    with _patch(conn):
        result = um.create_dashboard_page("user", 1, "dashboard", "My Page")
    assert result is not None
    assert result["name"] == "My Page"
    assert result["is_default"] is False
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_create_dashboard_page_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.create_dashboard_page("user", 1, "dashboard", "Bad")
    assert result is None
    conn.rollback.assert_called_once()
    conn.close.assert_called_once()


def test_rename_dashboard_page_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 1
    with _patch(conn):
        result = um.rename_dashboard_page("user", 1, "dashboard", "dashboard-abc", "New Name")
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_rename_dashboard_page_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 0
    with _patch(conn):
        result = um.rename_dashboard_page("user", 1, "dashboard", "nonexistent", "X")
    assert result is False
    conn.close.assert_called_once()


def test_delete_dashboard_page_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 1
    with _patch(conn):
        result = um.delete_dashboard_page("user", 1, "dashboard", "dashboard-abc")
    assert result is True
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_delete_dashboard_page_not_found(mc):
    import User_Management as um

    conn, cur = mc
    cur.rowcount = 0
    with _patch(conn):
        result = um.delete_dashboard_page("user", 1, "dashboard", "ghost")
    assert result is False
    conn.close.assert_called_once()


def test_delete_dashboard_page_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.delete_dashboard_page("user", 1, "dashboard", "dashboard-abc")
    assert result is False
    conn.rollback.assert_called_once()
    conn.close.assert_called_once()


# ── Notification history ──────────────────────────────────────────────────────


def test_save_notification_history_ok(mc):
    import User_Management as um

    conn, cur = mc
    entries = [{"id": "e1", "hostname": "h1", "severity": 3, "name": "alert", "clock": 1000}]
    with _patch(conn):
        um.save_notification_history(1, entries)
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_save_notification_history_empty_noop(mc):
    import User_Management as um

    conn, cur = mc
    with _patch(conn):
        um.save_notification_history(1, [])
    # get_conn is never called for empty list
    conn.commit.assert_not_called()


def test_save_notification_history_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    entries = [{"id": "e1", "hostname": "h1", "severity": 3, "name": "alert", "clock": 1000}]
    with _patch(conn):
        um.save_notification_history(1, entries)  # must not raise
    conn.rollback.assert_called_once()
    conn.close.assert_called_once()


def test_get_notification_history_ok(mc):
    import User_Management as um

    conn, cur = mc
    cur.fetchall.return_value = [
        {
            "id": "e1",
            "source": "zabbix",
            "hostname": "h1",
            "severity": 3,
            "name": "alert",
            "clock": 1000,
            "acknowledged": False,
        }
    ]
    with _patch(conn):
        result = um.get_notification_history(1)
    assert len(result) == 1
    assert result[0]["id"] == "e1"
    conn.close.assert_called_once()


def test_get_notification_history_error(mc):
    import User_Management as um

    conn, cur = mc
    cur.execute.side_effect = Exception("db error")
    with _patch(conn):
        result = um.get_notification_history(1)
    assert result == []
    conn.close.assert_called_once()
