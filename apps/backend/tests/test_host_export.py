"""Tests for Host_Manager/export.py."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("ZABBIX_URL", "http://fake-zabbix")
os.environ.setdefault("ZABBIX_USER", "Admin")
os.environ.setdefault("ZABBIX_PASS", "zabbix")

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture()
def mgr():
    with patch("zabbix_utils.ZabbixAPI"):
        from Host_Manager import Host_Manager

        m = Host_Manager()
        m.zapi = MagicMock()
        return m


def _host(hostid="1", host="srv01", name="Server 01", status="0", proxyid="0"):
    return {
        "hostid": hostid,
        "host": host,
        "name": name,
        "status": status,
        "description": "test host",
        "proxyid": proxyid,
        "proxy_hostid": proxyid,
        "interfaces": [
            {
                "type": "1",
                "ip": "10.0.0.1",
                "port": "10050",
                "available": "1",
            }
        ],
        "groups": [{"name": "Linux Servers"}],
        "parentTemplates": [{"name": "Linux by Zabbix agent"}],
    }


# ── _build_proxy_map ───────────────────────────────────────────────────────────


def test_build_proxy_map_returns_dict(mgr):
    mgr.zapi.proxy.get.return_value = [{"proxyid": "5", "name": "proxy-eu", "host": "proxy-eu"}]
    result = mgr._build_proxy_map()
    assert result["5"] == "proxy-eu"


def test_build_proxy_map_error_returns_empty(mgr):
    mgr.zapi.proxy.get.side_effect = Exception("zapi error")
    result = mgr._build_proxy_map()
    assert result == {}


# ── _fetch_export_rows ─────────────────────────────────────────────────────────


def test_fetch_export_rows_returns_list(mgr):
    mgr.zapi.host.get.return_value = [_host()]
    mgr.zapi.proxy.get.return_value = []
    rows = mgr._fetch_export_rows()
    assert len(rows) == 1
    assert rows[0][1] == "srv01"
    assert rows[0][5] == "10.0.0.1"


def test_fetch_export_rows_with_hostname_filter(mgr):
    mgr.zapi.host.get.return_value = [_host("1", "srv01"), _host("2", "srv02")]
    mgr.zapi.proxy.get.return_value = []
    rows = mgr._fetch_export_rows(hostname_filter={"srv01"})
    assert len(rows) == 1
    assert rows[0][1] == "srv01"


def test_fetch_export_rows_with_proxy(mgr):
    mgr.zapi.host.get.return_value = [_host(proxyid="5")]
    mgr.zapi.proxy.get.return_value = [{"proxyid": "5", "name": "proxy-eu", "host": "proxy-eu"}]
    rows = mgr._fetch_export_rows()
    assert rows[0][7] == "proxy-eu"


def test_fetch_export_rows_no_proxy_shows_dash(mgr):
    mgr.zapi.host.get.return_value = [_host(proxyid="0")]
    mgr.zapi.proxy.get.return_value = []
    rows = mgr._fetch_export_rows()
    assert rows[0][7] == "—"


def test_fetch_export_rows_disabled_host(mgr):
    mgr.zapi.host.get.return_value = [_host(status="1")]
    mgr.zapi.proxy.get.return_value = []
    rows = mgr._fetch_export_rows()
    assert rows[0][3] == "Disabled"


def test_fetch_export_rows_no_interfaces(mgr):
    h = _host()
    h["interfaces"] = []
    mgr.zapi.host.get.return_value = [h]
    mgr.zapi.proxy.get.return_value = []
    rows = mgr._fetch_export_rows()
    assert rows[0][5] == "N/A"


def test_fetch_export_rows_non_agent_interface_fallback(mgr):
    h = _host()
    h["interfaces"] = [{"type": "2", "ip": "10.0.0.2", "port": "161", "available": "1"}]
    mgr.zapi.host.get.return_value = [h]
    mgr.zapi.proxy.get.return_value = []
    rows = mgr._fetch_export_rows()
    assert rows[0][5] == "10.0.0.2"


# ── export_hosts_to_excel_bytes ────────────────────────────────────────────────


def test_export_hosts_to_excel_bytes_returns_bytes(mgr):
    mgr.zapi.host.get.return_value = [_host()]
    mgr.zapi.proxy.get.return_value = []
    result = mgr.export_hosts_to_excel_bytes()
    assert isinstance(result, bytes)
    assert len(result) > 0


def test_export_hosts_to_excel_bytes_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.export_hosts_to_excel_bytes()
    assert result is None


def test_export_hosts_to_excel_bytes_with_filter(mgr):
    mgr.zapi.host.get.return_value = [_host("1", "srv01"), _host("2", "srv02")]
    mgr.zapi.proxy.get.return_value = []
    result = mgr.export_hosts_to_excel_bytes(hostname_filter={"srv01"})
    assert isinstance(result, bytes)


def test_export_hosts_to_excel_bytes_exception_returns_none(mgr):
    mgr.zapi.host.get.side_effect = Exception("zapi error")
    mgr.zapi.proxy.get.return_value = []
    result = mgr.export_hosts_to_excel_bytes()
    assert result is None


# ── export_hosts_to_csv_bytes ──────────────────────────────────────────────────


def test_export_hosts_to_csv_bytes_returns_bytes(mgr):
    mgr.zapi.host.get.return_value = [_host()]
    mgr.zapi.proxy.get.return_value = []
    result = mgr.export_hosts_to_csv_bytes()
    assert isinstance(result, bytes)
    assert b"srv01" in result


def test_export_hosts_to_csv_bytes_zapi_none(mgr):
    mgr.zapi = None
    result = mgr.export_hosts_to_csv_bytes()
    assert result is None


def test_export_hosts_to_csv_bytes_with_filter(mgr):
    mgr.zapi.host.get.return_value = [_host("1", "srv01"), _host("2", "srv02")]
    mgr.zapi.proxy.get.return_value = []
    result = mgr.export_hosts_to_csv_bytes(hostname_filter={"srv01"})
    assert b"srv01" in result
    assert b"srv02" not in result


def test_export_hosts_to_csv_bytes_exception_returns_none(mgr):
    mgr.zapi.host.get.side_effect = Exception("zapi error")
    mgr.zapi.proxy.get.return_value = []
    result = mgr.export_hosts_to_csv_bytes()
    assert result is None


# ── export_hosts_to_excel (file path variant) ──────────────────────────────────


def test_export_hosts_to_excel_writes_file(mgr, tmp_path):
    mgr.zapi.host.get.return_value = [_host()]
    mgr.zapi.proxy.get.return_value = []
    out_path = str(tmp_path / "out.xlsx")
    result = mgr.export_hosts_to_excel(file_path=out_path)
    assert result == out_path
    assert Path(out_path).exists()


def test_export_hosts_to_excel_zapi_none_returns_none(mgr):
    mgr.zapi = None
    result = mgr.export_hosts_to_excel()
    assert result is None
