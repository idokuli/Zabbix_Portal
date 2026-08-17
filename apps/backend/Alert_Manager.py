import logging
import time
from Database import get_conn
from Zabbix_Base import ZabbixBase

logger = logging.getLogger(__name__)


class AlertManager(ZabbixBase):
    def __init__(self):
        super().__init__()
        logger.info("Alert Manager ready.")

    # ── Rule CRUD ─────────────────────────────────────────────────────────

    def get_rules(self, user_id: int) -> list[dict]:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, rule_type, item_id, item_name, hostname, operator,
                              threshold, severity, enabled, is_firing, created_at,
                              expected_contains
                       FROM alert_rules WHERE user_id = %s ORDER BY created_at DESC""",
                    (user_id,),
                )
                return [dict(r) for r in cur.fetchall()]
        except Exception:
            logger.exception("get_rules failed")
            return []
        finally:
            conn.close()

    def create_rule(
        self,
        user_id: int,
        item_id: str,
        item_name: str,
        hostname: str,
        operator: str,
        threshold: float | None,
        severity: int,
        rule_type: str = "item",
        expected_contains: str = "ok",
    ) -> dict:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO alert_rules
                           (user_id, item_id, item_name, hostname, operator, threshold,
                            severity, rule_type, expected_contains)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                    (
                        user_id,
                        item_id,
                        item_name,
                        hostname,
                        operator,
                        threshold,
                        severity,
                        rule_type,
                        expected_contains,
                    ),
                )
                row = cur.fetchone()
            conn.commit()
            return {"id": row["id"]}
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def delete_rule(self, rule_id: int, user_id: int) -> bool:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM alert_rules WHERE id = %s AND user_id = %s",
                    (rule_id, user_id),
                )
                deleted = cur.rowcount > 0
            conn.commit()
            return deleted
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def update_rule(
        self,
        rule_id: int,
        user_id: int,
        severity: int,
        operator: str | None = None,
        threshold: float | None = None,
        item_id: str | None = None,
        item_name: str | None = None,
        hostname: str | None = None,
        expected_contains: str | None = None,
    ) -> bool:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                # Fetch rule_type so we know which fields to update
                cur.execute(
                    "SELECT rule_type FROM alert_rules WHERE id = %s AND user_id = %s",
                    (rule_id, user_id),
                )
                row = cur.fetchone()
                if not row:
                    return False
                rule_type = row["rule_type"]

                if rule_type == "service":
                    cur.execute(
                        """UPDATE alert_rules
                           SET severity = %s, expected_contains = COALESCE(%s, expected_contains)
                           WHERE id = %s AND user_id = %s""",
                        (severity, expected_contains, rule_id, user_id),
                    )
                elif (
                    item_id
                    and item_name
                    and hostname
                    and operator is not None
                    and threshold is not None
                ):
                    cur.execute(
                        """UPDATE alert_rules
                           SET operator = %s, threshold = %s, severity = %s,
                               item_id = %s, item_name = %s, hostname = %s
                           WHERE id = %s AND user_id = %s""",
                        (
                            operator,
                            threshold,
                            severity,
                            item_id,
                            item_name,
                            hostname,
                            rule_id,
                            user_id,
                        ),
                    )
                else:
                    cur.execute(
                        """UPDATE alert_rules
                           SET operator = COALESCE(%s, operator),
                               threshold = COALESCE(%s, threshold),
                               severity = %s
                           WHERE id = %s AND user_id = %s""",
                        (operator, threshold, severity, rule_id, user_id),
                    )
                updated = cur.rowcount > 0
            conn.commit()
            return updated
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def toggle_rule(self, rule_id: int, user_id: int) -> bool | None:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """UPDATE alert_rules SET enabled = NOT enabled
                       WHERE id = %s AND user_id = %s RETURNING enabled""",
                    (rule_id, user_id),
                )
                row = cur.fetchone()
            conn.commit()
            return row["enabled"] if row else None
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def get_events(self, user_id: int, limit: int = 200) -> list[dict]:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT ae.id, ae.rule_id,
                              COALESCE(ae.item_id, ar.item_id) AS item_id,
                              ae.item_name, ae.hostname,
                              ae.operator, ae.threshold, ae.actual_value, ae.severity,
                              EXTRACT(EPOCH FROM ae.fired_at)::BIGINT AS fired_at
                       FROM alert_events ae
                       LEFT JOIN alert_rules ar ON ae.rule_id = ar.id
                       WHERE ae.user_id = %s
                       ORDER BY ae.fired_at DESC LIMIT %s""",
                    (user_id, limit),
                )
                return [dict(r) for r in cur.fetchall()]
        except Exception:
            logger.exception("get_events failed")
            return []
        finally:
            conn.close()

    # ── Background checker ────────────────────────────────────────────────

    @staticmethod
    def _insert_alert_event(conn, rule: dict, op: str, threshold: float, actual_val: float) -> None:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO alert_events
                       (rule_id, user_id, item_id, item_name, hostname,
                        operator, threshold, actual_value, severity)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    rule["id"],
                    rule["user_id"],
                    rule["item_id"],
                    rule["item_name"],
                    rule["hostname"],
                    op,
                    threshold,
                    actual_val,
                    rule["severity"],
                ),
            )

    @staticmethod
    def _set_rule_firing(conn, rule_id: int, is_firing: bool) -> None:
        sql = (
            "UPDATE alert_rules SET is_firing = TRUE WHERE id = %s"
            if is_firing
            else "UPDATE alert_rules SET is_firing = FALSE WHERE id = %s"
        )
        with conn.cursor() as cur:
            cur.execute(sql, (rule_id,))

    @staticmethod
    def _evaluate_item_rule(rule: dict, item: dict) -> tuple[str, bool, float] | None:
        """Return (operator, firing, actual_value) for one item rule, or None to
        skip it this cycle (non-numeric item with a numeric operator, or a value
        that doesn't parse as a number)."""
        op = rule["operator"]
        value_type = int(item.get("value_type", 1))
        lastvalue = str(item.get("lastvalue") or "")

        if op in ("contains", "!contains"):
            expected = (rule["expected_contains"] or "").lower()
            match = expected in lastvalue.lower()
            firing = match if op == "contains" else not match
            return op, firing, 0.0

        if value_type not in (0, 3):
            return None  # non-numeric item with a numeric operator — skip
        try:
            val = float(lastvalue)
        except (ValueError, TypeError):
            return None
        firing = (
            (op == ">" and val > rule["threshold"])
            or (op == "<" and val < rule["threshold"])
            or (op == ">=" and val >= rule["threshold"])
            or (op == "<=" and val <= rule["threshold"])
        )
        return op, firing, val

    def _process_item_rules(self, conn, item_rules: list[dict]) -> None:
        """Evaluate item-type rules against their latest Zabbix values, inserting
        an alert_event and flipping is_firing on ok→firing / firing→ok transitions.
        At most one new firing is allowed per item per cycle."""
        item_ids = list({r["item_id"] for r in item_rules})
        try:
            items = self.zapi.item.get(
                itemids=item_ids, output=["itemid", "lastvalue", "value_type"]
            )
            value_map = {i["itemid"]: i for i in items}
        except Exception:
            logger.exception("Alert checker: failed to fetch items")
            value_map = {}

        fired_this_cycle: set[str] = set()
        for rule in item_rules:
            item = value_map.get(rule["item_id"])
            if not item or item.get("lastvalue") is None:
                continue

            evaluated = self._evaluate_item_rule(rule, item)
            if evaluated is None:
                continue
            op, firing, actual_val = evaluated

            if firing and not rule["is_firing"]:
                if rule["item_id"] in fired_this_cycle:
                    continue
                fired_this_cycle.add(rule["item_id"])
                self._insert_alert_event(conn, rule, op, rule["threshold"], actual_val)
                self._set_rule_firing(conn, rule["id"], True)
            elif not firing and rule["is_firing"]:
                self._set_rule_firing(conn, rule["id"], False)

    def _process_service_rules(self, conn, service_rules: list[dict]) -> None:
        """Check health-monitor items for service rules: firing means the response
        body no longer contains the expected string (or the item hasn't reported
        fresh data in the last 10 minutes)."""
        svc_item_ids = list({r["item_id"] for r in service_rules})
        try:
            svc_items = self.zapi.item.get(
                itemids=svc_item_ids,
                output=["itemid", "lastvalue", "lastclock", "state"],
            )
            svc_map = {i["itemid"]: i for i in svc_items}
        except Exception:
            logger.exception("Alert checker: failed to fetch service items")
            svc_map = {}

        now = time.time()
        for rule in service_rules:
            svc = svc_map.get(rule["item_id"])
            if not svc:
                continue
            lastclock = int(svc.get("lastclock") or 0)
            lastvalue = svc.get("lastvalue") or ""
            state = int(svc.get("state", 1))
            # stale if not checked in the last 10 minutes
            fresh = state == 0 and lastclock > 0 and (now - lastclock) < 600
            working = fresh and rule["expected_contains"].lower() in lastvalue.lower()
            firing = not working

            if firing and not rule["is_firing"]:
                self._insert_alert_event(conn, rule, "!=", 0, 0)
                self._set_rule_firing(conn, rule["id"], True)
            elif not firing and rule["is_firing"]:
                self._set_rule_firing(conn, rule["id"], False)

    def run_checks(self) -> None:
        """Evaluate all enabled rules; insert alert_events on ok→firing transitions.

        Item rules: numeric threshold comparison on Zabbix item last value.
        Service rules: check whether the health-monitor response body contains the
        expected string — fires when the service stops working.
        """
        if not self.zapi:
            return

        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, user_id, rule_type, item_id, item_name, hostname,
                              operator, threshold, severity, is_firing, expected_contains
                       FROM alert_rules WHERE enabled = TRUE
                       ORDER BY severity ASC, threshold ASC"""
                )
                rules = [dict(r) for r in cur.fetchall()]

            if not rules:
                return

            item_rules = [r for r in rules if r["rule_type"] == "item"]
            service_rules = [r for r in rules if r["rule_type"] == "service"]

            if item_rules:
                self._process_item_rules(conn, item_rules)
            if service_rules:
                self._process_service_rules(conn, service_rules)

            conn.commit()
        except Exception:
            conn.rollback()
            logger.exception("Alert checker: DB error")
        finally:
            conn.close()
