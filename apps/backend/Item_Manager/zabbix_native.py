"""Zabbix-native item types: internal (5), trapper (2), external (10),
calculated (15), dependent (18), JS script (21), browser (26).
"""

import logging
from Zabbix_Base import zabbix_err
from typing import TYPE_CHECKING
from api.schemas.items import BrowserItemRequest, ZabbixScriptItemRequest

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)

_ZABBIX_NOT_CONNECTED = "Zabbix API not connected."


class ZabbixNativeItemsMixin:
    """Mixed into Item_Manager. Assumes `self.zapi` from Zabbix_Base."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"

    def add_internal_item(
        self,
        hostname: str,
        item_name: str,
        item_key: str,
        value_type: int = 3,
        team_name: str = "",
        delay: str = "1m",
        units: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
        status: int = 0,
    ) -> tuple[str | None, str | None]:
        """Add a Zabbix internal item (type 5) using built-in zabbix[...] keys."""
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                type=5,
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
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "Internal item %r (%s) added to %r (ID: %s).",
                item_name,
                item_key,
                hostname,
                item_id,
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_internal_item(%r) failed", hostname)
            return None, zabbix_err(e)

    def add_trapper_item(
        self,
        hostname: str,
        item_name: str,
        item_key: str,
        value_type: int = 4,
        allow_traps: bool = True,
        team_name: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
        status: int = 0,
    ) -> tuple[str | None, str | None]:
        """Add a Zabbix trapper item (type 2). Accepts data pushed via zabbix_sender."""
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                type=2,
                value_type=value_type,
                history=history or "31d",
                trends=trends or "365d",
                allow_traps=1 if allow_traps else 0,
                status=status,
            )
            if description:
                kwargs["description"] = description
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "Trapper item %r (%s) added to %r (ID: %s).",
                item_name,
                item_key,
                hostname,
                item_id,
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_trapper_item(%r) failed", hostname)
            return None, zabbix_err(e)

    def add_external_item(
        self,
        hostname: str,
        item_name: str,
        item_key: str,
        value_type: int = 4,
        team_name: str = "",
        delay: str = "1m",
        units: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
        status: int = 0,
    ) -> tuple[str | None, str | None]:
        """Add an external check item (type 10). Script must exist in ExternalScripts dir on Zabbix server."""
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            interfaces = self.zapi.hostinterface.get(hostids=host_id)
            iface = interfaces[0] if interfaces else None
            if not iface:
                return None, f"No interface found for host '{hostname}'."
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                interfaceid=iface["interfaceid"],
                type=10,
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
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "External item %r (%s) added to %r (ID: %s).",
                item_name,
                item_key,
                hostname,
                item_id,
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_external_item(%r) failed", hostname)
            return None, zabbix_err(e)

    def add_calculated_item(
        self,
        hostname: str,
        item_name: str,
        item_key: str,
        formula: str,
        value_type: int = 0,
        team_name: str = "",
        delay: str = "1m",
        units: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
        status: int = 0,
    ) -> tuple[str | None, str | None]:
        """Add a calculated item (type 15). Derives its value from a formula referencing other items."""
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        if not formula.strip():
            return None, "Formula is required."
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                type=15,
                value_type=value_type,
                params=formula,
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
                status=status,
            )
            if units:
                kwargs["units"] = units
            if description:
                kwargs["description"] = description
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "Calculated item %r (%s) added to %r (ID: %s).",
                item_name,
                item_key,
                hostname,
                item_id,
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_calculated_item(%r) failed", hostname)
            return None, zabbix_err(e)

    def add_dependent_item(
        self,
        hostname: str,
        item_name: str,
        item_key: str,
        master_itemid: str,
        value_type: int = 4,
        team_name: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
        status: int = 0,
    ) -> tuple[str | None, str | None]:
        """Add a dependent item (type 18). Its value is derived from preprocessing a master item."""
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        if not master_itemid:
            return None, "master_itemid is required."
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                type=18,
                value_type=value_type,
                master_itemid=master_itemid,
                history=history or "31d",
                trends=trends or "365d",
                status=status,
            )
            if description:
                kwargs["description"] = description
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "Dependent item %r added to %r (master: %s, ID: %s).",
                item_name,
                hostname,
                master_itemid,
                item_id,
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_dependent_item(%r) failed", hostname)
            return None, zabbix_err(e)

    def add_zabbix_script_item(
        self, request: ZabbixScriptItemRequest, team_name: str = ""
    ) -> tuple[str | None, str | None]:
        """Add a Zabbix Script item (type 21). JavaScript code runs on the Zabbix server/proxy."""
        hostname = request.hostname
        item_name = request.item_name
        item_key = request.item_key
        params = request.params
        parameters = request.parameters
        value_type = request.value_type
        delay = request.delay
        units = request.units
        history = request.history
        trends = request.trends
        description = request.description
        status = request.status
        timeout = request.timeout

        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        if not params.strip():
            return None, "Script code is required."
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                type=21,
                value_type=value_type,
                params=params,
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
                status=status,
            )
            if parameters:
                kwargs["parameters"] = [
                    {"name": p.name, "value": p.value} for p in parameters if p.name
                ]
            if units:
                kwargs["units"] = units
            if description:
                kwargs["description"] = description
            if timeout:
                kwargs["timeout"] = timeout
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "Script item %r (%s) added to %r (ID: %s).",
                item_name,
                item_key,
                hostname,
                item_id,
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_zabbix_script_item(%r) failed", hostname)
            return None, zabbix_err(e)

    def add_browser_item(
        self, request: BrowserItemRequest, team_name: str = ""
    ) -> tuple[str | None, str | None]:
        """Add a Browser item (type 26). JavaScript browser automation on Zabbix server (7.x+)."""
        hostname = request.hostname
        item_name = request.item_name
        item_key = request.item_key
        params = request.params
        parameters = request.parameters
        value_type = request.value_type
        delay = request.delay
        units = request.units
        history = request.history
        trends = request.trends
        description = request.description
        status = request.status
        timeout = request.timeout

        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        if not params.strip():
            return None, "Browser script code is required."
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                type=26,
                value_type=value_type,
                params=params,
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
                status=status,
            )
            if parameters:
                kwargs["parameters"] = [
                    {"name": p.name, "value": p.value} for p in parameters if p.name
                ]
            if units:
                kwargs["units"] = units
            if description:
                kwargs["description"] = description
            if timeout:
                kwargs["timeout"] = timeout
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "Browser item %r (%s) added to %r (ID: %s).",
                item_name,
                item_key,
                hostname,
                item_id,
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_browser_item(%r) failed", hostname)
            return None, zabbix_err(e)
