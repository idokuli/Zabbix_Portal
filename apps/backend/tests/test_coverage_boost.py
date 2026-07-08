"""Targeted tests to push coverage over 80% — gaps in Report_Manager,
ZabbixAdmin_Manager/macros+system, and api/deps."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://fake-zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

from unittest.mock import MagicMock, patch

import pytest


# ─────────────────────────────────────────────────────────────────────────────
# Report_Manager missed paths
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture()
def report():
    with patch("zabbix_utils.ZabbixAPI"):
        from Report_Manager import Report_Manager

        m = Report_Manager()
        m.zapi = MagicMock()
        m._zabbix_version = (6, 4)
        return m


def test_get_top_triggers_severity_filter(report):
    report.zapi.trigger.get.return_value = []
    result = report.get_top_triggers(severity_min=3)
    assert result == []
    call_kwargs = report.zapi.trigger.get.call_args[1]
    assert 3 in call_kwargs["filter"]["priority"]


def test_get_top_triggers_exception_raises(report):
    report.zapi.trigger.get.side_effect = Exception("zapi error")
    with pytest.raises(RuntimeError):
        report.get_top_triggers()


def test_get_audit_log_with_time_from_and_userid(report):
    report.zapi.auditlog.get.return_value = []
    result = report.get_audit_log(time_from=1700000000, userid="5")
    assert result == []
    call_kwargs = report.zapi.auditlog.get.call_args[1]
    assert call_kwargs["time_from"] == 1700000000
    assert call_kwargs["userids"] == ["5"]


def test_get_audit_log_exception_raises(report):
    report.zapi.auditlog.get.side_effect = Exception("zapi error")
    with pytest.raises(RuntimeError):
        report.get_audit_log()


def test_get_action_log_with_time_from(report):
    report.zapi.alert.get.return_value = []
    result = report.get_action_log(time_from=1700000000)
    assert result == []
    call_kwargs = report.zapi.alert.get.call_args[1]
    assert call_kwargs["time_from"] == 1700000000


def test_get_action_log_exception_raises(report):
    report.zapi.alert.get.side_effect = Exception("zapi error")
    with pytest.raises(RuntimeError):
        report.get_action_log()


def test_get_notification_history_zabbix7_filters_alerttype(report):
    report._zabbix_version = (7, 0)
    report.zapi.alert.get.return_value = [
        {
            "alertid": "1",
            "clock": "1700000000",
            "sendto": "a@b.com",
            "subject": "test",
            "status": "1",
            "error": "",
            "userid": "",
            "mediatypeid": "",
            "alerttype": "0",  # notification
        },
        {
            "alertid": "2",
            "clock": "1700000001",
            "sendto": "x@y.com",
            "subject": "other",
            "status": "1",
            "error": "",
            "userid": "",
            "mediatypeid": "",
            "alerttype": "1",  # not a notification
        },
    ]
    result = report.get_notification_history()
    assert len(result) == 1
    assert result[0]["alertid"] == "1"


def test_get_notification_history_user_enrichment_fails(report):
    report.zapi.alert.get.return_value = [
        {
            "alertid": "1",
            "clock": "1700000000",
            "sendto": "a@b.com",
            "subject": "test",
            "status": "1",
            "error": "",
            "userid": "5",
            "mediatypeid": "1",
        }
    ]
    report.zapi.user.get.side_effect = Exception("zapi error")
    report.zapi.mediatype.get.side_effect = Exception("zapi error")
    result = report.get_notification_history()
    assert isinstance(result, list)


def test_get_notification_history_exception_raises(report):
    report.zapi.alert.get.side_effect = Exception("zapi error")
    with pytest.raises(RuntimeError):
        report.get_notification_history()


def test_get_availability_no_problems(report):
    report.zapi.problem.get.return_value = []
    result = report.get_availability()
    assert result == []


def test_get_availability_with_groupid(report):
    report.zapi.problem.get.return_value = []
    result = report.get_availability(groupid="1")
    assert result == []
    call_kwargs = report.zapi.problem.get.call_args[1]
    assert call_kwargs["groupids"] == ["1"]


def test_get_availability_with_problems(report):
    import time

    now = int(time.time())
    report.zapi.problem.get.return_value = [
        {
            "eventid": "1",
            "objectid": "10",
            "clock": str(now - 3600),
            "r_clock": str(now - 1800),
            "severity": "3",
            "name": "CPU high",
        }
    ]
    report.zapi.trigger.get.return_value = [
        {
            "triggerid": "10",
            "hosts": [{"hostid": "1", "host": "srv01"}],
        }
    ]
    result = report.get_availability()
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["hostname"] == "srv01"
    assert result[0]["availability_pct"] <= 100.0


def test_get_availability_ongoing_problem(report):
    import time

    now = int(time.time())
    report.zapi.problem.get.return_value = [
        {
            "eventid": "1",
            "objectid": "10",
            "clock": str(now - 3600),
            "r_clock": "0",  # still ongoing
            "severity": "3",
            "name": "Disk full",
        }
    ]
    report.zapi.trigger.get.return_value = [
        {"triggerid": "10", "hosts": [{"hostid": "2", "host": "db01"}]}
    ]
    result = report.get_availability()
    assert len(result) == 1


def test_get_availability_exception_raises(report):
    report.zapi.problem.get.side_effect = Exception("zapi error")
    with pytest.raises(RuntimeError):
        report.get_availability()


# ─────────────────────────────────────────────────────────────────────────────
# ZabbixAdmin_Manager/macros.py — error paths and macro formatting
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture()
def zadmin():
    with patch("zabbix_utils.ZabbixAPI"):
        from ZabbixAdmin_Manager import ZabbixAdmin_Manager

        m = ZabbixAdmin_Manager()
        m.zapi = MagicMock()
        m._zabbix_version = (6, 4)
        return m


def test_list_global_macros_exception_raises(zadmin):
    zadmin.zapi.usermacro.get.side_effect = Exception("zapi error")
    with pytest.raises(RuntimeError):
        zadmin.list_global_macros()


def test_create_global_macro_auto_wraps_name(zadmin):
    zadmin.zapi.usermacro.createglobal.return_value = {"globalmacroids": ["10"]}
    result = zadmin.create_global_macro("MYVAR", "myval")
    assert result == "10"
    call_kwargs = zadmin.zapi.usermacro.createglobal.call_args[1]
    assert call_kwargs["macro"].startswith("{$")


def test_create_global_macro_exception_raises(zadmin):
    zadmin.zapi.usermacro.createglobal.side_effect = Exception("zapi error")
    with pytest.raises(RuntimeError):
        zadmin.create_global_macro("{$MYVAR}", "val")


def test_update_global_macro_success(zadmin):
    result = zadmin.update_global_macro("5", "newval")
    assert result is True


def test_update_global_macro_exception_raises(zadmin):
    zadmin.zapi.usermacro.updateglobal.side_effect = Exception("zapi error")
    with pytest.raises(RuntimeError):
        zadmin.update_global_macro("5", "val")


def test_delete_global_macro_success(zadmin):
    result = zadmin.delete_global_macro("5")
    assert result is True
    zadmin.zapi.usermacro.deleteglobal.assert_called_once_with(["5"])


def test_delete_global_macro_exception_raises(zadmin):
    zadmin.zapi.usermacro.deleteglobal.side_effect = Exception("zapi error")
    with pytest.raises(RuntimeError):
        zadmin.delete_global_macro("5")


# ─────────────────────────────────────────────────────────────────────────────
# ZabbixAdmin_Manager/system.py — queue, settings, housekeeping
# ─────────────────────────────────────────────────────────────────────────────


def test_get_queue_overview_zabbix7_returns_error_message(zadmin):
    zadmin._zabbix_version = (7, 0)
    result = zadmin.get_queue_overview()
    assert "error" in result
    assert result["total"] == 0


def test_get_queue_overview_returns_enriched_items(zadmin):
    zadmin._zabbix_version = (6, 4)
    zadmin.zapi.queue.get.return_value = [
        {"itemid": "1", "nextcheck": "1700010000", "delay": "60"}
    ]
    zadmin.zapi.item.get.return_value = [
        {"itemid": "1", "name": "CPU", "hosts": [{"host": "srv01"}]}
    ]
    result = zadmin.get_queue_overview()
    assert result["total"] == 1
    assert result["items"][0]["item_name"] == "CPU"


def test_get_queue_overview_enrichment_fails_gracefully(zadmin):
    zadmin._zabbix_version = (6, 4)
    zadmin.zapi.queue.get.return_value = [{"itemid": "1", "nextcheck": "100"}]
    zadmin.zapi.item.get.side_effect = Exception("zapi error")
    result = zadmin.get_queue_overview()
    assert result["total"] == 1


def test_get_queue_overview_queue_api_fails(zadmin):
    zadmin._zabbix_version = (6, 4)
    zadmin.zapi.queue.get.side_effect = Exception("queue not supported")
    result = zadmin.get_queue_overview()
    assert "error" in result


def test_get_queue_overview_zapi_none(zadmin):
    zadmin.zapi = None
    result = zadmin.get_queue_overview()
    assert result == {"items": [], "total": 0}


def test_get_settings_returns_dict(zadmin):
    zadmin.zapi.settings.get.return_value = {"hk_events_trigger": "365d"}
    result = zadmin.get_settings()
    assert result["hk_events_trigger"] == "365d"


def test_get_settings_exception_raises(zadmin):
    zadmin.zapi.settings.get.side_effect = Exception("zapi error")
    with pytest.raises(RuntimeError):
        zadmin.get_settings()


def test_update_housekeeping_success(zadmin):
    result = zadmin.update_housekeeping({"hk_events_trigger": "365d"})
    assert result is True


def test_update_housekeeping_zapi_none_raises(zadmin):
    zadmin.zapi = None
    with pytest.raises(RuntimeError):
        zadmin.update_housekeeping({"hk_events_trigger": "365d"})


def test_update_housekeeping_exception_raises(zadmin):
    zadmin.zapi.settings.update.side_effect = Exception("zapi error")
    with pytest.raises(RuntimeError):
        zadmin.update_housekeeping({"hk_events_trigger": "365d"})


# ─────────────────────────────────────────────────────────────────────────────
# api/deps.py — team_hostname_filter for non-root/auditor user
# ─────────────────────────────────────────────────────────────────────────────


def _make_conn_with_rows(rows):
    conn = MagicMock()
    cur = MagicMock()
    cur.fetchall.return_value = rows
    cur.__enter__ = lambda s: cur
    cur.__exit__ = MagicMock(return_value=False)
    conn.cursor.return_value = cur
    return conn


def test_team_hostname_filter_root_returns_none():
    from api.deps import team_hostname_filter

    user = {"roles": ["root"], "sub": "1"}
    result = team_hostname_filter(user)
    assert result is None


def test_team_hostname_filter_auditor_returns_none():
    from api.deps import team_hostname_filter

    user = {"roles": ["auditor"], "sub": "1"}
    result = team_hostname_filter(user)
    assert result is None


def test_team_hostname_filter_member_queries_db():
    conn = _make_conn_with_rows([{"hostname": "srv01"}, {"hostname": "srv02"}])
    with patch("api.deps.get_conn", return_value=conn):
        from api.deps import team_hostname_filter

        user = {"roles": ["member"], "sub": "5"}
        result = team_hostname_filter(user)
    assert result == {"srv01", "srv02"}


def test_team_hostname_filter_no_user_id_returns_empty():
    from api.deps import team_hostname_filter

    user = {"roles": ["member"], "sub": "0"}
    result = team_hostname_filter(user)
    assert result == set()
