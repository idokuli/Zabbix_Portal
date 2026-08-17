import logging

from Zabbix_Base import ZabbixBase, zabbix_err

logger = logging.getLogger(__name__)

_ZABBIX_NOT_CONNECTED = "Zabbix API not connected."


class DataCollectionManager(ZabbixBase):
    def __init__(self):
        super().__init__()
        logger.info("DataCollection Manager ready.")

    # ── Template Groups ────────────────────────────────────────────────

    def list_template_groups(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            groups = self.zapi.templategroup.get(
                output=["groupid", "name"],
                selectTemplates=["templateid", "name"],
                sortfield="name",
                sortorder="ASC",
            )
            return [
                {
                    "groupid": g["groupid"],
                    "name": g["name"],
                    "template_count": len(g.get("templates", [])),
                }
                for g in groups
            ]
        except Exception:
            logger.exception("list_template_groups failed")
            return []

    def get_template_group_members(self, groupid: str) -> list[dict]:
        if not self.zapi:
            return []
        try:
            templates = self.zapi.template.get(
                output=["templateid", "name", "description"],
                groupids=[groupid],
                sortfield="name",
            )
            return [
                {
                    "templateid": t["templateid"],
                    "name": t["name"],
                    "description": t.get("description", ""),
                }
                for t in templates
            ]
        except Exception:
            logger.exception("get_template_group_members(%s) failed", groupid)
            return []

    def create_template_group(self, name: str) -> tuple[str | None, str | None]:
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        try:
            result = self.zapi.templategroup.create(name=name)
            gid = result["groupids"][0]
            logger.info("Created template group %r (ID: %s).", name, gid)
            return gid, None
        except Exception as e:
            logger.exception("create_template_group(%r) failed", name)
            return None, zabbix_err(e)

    def update_template_group(self, groupid: str, name: str) -> bool:
        if not self.zapi:
            return False
        try:
            self.zapi.templategroup.update(groupid=groupid, name=name)
            logger.info("Updated template group %s → %r.", groupid, name)
            return True
        except Exception:
            logger.exception("update_template_group(%s) failed", groupid)
            return False

    def delete_template_group(self, groupid: str) -> bool:
        if not self.zapi:
            return False
        try:
            self.zapi.templategroup.delete([groupid])
            logger.info("Deleted template group %s.", groupid)
            return True
        except Exception:
            logger.exception("delete_template_group(%s) failed", groupid)
            return False

    def set_template_group_members(self, groupid: str, templateids: list[str]) -> bool:
        if not self.zapi:
            return False
        try:
            current = self.zapi.template.get(groupids=[groupid], output=["templateid"])
            current_ids = {t["templateid"] for t in current}
            new_ids = set(templateids)
            to_add = list(new_ids - current_ids)
            to_remove = list(current_ids - new_ids)
            if to_add:
                self.zapi.template.massadd(
                    templates=[{"templateid": t} for t in to_add],
                    groups=[{"groupid": groupid}],
                )
            if to_remove:
                self.zapi.template.massremove(templateids=to_remove, groupids=[groupid])
            return True
        except Exception:
            logger.exception("set_template_group_members(%s) failed", groupid)
            return False

    # ── Host Groups ────────────────────────────────────────────────────

    def list_host_groups(self) -> list[dict]:
        return self._cached("host_groups", 300.0, self._fetch_host_groups)

    def _fetch_host_groups(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            groups = self.zapi.hostgroup.get(
                output=["groupid", "name"],
                selectHosts=["hostid"],
                sortfield="name",
                sortorder="ASC",
            )
            return [
                {
                    "groupid": g["groupid"],
                    "name": g["name"],
                    "host_count": len(g.get("hosts", [])),
                }
                for g in groups
            ]
        except Exception:
            logger.exception("list_host_groups failed")
            return []

    def get_host_group_members(self, groupid: str) -> list[dict]:
        if not self.zapi:
            return []
        try:
            hosts = self.zapi.host.get(
                output=["hostid", "host", "name", "status"],
                groupids=[groupid],
                sortfield="host",
            )
            return [
                {
                    "hostid": h["hostid"],
                    "host": h["host"],
                    "name": h["name"],
                    "status": int(h.get("status", 0)),
                }
                for h in hosts
            ]
        except Exception:
            logger.exception("get_host_group_members(%s) failed", groupid)
            return []

    def create_host_group(self, name: str) -> tuple[str | None, str | None]:
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        try:
            result = self.zapi.hostgroup.create(name=name)
            gid = result["groupids"][0]
            logger.info("Created host group %r (ID: %s).", name, gid)
            self._invalidate("host_groups")
            return gid, None
        except Exception as e:
            logger.exception("create_host_group(%r) failed", name)
            return None, zabbix_err(e)

    def update_host_group(self, groupid: str, name: str) -> bool:
        if not self.zapi:
            return False
        try:
            self.zapi.hostgroup.update(groupid=groupid, name=name)
            logger.info("Updated host group %s → %r.", groupid, name)
            self._invalidate("host_groups")
            return True
        except Exception:
            logger.exception("update_host_group(%s) failed", groupid)
            return False

    def delete_host_group(self, groupid: str) -> bool:
        if not self.zapi:
            return False
        try:
            self.zapi.hostgroup.delete([groupid])
            logger.info("Deleted host group %s.", groupid)
            self._invalidate("host_groups")
            return True
        except Exception:
            logger.exception("delete_host_group(%s) failed", groupid)
            return False

    def set_host_group_members(self, groupid: str, hostids: list[str]) -> tuple[bool, str | None]:
        if not self.zapi:
            return False, _ZABBIX_NOT_CONNECTED
        try:
            current = self.zapi.host.get(groupids=[groupid], output=["hostid"])
            current_ids = {h["hostid"] for h in current}
            new_ids = set(hostids)
            to_add = list(new_ids - current_ids)
            to_remove = list(current_ids - new_ids)
            if to_add:
                self.zapi.host.massadd(
                    hosts=[{"hostid": h} for h in to_add], groups=[{"groupid": groupid}]
                )
            if to_remove:
                self.zapi.host.massremove(hostids=to_remove, groupids=[groupid])
            self._invalidate("host_groups")
            return True, None
        except Exception as e:
            logger.exception("set_host_group_members(%s) failed", groupid)
            return False, zabbix_err(e)

    # ── Templates ─────────────────────────────────────────────────────

    def list_templates(self, search: str = "") -> list[dict]:
        # Bypass cache for filtered searches; cache the full unfiltered list
        if search:
            return self._fetch_templates(search)
        return self._cached("templates_full", 300.0, lambda: self._fetch_templates(""))

    def _fetch_templates(self, search: str) -> list[dict]:
        if not self.zapi:
            return []
        try:
            kwargs: dict = dict(
                output=["templateid", "name", "description"],
                selectTemplateGroups=["groupid", "name"],
                selectParentTemplates=["templateid", "name"],
                sortfield="name",
                sortorder="ASC",
                limit=500,
            )
            if search:
                kwargs["search"] = {"name": search}
            templates = self.zapi.template.get(**kwargs)
            return [
                {
                    "templateid": t["templateid"],
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "groups": [
                        {"groupid": g["groupid"], "name": g["name"]}
                        for g in t.get("templategroups", [])
                    ],
                    "linked_templates": [
                        {"templateid": p["templateid"], "name": p["name"]}
                        for p in t.get("parentTemplates", [])
                    ],
                }
                for t in templates
            ]
        except Exception:
            logger.exception("list_templates failed")
            return []

    def create_template(
        self,
        name: str,
        group_ids: list[str],
        description: str = "",
        visible_name: str = "",
        template_ids: list[str] | None = None,
        tags: list[dict] | None = None,
        macros: list[dict] | None = None,
    ) -> tuple[str | None, str | None]:
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        if not group_ids:
            return None, "At least one template group is required."
        try:
            params: dict = {
                "host": name,
                "name": visible_name.strip() if visible_name and visible_name.strip() else name,
                "description": description,
                "groups": [{"groupid": gid} for gid in group_ids],
            }
            if template_ids:
                params["templates"] = [{"templateid": tid} for tid in template_ids]
            if tags:
                params["tags"] = [
                    {"tag": t.get("tag", ""), "value": t.get("value", "")}
                    for t in tags
                    if t.get("tag")
                ]
            if macros:
                params["macros"] = [
                    {
                        "macro": m.get("macro", ""),
                        "value": m.get("value", ""),
                        "description": m.get("description", ""),
                    }
                    for m in macros
                    if m.get("macro")
                ]
            result = self.zapi.template.create(**params)
            tid = result["templateids"][0]
            logger.info("Created template %r (ID: %s).", name, tid)
            self._invalidate("templates_full")
            self._invalidate("templates_simple")
            return tid, None
        except Exception as e:
            logger.exception("create_template(%r) failed", name)
            return None, zabbix_err(e)

    def get_template_detail(self, templateid: str) -> dict | None:
        """Fetch full template detail including tags, macros, and item count."""
        if not self.zapi:
            return None
        try:
            result = self.zapi.template.get(
                templateids=[templateid],
                output="extend",
                selectTemplateGroups=["groupid", "name"],
                selectParentTemplates=["templateid", "name"],
                selectTags="extend",
                selectMacros="extend",
            )
            if not result:
                return None
            t = result[0]
            # Count items on this template directly (not inherited)
            try:
                items = self.zapi.item.get(
                    templateids=[templateid], output=["itemid"], inherited=False
                )
                item_count = len(items)
            except Exception:
                item_count = 0
            return {
                "templateid": t["templateid"],
                "name": t["host"],
                "visible_name": t.get("name", t["host"]),
                "description": t.get("description", ""),
                "groups": [
                    {"groupid": g["groupid"], "name": g["name"]}
                    for g in t.get("templategroups", [])
                ],
                "linked_templates": [
                    {"templateid": p["templateid"], "name": p["name"]}
                    for p in t.get("parentTemplates", [])
                ],
                "tags": [
                    {"tag": tg.get("tag", ""), "value": tg.get("value", "")}
                    for tg in t.get("tags", [])
                ],
                "macros": [
                    {
                        "macro": m.get("macro", ""),
                        "value": m.get("value", ""),
                        "description": m.get("description", ""),
                    }
                    for m in t.get("macros", [])
                ],
                "item_count": item_count,
            }
        except Exception:
            logger.exception("get_template_detail(%s) failed", templateid)
            return None

    def update_template(
        self,
        templateid: str,
        name: str | None = None,
        visible_name: str | None = None,
        description: str | None = None,
        group_ids: list[str] | None = None,
        template_ids: list[str] | None = None,
        tags: list[dict] | None = None,
        macros: list[dict] | None = None,
    ) -> tuple[bool, str | None]:
        if not self.zapi:
            return False, _ZABBIX_NOT_CONNECTED
        try:
            params: dict = {"templateid": templateid}
            if name is not None:
                params["host"] = name
            if visible_name is not None:
                params["name"] = visible_name if visible_name.strip() else (name or "")
            if description is not None:
                params["description"] = description
            if group_ids is not None:
                params["groups"] = [{"groupid": gid} for gid in group_ids]
            if template_ids is not None:
                params["templates"] = [{"templateid": tid} for tid in template_ids]
            if tags is not None:
                params["tags"] = [
                    {"tag": t.get("tag", ""), "value": t.get("value", "")}
                    for t in tags
                    if t.get("tag")
                ]
            if macros is not None:
                params["macros"] = [
                    {
                        "macro": m.get("macro", ""),
                        "value": m.get("value", ""),
                        "description": m.get("description", ""),
                    }
                    for m in macros
                    if m.get("macro")
                ]
            self.zapi.template.update(**params)
            self._invalidate("templates_full")
            self._invalidate("templates_simple")
            logger.info("Updated template %s.", templateid)
            return True, None
        except Exception as e:
            logger.exception("update_template(%s) failed", templateid)
            return False, zabbix_err(e)

    def delete_template(self, templateid: str) -> bool:
        if not self.zapi:
            return False
        try:
            self.zapi.template.delete([templateid])
            logger.info("Deleted template %s.", templateid)
            self._invalidate("templates_full")
            self._invalidate("templates_simple")
            return True
        except Exception:
            logger.exception("delete_template(%s) failed", templateid)
            return False

    # ── Maintenance ───────────────────────────────────────────────────

    def list_maintenances(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            maintenances = self.zapi.maintenance.get(
                output=[
                    "maintenanceid",
                    "name",
                    "maintenance_type",
                    "active_since",
                    "active_till",
                    "description",
                ],
                selectHosts=["hostid", "name"],
                selectGroups=["groupid", "name"],
                selectTimeperiods=["timeperiodid", "period", "start_date"],
                sortfield="name",
                sortorder="ASC",
            )
            return [
                {
                    "maintenanceid": m["maintenanceid"],
                    "name": m["name"],
                    "maintenance_type": m["maintenance_type"],  # "0"=with data, "1"=no data
                    "active_since": int(m["active_since"]),
                    "active_till": int(m["active_till"]),
                    "description": m.get("description", ""),
                    "hosts": [
                        {"hostid": h["hostid"], "name": h["name"]} for h in m.get("hosts", [])
                    ],
                    "groups": [
                        {"groupid": g["groupid"], "name": g["name"]} for g in m.get("groups", [])
                    ],
                }
                for m in maintenances
            ]
        except Exception:
            logger.exception("list_maintenances failed")
            return []

    def create_maintenance(
        self,
        name: str,
        maintenance_type: int,
        active_since: int,
        active_till: int,
        hostids: list[str],
        groupids: list[str],
        description: str = "",
    ) -> tuple[str | None, str | None]:
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        if not hostids and not groupids:
            return None, "At least one host or host group is required."
        try:
            duration = max(active_till - active_since, 3600)
            kwargs: dict = dict(
                name=name,
                maintenance_type=maintenance_type,
                active_since=active_since,
                active_till=active_till,
                description=description,
                timeperiods=[
                    {
                        "timeperiod_type": 0,
                        "start_date": active_since,
                        "period": duration,
                    }
                ],
            )
            if hostids:
                kwargs["hostids"] = hostids
            if groupids:
                kwargs["groupids"] = groupids
            result = self.zapi.maintenance.create(**kwargs)
            mid = result["maintenanceids"][0]
            logger.info("Created maintenance %r (ID: %s).", name, mid)
            return mid, None
        except Exception as e:
            logger.exception("create_maintenance(%r) failed", name)
            return None, zabbix_err(e)

    def delete_maintenance(self, maintenanceid: str) -> bool:
        if not self.zapi:
            return False
        try:
            self.zapi.maintenance.delete([maintenanceid])
            logger.info("Deleted maintenance %s.", maintenanceid)
            return True
        except Exception:
            logger.exception("delete_maintenance(%s) failed", maintenanceid)
            return False

    # ── Event Correlation ──────────────────────────────────────────────

    def list_correlations(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            correlations = self.zapi.correlation.get(
                output=["correlationid", "name", "description", "status"],
                selectFilter=["conditions"],
                selectOperations=["type"],
                sortfield="name",
                sortorder="ASC",
            )
            return [
                {
                    "correlationid": c["correlationid"],
                    "name": c["name"],
                    "description": c.get("description", ""),
                    "status": c["status"],  # status: "0" enabled, "1" disabled
                    "condition_count": len(c.get("filter", {}).get("conditions", [])),
                    "operation_count": len(c.get("operations", [])),
                }
                for c in correlations
            ]
        except Exception:
            logger.exception("list_correlations failed")
            return []

    # Condition types (index order): old event tag, new event tag, new event tag value, old event tag value
    # Operators (index order): equals, not equal, like, not like
    # Operation types (index order): close new event, close old events

    def create_correlation(
        self,
        name: str,
        description: str = "",
        status: int = 0,
        conditions: list[dict] | None = None,
        evaltype: int = 0,
        operation_type: int = 0,
    ) -> tuple[str | None, str | None]:
        """Create a correlation with one or more tag conditions."""
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        try:
            cond_list = []
            for c in conditions or []:
                entry: dict = {
                    "type": str(c.get("type", "1")),
                    "operator": str(c.get("operator", "0")),
                }
                if c.get("tag"):
                    entry["tag"] = c["tag"]
                if c.get("value") is not None:
                    entry["value"] = c["value"]
                cond_list.append(entry)
            filter_obj = {"evaltype": str(evaltype), "conditions": cond_list}
            result = self.zapi.correlation.create(
                name=name,
                description=description,
                status=str(status),
                filter=filter_obj,
                operations=[{"type": str(operation_type)}],
            )
            cid = result["correlationids"][0]
            logger.info("Created correlation %r (ID: %s).", name, cid)
            return cid, None
        except Exception as e:
            logger.exception("create_correlation(%r) failed", name)
            return None, zabbix_err(e)

    def delete_correlation(self, correlationid: str) -> bool:
        if not self.zapi:
            return False
        try:
            self.zapi.correlation.delete([correlationid])
            logger.info("Deleted correlation %s.", correlationid)
            return True
        except Exception:
            logger.exception("delete_correlation(%s) failed", correlationid)
            return False

    # ── Discovery Rules ────────────────────────────────────────────────

    _DCHECK_TYPES: dict[str, int] = {
        "ssh": 0,
        "ldap": 1,
        "smtp": 2,
        "ftp": 3,
        "http": 4,
        "pop": 5,
        "nntp": 6,
        "imap": 7,
        "tcp": 8,
        "icmp": 9,
        "snmp": 11,
        "telnet": 14,
        "jmx": 16,
        "zabbix": 18,
    }

    def list_discovery_rules(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            rules = self.zapi.drule.get(
                output=["druleid", "name", "iprange", "delay", "status", "nextcheck"],
                selectDChecks=["type", "ports", "key_"],
                sortfield="name",
                sortorder="ASC",
            )
            return [
                {
                    "druleid": r["druleid"],
                    "name": r["name"],
                    "iprange": r["iprange"],
                    "delay": r["delay"],
                    "status": r["status"],  # status: "0" active, "1" disabled
                    "nextcheck": int(r.get("nextcheck", 0)),
                    "check_count": len(r.get("dchecks", [])),
                }
                for r in rules
            ]
        except Exception:
            logger.exception("list_discovery_rules failed")
            return []

    def create_discovery_rule(
        self,
        name: str,
        iprange: str,
        delay: str,
        check_types: list[str],
        ports: str = "",
    ) -> tuple[str | None, str | None]:
        if not self.zapi:
            return None, _ZABBIX_NOT_CONNECTED
        if not check_types:
            return None, "At least one check type is required."
        try:
            dchecks = []
            for ct in check_types:
                ct_lower = ct.lower()
                type_id = self._DCHECK_TYPES.get(ct_lower, 9)  # default ICMP
                check: dict = {"type": str(type_id)}
                if ports and ct_lower not in ("icmp",):
                    check["ports"] = ports
                dchecks.append(check)

            result = self.zapi.drule.create(
                name=name,
                iprange=iprange,
                delay=delay,
                dchecks=dchecks,
            )
            rid = result["druleids"][0]
            logger.info("Created discovery rule %r (ID: %s).", name, rid)
            return rid, None
        except Exception as e:
            logger.exception("create_discovery_rule(%r) failed", name)
            return None, zabbix_err(e)

    def delete_discovery_rule(self, druleid: str) -> bool:
        if not self.zapi:
            return False
        try:
            self.zapi.drule.delete([druleid])
            logger.info("Deleted discovery rule %s.", druleid)
            return True
        except Exception:
            logger.exception("delete_discovery_rule(%s) failed", druleid)
            return False
