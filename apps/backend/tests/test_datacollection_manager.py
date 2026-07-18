"""Tests for DataCollection_Manager.py."""

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
        from DataCollection_Manager import DataCollection_Manager

        m = DataCollection_Manager()
        m.zapi = MagicMock()
        m._cache = {}
        return m


# ── Host groups ──────────────────────────────────────────────────────────────


def test_list_host_groups_returns_list(mgr):
    mgr.zapi.hostgroup.get.return_value = [
        {"groupid": "1", "name": "Linux", "hosts": [{"hostid": "5"}]}
    ]
    result = mgr.list_host_groups()
    assert isinstance(result, list)
    assert result[0]["groupid"] == "1"
    assert result[0]["host_count"] == 1


def test_list_host_groups_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_host_groups()
    assert result == []


def test_create_host_group_returns_id(mgr):
    mgr.zapi.hostgroup.create.return_value = {"groupids": ["10"]}
    gid, err = mgr.create_host_group("NewGroup")
    assert gid == "10"
    assert err is None


def test_create_host_group_zapi_none(mgr):
    mgr.zapi = None
    gid, err = mgr.create_host_group("X")
    assert gid is None
    assert err is not None


def test_update_host_group_true(mgr):
    mgr.zapi.hostgroup.update.return_value = {"groupids": ["1"]}
    assert mgr.update_host_group("1", "NewName") is True


def test_delete_host_group_true(mgr):
    mgr.zapi.hostgroup.delete.return_value = {"groupids": ["1"]}
    assert mgr.delete_host_group("1") is True


def test_delete_host_group_zapi_none(mgr):
    mgr.zapi = None
    assert mgr.delete_host_group("1") is False


# ── Templates ────────────────────────────────────────────────────────────────


def test_list_templates_returns_list(mgr):
    mgr.zapi.template.get.return_value = [
        {
            "templateid": "1",
            "name": "Linux by Zabbix agent",
            "host": "Linux by Zabbix agent",
            "description": "",
        }
    ]
    result = mgr.list_templates()
    assert isinstance(result, list)
    assert result[0]["templateid"] == "1"


def test_list_templates_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_templates()
    assert result == []


# ── Maintenances ─────────────────────────────────────────────────────────────


def test_list_maintenances_returns_list(mgr):
    mgr.zapi.maintenance.get.return_value = [
        {
            "maintenanceid": "1",
            "name": "Scheduled downtime",
            "maintenance_type": "0",
            "active_since": "1700000000",
            "active_till": "1700003600",
            "description": "",
            "hosts": [],
            "groups": [],
            "timeperiods": [],
        }
    ]
    result = mgr.list_maintenances()
    assert isinstance(result, list)
    assert result[0]["maintenanceid"] == "1"


def test_list_maintenances_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_maintenances()
    assert result == []


def test_delete_maintenance_true(mgr):
    mgr.zapi.maintenance.delete.return_value = {"maintenanceids": ["1"]}
    assert mgr.delete_maintenance("1") is True


# ── Template groups ───────────────────────────────────────────────────────────


def test_list_template_groups_returns_list(mgr):
    mgr.zapi.templategroup.get.return_value = [{"groupid": "1", "name": "Templates/OS"}]
    result = mgr.list_template_groups()
    assert isinstance(result, list)


def test_list_template_groups_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_template_groups()
    assert result == []


# ── Discovery rules ───────────────────────────────────────────────────────────


def test_list_discovery_rules_returns_list(mgr):
    mgr.zapi.drule.get.return_value = [
        {
            "druleid": "1",
            "name": "Local network",
            "iprange": "192.168.1.1-254",
            "delay": "3600",
            "status": "0",
            "dchecks": [],
        }
    ]
    result = mgr.list_discovery_rules()
    assert isinstance(result, list)


def test_list_discovery_rules_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_discovery_rules()
    assert result == []


def test_delete_discovery_rule_true(mgr):
    mgr.zapi.drule.delete.return_value = {"druleids": ["1"]}
    assert mgr.delete_discovery_rule("1") is True


# ── Correlations ─────────────────────────────────────────────────────────────


def test_list_correlations_returns_list(mgr):
    mgr.zapi.correlation.get.return_value = [
        {
            "correlationid": "1",
            "name": "Close old events",
            "description": "",
            "status": "0",
            "filter": {},
            "operations": [],
        }
    ]
    result = mgr.list_correlations()
    assert isinstance(result, list)


def test_list_correlations_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.list_correlations()
    assert result == []


# ── Template group members ────────────────────────────────────────────────────


def test_get_template_group_members_returns_list(mgr):
    mgr.zapi.template.get.return_value = [{"templateid": "10", "name": "Linux", "description": ""}]
    result = mgr.get_template_group_members("1")
    assert result[0]["templateid"] == "10"


def test_get_template_group_members_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_template_group_members("1")
    assert result == []


def test_create_template_group_returns_id(mgr):
    mgr.zapi.templategroup.create.return_value = {"groupids": ["20"]}
    gid, err = mgr.create_template_group("MyGroup")
    assert gid == "20"
    assert err is None


def test_create_template_group_zapi_none(mgr):
    mgr.zapi = None
    gid, err = mgr.create_template_group("X")
    assert gid is None


def test_update_template_group_true(mgr):
    mgr.zapi.templategroup.update.return_value = {"groupids": ["1"]}
    assert mgr.update_template_group("1", "NewName") is True


def test_update_template_group_zapi_none(mgr):
    mgr.zapi = None
    assert mgr.update_template_group("1", "X") is False


def test_delete_template_group_true(mgr):
    mgr.zapi.templategroup.delete.return_value = {"groupids": ["1"]}
    assert mgr.delete_template_group("1") is True


def test_delete_template_group_zapi_none(mgr):
    mgr.zapi = None
    assert mgr.delete_template_group("1") is False


def test_set_template_group_members_adds_and_removes(mgr):
    mgr.zapi.template.get.return_value = [{"templateid": "10"}]
    result = mgr.set_template_group_members("1", ["20"])
    assert result is True
    mgr.zapi.template.massadd.assert_called_once()
    mgr.zapi.template.massremove.assert_called_once()


def test_set_template_group_members_zapi_none(mgr):
    mgr.zapi = None
    assert mgr.set_template_group_members("1", ["10"]) is False


# ── Host group members ────────────────────────────────────────────────────────


def test_get_host_group_members_returns_list(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "5", "host": "h1", "name": "h1", "status": "0"}]
    result = mgr.get_host_group_members("2")
    assert result[0]["hostid"] == "5"
    assert result[0]["status"] == 0


def test_get_host_group_members_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_host_group_members("1")
    assert result == []


def test_set_host_group_members_adds_and_removes(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "10"}]
    result = mgr.set_host_group_members("1", ["20"])
    assert result is True
    mgr.zapi.host.massadd.assert_called_once()
    mgr.zapi.host.massremove.assert_called_once()


def test_set_host_group_members_zapi_none(mgr):
    mgr.zapi = None
    assert mgr.set_host_group_members("1", ["10"]) is False


# ── Template CRUD ─────────────────────────────────────────────────────────────


def test_create_template_success(mgr):
    mgr.zapi.template.create.return_value = {"templateids": ["99"]}
    tid, err = mgr.create_template("MyTemplate", ["1"])
    assert tid == "99"
    assert err is None


def test_create_template_no_groups(mgr):
    tid, err = mgr.create_template("T", [])
    assert tid is None
    assert "group" in err


def test_create_template_zapi_none(mgr):
    mgr.zapi = None
    tid, err = mgr.create_template("T", ["1"])
    assert tid is None


def test_get_template_detail_returns_dict(mgr):
    mgr.zapi.template.get.return_value = [
        {
            "templateid": "99",
            "host": "Linux",
            "name": "Linux agent",
            "description": "",
            "templategroups": [{"groupid": "1", "name": "Templates/OS"}],
            "parentTemplates": [],
            "tags": [],
            "macros": [],
        }
    ]
    mgr.zapi.item.get.return_value = []
    result = mgr.get_template_detail("99")
    assert result is not None
    assert result["templateid"] == "99"


def test_get_template_detail_not_found(mgr):
    mgr.zapi.template.get.return_value = []
    result = mgr.get_template_detail("999")
    assert result is None


def test_get_template_detail_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_template_detail("1")
    assert result is None


def test_delete_template_true(mgr):
    mgr.zapi.template.delete.return_value = {"templateids": ["1"]}
    assert mgr.delete_template("1") is True


def test_delete_template_zapi_none(mgr):
    mgr.zapi = None
    assert mgr.delete_template("1") is False


# ── Maintenance CRUD ──────────────────────────────────────────────────────────


def test_create_maintenance_success(mgr):
    mgr.zapi.maintenance.create.return_value = {"maintenanceids": ["5"]}
    mid, err = mgr.create_maintenance(
        name="Downtime",
        maintenance_type=0,
        active_since=1700000000,
        active_till=1700003600,
        hostids=["1"],
        groupids=[],
    )
    assert mid == "5"
    assert err is None


def test_create_maintenance_zapi_none(mgr):
    mgr.zapi = None
    mid, err = mgr.create_maintenance(
        name="D",
        maintenance_type=0,
        active_since=0,
        active_till=3600,
        hostids=[],
        groupids=[],
    )
    assert mid is None


# ── Correlation CRUD ──────────────────────────────────────────────────────────


def test_create_correlation_success(mgr):
    mgr.zapi.correlation.create.return_value = {"correlationids": ["10"]}
    cid, err = mgr.create_correlation(name="Close old events")
    assert cid == "10"
    assert err is None


def test_create_correlation_zapi_none(mgr):
    mgr.zapi = None
    cid, err = mgr.create_correlation(name="X")
    assert cid is None


def test_delete_correlation_true(mgr):
    mgr.zapi.correlation.delete.return_value = {"correlationids": ["1"]}
    assert mgr.delete_correlation("1") is True


# ── Discovery rule CRUD ───────────────────────────────────────────────────────


def test_set_host_group_members_true(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "5"}]
    mgr.zapi.hostgroup.massupdate.return_value = {"groupids": ["1"]}
    assert mgr.set_host_group_members("1", ["5"]) is True


def test_set_template_group_members_true(mgr):
    mgr.zapi.templategroup.massupdate.return_value = {"groupids": ["1"]}
    assert mgr.set_template_group_members("1", ["99"]) is True


def test_create_template_returns_id(mgr):
    mgr.zapi.template.create.return_value = {"templateids": ["20"]}
    tid, err = mgr.create_template("My Template", ["1"])
    assert tid == "20"
    assert err is None


def test_create_maintenance_returns_id(mgr):
    mgr.zapi.maintenance.create.return_value = {"maintenanceids": ["5"]}
    mid, err = mgr.create_maintenance(
        name="Downtime",
        maintenance_type=0,
        active_since=1700000000,
        active_till=1700003600,
        hostids=["1"],
        groupids=[],
    )
    assert mid == "5"
    assert err is None


def test_create_maintenance_no_hosts_or_groups(mgr):
    mid, err = mgr.create_maintenance("X", 0, 1700000000, 1700003600, [], [])
    assert mid is None
    assert err is not None


def test_create_correlation_returns_id(mgr):
    mgr.zapi.correlation.create.return_value = {"correlationids": ["3"]}
    cid, err = mgr.create_correlation(
        name="Close old",
        conditions=[{"type": "1", "tag": "scope", "value": "test"}],
    )
    assert cid == "3"
    assert err is None


def test_delete_correlation_zapi_none(mgr):
    mgr.zapi = None
    assert mgr.delete_correlation("1") is False


def test_create_discovery_rule_success(mgr):
    mgr.zapi.drule.create.return_value = {"druleids": ["20"]}
    did, err = mgr.create_discovery_rule(
        name="LAN scan",
        iprange="192.168.1.1-254",
        delay="3600",
        check_types=["icmp", "ftp"],
    )
    assert did == "20"
    assert err is None


def test_create_discovery_rule_empty_checks(mgr):
    did, err = mgr.create_discovery_rule(
        name="X",
        iprange="1.2.3.4",
        delay="3600",
        check_types=[],
    )
    assert did is None
    assert "check type" in err


def test_create_discovery_rule_zapi_none(mgr):
    mgr.zapi = None
    did, err = mgr.create_discovery_rule(
        name="X",
        iprange="1.2.3.4",
        delay="3600",
        check_types=["icmp"],
    )
    assert did is None


# ── Error paths ───────────────────────────────────────────────────────────────


def test_list_template_groups_error(mgr):
    mgr.zapi.templategroup.get.side_effect = Exception("fail")
    result = mgr.list_template_groups()
    assert result == []


def test_get_template_group_members_error(mgr):
    mgr.zapi.template.get.side_effect = Exception("fail")
    result = mgr.get_template_group_members("1")
    assert result == []


def test_create_template_group_error(mgr):
    mgr.zapi.templategroup.create.side_effect = Exception("fail")
    gid, err = mgr.create_template_group("X")
    assert gid is None
    assert err is not None


def test_update_template_group_error(mgr):
    mgr.zapi.templategroup.update.side_effect = Exception("fail")
    result = mgr.update_template_group("1", "New Name")
    assert result is False


def test_delete_template_group_error(mgr):
    mgr.zapi.templategroup.delete.side_effect = Exception("fail")
    result = mgr.delete_template_group("1")
    assert result is False


def test_get_host_group_members_error(mgr):
    mgr.zapi.host.get.side_effect = Exception("fail")
    result = mgr.get_host_group_members("1")
    assert result == []


def test_update_host_group_error(mgr):
    mgr.zapi.hostgroup.update.side_effect = Exception("fail")
    result = mgr.update_host_group("1", "New Name")
    assert result is False


def test_delete_host_group_error(mgr):
    mgr.zapi.hostgroup.delete.side_effect = Exception("fail")
    result = mgr.delete_host_group("1")
    assert result is False


def test_delete_template_error(mgr):
    mgr.zapi.template.delete.side_effect = Exception("fail")
    result = mgr.delete_template("1")
    assert result is False


def test_list_maintenances_error(mgr):
    mgr.zapi.maintenance.get.side_effect = Exception("fail")
    result = mgr.list_maintenances()
    assert result == []


def test_delete_maintenance_error(mgr):
    mgr.zapi.maintenance.delete.side_effect = Exception("fail")
    result = mgr.delete_maintenance("1")
    assert result is False


def test_list_correlations_error(mgr):
    mgr.zapi.correlation.get.side_effect = Exception("fail")
    result = mgr.list_correlations()
    assert result == []


def test_delete_correlation_error(mgr):
    mgr.zapi.correlation.delete.side_effect = Exception("fail")
    result = mgr.delete_correlation("1")
    assert result is False


def test_list_discovery_rules_error(mgr):
    mgr.zapi.drule.get.side_effect = Exception("fail")
    result = mgr.list_discovery_rules()
    assert result == []


def test_delete_discovery_rule_error(mgr):
    mgr.zapi.drule.delete.side_effect = Exception("fail")
    result = mgr.delete_discovery_rule("1")
    assert result is False


def test_delete_discovery_rule_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.delete_discovery_rule("1")
    assert result is False


def test_delete_maintenance_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.delete_maintenance("1")
    assert result is False


# ── update_template ───────────────────────────────────────────────────────────


def test_update_template_name_only(mgr):
    ok, err = mgr.update_template("1", name="New Name")
    assert ok is True
    assert err is None


def test_update_template_all_fields(mgr):
    ok, err = mgr.update_template(
        "1",
        name="T",
        visible_name="Template T",
        description="desc",
        group_ids=["5", "6"],
        template_ids=["20", "21"],
        tags=[{"tag": "env", "value": "prod"}, {"tag": "", "value": "x"}],
        macros=[{"macro": "{$VAR}", "value": "1", "description": "test"}],
    )
    assert ok is True
    assert err is None


def test_update_template_visible_name_empty_string(mgr):
    """Empty visible_name falls back to the given name."""
    ok, err = mgr.update_template("1", name="T", visible_name="")
    assert ok is True
    call_kwargs = mgr.zapi.template.update.call_args[1]
    assert call_kwargs["name"] == "T"


def test_update_template_zapi_none(mgr):
    mgr.zapi = None
    ok, err = mgr.update_template("1", name="X")
    assert ok is False
    assert err is not None


def test_update_template_error(mgr):
    mgr.zapi.template.update.side_effect = Exception("fail")
    ok, err = mgr.update_template("1", name="X")
    assert ok is False
    assert err is not None


def test_create_discovery_rule_error(mgr):
    mgr.zapi.drule.create.side_effect = Exception("fail")
    did, err = mgr.create_discovery_rule(
        name="X", iprange="1.2.3.4", delay="3600", check_types=["icmp"]
    )
    assert did is None
    assert err is not None


def test_create_maintenance_error(mgr):
    mgr.zapi.maintenance.create.side_effect = Exception("fail")
    import time

    now = int(time.time())
    mid, err = mgr.create_maintenance("X", 0, now, now + 3600, hostids=["1"], groupids=[])
    assert mid is None
    assert err is not None


def test_create_correlation_error(mgr):
    mgr.zapi.correlation.create.side_effect = Exception("fail")
    cid, err = mgr.create_correlation(
        name="X",
        conditions=[{"type": "1", "tag": "env", "value": "prod"}],
    )
    assert cid is None
    assert err is not None
