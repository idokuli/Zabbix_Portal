"""Tests for ZabbixSync push and pull methods."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://fake-zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture()
def sync():
    with patch("zabbix_utils.ZabbixAPI"):
        from ZabbixSync import ZabbixSync

        s = ZabbixSync()
        s.zapi = MagicMock()
        s._zabbix_major = 6
        s._ufield = "username"
        s._roleids = {1: "101", 2: "102", 3: "103"}
        s._select_hg_param = "selectHostGroups"
        s._host_hg_key = "hostgroups"
        return s


# ── push_user ─────────────────────────────────────────────────────────────────


def test_push_user_creates_new(sync):
    sync._get_or_create_usergroup = MagicMock(return_value="5")
    sync._get_zabbix_user = MagicMock(return_value=None)
    sync._user_type = MagicMock(return_value=1)
    sync._roleid_for = MagicMock(return_value="101")
    sync.push_user("alice", "pass123", ["operator"], "TeamA")
    sync.zapi.user.create.assert_called_once()


def test_push_user_updates_existing(sync):
    sync._get_or_create_usergroup = MagicMock(return_value="5")
    sync._get_zabbix_user = MagicMock(return_value={"userid": "10"})
    sync._user_type = MagicMock(return_value=1)
    sync._roleid_for = MagicMock(return_value="101")
    sync.push_user("alice", "newpass", ["operator"], "TeamA")
    sync.zapi.user.update.assert_called_once()


def test_push_user_zapi_none(sync):
    sync.zapi = None
    sync._get_or_create_usergroup = MagicMock()
    sync.push_user("alice", "p", ["operator"], "T")
    sync._get_or_create_usergroup.assert_not_called()


def test_push_user_no_group_skips(sync):
    sync._get_or_create_usergroup = MagicMock(return_value=None)
    sync._get_zabbix_user = MagicMock()
    sync.push_user("alice", "p", ["operator"], "T")
    sync._get_zabbix_user.assert_not_called()


def test_push_user_without_team(sync):
    sync._get_or_create_usergroup = MagicMock(return_value="5")
    sync._get_zabbix_user = MagicMock(return_value=None)
    sync._user_type = MagicMock(return_value=1)
    sync._roleid_for = MagicMock(return_value="101")
    sync.push_user("bob", "", ["operator"], None)
    sync.zapi.user.create.assert_called_once()


# ── delete_user ────────────────────────────────────────────────────────────────


def test_delete_user_removes_from_zabbix(sync):
    sync._get_zabbix_user = MagicMock(return_value={"userid": "10"})
    sync.delete_user("alice")
    sync.zapi.user.delete.assert_called_once_with("10")


def test_delete_user_not_found_is_noop(sync):
    sync._get_zabbix_user = MagicMock(return_value=None)
    sync.delete_user("ghost")
    sync.zapi.user.delete.assert_not_called()


def test_delete_user_zapi_none(sync):
    sync.zapi = None
    sync._get_zabbix_user = MagicMock()
    sync.delete_user("alice")
    sync._get_zabbix_user.assert_not_called()


# ── update_password ────────────────────────────────────────────────────────────


def test_update_password_calls_user_update(sync):
    sync._get_zabbix_user = MagicMock(return_value={"userid": "10"})
    sync.update_password("alice", "newpass")
    sync.zapi.user.update.assert_called_once()
    call_kwargs = sync.zapi.user.update.call_args[1]
    assert call_kwargs["passwd"] == "newpass"


def test_update_password_user_not_found_is_noop(sync):
    sync._get_zabbix_user = MagicMock(return_value=None)
    sync.update_password("ghost", "newpass")
    sync.zapi.user.update.assert_not_called()


def test_update_password_zapi_none(sync):
    sync.zapi = None
    sync._get_zabbix_user = MagicMock()
    sync.update_password("alice", "p")
    sync._get_zabbix_user.assert_not_called()


# ── push_team ──────────────────────────────────────────────────────────────────


def test_push_team_creates_groups_and_permission(sync):
    sync._get_or_create_usergroup = MagicMock(return_value="5")
    sync._get_or_create_hostgroup = MagicMock(return_value="10")
    sync._set_usergroup_permission = MagicMock()
    sync.push_team("TeamA")
    sync._get_or_create_usergroup.assert_called_once_with("TeamA")
    sync._get_or_create_hostgroup.assert_called_once_with("TeamA")
    sync._set_usergroup_permission.assert_called_once()


def test_push_team_zapi_none(sync):
    sync.zapi = None
    sync._get_or_create_usergroup = MagicMock()
    sync.push_team("TeamA")
    sync._get_or_create_usergroup.assert_not_called()


# ── delete_team ────────────────────────────────────────────────────────────────


def test_delete_team_deletes_groups(sync):
    sync.zapi.usergroup.get.return_value = [{"usrgrpid": "5"}]
    sync.zapi.hostgroup.get.return_value = [{"groupid": "10"}]
    sync.delete_team("TeamA")
    sync.zapi.usergroup.delete.assert_called_once_with("5")
    sync.zapi.hostgroup.delete.assert_called_once_with("10")


def test_delete_team_group_not_found_is_noop(sync):
    sync.zapi.usergroup.get.return_value = []
    sync.zapi.hostgroup.get.return_value = []
    sync.delete_team("NonExistent")
    sync.zapi.usergroup.delete.assert_not_called()
    sync.zapi.hostgroup.delete.assert_not_called()


def test_delete_team_zapi_none(sync):
    sync.zapi = None
    sync.delete_team("TeamA")


# ── push_host_to_team ──────────────────────────────────────────────────────────


def test_push_host_to_team_adds_to_hostgroup(sync):
    sync._get_or_create_hostgroup = MagicMock(return_value="10")
    sync.zapi.host.get.return_value = [{"hostid": "1", "hostgroups": []}]
    sync.push_host_to_team("myhost", "TeamA")
    sync.zapi.host.update.assert_called_once()


def test_push_host_to_team_host_not_found(sync):
    sync._get_or_create_hostgroup = MagicMock(return_value="10")
    sync.zapi.host.get.return_value = []
    sync.push_host_to_team("ghost", "TeamA")
    sync.zapi.host.update.assert_not_called()


def test_push_host_to_team_already_member_skips_update(sync):
    sync._get_or_create_hostgroup = MagicMock(return_value="10")
    sync.zapi.host.get.return_value = [{"hostid": "1", "hostgroups": [{"groupid": "10"}]}]
    sync.push_host_to_team("myhost", "TeamA")
    sync.zapi.host.update.assert_not_called()


def test_push_host_to_team_zapi_none(sync):
    sync.zapi = None
    sync._get_or_create_hostgroup = MagicMock()
    sync.push_host_to_team("myhost", "TeamA")
    sync._get_or_create_hostgroup.assert_not_called()


# ── remove_host_from_team ──────────────────────────────────────────────────────


def test_remove_host_from_team(sync):
    sync.zapi.hostgroup.get.return_value = [{"groupid": "10"}]
    sync.zapi.host.get.return_value = [
        {"hostid": "1", "hostgroups": [{"groupid": "10"}, {"groupid": "2"}]}
    ]
    sync.remove_host_from_team("myhost", "TeamA")
    sync.zapi.host.update.assert_called_once()
    call_kwargs = sync.zapi.host.update.call_args[1]
    # group "10" should be removed, "2" kept
    group_ids = [g["groupid"] for g in call_kwargs["groups"]]
    assert "10" not in group_ids
    assert "2" in group_ids


def test_remove_host_from_team_group_not_found(sync):
    sync.zapi.hostgroup.get.return_value = []
    sync.remove_host_from_team("myhost", "TeamA")
    sync.zapi.host.update.assert_not_called()


def test_remove_host_from_team_zapi_none(sync):
    sync.zapi = None
    sync.remove_host_from_team("myhost", "TeamA")


# ── bootstrap_teams ────────────────────────────────────────────────────────────


def test_bootstrap_teams_pushes_each_team(sync):
    sync.push_team = MagicMock()
    sync.push_host_to_team = MagicMock()
    with (
        patch("User_Management.list_teams", return_value=[{"id": 1, "name": "Ops"}]),
        patch("User_Management.get_team_hostnames", return_value=["h1", "h2"]),
    ):
        sync.bootstrap_teams()
    sync.push_team.assert_called_once_with("Ops")
    assert sync.push_host_to_team.call_count == 2


def test_bootstrap_teams_zapi_none(sync):
    sync.zapi = None
    sync.push_team = MagicMock()
    sync.bootstrap_teams()
    sync.push_team.assert_not_called()


# ── pull_users ─────────────────────────────────────────────────────────────────


def test_pull_users_creates_new_portal_users(sync):
    sync.zapi.user.get.return_value = [
        {
            "userid": "5",
            "username": "newuser",
            "roleid": "101",
            "usrgrps": [{"usrgrpid": "1", "name": "TeamA"}],
        }
    ]
    with (
        patch("User_Management.list_teams", return_value=[]),
        patch("User_Management.list_users", return_value=[]),
        patch("User_Management.create_user") as mock_create,
        patch("User_Management.create_team", return_value={"id": 1}),
        patch("Auth.hash_password", return_value="hashed"),
    ):
        sync.pull_users()
    mock_create.assert_called_once()


def test_pull_users_skips_existing(sync):
    sync.zapi.user.get.return_value = [
        {
            "userid": "5",
            "username": "existing",
            "roleid": "101",
            "usrgrps": [{"usrgrpid": "1", "name": "TeamA"}],
        }
    ]
    with (
        patch("User_Management.list_teams", return_value=[]),
        patch("User_Management.list_users", return_value=[{"username": "existing"}]),
        patch("User_Management.create_user") as mock_create,
        patch("Auth.hash_password", return_value="hashed"),
    ):
        sync.pull_users()
    mock_create.assert_not_called()


def test_pull_users_zapi_none(sync):
    sync.zapi = None
    sync.pull_users()
