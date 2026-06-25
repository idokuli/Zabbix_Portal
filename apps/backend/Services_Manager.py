import json
import logging
import re
import time

from Zabbix_Base import Zabbix_Base

logger = logging.getLogger(__name__)

SERVICE_ALGORITHM = {
    0: "Set manually",
    1: "Most critical of children",
    2: "Most critical of child problems",
}
SLA_PERIOD = {
    "PERIOD_DAILY": "Daily",
    "PERIOD_WEEKLY": "Weekly",
    "PERIOD_MONTHLY": "Monthly",
    "PERIOD_QUARTERLY": "Quarterly",
    "PERIOD_ANNUALLY": "Annually",
}


class Services_Manager(Zabbix_Base):
    def __init__(self):
        super().__init__()
        logger.info("Services Manager ready.")

    # ── Services ───────────────────────────────────────────────────────

    def list_services(self, parentid: str | None = None) -> list[dict]:
        if not self.zapi:
            return []
        try:
            params: dict = dict(
                output=[
                    "serviceid",
                    "name",
                    "algorithm",
                    "sortorder",
                    "weight",
                    "status",
                    "description",
                ],
                selectChildren=["serviceid", "name"],
                selectParents=["serviceid", "name"],
                selectTags=["tag", "value"],
                sortfield="name",
            )
            if parentid:
                params["parentids"] = [parentid]
            services = self.zapi.service.get(**params)
            return [
                {
                    "serviceid": s["serviceid"],
                    "name": s["name"],
                    "algorithm": int(s.get("algorithm", 0)),
                    "algorithm_label": SERVICE_ALGORITHM.get(
                        int(s.get("algorithm", 0)), "Set manually"
                    ),
                    "sortorder": int(s.get("sortorder", 0)),
                    "weight": int(s.get("weight", 0)),
                    "status": int(s.get("status", -1)),
                    "description": s.get("description", ""),
                    "tags": s.get("tags", []),
                    "children": s.get("children", []),
                    "parents": s.get("parents", []),
                }
                for s in services
            ]
        except Exception:
            logger.exception("list_services failed")
            return []

    def create_service(
        self,
        name: str,
        algorithm: int = 0,
        sortorder: int = 0,
        weight: int = 0,
        description: str = "",
    ) -> str:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            result = self.zapi.service.create(
                name=name,
                algorithm=algorithm,
                sortorder=sortorder,
                weight=weight,
                description=description,
            )
            return result["serviceids"][0]
        except Exception as e:
            raise RuntimeError(str(e))

    def delete_service(self, serviceid: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.service.delete([serviceid])
            return True
        except Exception as e:
            raise RuntimeError(str(e))

    def update_service(
        self,
        serviceid: str,
        name: str | None = None,
        algorithm: int | None = None,
        description: str | None = None,
    ) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            params: dict = {"serviceid": serviceid}
            if name is not None:
                params["name"] = name
            if algorithm is not None:
                params["algorithm"] = algorithm
            if description is not None:
                params["description"] = description
            self.zapi.service.update(**params)
            return True
        except Exception as e:
            raise RuntimeError(str(e))

    # ── SLA ────────────────────────────────────────────────────────────

    def list_slas(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            slas = self.zapi.sla.get(
                output=[
                    "slaid",
                    "name",
                    "slo",
                    "period",
                    "timezone",
                    "description",
                    "status",
                    "effective_date",
                ],
                selectServiceTags=["tag", "value"],
                sortfield="name",
            )
            return [
                {
                    "slaid": s["slaid"],
                    "name": s["name"],
                    "slo": float(s.get("slo", 99.9)),
                    "period": s.get("period", "PERIOD_MONTHLY"),
                    "period_label": SLA_PERIOD.get(
                        s.get("period", "PERIOD_MONTHLY"), s.get("period", "")
                    ),
                    "timezone": s.get("timezone", "UTC"),
                    "description": s.get("description", ""),
                    "status": int(s.get("status", 0)),
                    "effective_date": int(s.get("effective_date", 0)),
                    "service_tags": s.get("serviceTags", s.get("service_tags", [])),
                }
                for s in slas
            ]
        except Exception:
            logger.exception("list_slas failed")
            return []

    def create_sla(
        self,
        name: str,
        slo: float,
        period: str = "PERIOD_MONTHLY",
        timezone: str = "UTC",
        description: str = "",
        service_tags: list | None = None,
    ) -> str:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            result = self.zapi.sla.create(
                name=name,
                slo=str(slo),
                period=period,
                timezone=timezone,
                description=description,
                status=0,
                effective_date=0,
                service_tags=service_tags or [],
                schedule=[{"period_from": 0, "period_to": 86400} for _ in range(7)],
            )
            return result["slaids"][0]
        except Exception as e:
            raise RuntimeError(str(e))

    def delete_sla(self, slaid: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.sla.delete([slaid])
            return True
        except Exception as e:
            raise RuntimeError(str(e))

    def get_sla_report(self, slaid: str, periods: int = 3) -> list[dict]:
        if not self.zapi:
            return []
        try:
            result = self.zapi.sla.getsli(slaid=slaid, periods=periods)
            return result if isinstance(result, list) else [result]
        except Exception as e:
            logger.warning("sla.getsli failed: %s", e)
            return []

    # ── Health Monitors ────────────────────────────────────────────────

    @staticmethod
    def _hm_slug(name: str) -> str:
        slug = re.sub(r"[^a-z0-9]", "_", name.lower().strip())[:30].strip("_")
        return slug or "monitor"

    def add_health_monitor(
        self,
        hostid: str,
        name: str,
        url: str,
        expected_contains: str = "ok",
        process_name: str | None = None,
    ) -> dict:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            http_key = f"health.http[{self._hm_slug(name)}]"
            if self.zapi.item.get(
                hostids=[hostid], filter={"key_": http_key}, output=["itemid"]
            ):
                raise RuntimeError(
                    "A health monitor with a similar name already exists on this host."
                )

            proc_itemid = None
            proc_created = False
            if process_name:
                proc_key = f"proc.num[{process_name}]"
                existing_proc = self.zapi.item.get(
                    hostids=[hostid], filter={"key_": proc_key}, output=["itemid"]
                )
                if existing_proc:
                    proc_itemid = existing_proc[0]["itemid"]
                else:
                    r = self.zapi.item.create(
                        hostid=hostid,
                        name=f"[HealthMon] Process: {process_name}",
                        key_=proc_key,
                        type=0,
                        value_type=3,
                        delay="1m",
                    )
                    proc_itemid = r["itemids"][0]
                    proc_created = True

            description = json.dumps(
                {
                    "health_monitor": True,
                    "expected": expected_contains,
                    "url": url,
                    "proc_itemid": proc_itemid,
                    "proc_created": proc_created,
                }
            )
            result = self.zapi.item.create(
                hostid=hostid,
                name=f"[HealthMon] {name}",
                key_=http_key,
                type=19,
                value_type=4,
                url=url,
                request_method=0,
                retrieve_mode=0,
                delay="1m",
                timeout="15s",
                description=description,
            )
            return {"itemid": result["itemids"][0], "proc_itemid": proc_itemid}
        except RuntimeError:
            raise
        except Exception as e:
            raise RuntimeError(str(e))

    def list_health_monitors(self, hostid: str | None = None) -> list[dict]:
        if not self.zapi:
            return []
        try:
            params: dict = dict(
                search={"key_": "health.http["},
                startSearch=True,
                output=[
                    "itemid",
                    "name",
                    "key_",
                    "lastvalue",
                    "lastclock",
                    "state",
                    "description",
                    "hostid",
                ],
                selectHosts=["hostid", "host"],
            )
            if hostid:
                params["hostids"] = [hostid]
            items = self.zapi.item.get(**params)

            configs = []
            proc_itemids = []
            for item in items:
                try:
                    config = json.loads(item.get("description", "{}") or "{}")
                except Exception:
                    config = {}
                configs.append(config)
                if config.get("proc_itemid"):
                    proc_itemids.append(config["proc_itemid"])

            proc_map: dict = {}
            if proc_itemids:
                proc_items = self.zapi.item.get(
                    itemids=proc_itemids,
                    output=["itemid", "lastvalue", "lastclock", "state"],
                )
                proc_map = {p["itemid"]: p for p in proc_items}

            now = time.time()
            result = []
            for item, config in zip(items, configs):
                state = int(item.get("state", 0))
                lastclock = int(item.get("lastclock") or 0)
                lastvalue = item.get("lastvalue", "") or ""
                expected = config.get("expected", "ok")
                proc_itemid = config.get("proc_itemid")

                if proc_itemid and proc_itemid in proc_map:
                    proc = proc_map[proc_itemid]
                    proc_clock = int(proc.get("lastclock") or 0)
                    running = (
                        int(proc.get("state", 1)) == 0
                        and proc_clock > 0
                        and (now - proc_clock) < 600
                        and (proc.get("lastvalue") or "0").strip() == "1"
                    )
                else:
                    running = state == 0 and lastclock > 0 and (now - lastclock) < 600

                working = running and expected.lower() in lastvalue.lower()
                host_info = (item.get("hosts") or [{}])[0]

                result.append(
                    {
                        "itemid": item["itemid"],
                        "name": item["name"].removeprefix("[HealthMon] "),
                        "host": host_info.get("host", ""),
                        "hostid": item.get("hostid", ""),
                        "url": config.get("url", ""),
                        "expected": expected,
                        "running": running,
                        "working": working,
                        "last_value": lastvalue[:200] if lastvalue else None,
                        "last_check": lastclock or None,
                        "proc_itemid": proc_itemid,
                        "has_proc_check": bool(proc_itemid),
                    }
                )
            return result
        except Exception as e:
            logger.exception("list_health_monitors failed")
            raise RuntimeError(str(e))

    def delete_health_monitor(self, itemid: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            items = self.zapi.item.get(
                itemids=[itemid], output=["itemid", "description"]
            )
            if not items:
                raise RuntimeError("Item not found")
            try:
                config = json.loads(items[0].get("description", "{}") or "{}")
            except Exception:
                config = {}
            self.zapi.item.delete([itemid])
            proc_itemid = config.get("proc_itemid")
            if proc_itemid and config.get("proc_created"):
                try:
                    self.zapi.item.delete([proc_itemid])
                except Exception:
                    pass
            return True
        except RuntimeError:
            raise
        except Exception as e:
            raise RuntimeError(str(e))
