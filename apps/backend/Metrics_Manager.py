import logging
import time

from Zabbix_Base import Zabbix_Base

logger = logging.getLogger(__name__)

SEVERITY_NAMES = {
    "0": "Not classified",
    "1": "Information",
    "2": "Warning",
    "3": "Average",
    "4": "High",
    "5": "Disaster",
}


class Metrics_Manager(Zabbix_Base):
    def __init__(self):
        super().__init__()
        logger.info("Metrics Manager ready.")

    def get_problems(self) -> list[dict]:
        """Return active problems enriched with host name and age (30 s TTL cache)."""
        return self._cached("problems", 30.0, self._fetch_problems)

    def _host_group_map(self) -> dict[str, list[str]]:
        """hostid -> list of host group names (5 min cache)."""
        return self._cached("problem_host_groups", 300.0, self._fetch_host_group_map)

    def _fetch_host_group_map(self) -> dict[str, list[str]]:
        if not self.zapi:
            return {}
        try:
            # Zabbix 6.2+ renamed selectGroups → selectHostGroups on host.get.
            groups_field = "selectHostGroups" if self._zabbix_version >= (6, 2) else "selectGroups"
            groups_key = "hostgroups" if self._zabbix_version >= (6, 2) else "groups"
            hosts = self.zapi.host.get(output=["hostid"], **{groups_field: ["name"]})
            result: dict[str, list[str]] = {}
            for h in hosts:
                groups_list = h.get(groups_key) or h.get("groups") or []
                result[h["hostid"]] = [g["name"] for g in groups_list]
            return result
        except Exception:
            logger.exception("_fetch_host_group_map failed")
            return {}

    def _fetch_problems(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            # problem.get only accepts "eventid" as sortfield — severity/clock are
            # not valid here (they are valid for event.get). Sort by severity
            # client-side after enrichment so the UI still sees highest first.
            problems = self.zapi.problem.get(
                output=[
                    "eventid",
                    "objectid",
                    "severity",
                    "name",
                    "clock",
                    "acknowledged",
                ],
                recent=True,
                sortfield="eventid",
                sortorder="DESC",
            )
            if not problems:
                return []

            trigger_ids = [p["objectid"] for p in problems]
            triggers = self.zapi.trigger.get(
                triggerids=trigger_ids,
                output=["triggerid"],
                selectHosts=["host", "hostid"],
            )
            trigger_map = {t["triggerid"]: t for t in triggers}
            group_map = self._host_group_map()

            now = int(time.time())
            result = []
            for p in problems:
                trigger = trigger_map.get(p["objectid"], {})
                hosts = trigger.get("hosts", [])
                hostname = hosts[0]["host"] if hosts else "Unknown"
                groups = group_map.get(hosts[0]["hostid"], []) if hosts else []
                result.append(
                    {
                        "eventid": p["eventid"],
                        "hostname": hostname,
                        "groups": groups,
                        "severity": int(p["severity"]),
                        "severity_name": SEVERITY_NAMES.get(p["severity"], "Unknown"),
                        "name": p["name"],
                        "clock": int(p["clock"]),
                        "age_seconds": now - int(p["clock"]),
                        "acknowledged": p["acknowledged"] == "1",
                    }
                )
            # Sort highest severity first, then most recent within same severity
            result.sort(key=lambda x: (-x["severity"], -x["clock"]))
            return result
        except Exception:
            logger.exception("get_problems failed")
            return []

    def acknowledge_problem(self, eventid: str, username: str = "portal", note: str = "") -> bool:
        """Acknowledge a Zabbix problem event. Returns True on success."""
        if not self.zapi:
            return False
        try:
            parts = [f"Acknowledged by {username} via Zabbix Portal"]
            if note:
                parts.append(note)
            # action bitmask: 2 = acknowledge, 4 = add message  →  6 = both
            self.zapi.event.acknowledge(
                eventids=[eventid],
                action=6,
                message=" — ".join(parts),
            )
            self._invalidate("problems")
            return True
        except Exception:
            logger.exception("acknowledge_problem failed for eventid=%s", eventid)
            return False

    def add_problem_note(self, eventid: str, username: str, note: str) -> bool:
        """Post a comment on a Zabbix problem event without acknowledging it."""
        if not self.zapi:
            return False
        try:
            # action bitmask 4 = add message only — leaves the acknowledged
            # flag untouched, unlike acknowledge_problem's bitmask 6.
            self.zapi.event.acknowledge(
                eventids=[eventid],
                action=4,
                message=f"{username}: {note}",
            )
            return True
        except Exception:
            logger.exception("add_problem_note failed for eventid=%s", eventid)
            return False

    def _resolve_recovery_clocks(self, events: list[dict]) -> dict[str, int]:
        """Map r_eventid -> resolution clock, batched for the given problem events.

        r_eventid points to the recovery event; its clock is the resolution timestamp.
        """
        recovery_ids = [e["r_eventid"] for e in events if e.get("r_eventid", "0") != "0"]
        if not recovery_ids:
            return {}
        rec_events = self.zapi.event.get(
            eventids=recovery_ids,
            output=["eventid", "clock"],
        )
        return {r["eventid"]: int(r["clock"]) for r in rec_events}

    def _resolve_ack_usernames(self, events: list[dict]) -> dict[str, str]:
        """Batch-resolve Zabbix userids -> usernames for all acknowledge entries."""
        all_userids = {
            ack.get("userid", "")
            for e in events
            for ack in (e.get("acknowledges") or [])
            if ack.get("userid")
        }
        if not all_userids:
            return {}
        try:
            zabbix_users = self.zapi.user.get(
                userids=list(all_userids),
                output=["userid", "username"],
            )
            return {u["userid"]: u["username"] for u in zabbix_users}
        except Exception as exc:
            logger.debug("Failed to enrich ack user list: %s", exc)
            return {}

    @staticmethod
    def _passes_history_filters(
        hostname: str, event: dict, hostname_filter: set[str] | None, severity_min: int
    ) -> bool:
        if hostname_filter is not None and hostname not in hostname_filter:
            return False
        return not (severity_min > 0 and int(event.get("severity", 0)) < severity_min)

    @staticmethod
    def _build_history_entry(
        event: dict,
        hostname: str,
        recovery_clock: dict[str, int],
        userid_to_username: dict[str, str],
        now: int,
    ) -> dict:
        clock = int(event["clock"])
        r_eventid = event.get("r_eventid", "0")
        r_clock = recovery_clock.get(r_eventid, 0) if r_eventid != "0" else 0
        resolved = r_clock > 0
        duration = (r_clock - clock) if resolved else (now - clock)

        acks = event.get("acknowledges") or []
        raw_userid = acks[-1].get("userid", "") if acks else ""
        ack_user = userid_to_username.get(raw_userid, raw_userid) if acks else None
        ack_note = acks[-1].get("message", "") if acks else ""
        ack_time = int(acks[-1].get("clock", 0)) if acks else None

        return {
            "eventid": event["eventid"],
            "name": event.get("name", ""),
            "hostname": hostname,
            "severity": int(event.get("severity", 0)),
            "severity_name": SEVERITY_NAMES.get(str(event.get("severity", "0")), "Unknown"),
            "clock": clock,
            "r_clock": r_clock,
            "resolved": resolved,
            "duration_seconds": duration,
            "acknowledged": event.get("acknowledged") == "1",
            "ack_user": ack_user,
            "ack_note": ack_note,
            "ack_time": ack_time,
        }

    def get_problem_history(
        self,
        hours: int = 24,
        hostname_filter: set[str] | None = None,
        severity_min: int = 0,
        limit: int = 500,
    ) -> list[dict]:
        """Return historical problems (active + resolved) for the given time window.

        Uses event.get (value=1 = PROBLEM events) instead of problem.get because
        problem.get with time_from/time_till only returns currently active problems
        filtered by start time — resolved problems are absent. event.get queries
        the events table directly and returns all problem events including resolved.
        hostname_filter=None means no restriction (root/auditor).
        """
        if not self.zapi:
            return []
        try:
            time_till = int(time.time())
            time_from = time_till - hours * 3600
            logger.debug(
                "get_problem_history: hours=%d time_from=%d time_till=%d",
                hours,
                time_from,
                time_till,
            )

            events = self.zapi.event.get(
                output=[
                    "eventid",
                    "objectid",
                    "severity",
                    "name",
                    "clock",
                    "r_eventid",
                    "acknowledged",
                ],
                source=0,  # trigger-generated
                object=0,  # trigger objects
                value=1,  # PROBLEM events only (not recovery)
                time_from=time_from,
                time_till=time_till,
                sortfield="clock",
                sortorder="DESC",
                limit=limit,
                selectAcknowledges="extend",  # "username" is not a valid ack field; use extend
            )
            logger.info(
                "get_problem_history: event.get returned %d events",
                len(events) if events else 0,
            )
            if not events:
                return []

            recovery_clock = self._resolve_recovery_clocks(events)

            trigger_ids = list({e["objectid"] for e in events})
            triggers = self.zapi.trigger.get(
                triggerids=trigger_ids,
                output=["triggerid"],
                selectHosts=["host"],
            )
            trigger_map = {t["triggerid"]: t for t in triggers}

            userid_to_username = self._resolve_ack_usernames(events)

            now = int(time.time())
            result = []
            for e in events:
                trigger = trigger_map.get(e["objectid"], {})
                hosts = trigger.get("hosts", [])
                if not hosts:
                    continue
                hostname = hosts[0]["host"]
                if not self._passes_history_filters(hostname, e, hostname_filter, severity_min):
                    continue
                result.append(
                    self._build_history_entry(e, hostname, recovery_clock, userid_to_username, now)
                )
            return result
        except Exception:
            logger.exception("get_problem_history failed")
            return []

    def get_item_history(self, itemid: str, minutes: int = 360) -> dict:
        """Return time-series history for a single numeric item."""
        if not self.zapi:
            return {"history": [], "item_name": "", "units": ""}
        try:
            items = self.zapi.item.get(
                itemids=[itemid],
                output=["itemid", "name", "value_type", "units"],
                selectHosts=["host"],
            )
            if not items:
                return {"history": [], "item_name": "", "units": "", "hostname": ""}

            item = items[0]
            value_type = int(item["value_type"])
            hostname = (item.get("hosts") or [{}])[0].get("host", "")

            # Only float (0) and integer (3) can be graphed meaningfully
            if value_type not in (0, 3):
                return {
                    "history": [],
                    "item_name": item["name"],
                    "units": item.get("units", ""),
                    "hostname": hostname,
                }

            time_till = int(time.time())
            time_from = time_till - minutes * 60

            if minutes > 1440:
                # Periods longer than 24 h: use hourly trend aggregates.
                # history.get would cap at a few thousand raw points and miss most
                # of the range; trend.get returns one avg point per hour — always
                # accurate and fast.
                trends = self.zapi.trend.get(
                    itemids=[itemid],
                    time_from=time_from,
                    time_till=time_till,
                    output=["clock", "value_avg"],
                    sortfield="clock",
                    sortorder="ASC",
                )
                points = [
                    {"clock": int(t["clock"]), "value": float(t["value_avg"])} for t in trends
                ]
            else:
                # Periods ≤ 24 h: raw history.  Fetch DESC (most-recent first) so
                # the limit always discards the oldest points, never the newest.
                # Reverse the list before returning so the frontend gets ASC order.
                history = self.zapi.history.get(
                    itemids=[itemid],
                    history=value_type,
                    time_from=time_from,
                    time_till=time_till,
                    output=["clock", "value"],
                    sortfield="clock",
                    sortorder="DESC",
                    limit=5000,
                )
                points = [
                    {"clock": int(h["clock"]), "value": float(h["value"])}
                    for h in reversed(history)
                ]
            return {
                "history": points,
                "item_name": item["name"],
                "units": item.get("units", ""),
                "hostname": hostname,
            }
        except Exception:
            logger.exception("get_item_history failed")
            return {"history": [], "item_name": "", "units": "", "hostname": ""}
