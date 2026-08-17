"""Database monitoring items: ODBC (type 11) and Agent2 DB plugin items."""

import logging
from Zabbix_Base import zabbix_err
from typing import TYPE_CHECKING
from collections.abc import Callable
from api.schemas.items import DbAgent2Request, DbOdbcRequest, ItemRequest

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)

_LABEL_PING = "Ping (1=up, 0=down)"
_LABEL_VERSION = "Server version"


class DatabaseItemsMixin:
    """Mixed into ItemManager. Calls self.add_item (CoreItemsMixin) via MRO."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"
        add_item: Callable[..., tuple[str | None, str | None]]
        maybe_create_trigger: Callable[..., tuple[str | None, str | None]]
        _maybe_create_trigger_logged: Callable[..., None]

    _DB_AGENT2_METRICS: dict = {
        "postgresql": [
            {
                "metric": "ping",
                "key": "pgsql.ping",
                "vtype": 3,
                "label": _LABEL_PING,
                "has_extra": False,
            },
            {
                "metric": "version",
                "key": "pgsql.version",
                "vtype": 4,
                "label": _LABEL_VERSION,
                "has_extra": False,
            },
            {
                "metric": "connections",
                "key": "pgsql.connections",
                "vtype": 4,
                "label": "Connection stats (JSON)",
                "has_extra": False,
            },
            {
                "metric": "db_size",
                "key": "pgsql.db.size",
                "vtype": 3,
                "label": "Database size (bytes)",
                "has_extra": True,
            },
        ],
        "mysql": [
            {
                "metric": "ping",
                "key": "mysql.ping",
                "vtype": 3,
                "label": _LABEL_PING,
                "has_extra": False,
            },
            {
                "metric": "version",
                "key": "mysql.version",
                "vtype": 4,
                "label": _LABEL_VERSION,
                "has_extra": False,
            },
            {
                "metric": "connections",
                "key": "mysql.connections",
                "vtype": 3,
                "label": "Active connections",
                "has_extra": False,
            },
            {
                "metric": "db_size",
                "key": "mysql.db.size",
                "vtype": 3,
                "label": "Database size (bytes)",
                "has_extra": True,
            },
        ],
        "mongodb": [
            {
                "metric": "ping",
                "key": "mongodb.ping",
                "vtype": 3,
                "label": _LABEL_PING,
                "has_extra": False,
            },
            {
                "metric": "version",
                "key": "mongodb.server.version",
                "vtype": 4,
                "label": _LABEL_VERSION,
                "has_extra": False,
            },
            {
                "metric": "connections",
                "key": "mongodb.connections",
                "vtype": 3,
                "label": "Current connections",
                "has_extra": False,
            },
        ],
        "mssql": [
            {
                "metric": "ping",
                "key": "mssql.ping",
                "vtype": 3,
                "label": _LABEL_PING,
                "has_extra": False,
            },
            {
                "metric": "version",
                "key": "mssql.version",
                "vtype": 4,
                "label": _LABEL_VERSION,
                "has_extra": False,
            },
            {
                "metric": "connections",
                "key": "mssql.connections",
                "vtype": 3,
                "label": "Active connections",
                "has_extra": False,
            },
        ],
    }

    def add_db_odbc_item(
        self, request: DbOdbcRequest, team_name: str = ""
    ) -> tuple[str | None, str | None]:
        """Add a Zabbix ODBC database monitor item (type 11) using db.odbc.select."""
        hostname, dsn, sql_query, description = (
            request.hostname,
            request.dsn,
            request.sql_query,
            request.description,
        )
        if not self.zapi:
            return None, "Zabbix API not connected."
        if not dsn or not sql_query or not description:
            return None, "DSN, description, and SQL query are all required."
        try:
            host_data = self.zapi.host.get(filter={"host": [hostname]}, output=["hostid"])
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            item_name = request.item_name or f"ODBC: {description} on {hostname}"
            safe_desc = description.replace(",", "_").replace("]", "_").replace("[", "_")
            item_key = f"db.odbc.select[{safe_desc},{dsn}]"
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                type=11,  # DB monitor (ODBC); type 4 was legacy SNMPv2c
                value_type=request.value_type,
                params=sql_query,
                delay=request.delay or "1m",
                history=request.history or "31d",
                trends=request.trends or "365d",
                status=request.status,
            )
            if request.units:
                kwargs["units"] = request.units
            if request.timeout:
                kwargs["timeout"] = request.timeout
            if request.username:
                kwargs["username"] = request.username
            if request.password:
                kwargs["password"] = request.password
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info("ODBC item %r added to %r (ID: %s).", item_name, hostname, item_id)
            self._maybe_create_trigger_logged(
                hostname, item_key, item_name, request.value_type, request, "add_db_odbc_item"
            )
            return item_id, None
        except Exception as e:
            logger.exception("add_db_odbc_item(%r) failed", hostname)
            return None, zabbix_err(e)

    def add_db_agent2_item(
        self, request: DbAgent2Request, team_name: str = ""
    ) -> tuple[str | None, str | None]:
        """Add an Agent2 database plugin item (type 0) using engine-specific keys."""
        hostname = request.hostname
        engine = request.engine
        conn_string = request.conn_string
        metric = request.metric
        item_name = request.item_name
        extra_param = request.extra_param
        value_type = request.value_type

        if not self.zapi:
            return None, "Zabbix API not connected."
        engine_metrics = self._DB_AGENT2_METRICS.get(engine)
        if not engine_metrics:
            return (
                None,
                f"Unsupported engine '{engine}'. Use: {', '.join(self._DB_AGENT2_METRICS)}.",
            )
        meta = next((m for m in engine_metrics if m["metric"] == metric), None)
        if not meta:
            supported = ", ".join(m["metric"] for m in engine_metrics)
            return (
                None,
                f"Unknown metric '{metric}' for '{engine}'. Supported: {supported}.",
            )
        if not conn_string:
            return None, "Connection string is required."
        key_base = meta["key"]
        if extra_param:
            item_key = f"{key_base}[{conn_string},{extra_param}]"
        else:
            item_key = f"{key_base}[{conn_string}]"
        vtype = value_type if value_type is not None else meta["vtype"]
        if not item_name:
            item_name = f"{engine} {meta['label']} on {hostname}"
        return self.add_item(
            ItemRequest(
                hostname=hostname,
                item_name=item_name,
                item_key=item_key,
                value_type=vtype,
                create_trigger=request.create_trigger,
                trigger_operator=request.trigger_operator,
                trigger_threshold=request.trigger_threshold,
                trigger_pattern=request.trigger_pattern,
                trigger_match_type=request.trigger_match_type,
                trigger_priority=request.trigger_priority,
            ),
            team_name,
        )
