"""Remote-protocol agent items: IPMI (12), SSH (13), Telnet (14), JMX (16)."""

import logging
from Zabbix_Base import zabbix_err
import re
from typing import TYPE_CHECKING, Protocol
from api.schemas.items import IpmiItemRequest, JmxItemRequest, SshItemRequest, TelnetItemRequest

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI
    from Item_Manager.triggers import _TriggerConfigured


class _UnitsDescribed(Protocol):
    """Structural type for the units/description fields shared by several item requests."""

    units: str
    description: str


logger = logging.getLogger(__name__)

_ZABBIX_NOT_CONNECTED = "Zabbix API not connected."


class RemoteItemsMixin:
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
    def _pick_ipmi_interface(interfaces: list[dict]) -> dict | None:
        """Prefer a host's IPMI interface (Zabbix type 3); fall back to the first."""
        return next((i for i in interfaces if str(i.get("type")) == "3"), None) or (
            interfaces[0] if interfaces else None
        )

    @staticmethod
    def _ipmi_item_identity(request: IpmiItemRequest, hostname: str) -> tuple[str, str]:
        """Resolve the effective item_key/item_name, auto-generating either when blank."""
        item_key = request.item_key
        if not item_key:
            safe = request.ipmi_sensor.replace(" ", "_")[:40]
            item_key = f"ipmi.sensor[{safe}]"
        item_name = request.item_name or f"IPMI: {request.ipmi_sensor} on {hostname}"
        return item_key, item_name

    @staticmethod
    def _units_description_kwargs(request: "_UnitsDescribed", team_name: str) -> dict:
        """Build the units/description/team-tag fields shared by several item types."""
        kwargs: dict = {}
        if request.units:
            kwargs["units"] = request.units
        if request.description:
            kwargs["description"] = request.description
        if team_name:
            kwargs["tags"] = [{"tag": "team", "value": team_name}]
        return kwargs

    def add_ipmi_item(
        self, request: IpmiItemRequest, team_name: str = ""
    ) -> tuple[str | None, str | None]:
        """Add an IPMI agent item (type 12). Requires an IPMI interface on the host."""
        hostname = request.hostname
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            interfaces = self.zapi.hostinterface.get(hostids=host_id)
            ipmi_iface = self._pick_ipmi_interface(interfaces)
            if not ipmi_iface:
                return None, f"No interface found for host '{hostname}'."
            item_key, item_name = self._ipmi_item_identity(request, hostname)
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                interfaceid=ipmi_iface["interfaceid"],
                type=12,
                value_type=request.value_type,
                ipmi_sensor=request.ipmi_sensor,
                delay=request.delay or "1m",
                history=request.history or "31d",
                trends=request.trends or "365d",
                status=request.status,
            )
            kwargs.update(self._units_description_kwargs(request, team_name))
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "IPMI item %r (%s) added to %r (ID: %s).",
                item_name,
                request.ipmi_sensor,
                hostname,
                item_id,
            )
            self._maybe_create_trigger_logged(
                hostname, item_key, item_name, request.value_type, request, "add_ipmi_item"
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_ipmi_item(%r) failed", hostname)
            return None, zabbix_err(e)

    @staticmethod
    def _ssh_extra_kwargs(request: SshItemRequest, team_name: str) -> dict:
        """Build the optional SSH-item fields that are only sent when set."""
        kwargs: dict = {}
        if request.authtype == 0 and request.password:
            kwargs["password"] = request.password
        if request.authtype == 1:
            kwargs["publickey"] = request.publickey
            kwargs["privatekey"] = request.privatekey
        if request.units:
            kwargs["units"] = request.units
        if request.description:
            kwargs["description"] = request.description
        if request.timeout:
            kwargs["timeout"] = request.timeout
        if team_name:
            kwargs["tags"] = [{"tag": "team", "value": team_name}]
        return kwargs

    def add_ssh_item(
        self, request: SshItemRequest, team_name: str = ""
    ) -> tuple[str | None, str | None]:
        """Add an SSH agent item (type 13). Zabbix server connects via SSH and runs the script."""
        hostname = request.hostname
        item_name = request.item_name
        params = request.params
        item_key = request.item_key
        authtype = request.authtype
        username = request.username
        value_type = request.value_type
        delay = request.delay
        history = request.history
        trends = request.trends
        status = request.status

        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
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
            kwargs.update(self._ssh_extra_kwargs(request, team_name))
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info("SSH item %r added to %r (ID: %s).", item_name, hostname, item_id)
            self._maybe_create_trigger_logged(
                hostname, item_key, item_name, value_type, request, "add_ssh_item"
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_ssh_item(%r) failed", hostname)
            return None, zabbix_err(e)

    def add_telnet_item(
        self, request: TelnetItemRequest, team_name: str = ""
    ) -> tuple[str | None, str | None]:
        """Add a Telnet agent item (type 14). Zabbix server connects via Telnet and runs the script."""
        hostname = request.hostname
        item_name = request.item_name
        params = request.params
        item_key = request.item_key
        value_type = request.value_type

        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
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
                username=request.username or "",
                password=request.password or "",
                delay=request.delay or "1m",
                history=request.history or "31d",
                trends=request.trends or "365d",
                status=request.status,
            )
            kwargs.update(self._units_description_kwargs(request, team_name))
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info("Telnet item %r added to %r (ID: %s).", item_name, hostname, item_id)
            self._maybe_create_trigger_logged(
                hostname, item_key, item_name, value_type, request, "add_telnet_item"
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_telnet_item(%r) failed", hostname)
            return None, zabbix_err(e)

    @staticmethod
    def _pick_jmx_interface(interfaces: list[dict]) -> dict | None:
        """Prefer a host's JMX interface (Zabbix type 4); fall back to the first."""
        return next((i for i in interfaces if str(i.get("type")) == "4"), None) or (
            interfaces[0] if interfaces else None
        )

    @staticmethod
    def _jmx_extra_kwargs(request: JmxItemRequest, team_name: str) -> dict:
        kwargs: dict = {}
        if request.jmx_endpoint:
            kwargs["jmx_endpoint"] = request.jmx_endpoint
        if request.username:
            kwargs["username"] = request.username
            kwargs["password"] = request.password
        if request.units:
            kwargs["units"] = request.units
        if request.description:
            kwargs["description"] = request.description
        if team_name:
            kwargs["tags"] = [{"tag": "team", "value": team_name}]
        return kwargs

    def add_jmx_item(
        self, request: JmxItemRequest, team_name: str = ""
    ) -> tuple[str | None, str | None]:
        """Add a JMX agent item (type 16). Requires Zabbix Java Gateway and a JMX interface on the host."""
        hostname = request.hostname
        item_name = request.item_name
        item_key = request.item_key
        value_type = request.value_type

        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
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
            jmx_iface = self._pick_jmx_interface(interfaces)
            if not jmx_iface:
                return None, f"No interface found for host '{hostname}'."
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                interfaceid=jmx_iface["interfaceid"],
                type=16,
                value_type=value_type,
                delay=request.delay or "1m",
                history=request.history or "31d",
                trends=request.trends or "365d",
                status=request.status,
            )
            kwargs.update(self._jmx_extra_kwargs(request, team_name))
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "JMX item %r (%s) added to %r (ID: %s).",
                item_name,
                item_key,
                hostname,
                item_id,
            )
            self._maybe_create_trigger_logged(
                hostname, item_key, item_name, value_type, request, "add_jmx_item"
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_jmx_item(%r) failed", hostname)
            return None, zabbix_err(e)
