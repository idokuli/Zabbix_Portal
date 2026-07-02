"""Sync deletion guard and list_users regression tests."""

from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture()
def sync_bot():
    """ZabbixSync instance with a mocked Zabbix API — no real connection needed."""
    from ZabbixSync import ZabbixSync

    bot = ZabbixSync()
    bot.zapi = MagicMock()
    # full_sync fetches users first; return an empty list so no imports happen.
    bot.zapi.user.get.return_value = []
    # Silence group and host sync sections.
    bot.zapi.usergroup.get.return_value = []
    bot.zapi.host.get.return_value = []
    return bot


# ── Deletion guard ────────────────────────────────────────────────────────────


def _run_sync(sync_bot, portal_users):
    """Run full_sync with a fixed portal user list and return the delete_user mock.

    full_sync imports User_Management locally (import User_Management as um), so
    we patch at the module level rather than via ZabbixSync.pull.um.
    """
    with (
        patch("User_Management.list_teams", return_value=[]),
        patch("User_Management.list_users", return_value=portal_users),
        patch("User_Management.create_user"),
        patch("User_Management.update_user_profile"),
        patch("User_Management.create_team"),
        patch("User_Management.delete_team"),
        patch("User_Management.get_overview", return_value=[]),
        patch("User_Management.assign_host"),
        patch("User_Management.unassign_host"),
        patch("User_Management.delete_user") as mock_delete,
    ):
        sync_bot.full_sync()
        return mock_delete


def test_deletes_zabbix_source_user_removed_from_zabbix(sync_bot):
    """A source='zabbix' user absent from Zabbix must be deleted from the portal."""
    user = {"id": 10, "username": "zbx_user", "roles": ["operator"], "source": "zabbix"}
    mock_delete = _run_sync(sync_bot, [user])
    mock_delete.assert_called_once_with(10)


def test_preserves_local_source_user(sync_bot):
    """A source='local' user absent from Zabbix must NOT be deleted."""
    user = {
        "id": 20,
        "username": "local_user",
        "roles": ["operator"],
        "source": "local",
    }
    mock_delete = _run_sync(sync_bot, [user])
    mock_delete.assert_not_called()


def test_preserves_ldap_source_user(sync_bot):
    """A source='ldap' user absent from Zabbix must NOT be deleted."""
    user = {"id": 30, "username": "ldap_user", "roles": ["operator"], "source": "ldap"}
    mock_delete = _run_sync(sync_bot, [user])
    mock_delete.assert_not_called()


def test_preserves_root_user_regardless_of_source(sync_bot):
    """A user with the 'root' role must never be deleted by sync, even if source='zabbix'."""
    user = {"id": 1, "username": "Admin", "roles": ["root"], "source": "zabbix"}
    mock_delete = _run_sync(sync_bot, [user])
    mock_delete.assert_not_called()


def test_mixed_sources_only_deletes_zabbix(sync_bot):
    """Only source='zabbix' users get deleted; local and ldap survive."""
    users = [
        {"id": 10, "username": "zbx_user", "roles": ["operator"], "source": "zabbix"},
        {"id": 20, "username": "local_user", "roles": ["operator"], "source": "local"},
        {"id": 30, "username": "ldap_user", "roles": ["operator"], "source": "ldap"},
    ]
    mock_delete = _run_sync(sync_bot, users)
    mock_delete.assert_called_once_with(10)


# ── list_users source column regression ──────────────────────────────────────


def test_list_users_returns_source_column():
    """list_users must include 'source' in every returned row."""
    fake_row = {
        "id": 1,
        "username": "alice",
        "email": None,
        "roles": ["operator"],
        "team_id": None,
        "source": "local",
        "team_name": None,
    }
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value.fetchall.return_value = [
        fake_row
    ]

    with patch("User_Management.get_conn", return_value=mock_conn):
        import User_Management as um

        result = um.list_users()

    assert len(result) == 1
    assert "source" in result[0], "list_users must return 'source' column"
    assert result[0]["source"] == "local"
