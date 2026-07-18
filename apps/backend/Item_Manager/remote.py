"""Remote-protocol agent items: IPMI (12), SSH (13), Telnet (14), JMX (16)."""

import logging
from Zabbix_Base import zabbix_err
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class RemoteItemsMixin:
    """Mixed into Item_Manager. Assumes `self.zapi` from Zabbix_Base."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"

    def add_ipmi_item(
        self,
        hostname: str,
        item_name: str,
        ipmi_sensor: str,
        item_key: str = "",
        value_type: int = 0,
        team_name: str = "",
        delay: str = "1m",
        units: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
        status: int = 0,
    ) -> tuple[str | None, str | None]:
        """Add an IPMI agent item (type 12). Requires an IPMI interface on the host."""
        if not self.zapi:
            return None, "Zabbix API not connected."
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            interfaces = self.zapi.hostinterface.get(hostids=host_id)
            # Prefer IPMI interface (type 3), fall back to first
            ipmi_iface = next((i for i in interfaces if str(i.get("type")) == "3"), None) or (
                interfaces[0] if interfaces else None
            )
            if not ipmi_iface:
                return None, f"No interface found for host '{hostname}'."
            if not item_key:
                safe = ipmi_sensor.replace(" ", "_")[:40]
                item_key = f"ipmi.sensor[{safe}]"
            if not item_name:
                item_name = f"IPMI: {ipmi_sensor} on {hostname}"
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                interfaceid=ipmi_iface["interfaceid"],
                type=12,
                value_type=value_type,
                ipmi_sensor=ipmi_sensor,
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
                "IPMI item %r (%s) added to %r (ID: %s).",
                item_name,
                ipmi_sensor,
                hostname,
                item_id,
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_ipmi_item(%r) failed", hostname)
            return None, zabbix_err(e)

    def add_ssh_item(
        self,
        hostname: str,
        item_name: str,
        params: str,
        item_key: str = "",
        authtype: int = 0,  # 0=password, 1=public key
        username: str = "",
        password: str = "",
        publickey: str = "",
        privatekey: str = "",
        value_type: int = 1,
        team_name: str = "",
        delay: str = "1m",
        units: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
        status: int = 0,
        timeout: str = "",
    ) -> tuple[str | None, str | None]:
        """Add an SSH agent item (type 13). Zabbix server connects via SSH and runs the script."""
        if not self.zapi:
            return None, "Zabbix API not connected."
        if not params.strip():
            return None, "SSH script/commands are required."
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            interfaces = self.zapi.hostinterface.get(hostids=host_id)
            iface = interfaces[0] if interfaces else None
            if not iface:
                return None, f"No interface found for host '{hostname}'."
            if not item_key:
                safe = re.sub(r"[^a-zA-Z0-9._-]", "_", item_name)[:40]
                item_key = f"ssh.run[{safe}]"
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                interfaceid=iface["interfaceid"],
                type=13,
                value_type=value_type,
                params=params,
                authtype=authtype,
                username=username or "",
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
                status=status,
            )
            if authtype == 0 and password:
                kwargs["password"] = password
            if authtype == 1:
                kwargs["publickey"] = publickey
                kwargs["privatekey"] = privatekey
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
            logger.info("SSH item %r added to %r (ID: %s).", item_name, hostname, item_id)
            return item_id, None
        except Exception as e:
            logger.exception("add_ssh_item(%r) failed", hostname)
            return None, zabbix_err(e)

    def add_telnet_item(
        self,
        hostname: str,
        item_name: str,
        params: str,
        item_key: str = "",
        username: str = "",
        password: str = "",
        value_type: int = 1,
        team_name: str = "",
        delay: str = "1m",
        units: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
        status: int = 0,
    ) -> tuple[str | None, str | None]:
        """Add a Telnet agent item (type 14). Zabbix server connects via Telnet and runs the script."""
        if not self.zapi:
            return None, "Zabbix API not connected."
        if not params.strip():
            return None, "Telnet script/commands are required."
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            interfaces = self.zapi.hostinterface.get(hostids=host_id)
            iface = interfaces[0] if interfaces else None
            if not iface:
                return None, f"No interface found for host '{hostname}'."
            if not item_key:
                safe = re.sub(r"[^a-zA-Z0-9._-]", "_", item_name)[:40]
                item_key = f"telnet.run[{safe}]"
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                interfaceid=iface["interfaceid"],
                type=14,
                value_type=value_type,
                params=params,
                username=username or "",
                password=password or "",
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
            logger.info("Telnet item %r added to %r (ID: %s).", item_name, hostname, item_id)
            return item_id, None
        except Exception as e:
            logger.exception("add_telnet_item(%r) failed", hostname)
            return None, zabbix_err(e)

    def add_jmx_item(
        self,
        hostname: str,
        item_name: str,
        item_key: str,
        jmx_endpoint: str = "",
        username: str = "",
        password: str = "",
        value_type: int = 3,
        team_name: str = "",
        delay: str = "1m",
        units: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
        status: int = 0,
    ) -> tuple[str | None, str | None]:
        """Add a JMX agent item (type 16). Requires Zabbix Java Gateway and a JMX interface on the host."""
        if not self.zapi:
            return None, "Zabbix API not connected."
        if not item_key:
            return (
                None,
                'JMX item key is required (e.g. jmx["java.lang:type=Memory","HeapMemoryUsage.used"]).',
            )
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            interfaces = self.zapi.hostinterface.get(hostids=host_id)
            # Prefer JMX interface (type 4)
            jmx_iface = next((i for i in interfaces if str(i.get("type")) == "4"), None) or (
                interfaces[0] if interfaces else None
            )
            if not jmx_iface:
                return None, f"No interface found for host '{hostname}'."
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                interfaceid=jmx_iface["interfaceid"],
                type=16,
                value_type=value_type,
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
                status=status,
            )
            if jmx_endpoint:
                kwargs["jmx_endpoint"] = jmx_endpoint
            if username:
                kwargs["username"] = username
                kwargs["password"] = password
            if units:
                kwargs["units"] = units
            if description:
                kwargs["description"] = description
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "JMX item %r (%s) added to %r (ID: %s).",
                item_name,
                item_key,
                hostname,
                item_id,
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_jmx_item(%r) failed", hostname)
            return None, zabbix_err(e)
