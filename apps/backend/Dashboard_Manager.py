import logging
import os
import time
from typing import Any

import requests as _req

from Zabbix_Base import Zabbix_Base

logger = logging.getLogger(__name__)


def _safe_float(val: object) -> float | None:
    try:
        return float(str(val))
    except (ValueError, TypeError):
        return None


class Dashboard_Manager(Zabbix_Base):
    def __init__(self) -> None:
        super().__init__()
        self._web_session: _req.Session | None = None
        self._base_web_url: str = self._resolve_base_web_url()
        logger.info("Dashboard Manager ready.")

    # ── Web session (for proxying native Zabbix graph images) ─────────

    def _resolve_base_web_url(self) -> str:
        """Strip API path suffix to get the Zabbix web base URL."""
        url = os.getenv("ZABBIX_URL", "").strip().rstrip("/")
        for suffix in ("/api_jsonrpc.php", "/zabbix/api_jsonrpc.php"):
            if url.endswith(suffix):
                url = url[: -len(suffix)]
                break
        return url

    def _login_web(self) -> _req.Session | None:
        user = os.getenv("ZABBIX_USER", "Admin")
        password = os.getenv("ZABBIX_PASS", "zabbix")
        session = _req.Session()
        try:
            resp = session.post(
                f"{self._base_web_url}/index.php",
                data={"name": user, "password": password, "enter": "Sign in"},
                timeout=10,
                verify=False,
                allow_redirects=True,
            )
            if resp.status_code == 200:
                self._web_session = session
                return session
        except Exception:
            logger.exception("Zabbix web login failed")
        return None

    def _web(self) -> _req.Session | None:
        if self._web_session is None:
            self._web_session = self._login_web()
        return self._web_session

    # ── Graph discovery ───────────────────────────────────────────────

    def get_graphs(self, hostid: str | None = None) -> list[dict]:
        """List Zabbix graphs, optionally filtered to one host."""
        if not self.zapi:
            return []
        try:
            kwargs: dict = dict(
                output=["graphid", "name", "width", "height", "graphtype"],
                selectHosts=["hostid", "host"],
                sortfield="name",
            )
            if hostid:
                kwargs["hostids"] = [hostid]
            graphs = self.zapi.graph.get(**kwargs)
            for g in graphs:
                hosts = ", ".join(h["host"] for h in g.get("hosts", []))
                if hosts:
                    g["name"] = f"{g['name']} ({hosts})"
            return graphs
        except Exception:
            logger.exception("get_graphs failed")
            return []

    # ── Native graph image proxy ──────────────────────────────────────

    def get_graph_image(
        self, graphid: str, period: int = 3600, width: int = 900, height: int = 200
    ) -> bytes | None:
        """Proxy the Zabbix-rendered PNG for a graph."""
        # Do not send stime — let Zabbix compute "now - period" in its own
        # server timezone. Sending stime in UTC causes a timezone mismatch
        # that shifts the rendered window and shows [no data].
        params: dict[str, Any] = {
            "graphid": graphid,
            "period": period,
            "width": width,
            "height": height,
        }

        def _fetch(session: _req.Session) -> bytes | None:
            try:
                resp = session.get(
                    f"{self._base_web_url}/chart2.php",
                    params=params,
                    timeout=15,
                    verify=False,
                )
                ct = resp.headers.get("Content-Type", "")
                if resp.status_code == 200 and "image" in ct:
                    return resp.content
            except Exception:
                logger.exception("chart2.php request failed")
            return None

        session = self._web()
        if not session:
            return None
        result = _fetch(session)
        if result:
            return result
        # Session may have expired — refresh once
        self._web_session = None
        session = self._login_web()
        return _fetch(session) if session else None

    # ── Chart.js data for a graph ─────────────────────────────────────

    def _fetch_series_points(
        self,
        itemid: str,
        vtype: int,
        time_from: int,
        time_till: int,
        minutes: int,
    ) -> list[dict]:
        if minutes > 1440:
            raw = self.zapi.trend.get(
                itemids=[itemid],
                time_from=time_from,
                time_till=time_till,
                output=["clock", "value_avg"],
                sortfield="clock",
                sortorder="ASC",
            )
            return [{"clock": int(r["clock"]), "value": float(r["value_avg"])} for r in raw]
        raw = self.zapi.history.get(
            itemids=[itemid],
            history=vtype,
            time_from=time_from,
            time_till=time_till,
            output=["clock", "value"],
            sortfield="clock",
            sortorder="DESC",
            limit=5000,
        )
        return [{"clock": int(r["clock"]), "value": float(r["value"])} for r in reversed(raw)]

    def get_graph_data(self, graphid: str, minutes: int = 360) -> dict:
        """Return history series for every numeric item in a graph."""
        if not self.zapi:
            return {"graph": {}, "series": []}
        try:
            graphs = self.zapi.graph.get(
                graphids=[graphid],
                output=["graphid", "name"],
                selectGraphItems=["itemid", "color", "drawtype", "sortorder"],
            )
            if not graphs:
                return {"graph": {}, "series": []}
            graph = graphs[0]
            gitems = sorted(graph.get("gitems", []), key=lambda x: int(x.get("sortorder", 0)))
            if not gitems:
                return {
                    "graph": {"graphid": graph["graphid"], "name": graph["name"]},
                    "series": [],
                }

            item_ids = [gi["itemid"] for gi in gitems]
            items_data = self.zapi.item.get(
                itemids=item_ids,
                output=["itemid", "name", "value_type", "units"],
            )
            item_map = {item["itemid"]: item for item in items_data}

            time_till = int(time.time())
            time_from = time_till - minutes * 60
            series = []
            for gi in gitems:
                item = item_map.get(gi["itemid"])
                if not item:
                    continue
                vtype = int(item["value_type"])
                if vtype not in (0, 3):
                    continue
                try:
                    points = self._fetch_series_points(
                        gi["itemid"], vtype, time_from, time_till, minutes
                    )
                except Exception:
                    logger.exception("history.get failed for item %s", gi["itemid"])
                    continue
                color = gi.get("color", "3B82F6")
                if color and not color.startswith("#"):
                    color = f"#{color}"
                series.append(
                    {
                        "itemid": item["itemid"],
                        "name": item["name"],
                        "units": item.get("units", ""),
                        "color": color or "#3B82F6",
                        "points": points,
                    }
                )
            return {
                "graph": {"graphid": graph["graphid"], "name": graph["name"]},
                "series": series,
            }
        except Exception:
            logger.exception("get_graph_data failed")
            return {"graph": {}, "series": []}

    # ── All-hosts metrics overview ────────────────────────────────────

    def _batch_lastvalue_by_host(self, key: str) -> dict[str, str]:
        """Return {hostid: lastvalue} for all items matching key."""
        items = self.zapi.item.get(
            search={"key_": key},
            searchWildcardsEnabled=True,
            output=["lastvalue"],
            selectHosts=["hostid"],
            filter={"state": "0"},
        )
        result: dict[str, str] = {}
        for item in items:
            for host in item.get("hosts", []):
                result[host["hostid"]] = item.get("lastvalue", "")
        return result

    @staticmethod
    def _build_host_metrics_entry(
        host: dict, cpu_map: dict, mem_map: dict, mem_avail_map: dict, disk_map: dict
    ) -> dict:
        hid = host["hostid"]
        entry: dict = {"hostid": hid, "hostname": host["host"]}

        if cpu_map.get(hid):
            v = _safe_float(cpu_map[hid])
            if v is not None:
                entry["cpu_util"] = round(v, 1)

        if mem_map.get(hid):
            v = _safe_float(mem_map[hid])
            if v is not None:
                entry["mem_util"] = round(v, 1)
        elif mem_avail_map.get(hid):
            v = _safe_float(mem_avail_map[hid])
            if v is not None:
                entry["mem_util"] = round(100 - v, 1)

        if disk_map.get(hid):
            v = _safe_float(disk_map[hid])
            if v is not None:
                entry["disk_util"] = round(v, 1)

        return entry

    def get_hosts_metrics(self) -> list[dict]:
        """Return last CPU / memory / disk values for every enabled host."""
        if not self.zapi:
            return []
        try:
            cpu_map = self._batch_lastvalue_by_host("system.cpu.util")
            mem_map = self._batch_lastvalue_by_host("vm.memory.utilization")
            mem_avail_map = self._batch_lastvalue_by_host("vm.memory.size[pavailable]")
            disk_map = self._batch_lastvalue_by_host("vfs.fs.size[/,pused]")

            hosts = self.zapi.host.get(
                output=["hostid", "host", "status"],
                filter={"status": "0"},
                limit=200,
            )

            return [
                self._build_host_metrics_entry(host, cpu_map, mem_map, mem_avail_map, disk_map)
                for host in hosts
            ]
        except Exception:
            logger.exception("get_hosts_metrics failed")
            return []

    # ── Recently created items ─────────────────────────────────────────

    def get_recent_items(self, limit: int = 30) -> list[dict]:
        """Return the most recently created non-inherited items."""
        if not self.zapi:
            return []
        try:
            items = self.zapi.item.get(
                output=[
                    "itemid",
                    "name",
                    "key_",
                    "value_type",
                    "delay",
                    "lastvalue",
                    "lastclock",
                    "units",
                ],
                selectHosts=["host", "hostid"],
                sortfield="itemid",
                sortorder="DESC",
                inherited=False,
                limit=limit,
            )
            result = []
            for item in items:
                hosts = item.get("hosts", [])
                result.append(
                    {
                        "itemid": item["itemid"],
                        "name": item["name"],
                        "key_": item["key_"],
                        "value_type": item["value_type"],
                        "delay": item["delay"],
                        "lastvalue": item.get("lastvalue", ""),
                        "units": item.get("units", ""),
                        "lastclock": int(item["lastclock"]) if item.get("lastclock") else None,
                        "hostname": hosts[0]["host"] if hosts else "Unknown",
                    }
                )
            return result
        except Exception:
            logger.exception("get_recent_items failed")
            return []
