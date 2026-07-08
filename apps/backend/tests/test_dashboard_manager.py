"""Tests for Dashboard_Manager.py."""

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
        from Dashboard_Manager import Dashboard_Manager

        m = Dashboard_Manager()
        m.zapi = MagicMock()
        m._cache = {}
        return m


def test_get_graphs_returns_list(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "1"}]
    mgr.zapi.graph.get.return_value = [
        {"graphid": "10", "name": "CPU load", "width": "900", "height": "200"}
    ]
    result = mgr.get_graphs()
    assert isinstance(result, list)


def test_get_graphs_with_hostid(mgr):
    mgr.zapi.graph.get.return_value = [
        {"graphid": "10", "name": "Memory", "width": "900", "height": "200"}
    ]
    result = mgr.get_graphs(hostid="5")
    assert isinstance(result, list)


def test_get_graphs_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_graphs()
    assert result == []


def test_get_graph_data_returns_dict(mgr):
    mgr.zapi.graph.get.return_value = [
        {
            "graphid": "10",
            "name": "CPU",
            "gitems": [{"itemid": "42", "color": "FF0000", "sortorder": "0"}],
        }
    ]
    mgr.zapi.item.get.return_value = [
        {
            "itemid": "42",
            "value_type": "0",
            "name": "cpu",
            "units": "%",
            "hosts": [{"host": "srv01"}],
        }
    ]
    mgr.zapi.history.get.return_value = [
        {"clock": "1700000000", "value": "10.5"},
        {"clock": "1700000060", "value": "12.0"},
    ]
    result = mgr.get_graph_data("10", minutes=60)
    assert isinstance(result, dict)
    assert "graph" in result


def test_get_graph_data_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_graph_data("10")
    assert result == {"graph": {}, "series": []}


def test_get_hosts_metrics_returns_list(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "1", "host": "web01", "status": "0"}]

    # _batch("system.cpu.util") returns item with hosts list → cpu_map populated
    def _item_get(**kw):
        search = kw.get("search", {})
        key = search.get("key_", "")
        if "cpu" in key:
            return [{"lastvalue": "25.3", "hosts": [{"hostid": "1"}]}]
        if "vm.memory.utilization" in key:
            return [{"lastvalue": "60.0", "hosts": [{"hostid": "1"}]}]
        return []

    mgr.zapi.item.get.side_effect = _item_get
    result = mgr.get_hosts_metrics()
    assert isinstance(result, list)
    assert result[0]["hostname"] == "web01"
    assert result[0].get("cpu_util") == 25.3


def test_get_hosts_metrics_mem_avail_fallback(mgr):
    mgr.zapi.host.get.return_value = [{"hostid": "2", "host": "db01", "status": "0"}]

    def _item_get(**kw):
        search = kw.get("search", {})
        key = search.get("key_", "")
        if "pavailable" in key:
            return [{"lastvalue": "30.0", "hosts": [{"hostid": "2"}]}]
        if "pused" in key:
            return [{"lastvalue": "55.0", "hosts": [{"hostid": "2"}]}]
        return []

    mgr.zapi.item.get.side_effect = _item_get
    result = mgr.get_hosts_metrics()
    assert isinstance(result, list)
    assert result[0].get("mem_util") == 70.0  # 100 - 30
    assert result[0].get("disk_util") == 55.0


def test_get_hosts_metrics_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_hosts_metrics()
    assert result == []


def test_get_recent_items_returns_list(mgr):
    mgr.zapi.item.get.return_value = [
        {
            "itemid": "1",
            "name": "CPU",
            "key_": "system.cpu.load",
            "delay": "1m",
            "lastvalue": "55",
            "lastclock": "1700000000",
            "value_type": "0",
            "units": "%",
            "hosts": [{"host": "srv01", "hostid": "5"}],
        }
    ]
    result = mgr.get_recent_items(limit=10)
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["hostname"] == "srv01"


def test_get_recent_items_no_lastclock(mgr):
    mgr.zapi.item.get.return_value = [
        {
            "itemid": "2",
            "name": "Disk",
            "key_": "vfs.fs.size",
            "delay": "5m",
            "lastvalue": "",
            "lastclock": "",
            "value_type": "3",
            "units": "B",
            "hosts": [],
        }
    ]
    result = mgr.get_recent_items()
    assert result[0]["lastclock"] is None
    assert result[0]["hostname"] == "Unknown"


def test_get_recent_items_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.get_recent_items()
    assert result == []


def test_get_graph_data_empty_graph(mgr):
    mgr.zapi.graph.get.return_value = []
    result = mgr.get_graph_data("99")
    assert result == {"graph": {}, "series": []}


def test_get_graph_data_no_gitems(mgr):
    mgr.zapi.graph.get.return_value = [{"graphid": "5", "name": "Empty", "gitems": []}]
    result = mgr.get_graph_data("5")
    assert result["graph"]["graphid"] == "5"
    assert result["series"] == []


def test_get_graph_data_non_numeric_value_type(mgr):
    mgr.zapi.graph.get.return_value = [
        {
            "graphid": "10",
            "name": "Logs",
            "gitems": [{"itemid": "42", "color": "FF0000", "sortorder": "0"}],
        }
    ]
    mgr.zapi.item.get.return_value = [
        {"itemid": "42", "value_type": "2", "name": "Log item", "units": ""}
    ]
    result = mgr.get_graph_data("10")
    assert result["series"] == []


def test_resolve_base_web_url():
    with patch("zabbix_utils.ZabbixAPI"):
        import os

        os.environ["ZABBIX_URL"] = "http://zabbix.corp/api_jsonrpc.php"
        from Dashboard_Manager import Dashboard_Manager

        m = Dashboard_Manager()
        m.zapi = MagicMock()
    assert m._base_web_url == "http://zabbix.corp"


def test_get_graph_image_web_session_returns_bytes(mgr):
    fake_session = MagicMock()
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.headers = {"Content-Type": "image/png"}
    fake_resp.content = b"\x89PNG"
    fake_session.get.return_value = fake_resp
    mgr._web_session = fake_session
    result = mgr.get_graph_image("10")
    assert result == b"\x89PNG"


def test_get_graph_image_no_session_returns_none(mgr):
    mgr._web_session = None
    with patch.object(mgr, "_login_web", return_value=None):
        result = mgr.get_graph_image("10")
    assert result is None


def test_login_web_success(mgr):
    with patch("Dashboard_Manager._req.Session") as mock_sess_cls:
        sess = MagicMock()
        resp = MagicMock()
        resp.status_code = 200
        sess.post.return_value = resp
        mock_sess_cls.return_value = sess
        result = mgr._login_web()
    assert result is sess
