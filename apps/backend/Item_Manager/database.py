"""Database monitoring items: ODBC (type 4) and Agent2 DB plugin items."""

import logging
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class DatabaseItemsMixin:
    """Mixed into Item_Manager. Calls self.add_item (CoreItemsMixin) via MRO."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"
        add_item: Callable[..., tuple[str | None, str | None]]

    _DB_AGENT2_METRICS: dict = {
        "postgresql": [
            {
                "metric": "ping",
                "key": "pgsql.ping",
                "vtype": 3,
                "label": "Ping (1=up, 0=down)",
                "has_extra": False,
            },
            {
                "metric": "version",
                "key": "pgsql.version",
                "vtype": 4,
                "label": "Server version",
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
                "label": "Ping (1=up, 0=down)",
                "has_extra": False,
            },
            {
                "metric": "version",
                "key": "mysql.version",
                "vtype": 4,
                "label": "Server version",
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
                "label": "Ping (1=up, 0=down)",
                "has_extra": False,
            },
            {
                "metric": "version",
                "key": "mongodb.server.version",
                "vtype": 4,
                "label": "Server version",
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
                "label": "Ping (1=up, 0=down)",
                "has_extra": False,
            },
            {
                "metric": "version",
                "key": "mssql.version",
                "vtype": 4,
                "label": "Server version",
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
        self,
        hostname: str,
        dsn: str,
        sql_query: str,
        description: str,
        item_name: str = "",
        value_type: int = 3,
        username: str = "",
        password: str = "",
        team_name: str = "",
        delay: str = "1m",
        units: str = "",
        history: str = "31d",
        trends: str = "365d",
        status: int = 0,
        timeout: str = "",
    ) -> tuple[str | None, str | None]:
        """Add a Zabbix ODBC database monitor item (type 4) using db.odbc.select."""
        if not self.zapi:
            return None, "Zabbix API not connected."
        if not dsn or not sql_query or not description:
            return None, "DSN, description, and SQL query are all required."
        try:
            host_data = self.zapi.host.get(
                filter={"host": [hostname]}, output=["hostid"]
            )
            if not host_data:
                return None, f"Host '{hostname}' not found."
            host_id = host_data[0]["hostid"]
            safe_desc = (
                description.replace(",", "_").replace("]", "_").replace("[", "_")
            )
            item_key = f"db.odbc.select[{safe_desc},{dsn}]"
            if not item_name:
                item_name = f"ODBC: {description} on {hostname}"
            kwargs: dict = dict(
                name=item_name,
                key_=item_key,
                hostid=host_id,
                type=4,
                value_type=value_type,
                params=sql_query,
                delay=delay or "1m",
                history=history or "31d",
                trends=trends or "365d",
                status=status,
            )
            if units:
                kwargs["units"] = units
            if timeout:
                kwargs["timeout"] = timeout
            if username:
                kwargs["username"] = username
            if password:
                kwargs["password"] = password
            if team_name:
                kwargs["tags"] = [{"tag": "team", "value": team_name}]
            result = self.zapi.item.create(**kwargs)
            item_id = result["itemids"][0]
            logger.info(
                "ODBC item %r added to %r (ID: %s).", item_name, hostname, item_id
            )
            return item_id, None
        except Exception as e:
            logger.error("add_db_odbc_item(%r) failed: %r", hostname, e)
            return None, str(e)

    def add_db_agent2_item(
        self,
        hostname: str,
        engine: str,
        conn_string: str,
        metric: str,
        item_name: str = "",
        extra_param: str = "",
        value_type: int | None = None,
        team_name: str = "",
    ) -> tuple[str | None, str | None]:
        """Add an Agent2 database plugin item (type 0) using engine-specific keys."""
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
        return self.add_item(hostname, item_name, item_key, vtype, team_name)
