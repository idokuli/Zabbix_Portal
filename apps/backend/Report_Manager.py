import logging
import time
from typing import Any

from Zabbix_Base import Zabbix_Base

logger = logging.getLogger(__name__)

SEVERITY_MAP = {
    0: "Not classified",
    1: "Information",
    2: "Warning",
    3: "Average",
    4: "High",
    5: "Disaster",
}
PORTAL_SEVERITY = {
    0: "None",
    1: "Info",
    2: "Low",
    3: "Medium",
    4: "High",
    5: "Critical",
}

AUDIT_ACTIONS = {
    0: "Add",
    1: "Update",
    2: "Delete",
    3: "Login",
    4: "Logout",
    5: "Enable",
    6: "Disable",
    7: "History clear",
    8: "Execute",
    9: "Config refresh",
    10: "Push value",
}
AUDIT_RESOURCES = {
    0: "User",
    3: "Host",
    4: "Action",
    5: "Graph",
    6: "Graph element",
    7: "Trigger",
    8: "Host group",
    9: "Item",
    10: "Image",
    11: "Map",
    13: "Screen element",
    14: "History",
    15: "Discovery rule",
    16: "Service",
    17: "Maintenance",
    18: "Regex",
    19: "Macro",
    20: "Template",
    22: "User group",
    23: "Application",
    24: "Trigger",
    25: "Dashboard",
    26: "Report",
    27: "Module",
    28: "Event",
    29: "Alert",
    30: "Zabbix server",
    31: "Media type",
    32: "Proxy",
    33: "Authentication",
    34: "Template group",
    35: "User directory",
    36: "Housekeeping",
    37: "Connector",
    38: "Token",
    39: "Role",
    40: "Scheduled report",
}


class Report_Manager(Zabbix_Base):
    def __init__(self):
        super().__init__()
        logger.info("Report Manager ready.")

    # ── Top Triggers ───────────────────────────────────────────────────

    def get_top_triggers(
        self, limit: int = 100, severity_min: int = 0, hours: int = 24
    ) -> list[dict]:
        if not self.zapi:
            return []
        try:
            since = int(time.time()) - hours * 3600
            params: dict[str, Any] = dict(
                output=[
                    "triggerid",
                    "description",
                    "priority",
                    "lastchange",
                    "status",
                    "value",
                ],
                selectHosts=["hostid", "host", "name"],
                selectLastEvent=["eventid", "clock", "acknowledged"],
                sortfield="lastchange",
                sortorder="DESC",
                limit=limit,
                only_true=True,
                filter={"status": 0},
                lastChangeSince=since,
            )
            if severity_min > 0:
                params["filter"]["priority"] = list(range(severity_min, 6))
            triggers = self.zapi.trigger.get(**params)
            return [
                {
                    "triggerid": t["triggerid"],
                    "description": t["description"],
                    "priority": int(t["priority"]),
                    "severity_label": PORTAL_SEVERITY.get(int(t["priority"]), "Unknown"),
                    "lastchange": int(t["lastchange"]),
                    "status": int(t["status"]),
                    "value": int(t["value"]),
                    "hosts": t.get("hosts", []),
                    "last_event": t.get("lastEvent"),
                }
                for t in triggers
            ]
        except Exception as e:
            logger.exception("get_top_triggers failed")
            raise RuntimeError(str(e)) from e

    # ── Audit Log ──────────────────────────────────────────────────────

    def get_audit_log(
        self, limit: int = 200, time_from: int | None = None, userid: str | None = None
    ) -> list[dict]:
        if not self.zapi:
            return []
        try:
            params: dict = dict(output="extend", limit=limit, sortfield="clock", sortorder="DESC")
            if time_from:
                params["time_from"] = time_from
            if userid:
                params["userids"] = [userid]
            entries = self.zapi.auditlog.get(**params)
            return [
                {
                    "auditid": e.get("auditid", ""),
                    "userid": e.get("userid", ""),
                    "username": e.get("username", ""),
                    "clock": int(e.get("clock", 0)),
                    "action": AUDIT_ACTIONS.get(int(e.get("action", 0)), str(e.get("action", ""))),
                    "resourcetype": AUDIT_RESOURCES.get(
                        int(e.get("resourcetype", 0)), str(e.get("resourcetype", ""))
                    ),
                    "resourceid": e.get("resourceid", ""),
                    "resourcename": e.get("resourcename", ""),
                    "ip": e.get("ip", ""),
                    "details": e.get("details", ""),
                }
                for e in entries
            ]
        except Exception as e:
            logger.exception("get_audit_log failed")
            raise RuntimeError(str(e)) from e

    # ── Action Log ────────────────────────────────────────────────────

    def get_action_log(self, limit: int = 200, time_from: int | None = None) -> list[dict]:
        if not self.zapi:
            return []
        try:
            params: dict = dict(output="extend", limit=limit, sortfield="clock", sortorder="DESC")
            if time_from:
                params["time_from"] = time_from
            alerts = self.zapi.alert.get(**params)
            return [
                {
                    "alertid": a.get("alertid", ""),
                    "actionid": a.get("actionid", ""),
                    "eventid": a.get("eventid", ""),
                    "clock": int(a.get("clock", 0)),
                    "message": a.get("message", ""),
                    "subject": a.get("subject", ""),
                    "sendto": a.get("sendto", ""),
                    "status": int(a.get("status", 0)),
                    "retries": int(a.get("retries", 0)),
                    "error": a.get("error", ""),
                    "mediatypeid": a.get("mediatypeid", ""),
                    "userid": a.get("userid", ""),
                }
                for a in alerts
            ]
        except Exception as e:
            logger.exception("get_action_log failed")
            raise RuntimeError(str(e)) from e

    # ── Notifications (Zabbix delivery history) ───────────────────────

    def get_notification_history(self, hours: int = 24, limit: int = 500) -> list[dict]:
        """Return recent Zabbix notification deliveries (alerts sent to users by Zabbix actions)."""
        if not self.zapi:
            return []
        import time as _time

        try:
            since = int(_time.time()) - hours * 3600
            # alerttype filter param was removed in Zabbix 7.x — filter by value in Python instead
            kwargs: dict = dict(
                output=[
                    "alertid",
                    "userid",
                    "mediatypeid",
                    "clock",
                    "sendto",
                    "subject",
                    "status",
                    "error",
                ],
                time_from=since,
                sortfield="clock",
                sortorder="DESC",
                limit=limit,
            )
            if self._zabbix_version < (7, 0):
                kwargs["alerttype"] = 0
            alerts = self.zapi.alert.get(**kwargs)
            # Keep only notification-type alerts on Zabbix 7+ (alerttype=0 means notification)
            if self._zabbix_version >= (7, 0):
                alerts = [a for a in alerts if str(a.get("alerttype", "0")) == "0"]
            # Batch-fetch usernames and media type names
            user_ids = list({a["userid"] for a in alerts if a.get("userid")})
            mtype_ids = list({a["mediatypeid"] for a in alerts if a.get("mediatypeid")})
            user_map: dict = {}
            mtype_map: dict = {}
            if user_ids:
                try:
                    users = self.zapi.user.get(userids=user_ids, output=["userid", "username"])
                    user_map = {u["userid"]: u["username"] for u in users}
                except Exception as exc:
                    logger.debug("Failed to enrich notification user names: %s", exc)
            if mtype_ids:
                try:
                    mtypes = self.zapi.mediatype.get(
                        mediatypeids=mtype_ids, output=["mediatypeid", "name"]
                    )
                    mtype_map = {m["mediatypeid"]: m["name"] for m in mtypes}
                except Exception as exc:
                    logger.debug("Failed to enrich notification media type names: %s", exc)
            STATUS_LABELS = {0: "Not sent", 1: "Sent", 2: "Failed"}
            return [
                {
                    "alertid": a["alertid"],
                    "clock": int(a["clock"]),
                    "sendto": a.get("sendto", ""),
                    "subject": a.get("subject", ""),
                    "status": int(a.get("status", 0)),
                    "status_label": STATUS_LABELS.get(int(a.get("status", 0)), "Unknown"),
                    "error": a.get("error", ""),
                    "username": user_map.get(a.get("userid", ""), a.get("userid", "")),
                    "media_type": mtype_map.get(a.get("mediatypeid", ""), ""),
                }
                for a in alerts
            ]
        except Exception as e:
            logger.exception("get_notification_history failed")
            raise RuntimeError(str(e)) from e

    # ── Availability ───────────────────────────────────────────────────

    def get_availability(self, hours: int = 24, groupid: str | None = None) -> list[dict]:
        """Per-host availability based on problems in the time window."""
        if not self.zapi:
            return []
        try:
            since = int(time.time()) - hours * 3600
            params: dict = dict(
                output=["eventid", "objectid", "clock", "r_clock", "severity", "name"],
                time_from=since,
                limit=2000,
            )
            if groupid:
                params["groupids"] = [groupid]
            problems = self.zapi.problem.get(**params)

            if not problems:
                return []

            # problem.get no longer supports selectHosts in Zabbix 7.x;
            # resolve hosts via trigger.get (objectid = triggerid for trigger problems)
            triggerids = list({p["objectid"] for p in problems})
            triggers = self.zapi.trigger.get(
                output=["triggerid"],
                selectHosts=["hostid", "host"],
                triggerids=triggerids,
            )
            trig_to_hosts = {t["triggerid"]: t.get("hosts", []) for t in triggers}

            # Aggregate downtime per host
            window = hours * 3600
            now = int(time.time())
            host_down: dict[str, dict] = {}
            for p in problems:
                for h in trig_to_hosts.get(p["objectid"], []):
                    hid = h["hostid"]
                    if hid not in host_down:
                        host_down[hid] = {
                            "hostid": hid,
                            "hostname": h["host"],
                            "downtime_seconds": 0,
                            "problem_count": 0,
                        }
                    host_down[hid]["problem_count"] += 1
                    start = int(p["clock"])
                    end = int(p["r_clock"]) if p.get("r_clock") and int(p["r_clock"]) > 0 else now
                    host_down[hid]["downtime_seconds"] += max(0, end - max(start, since))

            results = [
                {
                    **v,
                    "availability_pct": round(
                        100.0 * max(0, window - v["downtime_seconds"]) / window, 2
                    ),
                }
                for v in host_down.values()
            ]
            return sorted(results, key=lambda x: x["availability_pct"])
        except Exception as e:
            logger.exception("get_availability failed")
            raise RuntimeError(str(e)) from e
