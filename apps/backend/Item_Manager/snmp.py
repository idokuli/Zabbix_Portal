"""SNMP agent items (type 20) and SNMP trap items (type 17)."""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class SnmpItemsMixin:
    """Mixed into Item_Manager. Assumes `self.zapi` from Zabbix_Base."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"

    def add_snmp_item(
        self,
        hostname: str,
        item_name: str,
        item_key: str,
        snmp_oid: str,
        value_type: int = 3,
        snmp_version: int = 2,  # 1=v1, 2=v2c, 3=v3
        snmp_community: str = "public",
        snmpv3_securityname: str = "",
        snmpv3_securitylevel: int = 0,  # 0=noAuthNoPriv, 1=authNoPriv, 2=authPriv
        snmpv3_authprotocol: int = 0,  # 0=MD5,1=SHA,2=SHA224,3=SHA256,4=SHA384,5=SHA512
        snmpv3_authpassphrase: str = "",
        snmpv3_privprotocol: int = 0,  # 0=DES,1=AES128,2=AES192,3=AES256
        snmpv3_privpassphrase: str = "",
        snmpv3_contextname: str = "",
        team_name: str = "",
        delay: str = "1m",
        units: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
        status: int = 0,
    ) -> tuple[str | None, str | None]:
        """Add a Zabbix SNMP agent item (type 20). Requires an SNMP interface on the host."""
        if not self.zapi:
            return None, "Zabbix API not connected."
        if not snmp_oid:
            return None, "SNMP OID is required."
        try:
            host_data = self.zapi.host.get(
                filter={"host": [hostname]}, output=["hostid"]
            )
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            # Look for SNMP interface (type 2)
            interfaces = self.zapi.hostinterface.get(hostids=host_id)
            snmp_iface = next(
                (i for i in interfaces if str(i.get("type")) == "2"), None
            )
            if not snmp_iface:
                snmp_iface = interfaces[0] if interfaces else None
            if not snmp_iface:
                return None, f"No interface found for host '{hostname}'."
            if not item_name:
                item_name = f"SNMP: {snmp_oid} on {hostname}"
            if not item_key:
                safe = snmp_oid.replace(".", "_").replace(" ", "_")[:40]
                item_key = f"snmp.{safe}"
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
            )
            if snmp_version in (1, 2):
                kwargs["snmp_community"] = snmp_community or "public"
            if snmp_version == 3:
                kwargs["snmpv3_securityname"] = snmpv3_securityname
                kwargs["snmpv3_securitylevel"] = snmpv3_securitylevel
                if snmpv3_securitylevel >= 1:
                    kwargs["snmpv3_authprotocol"] = snmpv3_authprotocol
                    kwargs["snmpv3_authpassphrase"] = snmpv3_authpassphrase
                if snmpv3_securitylevel == 2:
                    kwargs["snmpv3_privprotocol"] = snmpv3_privprotocol
                    kwargs["snmpv3_privpassphrase"] = snmpv3_privpassphrase
                if snmpv3_contextname:
                    kwargs["snmpv3_contextname"] = snmpv3_contextname
            if units:
                kwargs["units"] = units
            if description:
                kwargs["description"] = description
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "SNMP item %r (oid=%s) added to %r (ID: %s).",
                item_name,
                snmp_oid,
                hostname,
                item_id,
            )
            return item_id, None
        except Exception as e:
            logger.error("add_snmp_item(%r) failed: %r", hostname, e)
            return None, str(e)

    def add_snmp_trap_item(
        self,
        hostname: str,
        item_name: str,
        item_key: str = "snmptrap.fallback",
        value_type: int = 1,
        team_name: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
        status: int = 0,
    ) -> tuple[str | None, str | None]:
        """Add a Zabbix SNMP trap item (type 17). Receives traps pushed by external devices."""
        if not self.zapi:
            return None, "Zabbix API not connected."
        try:
            host_data = self.zapi.host.get(
                filter={"host": [hostname]}, output=["hostid"]
            )
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            interfaces = self.zapi.hostinterface.get(hostids=host_id)
            snmp_iface = next(
                (i for i in interfaces if str(i.get("type")) == "2"), None
            ) or (interfaces[0] if interfaces else None)
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
            logger.info(
                "SNMP trap item %r added to %r (ID: %s).", item_name, hostname, item_id
            )
            return item_id, None
        except Exception as e:
            logger.error("add_snmp_trap_item(%r) failed: %r", hostname, e)
            return None, str(e)
