"""Trigger CRUD and the change/age trigger helpers used by file-watch items."""

import logging
from Zabbix_Base import zabbix_err
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class TriggersMixin:
    """Mixed into Item_Manager. Assumes `self.zapi`/`self._zabbix_version` from Zabbix_Base."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"
        _zabbix_version: tuple[int, int]

    def add_trigger(
        self,
        hostname,
        item_key,
        trigger_name,
        threshold,
        operator=">",
        priority=3,
        event_name: str = "",
        comments: str = "",
    ) -> tuple[str | None, str | None]:
        """
        Adds a trigger for a host item.
        Automatically picks the expression syntax based on the Zabbix server version:
          >=6.2 → last(/hostname/key)>value   (new syntax)
          <6.2  → {hostname:key.last()}>value  (classic syntax)
        Returns (trigger_id, error_message). trigger_id is None on failure.
        """
        if not self.zapi:
            return None, "Zabbix API not connected."

        valid_operators = {">", "<", ">=", "<=", "=", "<>"}
        if operator not in valid_operators:
            return None, f"Invalid operator '{operator}'."

        try:
            host_data = self.zapi.host.get(
                filter={"host": [hostname]}, output=["hostid"]
            )
            if not host_data:
                return None, f"Host '{hostname}' not found in Zabbix."

            # Choose expression format based on server version.
            # Zabbix 6.2+ dropped the classic {host:key.last()} syntax.
            if self._zabbix_version >= (6, 2):
                expression = f"last(/{hostname}/{item_key}){operator}{threshold}"
            else:
                expression = f"{{{hostname}:{item_key}.last()}}{operator}{threshold}"

            create_params: dict = {
                "description": trigger_name,
                "expression": expression,
                "priority": int(priority),
            }
            if event_name:
                create_params["event_name"] = event_name
            if comments:
                create_params["comments"] = comments
            result = self.zapi.trigger.create(**create_params)
            trigger_id = result["triggerids"][0]
            logger.info(
                "Trigger %r created on %r (ID: %s).", trigger_name, hostname, trigger_id
            )
            return trigger_id, None

        except Exception as e:
            msg = str(e)
            logger.error("add_trigger(%r, %r) failed: %r", hostname, trigger_name, e)
            return None, msg

    def add_string_trigger(
        self,
        hostname: str,
        item_key: str,
        trigger_name: str,
        pattern: str,
        match_type: str = "like",
        priority: int = 3,
        event_name: str = "",
        comments: str = "",
    ) -> tuple[str | None, str | None]:
        """
        Adds a trigger for a string/text item using pattern matching.
        match_type: like | notlike | regexp | notregexp
        >=6.2: find(/host/key,,"like","pattern")=1
        <6.2:  str({host:key.last()},"pattern")=1
        """
        if not self.zapi:
            return None, "Zabbix API not connected."
        try:
            host_data = self.zapi.host.get(
                filter={"host": [hostname]}, output=["hostid"]
            )
            if not host_data:
                return None, f"Host '{hostname}' not found in Zabbix."

            negate = match_type in ("notlike", "notregexp")
            base_fn = "regexp" if "regexp" in match_type else "like"
            fire_val = "0" if negate else "1"

            if self._zabbix_version >= (6, 2):
                expression = (
                    f'find(/{hostname}/{item_key},,"{base_fn}","{pattern}")={fire_val}'
                )
            else:
                expression = (
                    f'str({{{hostname}:{item_key}.last()}},"{pattern}")={fire_val}'
                )

            create_params: dict = {
                "description": trigger_name,
                "expression": expression,
                "priority": int(priority),
            }
            if event_name:
                create_params["event_name"] = event_name
            if comments:
                create_params["comments"] = comments
            result = self.zapi.trigger.create(**create_params)
            trigger_id = result["triggerids"][0]
            logger.info(
                "String trigger %r created on %r (ID: %s).",
                trigger_name,
                hostname,
                trigger_id,
            )
            return trigger_id, None
        except Exception as e:
            logger.error(
                "add_string_trigger(%r, %r) failed: %r", hostname, trigger_name, e
            )
            return None, zabbix_err(e)

    def get_trigger_hostname(self, triggerid: str) -> str:
        """Return the host name for a trigger, or '' if not found."""
        if not self.zapi:
            return ""
        try:
            triggers = self.zapi.trigger.get(
                triggerids=[triggerid], output=["triggerid"], selectHosts=["host"]
            )
            if triggers and triggers[0].get("hosts"):
                return triggers[0]["hosts"][0]["host"]
        except Exception as exc:
            logger.debug("get_hostname_for_trigger failed: %s", exc)
        return ""

    def list_triggers(self, hostname: str) -> tuple[list[dict], str]:
        """List all non-inherited triggers on a host.
        Returns (triggers, host_available) where host_available is
        '0'=Unknown, '1'=Available, '2'=Unavailable (Zabbix interface status).
        """
        if not self.zapi:
            return [], "0"
        try:
            host_data = self.zapi.host.get(
                filter={"host": [hostname]},
                output=["hostid"],
                selectInterfaces=["available", "type"],
            )
            if not host_data:
                return [], "0"

            # Zabbix 7.x: availability lives on each interface.
            # Prefer the ZBX agent interface (type=1), fall back to first.
            interfaces = host_data[0].get("interfaces", [])
            primary = next(
                (i for i in interfaces if str(i.get("type")) == "1"), None
            ) or (interfaces[0] if interfaces else None)
            host_available = str(primary.get("available", "0")) if primary else "0"

            triggers = self.zapi.trigger.get(
                hostids=host_data[0]["hostid"],
                output=[
                    "triggerid",
                    "description",
                    "expression",
                    "priority",
                    "status",
                    "value",
                    "lastchange",
                ],
                expandExpression=True,
                inherited=False,
            )
            return triggers, host_available
        except Exception as e:
            logger.error("list_triggers(%r) failed: %r", hostname, e)
            return [], "0"

    def update_trigger(
        self,
        triggerid: str,
        description: str | None = None,
        priority: int | None = None,
        status: int | None = None,
        expression: str | None = None,
        event_name: str | None = None,
        comments: str | None = None,
    ) -> bool:
        """Update a trigger's name, severity, status, expression, event name, or comments."""
        if not self.zapi:
            return False
        try:
            params: dict = {"triggerid": triggerid}
            if description is not None:
                params["description"] = description
            if priority is not None:
                params["priority"] = priority
            if status is not None:
                params["status"] = status
            if expression is not None:
                params["expression"] = expression
            if event_name is not None:
                params["event_name"] = event_name
            if comments is not None:
                params["comments"] = comments
            self.zapi.trigger.update(**params)
            logger.info("Updated trigger ID %s.", triggerid)
            return True
        except Exception as e:
            logger.error("update_trigger(%s) failed: %r", triggerid, e)
            raise

    def delete_trigger(self, triggerid: str) -> bool:
        """Delete a trigger by ID."""
        if not self.zapi:
            return False
        try:
            self.zapi.trigger.delete([triggerid])
            logger.info("Deleted trigger ID %s.", triggerid)
            return True
        except Exception as e:
            logger.error("delete_trigger(%s) failed: %r", triggerid, e)
            return False

    def list_all_triggers(
        self, search: str = "", hostname: str = "", limit: int = 2000
    ) -> list[dict]:
        """List triggers across all hosts. Custom (non-template) triggers are sorted first."""
        if not self.zapi:
            raise RuntimeError("Zabbix API not connected.")
        fetch_limit = min(limit * 3, 5000)
        kwargs: dict = dict(
            output=[
                "triggerid",
                "description",
                "expression",
                "priority",
                "status",
                "value",
                "lastchange",
                "templateid",
            ],
            selectHosts=["hostid", "host"],
            expandExpression=True,
            limit=fetch_limit,
            sortfield="description",
            sortorder="ASC",
        )
        if hostname:
            host_data = self.zapi.host.get(
                filter={"host": [hostname]}, output=["hostid"]
            )
            if not host_data:
                return []
            kwargs["hostids"] = host_data[0]["hostid"]
        if search:
            kwargs["search"] = {"description": search}
        triggers = self.zapi.trigger.get(**kwargs)
        # Fetch interface availability for each unique host so the UI can flag
        # triggers on unreachable hosts.
        unique_hostids = list(
            {
                t.get("hosts", [{}])[0].get("hostid", "")
                for t in triggers
                if t.get("hosts")
            }
            - {""}
        )
        host_avail_map: dict[str, str] = {}
        if unique_hostids:
            try:
                hosts_info = self.zapi.host.get(
                    hostids=unique_hostids,
                    output=["hostid"],
                    selectInterfaces=["available", "type"],
                )
                for h in hosts_info:
                    ifaces = h.get("interfaces", [])
                    primary = next(
                        (i for i in ifaces if str(i.get("type")) == "1"), None
                    ) or (ifaces[0] if ifaces else None)
                    host_avail_map[h["hostid"]] = (
                        str(primary.get("available", "0")) if primary else "0"
                    )
            except Exception as exc:
                logger.warning(
                    "list_all_triggers: could not fetch host availability: %r", exc
                )

        result = []
        for t in triggers:
            hosts = t.get("hosts") or []
            hostid = hosts[0].get("hostid", "") if hosts else ""
            result.append(
                {
                    "triggerid": t["triggerid"],
                    "description": t["description"],
                    "expression": t["expression"],
                    "priority": int(t["priority"]),
                    "status": int(t["status"]),
                    "value": int(t.get("value", 0)),
                    "lastchange": int(t.get("lastchange", 0)),
                    "hostname": hosts[0]["host"] if hosts else "",
                    "templateid": t.get("templateid", "0"),
                    "host_available": host_avail_map.get(hostid, "0"),
                }
            )
        # Custom triggers (templateid=0) first, template-inherited triggers after
        result.sort(
            key=lambda x: (
                0 if str(x["templateid"]) == "0" else 1,
                x["description"].lower(),
            )
        )
        logger.info(
            "list_all_triggers: returned %d triggers (search=%r, host=%r).",
            len(result),
            search,
            hostname,
        )
        return result[:limit]

    def add_change_trigger(
        self,
        hostname: str,
        item_key: str,
        trigger_name: str,
        priority: int = 2,
    ) -> tuple[str | None, str | None]:
        """Add a trigger that fires whenever an item's value changes (uses change() function)."""
        if not self.zapi:
            return None, "Zabbix API not connected."
        try:
            host_data = self.zapi.host.get(
                filter={"host": [hostname]}, output=["hostid"]
            )
            if not host_data:
                return None, f"Host '{hostname}' not found in Zabbix."
            if self._zabbix_version >= (6, 2):
                expression = f"change(/{hostname}/{item_key})=1"
            else:
                expression = f"{{{hostname}:{item_key}.change()}}>0"
            result = self.zapi.trigger.create(
                description=trigger_name, expression=expression, priority=int(priority)
            )
            trigger_id = result["triggerids"][0]
            logger.info(
                "Change trigger %r created on %r (ID: %s).",
                trigger_name,
                hostname,
                trigger_id,
            )
            return trigger_id, None
        except Exception as e:
            msg = str(e)
            logger.error("add_change_trigger(%r, %r) failed: %r", hostname, item_key, e)
            return None, msg

    def add_file_age_trigger(
        self,
        hostname: str,
        file_path: str,
        trigger_name: str,
        max_age_minutes: int,
        priority: int = 3,
    ) -> tuple[str | None, str | None]:
        """Add a trigger that fires when a file hasn't been modified in max_age_minutes.
        Requires Zabbix 5.4+ (new expression syntax with now() function).
        """
        if not self.zapi:
            return None, "Zabbix API not connected."
        if self._zabbix_version < (5, 4):
            return (
                None,
                "File age triggers require Zabbix 5.4 or newer (now() function not available in older versions).",
            )
        try:
            host_data = self.zapi.host.get(
                filter={"host": [hostname]}, output=["hostid"]
            )
            if not host_data:
                return None, f"Host '{hostname}' not found in Zabbix."
            item_key = f"vfs.file.time[{file_path},modify]"
            threshold = max_age_minutes * 60
            expression = f"now() - last(/{hostname}/{item_key}) > {threshold}"
            result = self.zapi.trigger.create(
                description=trigger_name, expression=expression, priority=int(priority)
            )
            trigger_id = result["triggerids"][0]
            logger.info(
                "Age trigger %r created on %r (ID: %s).",
                trigger_name,
                hostname,
                trigger_id,
            )
            return trigger_id, None
        except Exception as e:
            msg = str(e)
            logger.error(
                "add_file_age_trigger(%r, %r) failed: %r", hostname, file_path, e
            )
            return None, msg

    def bulk_add_triggers(
        self, hostnames: list[str], trigger_config: dict
    ) -> list[dict]:
        """Add the same trigger to multiple hosts. Returns [{hostname, trigger_id, error}]."""
        results = []
        for hostname in hostnames:
            trigger_id, err = self.add_trigger(
                hostname=hostname,
                item_key=trigger_config.get("item_key", ""),
                trigger_name=trigger_config.get("trigger_name", ""),
                threshold=trigger_config.get("threshold", 0),
                operator=trigger_config.get("operator", ">"),
                priority=trigger_config.get("priority", 3),
            )
            results.append(
                {"hostname": hostname, "trigger_id": trigger_id, "error": err}
            )

        ok = sum(1 for r in results if not r["error"])
        logger.info("bulk_add_triggers: %d/%d succeeded.", ok, len(hostnames))
        return results
