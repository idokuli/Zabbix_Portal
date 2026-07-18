"""Item processing queue overview, and global settings / housekeeping."""

import logging
from Zabbix_Base import zabbix_err
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class SystemMixin:
    """Mixed into ZabbixAdmin_Manager. Assumes `self.zapi`/`self._zabbix_version` from Zabbix_Base."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"
        _zabbix_version: tuple[int, int]

    def get_queue_overview(self) -> dict:
        if not self.zapi:
            return {"items": [], "total": 0}
        # queue.get was removed in Zabbix 7.0
        if self._zabbix_version >= (7, 0):
            return {
                "items": [],
                "total": 0,
                "error": f"Queue API was removed in Zabbix {self._zabbix_version[0]}.x. Check the item queue directly in the Zabbix web UI under Administration → Queue.",
            }
        try:
            overview = self.zapi.queue.get(output="extend", limit=500)
            # Enrich with host + item names
            item_ids = [o["itemid"] for o in overview if o.get("itemid")]
            name_map: dict[str, dict] = {}
            if item_ids:
                try:
                    items = self.zapi.item.get(
                        itemids=item_ids,
                        output=["itemid", "name"],
                        selectHosts=["host"],
                    )
                    for it in items:
                        host = (it.get("hosts") or [{}])[0].get("host", "")
                        name_map[it["itemid"]] = {
                            "item_name": it["name"],
                            "hostname": host,
                        }
                except Exception as exc:
                    logger.debug("Failed to enrich item queue with host/item names: %s", exc)
            enriched = []
            for o in overview:
                info = name_map.get(o.get("itemid", ""), {})
                enriched.append({**o, **info})
            enriched.sort(key=lambda x: int(x.get("nextcheck", 0)))
            return {"items": enriched, "total": len(enriched)}
        except Exception as e:
            logger.warning("queue.get failed: %s", e)
            return {"items": [], "total": 0, "error": zabbix_err(e)}

    def get_settings(self) -> dict:
        if not self.zapi:
            return {}
        try:
            return self.zapi.settings.get(output="extend")
        except Exception as e:
            logger.exception("get_settings failed")
            raise RuntimeError(str(e)) from e

    def update_housekeeping(self, params: dict) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.settings.update(**params)
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e
