"""Tests for Host_Manager."""

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
        from Host_Manager import HostManager

        m = HostManager()
        m.zapi = MagicMock()
        m._zabbix_version = (6, 4)
        return m


# ── get_template_id_from_name ────────────────────────────────────────────────


def test_get_template_id_from_name_exact(mgr):
    mgr.zapi.template.get.return_value = [
        {"templateid": "10001", "host": "Linux by Zabbix agent", "name": "Linux"}
    ]
    result = mgr.get_template_id_from_name("Linux by Zabbix agent")
    assert result == "10001"


def test_get_template_id_from_name_fallback_search(mgr):
    mgr.zapi.template.get.side_effect = [
        [],
        [],
        [{"templateid": "10002", "host": "Linux", "name": "Linux agent"}],
    ]
    result = mgr.get_template_id_from_name("Linux")
    assert result == "10002"


def test_get_template_id_from_name_not_found(mgr):
    mgr.zapi.template.get.return_value = []
    result = mgr.get_template_id_from_name("NonExistentTemplate")
    assert result is None


def test_get_template_id_from_name_none_input(mgr):
    result = mgr.get_template_id_from_name(None)
    assert result is None


def test_get_template_id_from_name_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_template_id_from_name("Linux")
    assert result is None


# ── list_templates ───────────────────────────────────────────────────────────


def test_list_templates_returns_list(mgr):
    mgr.zapi.template.get.return_value = [
        {"templateid": "1", "name": "Linux"},
        {"templateid": "2", "name": "Windows"},
    ]
    result = mgr.list_templates()
    assert len(result) == 2
    assert result[0]["name"] == "Linux"


def test_list_templates_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_templates()
    assert result == []


# ── create_server ────────────────────────────────────────────────────────────


def test_create_server_success(mgr):
    mgr.zapi.template.get.return_value = [
        {"templateid": "10001", "host": "Linux by Zabbix agent", "name": "Linux"}
    ]
    mgr.zapi.host.create.return_value = {"hostids": ["999"]}
    host_id, err = mgr.create_server("myhost", "192.168.1.1")
    assert host_id == "999"
    assert err is None


def test_create_server_template_not_found(mgr):
    mgr.zapi.template.get.return_value = []
    host_id, err = mgr.create_server("myhost", "192.168.1.1")
    assert host_id is None
    assert "not found" in err


def test_create_server_zapi_none(mgr):
    mgr.zapi = None
    host_id, err = mgr.create_server("myhost", "192.168.1.1")
    assert host_id is None
    assert err is not None


def test_create_server_with_proxy(mgr):
    mgr._zabbix_version = (7, 0)
    mgr.zapi.template.get.return_value = [
        {"templateid": "10001", "host": "Linux by Zabbix agent", "name": "Linux"}
    ]
    mgr.zapi.host.create.return_value = {"hostids": ["888"]}
    host_id, err = mgr.create_server("myhost", "192.168.1.1", proxyid="5")
    assert host_id == "888"
    call_kwargs = mgr.zapi.host.create.call_args[1]
    assert call_kwargs.get("proxyid") == "5"
    assert call_kwargs.get("monitored_by") == 1


def test_create_server_with_group_ids(mgr):
    mgr.zapi.template.get.return_value = [
        {"templateid": "10001", "host": "Linux by Zabbix agent", "name": "Linux"}
    ]
    mgr.zapi.host.create.return_value = {"hostids": ["777"]}
    host_id, err = mgr.create_server("h", "1.2.3.4", group_ids=["2", "5"])
    assert host_id == "777"
    call_kwargs = mgr.zapi.host.create.call_args[1]
    groups = call_kwargs["groups"]
    assert {"groupid": "2"} in groups
    assert {"groupid": "5"} in groups


# ── delete_server ────────────────────────────────────────────────────────────


def test_delete_server_success(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    result = mgr.delete_server("myhost")
    assert result is True
    mgr.zapi.host.delete.assert_called_once_with(["10"])


def test_delete_server_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    result = mgr.delete_server("ghost")
    assert result is False


def test_delete_server_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.delete_server("myhost")
    assert result is False


# ── get_hosts ────────────────────────────────────────────────────────────────


def test_get_hosts_returns_list(mgr):
    mgr.zapi.host.get.return_value = [
        {
            "hostid": "1",
            "host": "h1",
            "name": "h1",
            "status": "0",
            "proxy_hostid": "0",
            "interfaces": [],
            "tags": [],
            "parentTemplates": [],
            "groups": [],
        }
    ]
    mgr.zapi.problem.get.return_value = []
    result = mgr.get_hosts()
    assert isinstance(result, list)
    assert len(result) == 1


def test_get_hosts_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_hosts()
    assert result == []


def test_get_hosts_normalises_proxyid(mgr):
    mgr._zabbix_version = (6, 0)
    mgr.zapi.host.get.return_value = [
        {
            "hostid": "1",
            "host": "h1",
            "name": "h1",
            "status": "0",
            "proxy_hostid": "3",
            "interfaces": [],
            "tags": [],
            "parentTemplates": [],
            "groups": [],
        }
    ]
    mgr.zapi.problem.get.return_value = []
    result = mgr.get_hosts()
    assert result[0]["proxyid"] == "3"


# ── update_host ──────────────────────────────────────────────────────────────


def test_update_host_success(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10", "interfaces": []}]
    ok, err = mgr.update_host("myhost", name="NewName")
    assert ok is True
    assert err is None


def test_update_host_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    ok, err = mgr.update_host("ghost")
    assert ok is False
    assert "not found" in err


def test_update_host_updates_ip(mgr):
    mgr.zapi.host.get.return_value = [
        {
            "hostid": "10",
            "interfaces": [{"interfaceid": "5", "type": "1", "main": "1", "ip": "1.2.3.4"}],
        }
    ]
    ok, err = mgr.update_host("myhost", ip="5.6.7.8")
    assert ok is True
    mgr.zapi.hostinterface.update.assert_called_once_with(interfaceid="5", ip="5.6.7.8")


# ── tag_host / untag_host ─────────────────────────────────────────────────────


def test_tag_host_adds_tag(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "1", "tags": []}]
    result = mgr.tag_host("h1", "myteam")
    assert result is True
    call_kwargs = mgr.zapi.host.update.call_args[1]
    assert {"tag": "team", "value": "myteam"} in call_kwargs["tags"]


def test_tag_host_already_tagged(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "1", "tags": [{"tag": "team", "value": "myteam"}]}]
    result = mgr.tag_host("h1", "myteam")
    assert result is True
    mgr.zapi.host.update.assert_not_called()


def test_untag_host_removes_tag(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "1", "tags": [{"tag": "team", "value": "myteam"}]}]
    result = mgr.untag_host("h1", "myteam")
    assert result is True
    call_kwargs = mgr.zapi.host.update.call_args[1]
    assert call_kwargs["tags"] == []


# ── get_host_team ─────────────────────────────────────────────────────────────


def test_get_host_team_returns_team(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "1", "tags": [{"tag": "team", "value": "ops"}]}]
    result = mgr.get_host_team("h1")
    assert result == "ops"


def test_get_host_team_no_tag(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "1", "tags": []}]
    result = mgr.get_host_team("h1")
    assert result is None


def test_get_host_team_not_found(mgr):
    mgr.zapi.host.get.return_value = []
    result = mgr.get_host_team("ghost")
    assert result is None


# ── link_template / unlink_template ──────────────────────────────────────────


def test_link_template_success(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "1", "parentTemplates": [{"templateid": "10"}]}]
    ok, err = mgr.link_template("h1", "20")
    assert ok is True
    assert err is None


def test_link_template_already_linked(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "1", "parentTemplates": [{"templateid": "10"}]}]
    ok, err = mgr.link_template("h1", "10")
    assert ok is True
    mgr.zapi.host.update.assert_not_called()


def test_unlink_template_success(mgr):
    mgr.zapi.host.get.return_value = [
        {"hostid": "1", "parentTemplates": [{"templateid": "10"}, {"templateid": "20"}]}
    ]
    ok, err = mgr.unlink_template("h1", "10")
    assert ok is True
    call_kwargs = mgr.zapi.host.update.call_args[1]
    assert {"templateid": "10"} not in call_kwargs["templates"]


# ── update_host_tags ──────────────────────────────────────────────────────────


def test_update_host_tags_success(mgr):
    mgr.zapi.host.get.return_value = [
        {
            "hostid": "1",
            "tags": [{"tag": "team", "value": "ops"}, {"tag": "env", "value": "prod"}],
        }
    ]
    ok, err = mgr.update_host_tags("h1", [{"tag": "app", "value": "web"}])
    assert ok is True
    assert err is None
    call_kwargs = mgr.zapi.host.update.call_args[1]
    tag_keys = [t["tag"] for t in call_kwargs["tags"]]
    assert "team" in tag_keys
    assert "app" in tag_keys
    assert "env" not in tag_keys


# ── add_host_to_hostgroup ─────────────────────────────────────────────────────


def test_add_host_to_hostgroup_creates_new_group(mgr):
    mgr._zabbix_version = (6, 4)
    mgr.zapi.host.get.return_value = [{"hostid": "1", "hostgroups": []}]
    mgr.zapi.hostgroup.get.return_value = []
    mgr.zapi.hostgroup.create.return_value = {"groupids": ["99"]}
    result = mgr.add_host_to_hostgroup("h1", "NewGroup")
    assert result is True
    mgr.zapi.host.update.assert_called_once()


def test_add_host_to_hostgroup_existing_group(mgr):
    mgr._zabbix_version = (6, 4)
    mgr.zapi.host.get.return_value = [{"hostid": "1", "hostgroups": []}]
    mgr.zapi.hostgroup.get.return_value = [{"groupid": "5"}]
    result = mgr.add_host_to_hostgroup("h1", "ExistingGroup")
    assert result is True


def test_add_host_to_hostgroup_already_member(mgr):
    mgr._zabbix_version = (6, 4)
    mgr.zapi.host.get.return_value = [{"hostid": "1", "hostgroups": [{"groupid": "5"}]}]
    mgr.zapi.hostgroup.get.return_value = [{"groupid": "5"}]
    result = mgr.add_host_to_hostgroup("h1", "ExistingGroup")
    assert result is True
    mgr.zapi.host.update.assert_not_called()
