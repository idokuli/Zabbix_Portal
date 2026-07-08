"""Tests for Actions_Manager.py."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://fake-zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture()
def mgr():
    with patch("zabbix_utils.ZabbixAPI"):
        from Actions_Manager import Actions_Manager

        m = Actions_Manager()
        m.zapi = MagicMock()
        return m


def test_list_actions_returns_list(mgr):
    mgr.zapi.action.get.return_value = [
        {
            "actionid": "1",
            "name": "Notify ops",
            "eventsource": "0",
            "status": "0",
            "esc_period": "1h",
        }
    ]
    result = mgr.list_actions()
    assert isinstance(result, list)
    assert result[0]["actionid"] == "1"


def test_list_actions_with_eventsource(mgr):
    mgr.zapi.action.get.return_value = []
    result = mgr.list_actions(eventsource=0)
    assert result == []


def test_list_actions_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_actions()
    assert result == []


def test_create_action_returns_id(mgr):
    mgr.zapi.action.create.return_value = {"actionids": ["42"]}
    result = mgr.create_action(name="Test Action", eventsource=0)
    assert result == "42"


def test_create_action_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.create_action(name="X", eventsource=0)


def test_delete_action_true(mgr):
    mgr.zapi.action.delete.return_value = {"actionids": ["1"]}
    result = mgr.delete_action("1")
    assert result is True


def test_delete_action_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.delete_action("1")


def test_toggle_action_true(mgr):
    mgr.zapi.action.update.return_value = {"actionids": ["1"]}
    result = mgr.toggle_action("1", status=1)
    assert result is True


def test_list_media_types_returns_list(mgr):
    mgr.zapi.mediatype.get.return_value = [
        {"mediatypeid": "1", "name": "Email", "type": "0", "status": "0"}
    ]
    result = mgr.list_media_types()
    assert isinstance(result, list)
    assert result[0]["mediatypeid"] == "1"


def test_list_media_types_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_media_types()
    assert result == []


def test_delete_media_type_true(mgr):
    mgr.zapi.mediatype.delete.return_value = {"mediatypeids": ["1"]}
    result = mgr.delete_media_type("1")
    assert result is True


def test_list_scripts_returns_list(mgr):
    mgr.zapi.script.get.return_value = [
        {
            "scriptid": "1",
            "name": "Ping",
            "command": "ping -c 3 {HOST.CONN}",
            "execute_on": "2",
            "type": "0",
            "scope": "2",
            "status": "0",
            "description": "",
        }
    ]
    result = mgr.list_scripts()
    assert isinstance(result, list)
    assert result[0]["scriptid"] == "1"


def test_list_scripts_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_scripts()
    assert result == []


def test_delete_script_true(mgr):
    mgr.zapi.script.delete.return_value = {"scriptids": ["1"]}
    result = mgr.delete_script("1")
    assert result is True


# ── create_media_type ────────────────────────────────────────────────────────


def test_create_media_type_email(mgr):
    mgr.zapi.mediatype.create.return_value = {"mediatypeids": ["5"]}
    result = mgr.create_media_type(name="Email", mtype=0)
    assert result == "5"
    call_kwargs = mgr.zapi.mediatype.create.call_args[1]
    assert call_kwargs["smtp_server"] == "localhost"


def test_create_media_type_script(mgr):
    mgr.zapi.mediatype.create.return_value = {"mediatypeids": ["6"]}
    result = mgr.create_media_type(name="MyScript", mtype=2, script="/bin/notify.sh")
    assert result == "6"
    call_kwargs = mgr.zapi.mediatype.create.call_args[1]
    assert call_kwargs["exec_path"] == "/bin/notify.sh"


def test_create_media_type_webhook(mgr):
    mgr.zapi.mediatype.create.return_value = {"mediatypeids": ["7"]}
    result = mgr.create_media_type(name="Webhook", mtype=4, webhook_script="return 1;")
    assert result == "7"
    call_kwargs = mgr.zapi.mediatype.create.call_args[1]
    assert call_kwargs["script"] == "return 1;"


def test_create_media_type_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.create_media_type(name="X", mtype=0)


def test_create_media_type_error(mgr):
    mgr.zapi.mediatype.create.side_effect = Exception("fail")
    with pytest.raises(RuntimeError):
        mgr.create_media_type(name="X", mtype=0)


# ── update_media_type ────────────────────────────────────────────────────────


def test_update_media_type_email(mgr):
    result = mgr.update_media_type("1", name="Email", mtype=0)
    assert result is True


def test_update_media_type_script(mgr):
    result = mgr.update_media_type("1", name="S", mtype=2, script="/bin/s.sh")
    assert result is True
    call_kwargs = mgr.zapi.mediatype.update.call_args[1]
    assert call_kwargs["exec_path"] == "/bin/s.sh"


def test_update_media_type_webhook(mgr):
    result = mgr.update_media_type("1", name="W", mtype=4, webhook_script="code")
    assert result is True
    call_kwargs = mgr.zapi.mediatype.update.call_args[1]
    assert call_kwargs["script"] == "code"


def test_update_media_type_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.update_media_type("1", name="X", mtype=0)


def test_update_media_type_error(mgr):
    mgr.zapi.mediatype.update.side_effect = Exception("fail")
    with pytest.raises(RuntimeError):
        mgr.update_media_type("1", name="X", mtype=0)


# ── toggle_media_type ────────────────────────────────────────────────────────


def test_toggle_media_type_ok(mgr):
    result = mgr.toggle_media_type("1", status=1)
    assert result is True


def test_toggle_media_type_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.toggle_media_type("1", status=0)


def test_toggle_media_type_error(mgr):
    mgr.zapi.mediatype.update.side_effect = Exception("fail")
    with pytest.raises(RuntimeError):
        mgr.toggle_media_type("1", status=0)


# ── create_script ────────────────────────────────────────────────────────────


def test_create_script_ok(mgr):
    mgr.zapi.script.create.return_value = {"scriptids": ["9"]}
    result = mgr.create_script(name="Ping", command="ping -c 3 {HOST.CONN}")
    assert result == "9"


def test_create_script_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.create_script(name="X", command="cmd")


def test_create_script_error(mgr):
    mgr.zapi.script.create.side_effect = Exception("fail")
    with pytest.raises(RuntimeError):
        mgr.create_script(name="X", command="cmd")


def test_delete_script_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.delete_script("1")


def test_delete_media_type_zapi_none(mgr):
    mgr.zapi = None
    with pytest.raises(RuntimeError):
        mgr.delete_media_type("1")
