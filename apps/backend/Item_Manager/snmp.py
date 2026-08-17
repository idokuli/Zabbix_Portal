"""SNMP agent items (type 20) and SNMP trap items (type 17)."""

import logging
from Zabbix_Base import zabbix_err
from typing import TYPE_CHECKING
from api.schemas.items import SnmpItemRequest, SnmpTrapRequest

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI
    from Item_Manager.triggers import _TriggerConfigured

logger = logging.getLogger(__name__)


class SnmpItemsMixin:
    """Mixed into ItemManager. Assumes `self.zapi` from ZabbixBase."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"

        def maybe_create_trigger(
            self,
            hostname: str,
            item_key: str,
            item_name: str,
            value_type: int,
            create_trigger: bool,
            trigger_operator: str = ">",
            trigger_threshold: float | None = None,
            trigger_pattern: str = "",
            trigger_match_type: str = "like",
            trigger_priority: int = 3,
        ) -> tuple[str | None, str | None]: ...

        def _maybe_create_trigger_logged(
            self,
            hostname: str,
            item_key: str,
            item_name: str,
            value_type: int,
            request: "_TriggerConfigured",
            log_prefix: str,
        ) -> None: ...

    @staticmethod
    def _snmpv3_kwargs(
        securityname: str,
        securitylevel: int,
        authprotocol: int,
        authpassphrase: str,
        privprotocol: int,
        privpassphrase: str,
        contextname: str,
    ) -> dict:
        """Build the snmpv3_* item fields, following Zabbix's rule that auth/priv
        fields are only sent when the security level requires them (0=noAuthNoPriv,
        1=authNoPriv, 2=authPriv)."""
        kwargs: dict = {
            "snmpv3_securityname": securityname,
            "snmpv3_securitylevel": securitylevel,
        }
        if securitylevel >= 1:
            kwargs["snmpv3_authprotocol"] = authprotocol
            kwargs["snmpv3_authpassphrase"] = authpassphrase
        if securitylevel == 2:
            kwargs["snmpv3_privprotocol"] = privprotocol
            kwargs["snmpv3_privpassphrase"] = privpassphrase
        if contextname:
            kwargs["snmpv3_contextname"] = contextname
        return kwargs

    @staticmethod
    def _snmp_item_key(snmp_oid: str) -> str:
        safe = snmp_oid.replace(".", "_").replace(" ", "_")[:40]
        return f"snmp.{safe}"

    def _snmp_version_kwargs(
        self,
        snmp_version: int,
        snmp_community: str,
        snmpv3_securityname: str,
        snmpv3_securitylevel: int,
        snmpv3_authprotocol: int,
        snmpv3_authpassphrase: str,
        snmpv3_privprotocol: int,
        snmpv3_privpassphrase: str,
        snmpv3_contextname: str,
    ) -> dict:
        """Build the version-specific SNMP fields (community for v1/v2c, snmpv3_* for v3)."""
        if snmp_version in (1, 2):
            return {"snmp_community": snmp_community or "public"}
        if snmp_version == 3:
            return self._snmpv3_kwargs(
                snmpv3_securityname,
                snmpv3_securitylevel,
                snmpv3_authprotocol,
                snmpv3_authpassphrase,
                snmpv3_privprotocol,
                snmpv3_privpassphrase,
                snmpv3_contextname,
            )
        return {}

    @staticmethod
    def _optional_item_kwargs(units: str, description: str, team_name: str) -> dict:
        kwargs: dict = {}
        if units:
            kwargs["units"] = units
        if description:
            kwargs["description"] = description
        if team_name:
            kwargs["tags"] = [{"tag": "team", "value": team_name}]
        return kwargs

    @staticmethod
    def _pick_snmp_interface(interfaces: list[dict]) -> dict | None:
        """Prefer a host's SNMP interface (Zabbix type 2); fall back to the first
        interface if the host has none of that type, or None if it has no interfaces."""
        snmp_iface = next((i for i in interfaces if str(i.get("type")) == "2"), None)
        return snmp_iface or (interfaces[0] if interfaces else None)

    def add_snmp_item(
        self, request: SnmpItemRequest, team_name: str = ""
    ) -> tuple[str | None, str | None]:
        """Add a Zabbix SNMP agent item (type 20). Requires an SNMP interface on the host."""
        hostname = request.hostname
        item_name = request.item_name
        item_key = request.item_key
        snmp_oid = request.snmp_oid
        value_type = request.value_type
        snmp_version = request.snmp_version
        snmp_community = request.snmp_community
        snmpv3_securityname = request.snmpv3_securityname
        snmpv3_securitylevel = request.snmpv3_securitylevel
        snmpv3_authprotocol = request.snmpv3_authprotocol
        snmpv3_authpassphrase = request.snmpv3_authpassphrase
        snmpv3_privprotocol = request.snmpv3_privprotocol
        snmpv3_privpassphrase = request.snmpv3_privpassphrase
        snmpv3_contextname = request.snmpv3_contextname
        delay = request.delay
        units = request.units
        history = request.history
        trends = request.trends
        description = request.description
        status = request.status

        if not self.zapi:
            return None, "Zabbix API not connected."
        if not snmp_oid:
            return None, "SNMP OID is required."
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            interfaces = self.zapi.hostinterface.get(hostids=host_id)
            snmp_iface = self._pick_snmp_interface(interfaces)
            if not snmp_iface:
                return None, f"No interface found for host '{hostname}'."
            item_name = item_name or f"SNMP: {snmp_oid} on {hostname}"
            item_key = item_key or self._snmp_item_key(snmp_oid)
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                interfaceid=snmp_iface["interfaceid"],
                type=20,
                value_type=value_type,
                snmp_oid=snmp_oid,
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
                status=status,
                snmp_version=snmp_version,  # required by Zabbix 5.4+ unified SNMP type
            )
            kwargs.update(
                self._snmp_version_kwargs(
                    snmp_version,
                    snmp_community,
                    snmpv3_securityname,
                    snmpv3_securitylevel,
                    snmpv3_authprotocol,
                    snmpv3_authpassphrase,
                    snmpv3_privprotocol,
                    snmpv3_privpassphrase,
                    snmpv3_contextname,
                )
            )
            kwargs.update(self._optional_item_kwargs(units, description, team_name))
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "SNMP item %r (oid=%s) added to %r (ID: %s).",
                item_name,
                snmp_oid,
                hostname,
                item_id,
            )
            self._maybe_create_trigger_logged(
                hostname, item_key, item_name, value_type, request, "add_snmp_item"
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_snmp_item(%r) failed", hostname)
            return None, zabbix_err(e)

    def add_snmp_trap_item(
        self, request: SnmpTrapRequest, team_name: str = ""
    ) -> tuple[str | None, str | None]:
        """Add a Zabbix SNMP trap item (type 17). Receives traps pushed by external devices."""
        hostname = request.hostname
        item_name = request.item_name
        item_key = request.item_key
        value_type = request.value_type
        history = request.history
        trends = request.trends
        description = request.description
        status = request.status

        if not self.zapi:
            return None, "Zabbix API not connected."
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            interfaces = self.zapi.hostinterface.get(hostids=host_id)
            snmp_iface = next((i for i in interfaces if str(i.get("type")) == "2"), None) or (
                interfaces[0] if interfaces else None
            )
            if not snmp_iface:
                return None, f"No interface found for host '{hostname}'."
            kwargs: dict = dict(
                name=item_name,
                key_=item_key or "snmptrap.fallback",
                hostid=host_id,
                interfaceid=snmp_iface["interfaceid"],
                type=17,
                value_type=value_type,
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
            logger.info("SNMP trap item %r added to %r (ID: %s).", item_name, hostname, item_id)
            self._maybe_create_trigger_logged(
                hostname, item_key, item_name, value_type, request, "add_snmp_trap_item"
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_snmp_trap_item(%r) failed", hostname)
            return None, zabbix_err(e)
