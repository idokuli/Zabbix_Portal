"""Tests for ZabbixSync/helpers.py and ZabbixSync/background.py."""

import os
import threading

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
        s._rights_field = "rights"
        return s


# ── _fetch_roleids ─────────────────────────────────────────────────────────────


def test_fetch_roleids_maps_types(sync):
    sync.zapi.role.get.return_value = [
        {"roleid": "101", "name": "User", "type": "1"},
        {"roleid": "102", "name": "Admin", "type": "2"},
        {"roleid": "103", "name": "Super", "type": "3"},
    ]
    result = sync._fetch_roleids()
    assert result[1] == "101"
    assert result[2] == "102"
    assert result[3] == "103"


def test_fetch_roleids_skips_duplicate_type(sync):
    sync.zapi.role.get.return_value = [
        {"roleid": "101", "name": "User", "type": "1"},
        {"roleid": "999", "name": "Guest", "type": "1"},
    ]
    result = sync._fetch_roleids()
    assert result[1] == "101"  # first one wins


def test_fetch_roleids_zapi_error_returns_empty(sync):
    sync.zapi.role.get.side_effect = Exception("zapi down")
    result = sync._fetch_roleids()
    assert result == {}


# ── _roleid_for ────────────────────────────────────────────────────────────────


def test_roleid_for_exact_match(sync):
    assert sync._roleid_for(2) == "102"


def test_roleid_for_fallback(sync):
    # type 4 doesn't exist — falls back to type 3
    assert sync._roleid_for(4) == "103"


def test_roleid_for_no_match_returns_one(sync):
    sync._roleids = {}
    result = sync._roleid_for(3)
    assert result == "1"


# ── _get_zabbix_user ───────────────────────────────────────────────────────────


def test_get_zabbix_user_found(sync):
    sync.zapi.user.get.return_value = [{"userid": "5", "username": "alice"}]
    result = sync._get_zabbix_user("alice")
    assert result["userid"] == "5"


def test_get_zabbix_user_not_found(sync):
    sync.zapi.user.get.return_value = []
    result = sync._get_zabbix_user("ghost")
    assert result is None


def test_get_zabbix_user_exception_returns_none(sync):
    sync.zapi.user.get.side_effect = Exception("zapi error")
    result = sync._get_zabbix_user("alice")
    assert result is None


# ── _get_or_create_usergroup ───────────────────────────────────────────────────


def test_get_or_create_usergroup_existing(sync):
    sync.zapi.usergroup.get.return_value = [{"usrgrpid": "7"}]
    result = sync._get_or_create_usergroup("TeamA")
    assert result == "7"
    sync.zapi.usergroup.create.assert_not_called()


def test_get_or_create_usergroup_creates_new(sync):
    sync.zapi.usergroup.get.return_value = []
    sync.zapi.usergroup.create.return_value = {"usrgrpids": ["15"]}
    result = sync._get_or_create_usergroup("TeamB")
    assert result == "15"
    sync.zapi.usergroup.create.assert_called_once()


def test_get_or_create_usergroup_exception_returns_none(sync):
    sync.zapi.usergroup.get.side_effect = Exception("zapi error")
    result = sync._get_or_create_usergroup("TeamC")
    assert result is None


# ── _get_or_create_hostgroup ───────────────────────────────────────────────────


def test_get_or_create_hostgroup_existing(sync):
    sync.zapi.hostgroup.get.return_value = [{"groupid": "20"}]
    result = sync._get_or_create_hostgroup("TeamA")
    assert result == "20"
    sync.zapi.hostgroup.create.assert_not_called()


def test_get_or_create_hostgroup_creates_new(sync):
    sync.zapi.hostgroup.get.return_value = []
    sync.zapi.hostgroup.create.return_value = {"groupids": ["25"]}
    result = sync._get_or_create_hostgroup("TeamB")
    assert result == "25"
    sync.zapi.hostgroup.create.assert_called_once()


def test_get_or_create_hostgroup_exception_returns_none(sync):
    sync.zapi.hostgroup.get.side_effect = Exception("zapi error")
    result = sync._get_or_create_hostgroup("TeamC")
    assert result is None


# ── _set_usergroup_permission ──────────────────────────────────────────────────


def test_set_usergroup_permission_calls_update(sync):
    sync._set_usergroup_permission("5", "10")
    sync.zapi.usergroup.update.assert_called_once()
    call_kwargs = sync.zapi.usergroup.update.call_args[1]
    assert call_kwargs["usrgrpid"] == "5"


def test_set_usergroup_permission_exception_is_logged(sync):
    sync.zapi.usergroup.update.side_effect = Exception("fail")
    sync._set_usergroup_permission("5", "10")  # should not raise


# ── _user_type ─────────────────────────────────────────────────────────────────


def test_user_type_root_returns_3(sync):
    from ZabbixSync.constants import ROLE_TO_TYPE

    result = sync._user_type(["root"])
    assert result == ROLE_TO_TYPE.get("root", 3)


def test_user_type_empty_roles_returns_1(sync):
    assert sync._user_type([]) == 1


def test_user_type_picks_highest(sync):
    # team_lead=2 is higher than member=1
    result = sync._user_type(["member", "team_lead"])
    assert result == 2


# ── start_background_sync ──────────────────────────────────────────────────────


def test_start_background_sync_zapi_none_returns_none(sync):
    sync.zapi = None
    result = sync.start_background_sync()
    assert result is None


def test_start_background_sync_returns_thread(sync):
    sync.full_sync = MagicMock()
    thread = sync.start_background_sync()
    assert isinstance(thread, threading.Thread)
    assert thread.daemon is True


# ── start_realtime_sync ────────────────────────────────────────────────────────


def test_start_realtime_sync_returns_thread(sync):
    mock_conn = MagicMock()
    mock_conn.notifies = []
    # Make select.select return no-read-ready so the loop exits when full_sync is called

    sync.full_sync = MagicMock()

    with (
        patch("psycopg2.connect", return_value=mock_conn),
        patch("psycopg2.extensions", MagicMock()),
        patch("Database._DATABASE_URL", "postgresql://test"),
        patch("select.select", side_effect=Exception("stop")),
    ):
        thread = sync.start_realtime_sync()

    assert isinstance(thread, threading.Thread)
    assert thread.daemon is True


def test_start_realtime_sync_handles_db_error(sync):
    sync.full_sync = MagicMock()
    with (
        patch("psycopg2.connect", side_effect=Exception("db down")),
        patch("Database._DATABASE_URL", "postgresql://test"),
    ):
        thread = sync.start_realtime_sync()
    # Thread starts but _listen() crashes — that's fine
    assert isinstance(thread, threading.Thread)
    thread.join(timeout=1.0)  # give it a moment to fail


def test_start_realtime_sync_calls_full_sync_on_notify(sync):
    sync.full_sync = MagicMock()
    mock_conn = MagicMock()
    mock_conn.notifies = [MagicMock()]  # one notification waiting
    call_count = {"n": 0}

    def fake_select(rlist, wlist, elist, timeout):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return ([mock_conn], [], [])
        raise Exception("stop loop")

    with (
        patch("psycopg2.connect", return_value=mock_conn),
        patch("psycopg2.extensions", MagicMock()),
        patch("Database._DATABASE_URL", "postgresql://test"),
        patch("select.select", side_effect=fake_select),
    ):
        thread = sync.start_realtime_sync()
        thread.join(timeout=2.0)

    sync.full_sync.assert_called_once()
