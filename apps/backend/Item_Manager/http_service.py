"""HTTP agent items (type 19) and simple-check service items (type 3)."""

import logging
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


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
    def _http_extra_kwargs(
        *,
        units: str,
        description: str,
        posts: str,
        post_type: int,
        headers: str,
        http_proxy: str,
        ssl_cert_file: str,
        ssl_key_file: str,
        ssl_key_password: str,
        authtype: int,
        username: str,
        password: str,
        team_name: str,
        regex_preprocessing: bool,
        regex_pattern: str,
        regex_output: str,
        regex_no_match_value: str,
    ) -> dict:
        """Build the optional HTTP-agent-item fields that are only sent when set."""
        kwargs: dict = {}
        if units:
            kwargs["units"] = units
        if description:
            kwargs["description"] = description
        if posts:
            kwargs["posts"] = posts
            kwargs["post_type"] = post_type
        if headers:
            kwargs["headers"] = headers
        if http_proxy:
            kwargs["http_proxy"] = http_proxy
        if ssl_cert_file:
            kwargs["ssl_cert_file"] = ssl_cert_file
        if ssl_key_file:
            kwargs["ssl_key_file"] = ssl_key_file
            if ssl_key_password:
                kwargs["ssl_key_password"] = ssl_key_password
        if authtype:
            kwargs["authtype"] = authtype
            kwargs["username"] = username
            kwargs["password"] = password
        if team_name:
            kwargs["tags"] = [{"tag": "team", "value": team_name}]
        if regex_preprocessing and regex_pattern:
            kwargs["preprocessing"] = [
                {
                    "type": 5,  # Regular expression
                    "params": f"{regex_pattern}\n{regex_output}",
                    "error_handler": 2,  # Custom value on error (no match)
                    "error_handler_params": regex_no_match_value,
                }
            ]
        return kwargs

    def add_http_item(
        self,
        hostname: str,
        item_name: str,
        url: str,
        item_key: str = "",
        request_method: int = 0,  # 0=GET 1=POST 2=PUT 3=HEAD
        status_codes: str = "200",
        timeout: str = "15s",
        verify_peer: bool = True,
        verify_host: bool = True,
        follow_redirects: bool = True,
        posts: str = "",
        post_type: int = 0,  # 0=Raw 2=JSON 3=XML
        value_type: int = 4,  # 0=float (response time), 4=text (response body)
        retrieve_mode: int = 0,  # 0=body 1=headers 2=body+headers
        team_name: str = "",
        authtype: int = 0,  # 0=None, 1=Basic, 2=NTLM
        username: str = "",
        password: str = "",
        headers: str = "",  # newline-separated "Name: Value" pairs
        query_fields: list[dict] | None = None,  # [{name, value}] appended as URL params
        http_proxy: str = "",
        ssl_cert_file: str = "",
        ssl_key_file: str = "",
        ssl_key_password: str = "",
        convert_to_json: bool = False,  # output_format=1 in Zabbix
        allow_traps: bool = False,
        status: int = 0,  # 0=enabled 1=disabled
        regex_preprocessing: bool = False,
        regex_pattern: str = "",
        regex_output: str = "\\1",
        regex_no_match_value: str = "0",
        delay: str = "1m",
        units: str = "",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
    ) -> tuple[str | None, str | None]:
        """Add an HTTP agent item (Zabbix type 19). The Zabbix server fetches the URL."""
        if not self.zapi:
            return None, "Zabbix API not connected."
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found in Zabbix."
            host_id = host_data[0]["hostid"]

            if not item_key:
                safe = re.sub(r"[^a-zA-Z0-9._-]", "_", url)[:60]
                item_key = f"http.check[{safe}]"

            # Append query fields to URL if provided
            effective_url = url
            if query_fields:
                from urllib.parse import urlencode

                pairs = [(qf["name"], qf["value"]) for qf in query_fields if qf.get("name")]
                if pairs:
                    sep = "&" if "?" in effective_url else "?"
                    effective_url = effective_url + sep + urlencode(pairs)

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
                verify_peer=1 if verify_peer else 0,
                verify_host=1 if verify_host else 0,
                follow_redirects=1 if follow_redirects else 0,
                retrieve_mode=retrieve_mode,
                output_format=1 if convert_to_json else 0,
                allow_traps=1 if allow_traps else 0,
                status=status,
                interfaceid=0,  # HTTP agent does not require a host interface
            )
            kwargs.update(
                self._http_extra_kwargs(
                    units=units,
                    description=description,
                    posts=posts,
                    post_type=post_type,
                    headers=headers,
                    http_proxy=http_proxy,
                    ssl_cert_file=ssl_cert_file,
                    ssl_key_file=ssl_key_file,
                    ssl_key_password=ssl_key_password,
                    authtype=authtype,
                    username=username,
                    password=password,
                    team_name=team_name,
                    regex_preprocessing=regex_preprocessing,
                    regex_pattern=regex_pattern,
                    regex_output=regex_output,
                    regex_no_match_value=regex_no_match_value,
                )
            )

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
            return None, "Zabbix API not connected."
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
            return None, "Zabbix API not connected."
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found in Zabbix."
            host_id = host_data[0]["hostid"]

            interfaces = self.zapi.hostinterface.get(hostids=host_id)
            if not interfaces:
                return None, f"No interfaces found for host '{hostname}'."
            interface_id = self._pick_interface(interfaces, "1")["interfaceid"]

            # Build proc.num key — trailing empty params are omitted
            parts = [process_name, run_as_user, state, cmdline_regex]
            # Strip trailing empty parts
            while parts and not parts[-1]:
                parts.pop()
            item_key = f"proc.num[{','.join(parts)}]"

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
                trigger_name = f"{process_name} is not running on {hostname}"
                if run_as_user:
                    trigger_name = (
                        f"{process_name} (user: {run_as_user}) is not running on {hostname}"
                    )
                _, te = self.add_trigger(
                    hostname,
                    item_key,
                    trigger_name,
                    threshold=0,
                    operator="=",
                    priority=trigger_priority,
                )
                if te:
                    logger.warning("add_process_item: trigger creation failed: %s", te)

            return item_id, None
        except Exception as e:
            logger.exception("add_process_item(%r, %r) failed", hostname, process_name)
            return None, str(e)

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
            return None, "Zabbix API not connected."
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
