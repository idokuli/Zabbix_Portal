import logging
from Database import get_conn
from Zabbix_Base import Zabbix_Base

logger = logging.getLogger(__name__)


class Alert_Manager(Zabbix_Base):
    def __init__(self):
        super().__init__()
        logger.info("Alert Manager ready.")

    # ── Rule CRUD ─────────────────────────────────────────────────────────

    def get_rules(self, user_id: int) -> list[dict]:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, item_id, item_name, hostname, operator,
                              threshold, severity, enabled, is_firing, created_at
                       FROM alert_rules WHERE user_id = %s ORDER BY created_at DESC""",
                    (user_id,),
                )
                return [dict(r) for r in cur.fetchall()]
        except Exception as exc:
            logger.error("get_rules failed: %r", exc)
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
        threshold: float,
        severity: int,
    ) -> dict:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO alert_rules
                           (user_id, item_id, item_name, hostname, operator, threshold, severity)
                       VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                    (
                        user_id,
                        item_id,
                        item_name,
                        hostname,
                        operator,
                        threshold,
                        severity,
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
        operator: str,
        threshold: float,
        severity: int,
        item_id: str | None = None,
        item_name: str | None = None,
        hostname: str | None = None,
    ) -> bool:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                if item_id and item_name and hostname:
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
                           SET operator = %s, threshold = %s, severity = %s
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
        except Exception as exc:
            logger.error("get_events failed: %r", exc)
            return []
        finally:
            conn.close()

    # ── Background checker ────────────────────────────────────────────────

    def run_checks(self) -> None:
        """Evaluate all enabled rules; insert alert_events on ok→firing transitions.

        At most one new firing is allowed per item per cycle, ordered by severity
        ascending (mildest first).  This prevents a fast-rising metric from
        triggering every threshold simultaneously — each threshold fires in a
        separate cycle, giving operators time to react before the next escalation.
        """
        if not self.zapi:
            return

        conn = get_conn()
        try:
            # Phase 1: read rules — sort by severity ASC so mildest fires first
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, user_id, item_id, item_name, hostname,
                              operator, threshold, severity, is_firing
                       FROM alert_rules WHERE enabled = TRUE
                       ORDER BY severity ASC, threshold ASC"""
                )
                rules = [dict(r) for r in cur.fetchall()]

            if not rules:
                return

            # Phase 2: fetch latest values from Zabbix
            item_ids = list({r["item_id"] for r in rules})
            try:
                items = self.zapi.item.get(
                    itemids=item_ids,
                    output=["itemid", "lastvalue", "value_type"],
                )
                value_map = {i["itemid"]: i for i in items}
            except Exception as exc:
                logger.error("Alert checker: failed to fetch items: %r", exc)
                return

            # Phase 3: evaluate and write updates.
            # Track which item_ids have already fired a new event this cycle so
            # that only one threshold escalates per item per check interval.
            fired_this_cycle: set[str] = set()

            for rule in rules:
                item = value_map.get(rule["item_id"])
                if not item or not item.get("lastvalue"):
                    continue
                if int(item.get("value_type", 1)) not in (0, 3):
                    continue
                try:
                    val = float(item["lastvalue"])
                except (ValueError, TypeError):
                    continue

                op = rule["operator"]
                firing = (
                    (op == ">" and val > rule["threshold"])
                    or (op == "<" and val < rule["threshold"])
                    or (op == ">=" and val >= rule["threshold"])
                    or (op == "<=" and val <= rule["threshold"])
                )

                with conn.cursor() as cur:
                    if firing and not rule["is_firing"]:
                        if rule["item_id"] in fired_this_cycle:
                            # Another rule for this item already fired this cycle;
                            # leave is_firing=False so this rule fires next cycle.
                            continue
                        fired_this_cycle.add(rule["item_id"])
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
                                rule["threshold"],
                                val,
                                rule["severity"],
                            ),
                        )
                        cur.execute(
                            "UPDATE alert_rules SET is_firing = TRUE WHERE id = %s",
                            (rule["id"],),
                        )
                    elif not firing and rule["is_firing"]:
                        cur.execute(
                            "UPDATE alert_rules SET is_firing = FALSE WHERE id = %s",
                            (rule["id"],),
                        )
            conn.commit()
        except Exception as exc:
            conn.rollback()
            logger.error("Alert checker: DB error: %r", exc)
        finally:
            conn.close()
