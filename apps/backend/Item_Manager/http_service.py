"""HTTP agent items (type 19) and simple-check service items (type 3)."""

import logging
import re
from typing import TYPE_CHECKING
from api.schemas.items import HttpItemRequest

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)

_ZABBIX_NOT_CONNECTED = "Zabbix API not connected."


class HttpServiceItemsMixin:
    """Mixed into Item_Manager. Assumes `self.zapi` from Zabbix_Base.
    Calls self._pick_interface, which lives in CoreItemsMixin — resolved via the
    final Item_Manager class's MRO at runtime.
    """

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"

        def _pick_interface(self, interfaces: list[dict], iface_type: str) -> dict: ...

        def add_trigger(
            self,
            hostname: object,
            item_key: object,
            trigger_name: object,
            threshold: object,
            operator: str = ">",
            priority: int = 3,
            event_name: str = "",
            comments: str = "",
        ) -> tuple[str | None, str | None]: ...

    # Maps service_type slug → (item_key_template, default_name, value_type)
    _SERVICE_MAP: dict[str, tuple[str, str, int]] = {
        "icmp_ping": ("icmpping[]", "ICMP ping", 3),
        "icmp_loss": ("icmppingloss[]", "ICMP packet loss", 0),
        "icmp_time": ("icmppingsec[]", "ICMP response time", 0),
        "http": ("net.tcp.service[http,,{port}]", "HTTP check", 3),
        "https": ("net.tcp.service[https,,{port}]", "HTTPS check", 3),
        "ssh": ("net.tcp.service[ssh,,{port}]", "SSH check", 3),
        "smtp": ("net.tcp.service[smtp,,{port}]", "SMTP check", 3),
        "ftp": ("net.tcp.service[ftp,,{port}]", "FTP check", 3),
        "tcp_port": ("net.tcp.service[tcp,,{port}]", "TCP port check", 3),
    }
    _SERVICE_DEFAULT_PORTS: dict[str, int] = {
        "http": 80,
        "https": 443,
        "ssh": 22,
        "smtp": 25,
        "ftp": 21,
        "tcp_port": 0,
    }

    @staticmethod
    def _http_extra_kwargs(request: HttpItemRequest, team_name: str) -> dict:
        """Build the optional HTTP-agent-item fields that are only sent when set."""
        kwargs: dict = {}
        if request.units:
            kwargs["units"] = request.units
        if request.description:
            kwargs["description"] = request.description
        if request.posts:
            kwargs["posts"] = request.posts
            kwargs["post_type"] = request.post_type
        if request.headers:
            kwargs["headers"] = request.headers
        if request.http_proxy:
            kwargs["http_proxy"] = request.http_proxy
        if request.ssl_cert_file:
            kwargs["ssl_cert_file"] = request.ssl_cert_file
        if request.ssl_key_file:
            kwargs["ssl_key_file"] = request.ssl_key_file
            if request.ssl_key_password:
                kwargs["ssl_key_password"] = request.ssl_key_password
        if request.authtype:
            kwargs["authtype"] = request.authtype
            kwargs["username"] = request.username
            kwargs["password"] = request.password
        if team_name:
            kwargs["tags"] = [{"tag": "team", "value": team_name}]
        if request.regex_preprocessing and request.regex_pattern:
            kwargs["preprocessing"] = [
                {
                    "type": 5,  # Regular expression
                    "params": f"{request.regex_pattern}\n{request.regex_output}",
                    "error_handler": 2,  # Custom value on error (no match)
                    "error_handler_params": request.regex_no_match_value,
                }
            ]
        return kwargs

    @staticmethod
    def _http_item_url(url: str, query_fields: list) -> str:
        """Append query_fields (HttpQueryField list) to url as URL query params, if any."""
        if not query_fields:
            return url
        from urllib.parse import urlencode

        pairs = [(qf.name, qf.value) for qf in query_fields if qf.name]
        if not pairs:
            return url
        sep = "&" if "?" in url else "?"
        return url + sep + urlencode(pairs)

    def add_http_item(
        self, request: HttpItemRequest, team_name: str = ""
    ) -> tuple[str | None, str | None]:
        """Add an HTTP agent item (Zabbix type 19). The Zabbix server fetches the URL."""
        hostname = request.hostname
        item_name = request.item_name
        url = request.url
        item_key = request.item_key
        request_method = request.request_method
        status_codes = request.status_codes
        timeout = request.timeout
        verify_peer = request.verify_peer
        verify_host = request.verify_host
        follow_redirects = request.follow_redirects
        value_type = request.value_type
        retrieve_mode = request.retrieve_mode
        convert_to_json = request.convert_to_json
        allow_traps = request.allow_traps
        status = request.status
        delay = request.delay
        history = request.history
        trends = request.trends

        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found in Zabbix."
            host_id = host_data[0]["hostid"]

            if not item_key:
                safe = re.sub(r"[^a-zA-Z0-9._-]", "_", url)[:60]
                item_key = f"http.check[{safe}]"

            effective_url = self._http_item_url(url, request.query_fields)

            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                type=19,  # HTTP agent
                value_type=value_type,
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
                url=effective_url,
                request_method=request_method,
                status_codes=status_codes,
                timeout=timeout,
                verify_peer=int(verify_peer),
                verify_host=int(verify_host),
                follow_redirects=int(follow_redirects),
                retrieve_mode=retrieve_mode,
                output_format=int(convert_to_json),
                allow_traps=int(allow_traps),
                status=status,
                interfaceid=0,  # HTTP agent does not require a host interface
            )
            kwargs.update(self._http_extra_kwargs(request, team_name))

            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "HTTP item %r (url=%s) added to %r (ID: %s).",
                item_name,
                url,
                hostname,
                item_id,
            )
            return item_id, None
        except Exception as e:
            msg = str(e)
            logger.exception("add_http_item(%r, %r) failed", hostname, url)
            return None, msg

    def add_service_item(
        self,
        hostname: str,
        service_type: str,
        port: int | None = None,
        item_name: str = "",
        team_name: str = "",
        delay: str = "1m",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
    ) -> tuple[str | None, str | None]:
        """Add a simple-check service item (Zabbix type 3).
        service_type: icmp_ping | icmp_loss | icmp_time | http | https | ssh | smtp | ftp | tcp_port
        """
        if service_type not in self._SERVICE_MAP:
            return None, f"Unknown service type '{service_type}'."
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
            interface_id = interfaces[0]["interfaceid"]

            key_tpl, default_name, value_type = self._SERVICE_MAP[service_type]
            effective_port = port or self._SERVICE_DEFAULT_PORTS.get(service_type, 0)
            item_key = key_tpl.replace("{port}", str(effective_port))

            if not item_name:
                port_str = f":{effective_port}" if effective_port else ""
                item_name = f"{default_name} on {hostname}{port_str}"

            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                interfaceid=interface_id,
                type=3,  # Simple check
                value_type=value_type,
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
            )
            if description:
                kwargs["description"] = description
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]

            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "Service item %r (type=%s) added to %r (ID: %s).",
                item_name,
                service_type,
                hostname,
                item_id,
            )
            return item_id, None
        except Exception as e:
            msg = str(e)
            logger.exception("add_service_item(%r, %r) failed", hostname, service_type)
            return None, msg

    def add_process_item(
        self,
        hostname: str,
        process_name: str,
        run_as_user: str = "",
        cmdline_regex: str = "",
        state: str = "all",
        item_name: str = "",
        team_name: str = "",
        create_trigger: bool = True,
        trigger_priority: int = 3,
        delay: str = "1m",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
    ) -> tuple[str | None, str | None]:
        """Add a Zabbix agent item using proc.num[] to check if a process is running.

        proc.num[<name>,<user>,<state>,<cmdline>] returns the count of matching processes.
        A trigger fires when the count drops to 0.
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
            interface_id = self._pick_interface(interfaces, "1")["interfaceid"]

            item_key = self._proc_num_key(process_name, run_as_user, state, cmdline_regex)

            if not item_name:
                user_str = f" (user: {run_as_user})" if run_as_user else ""
                item_name = f"Process {process_name}{user_str} on {hostname}"

            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                interfaceid=interface_id,
                type=0,  # Zabbix agent
                value_type=3,  # Numeric unsigned
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
            )
            if description:
                kwargs["description"] = description
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]

            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info("Process item %r added to %r (ID: %s).", item_name, hostname, item_id)

            if create_trigger:
                self._create_process_down_trigger(
                    hostname, item_key, process_name, run_as_user, trigger_priority
                )

            return item_id, None
        except Exception as e:
            logger.exception("add_process_item(%r, %r) failed", hostname, process_name)
            return None, str(e)

    @staticmethod
    def _proc_num_key(process_name: str, run_as_user: str, state: str, cmdline_regex: str) -> str:
        """Build a proc.num[] item key, omitting trailing empty parameters."""
        parts = [process_name, run_as_user, state, cmdline_regex]
        while parts and not parts[-1]:
            parts.pop()
        return f"proc.num[{','.join(parts)}]"

    def _create_process_down_trigger(
        self,
        hostname: str,
        item_key: str,
        process_name: str,
        run_as_user: str,
        priority: int,
    ) -> None:
        """Create the "process is not running" trigger for add_process_item."""
        trigger_name = f"{process_name} is not running on {hostname}"
        if run_as_user:
            trigger_name = f"{process_name} (user: {run_as_user}) is not running on {hostname}"
        _, te = self.add_trigger(
            hostname, item_key, trigger_name, threshold=0, operator="=", priority=priority
        )
        if te:
            logger.warning("add_process_item: trigger creation failed: %s", te)

    def add_windows_service_item(
        self,
        hostname: str,
        service_name: str,
        item_name: str = "",
        team_name: str = "",
        create_trigger: bool = True,
        trigger_priority: int = 3,
        delay: str = "1m",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
    ) -> tuple[str | None, str | None]:
        """Add a Zabbix agent item using service.info[name,state] to monitor a Windows service.

        Returns 0 when running. Trigger fires on any non-zero state (stopped/paused/pending).
        Requires Zabbix agent on the Windows host.
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
            interface_id = self._pick_interface(interfaces, "1")["interfaceid"]

            item_key = f"service.info[{service_name},state]"
            if not item_name:
                item_name = f"Windows service {service_name} state on {hostname}"

            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                interfaceid=interface_id,
                type=0,  # Zabbix agent
                value_type=3,  # Numeric unsigned (0=running, 1-7=other states, 255=not found)
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
            )
            if description:
                kwargs["description"] = description
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]

            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "Windows service item %r added to %r (ID: %s).",
                item_name,
                hostname,
                item_id,
            )

            if create_trigger:
                trigger_name = f"Service {service_name} is not running on {hostname}"
                # state != 0 means not running (stopped=6, paused=1, pending states 2-5, unknown=7)
                _, te = self.add_trigger(
                    hostname,
                    item_key,
                    trigger_name,
                    threshold=0,
                    operator="<>",
                    priority=trigger_priority,
                )
                if te:
                    logger.warning("add_windows_service_item: trigger creation failed: %s", te)

            return item_id, None
        except Exception as e:
            logger.exception("add_windows_service_item(%r, %r) failed", hostname, service_name)
            return None, str(e)
