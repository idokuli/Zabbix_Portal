"""Proxy CRUD, proxy groups (Zabbix 7.x), and the cached proxy list."""

import logging
from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)

PROXY_TIMEOUT_FIELDS = [
    "timeout_zabbix_agent",
    "timeout_simple_check",
    "timeout_snmp_agent",
    "timeout_external_check",
    "timeout_db_monitor",
    "timeout_http_agent",
    "timeout_ssh_agent",
    "timeout_telnet_agent",
    "timeout_script",
    "timeout_browser",
]


class ProxiesMixin:
    """Mixed into ZabbixAdmin_Manager. Assumes `self.zapi`/`self._cached`/`self._invalidate`
    from Zabbix_Base.
    """

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"
        _cached: Callable[..., Any]
        _invalidate: Callable[[str], None]

    TLS_NONE = 1
    TLS_PSK = 2
    TLS_CERT = 4

    def _build_proxy_params(
        self,
        *,
        name: str,
        operating_mode: int = 0,
        description: str = "",
        proxy_groupid: str = "",
        local_address: str = "",
        local_port: str = "10051",
        address: str = "127.0.0.1",
        port: str = "10051",
        allowed_addresses: str = "",
        tls_connect: int = 1,
        tls_accept: int = 1,
        tls_issuer: str = "",
        tls_subject: str = "",
        tls_psk_identity: str = "",
        tls_psk: str = "",
        custom_timeouts: int = 0,
        timeouts: dict[str, str] | None = None,
    ) -> dict:
        params: dict = {
            "name": name,
            "operating_mode": operating_mode,
            "description": description,
        }
        if proxy_groupid:
            params["proxy_groupid"] = proxy_groupid
            params["local_address"] = local_address or address
            params["local_port"] = local_port or "10051"
        if operating_mode == 1:  # Passive — Zabbix server connects to the proxy
            params["address"] = address or "127.0.0.1"
            params["port"] = port or "10051"
            params["tls_connect"] = tls_connect
            if tls_connect == self.TLS_PSK:
                params["tls_psk_identity"] = tls_psk_identity
                if tls_psk:
                    params["tls_psk"] = tls_psk
            elif tls_connect == self.TLS_CERT:
                params["tls_issuer"] = tls_issuer
                params["tls_subject"] = tls_subject
        else:  # Active — the proxy connects to the Zabbix server
            params["allowed_addresses"] = allowed_addresses
            params["tls_accept"] = tls_accept
            if tls_accept & self.TLS_PSK:
                params["tls_psk_identity"] = tls_psk_identity
                if tls_psk:
                    params["tls_psk"] = tls_psk
            if tls_accept & self.TLS_CERT:
                params["tls_issuer"] = tls_issuer
                params["tls_subject"] = tls_subject
        params["custom_timeouts"] = custom_timeouts
        if custom_timeouts == 1 and timeouts:
            params.update({k: v for k, v in timeouts.items() if v})
        return params

    def create_proxy(self, **kwargs) -> str:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            params = self._build_proxy_params(**kwargs)
            result = self.zapi.proxy.create(**params)
            self._invalidate("proxies")
            return result["proxyids"][0]
        except Exception as e:
            raise RuntimeError(str(e))

    def update_proxy(self, proxyid: str, **kwargs) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            params = self._build_proxy_params(**kwargs)
            params["proxyid"] = proxyid
            self.zapi.proxy.update(**params)
            self._invalidate("proxies")
            return True
        except Exception as e:
            raise RuntimeError(str(e))

    def delete_proxy(self, proxyid: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.proxy.delete([proxyid])
            self._invalidate("proxies")
            return True
        except Exception as e:
            raise RuntimeError(str(e))

    def list_proxy_groups(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            groups = self.zapi.proxygroup.get(
                output="extend",
                selectProxies=["proxyid", "name"],
                sortfield="name",
            )
            return [
                {
                    "proxygroupid": g["proxygroupid"],
                    "name": g["name"],
                    "failover_delay": g.get("failover_delay", "1m"),
                    "min_online": int(g.get("min_online", 1)),
                    "description": g.get("description", ""),
                    "state": g.get("state", 0),
                    "proxy_count": len(g.get("proxies", [])),
                }
                for g in groups
            ]
        except Exception as e:
            logger.warning("list_proxy_groups failed (requires Zabbix 7.x): %s", e)
            return []

    def create_proxy_group(
        self,
        name: str,
        failover_delay: str = "1m",
        min_online: int = 1,
        description: str = "",
    ) -> str:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            result = self.zapi.proxygroup.create(
                name=name,
                failover_delay=failover_delay,
                min_online=min_online,
                description=description,
            )
            return result["proxygroupids"][0]
        except Exception as e:
            raise RuntimeError(str(e))

    def delete_proxy_group(self, proxygroupid: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.proxygroup.delete([proxygroupid])
            return True
        except Exception as e:
            raise RuntimeError(str(e))

    def list_proxies(self) -> list[dict]:
        return self._cached("proxies", 300.0, self._fetch_proxies)

    def _fetch_proxies(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            # "extend" returns every proxy field this Zabbix version actually
            # supports — avoids hardcoding a field list that breaks (with an
            # "invalid params" error) on Zabbix versions that renamed/dropped
            # fields like operating_mode/status or the per-proxy timeout overrides.
            proxies = self.zapi.proxy.get(
                output="extend",
                selectHosts="count",
            )
        except Exception:
            logger.exception("list_proxies failed")
            return []

        # Zabbix 7.x uses operating_mode (0=active, 1=passive); older versions
        # use status (5=active, 6=passive). Detect whichever this server sent.
        MODE_LABELS = {0: "Active", 1: "Passive"}
        result = []
        for p in proxies:
            if "operating_mode" in p:
                mode = int(p.get("operating_mode", 0))
            else:
                mode = 0 if int(p.get("status", 5)) == 5 else 1
            result.append(
                {
                    "proxyid": p["proxyid"],
                    "name": p.get("name", p.get("host", "")),
                    "mode": mode,
                    "mode_label": MODE_LABELS.get(mode, "Active"),
                    "description": p.get("description", ""),
                    "lastaccess": int(p.get("lastaccess", 0)),
                    "version": p.get("version", ""),
                    "host_count": int(p.get("hosts", 0)),
                    "proxy_groupid": p.get("proxy_groupid", "0"),
                    "local_address": p.get("local_address", ""),
                    "local_port": p.get("local_port", ""),
                    "address": p.get("address", ""),
                    "port": p.get("port", ""),
                    "allowed_addresses": p.get("allowed_addresses", ""),
                    "tls_connect": int(p.get("tls_connect", 1)),
                    "tls_accept": int(p.get("tls_accept", 1)),
                    "tls_issuer": p.get("tls_issuer", ""),
                    "tls_subject": p.get("tls_subject", ""),
                    "tls_psk_identity": p.get("tls_psk_identity", ""),
                    "custom_timeouts": int(p.get("custom_timeouts", 0)),
                    **{f: p.get(f, "") for f in PROXY_TIMEOUT_FIELDS},
                }
            )
        result.sort(key=lambda p: p["name"])
        return result
