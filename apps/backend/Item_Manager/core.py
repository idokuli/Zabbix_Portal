"""Core item CRUD: generic agent items, listing, lookup, deletion, update."""

import logging
from typing import TYPE_CHECKING, Any
from collections.abc import Callable

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)

_ZABBIX_NOT_CONNECTED = "Zabbix API not connected."


class CoreItemsMixin:
    """Mixed into Item_Manager. Assumes `self.zapi`/`self._invalidate`/`self._cached` from Zabbix_Base."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"
        _invalidate: Callable[[str], None]
        _cached: Callable[..., Any]

    def _pick_interface(self, interfaces: list[dict], iface_type: str) -> dict:
        """Prefer a host interface of the given Zabbix type (1=agent, 2=SNMP, 3=IPMI,
        4=JMX); fall back to the first interface if the host has none of that type."""
        return next((i for i in interfaces if str(i.get("type")) == iface_type), interfaces[0])

    def add_item(
        self,
        hostname,
        item_name,
        item_key,
        value_type=3,
        team_name: str = "",
        delay: str = "1m",
        units: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
        status: int = 0,
        timeout: str = "",
    ) -> tuple[str | None, str | None]:
        """
        Adds a new monitoring item to an existing host.
        value_type: 0=float, 1=string, 2=log, 3=integer, 4=text
        Returns (item_id, error_message). item_id is None on failure.
        """
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED

        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found in Zabbix."

            host_id = host_data[0]["hostid"]

            interfaces = self.zapi.hostinterface.get(hostids=host_id)
            if not interfaces:
                return None, f"No interfaces found for host '{hostname}'."
            # Prefer the Zabbix agent interface (type 1) — these items are type=0
            # (Zabbix agent) and Zabbix rejects them on a non-agent interface.
            interface_id = self._pick_interface(interfaces, "1")["interfaceid"]

            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                interfaceid=interface_id,
                type=0,  # Zabbix Agent (Passive)
                value_type=value_type,
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
                status=status,
            )
            if units:
                kwargs["units"] = units
            if description:
                kwargs["description"] = description
            if timeout:
                kwargs["timeout"] = timeout
            # Only attach tags when non-empty — some older Zabbix versions reject tags=[]
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]

            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "Item %r (key: %s) added to %r (ID: %s).",
                item_name,
                item_key,
                hostname,
                item_id,
            )
            self._invalidate(f"items_host_{hostname}")
            return item_id, None

        except Exception as e:
            msg = str(e)
            logger.exception("add_item(%r, %r) failed", hostname, item_name)
            return None, msg

    def list_items(self, hostname: str, include_inherited: bool = False) -> list[dict]:
        """List items on a host. include_inherited=True returns template items too."""
        if not self.zapi:
            return []
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return []
            kwargs: dict = dict(
                hostids=host_data[0]["hostid"],
                output=["itemid", "name", "key_", "value_type", "delay"],
                selectTags=["tag", "value"],
            )
            if not include_inherited:
                kwargs["inherited"] = False
            return self.zapi.item.get(**kwargs)
        except Exception:
            logger.exception("list_items(%r) failed", hostname)
            return []

    def get_item_hostname(self, itemid: str) -> str:
        """Return the host name for an item, or '' if not found."""
        if not self.zapi:
            return ""
        try:
            items = self.zapi.item.get(itemids=[itemid], output=["itemid"], selectHosts=["host"])
            if items and items[0].get("hosts"):
                return items[0]["hosts"][0]["host"]
        except Exception as exc:
            logger.debug("get_hostname_for_item failed: %s", exc)
        return ""

    def delete_item(self, itemid: str) -> bool:
        """Delete an item by ID."""
        if not self.zapi:
            return False
        try:
            self.zapi.item.delete([itemid])
            logger.info("Deleted item ID %s.", itemid)
            return True
        except Exception:
            logger.exception("delete_item(%s) failed", itemid)
            return False

    def update_item(
        self,
        itemid: str,
        name: str | None = None,
        delay: str | None = None,
        status: str | None = None,
        key_: str | None = None,
    ) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            params: dict = {"itemid": itemid}
            if name is not None:
                params["name"] = name
            if delay is not None:
                params["delay"] = delay
            if status is not None:
                params["status"] = int(status)
            if key_ is not None:
                params["key_"] = key_
            self.zapi.item.update(**params)
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def list_all_items(
        self,
        search: str = "",
        hostname: str = "",
        limit: int = 2000,
    ) -> list[dict]:
        """List items across all hosts. Custom (non-template) items are sorted first."""
        # Cache per-host unfiltered results for 30 s; bypass cache for searches
        if hostname and not search:
            cache_key = f"items_host_{hostname}"
            return self._cached(
                cache_key, 30.0, lambda: self._fetch_all_items(search, hostname, limit)
            )
        return self._fetch_all_items(search, hostname, limit)

    def _fetch_all_items(
        self,
        search: str = "",
        hostname: str = "",
        limit: int = 2000,
    ) -> list[dict]:
        if not self.zapi:
            raise RuntimeError(_ZABBIX_NOT_CONNECTED)
        # Fetch more than the requested limit so we can sort custom items first
        # then truncate — avoids template items crowding out user-created ones.
        fetch_limit = min(limit * 3, 5000)
        kwargs: dict = dict(
            output=[
                "itemid",
                "name",
                "key_",
                "value_type",
                "delay",
                "status",
                "state",
                "lastvalue",
                "lastclock",
                "templateid",
            ],
            selectHosts=["host"],
            selectTags=["tag", "value"],
            limit=fetch_limit,
            sortfield="name",
            sortorder="ASC",
        )
        if hostname:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return []
            kwargs["hostids"] = host_data[0]["hostid"]
        if search:
            kwargs["search"] = {"name": search, "key_": search}
            kwargs["searchByAny"] = True
        items = self.zapi.item.get(**kwargs)
        result = []
        for item in items:
            hosts = item.get("hosts") or []
            lc = item.get("lastclock")
            result.append(
                {
                    "itemid": item["itemid"],
                    "name": item["name"],
                    "key_": item["key_"],
                    "value_type": item["value_type"],
                    "delay": item["delay"],
                    "status": item["status"],
                    "state": item.get("state", "0"),
                    "hostname": hosts[0]["host"] if hosts else "",
                    "tags": item.get("tags", []),
                    "lastvalue": item.get("lastvalue", ""),
                    "lastclock": int(lc) if lc else None,
                    "templateid": item.get("templateid", "0"),
                }
            )
        # Custom items (templateid=0 = created directly, not from template) come first
        result.sort(key=lambda x: (0 if str(x["templateid"]) == "0" else 1, x["name"].lower()))
        logger.info(
            "list_all_items: returned %d items (search=%r, host=%r).",
            len(result),
            search,
            hostname,
        )
        return result[:limit]

    # Zabbix item types 0 (Zabbix agent, passive) and 7 (Zabbix agent, active) —
    # the only types this UI's Agent item panel creates (see add_item(), type=0).
    _AGENT_ITEM_TYPES = {"0", "7"}

    def get_all_item_keys(self, hostname: str) -> list[dict]:
        """Return Zabbix-agent-type item keys defined in templates linked to
        `hostname`, grouped by template name. Also includes delay, units, history,
        trends, description so the UI can pre-fill the add-item form when the user
        selects a known template key. Only used by the Agent item panel, so results
        are restricted to agent-type template items (type 0/7) — SNMP/HTTP/trapper/
        etc. keys from other item types aren't valid for the agent items this
        endpoint feeds. Scoped to the host's own templates (e.g. a Linux host only
        offers keys from "Linux by Zabbix agent"-style templates it's linked to)
        rather than every template in the whole Zabbix instance.
        """
        if not self.zapi:
            return []
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output="extend")
            if not host_data:
                logger.debug("get_all_item_keys: no Zabbix host matching %r.", hostname)
                return []
            host_id = host_data[0]["hostid"]

            templates = self.zapi.template.get(output="extend", hostids=[host_id])
            if not templates:
                return []
            template_ids = [t["templateid"] for t in templates]
            template_name_map = {t["templateid"]: t["name"] for t in templates}

            items = self.zapi.item.get(output="extend", hostids=template_ids)
            seen_keys: set[str] = set()
            result = []
            for item in items:
                if str(item.get("type")) not in self._AGENT_ITEM_TYPES:
                    continue
                key = item["key_"]
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                group = template_name_map.get(item["hostid"], "Other")
                result.append(
                    {
                        "key_": key,
                        "name": item["name"],
                        "value_type": item["value_type"],
                        "group": group,
                        "delay": item.get("delay", "1m"),
                        "units": item.get("units", ""),
                        "history": item.get("history", "31d"),
                        "trends": item.get("trends", "365d"),
                        "description": item.get("description", ""),
                    }
                )
            result.sort(key=lambda x: (x["group"], x["key_"]))
            logger.info("get_all_item_keys: returned %d unique keys.", len(result))
            return result
        except Exception:
            logger.exception("get_all_item_keys failed")
            return []

    def list_template_items(self, templateid: str) -> list[dict]:
        """List items defined directly on a template (not inherited from another template)."""
        if not self.zapi:
            return []
        try:
            items = self.zapi.item.get(
                templateids=[templateid],
                output="extend",
                inherited=False,
            )
            return [
                {
                    "itemid": i["itemid"],
                    "name": i["name"],
                    "key_": i["key_"],
                    "type": i.get("type", "0"),
                    "value_type": i.get("value_type", "3"),
                    "delay": i.get("delay", "1m"),
                    "history": i.get("history", "31d"),
                    "trends": i.get("trends", "365d"),
                    "status": i.get("status", "0"),
                    "units": i.get("units", ""),
                    "description": i.get("description", ""),
                    "templateid": i.get("templateid", "0"),
                }
                for i in items
            ]
        except Exception:
            logger.exception("list_template_items(%r) failed", templateid)
            return []

    def add_item_to_template(
        self,
        templateid: str,
        name: str,
        key_: str,
        type_: int = 0,
        value_type: int = 3,
        delay: str = "1m",
        history: str = "31d",
        trends: str = "365d",
        units: str = "",
        description: str = "",
    ) -> tuple[str | None, str | None]:
        """Add a generic item directly to a template. Templates have no interfaces."""
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        try:
            kwargs: dict = dict(
                name=name,
                key_=key_,
                hostid=templateid,
                type=type_,
                value_type=value_type,
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
            )
            if units:
                kwargs["units"] = units
            if description:
                kwargs["description"] = description
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info("Added item %r to template ID %s (ID: %s).", name, templateid, item_id)
            return item_id, None
        except Exception as e:
            logger.exception("add_item_to_template(%r, %r) failed", templateid, name)
            return None, str(e)
