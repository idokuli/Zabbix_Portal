"""Portal-side write-action audit log — records who did what, keyed to the real
logged-in portal user. Exists because every write to Zabbix goes through one shared
ZABBIX_USER service account (see Zabbix_Base.py), so Zabbix's own auditlog.get can
never attribute an action to the actual portal user. This table is populated by the
request-logging middleware in Zabbix_Main.py for every mutating request, so no
individual route needs to call record_action() itself."""

import logging

from Database import get_conn

logger = logging.getLogger(__name__)


def record_action(
    user_id: int | None,
    username: str,
    method: str,
    path: str,
    action: str,
    status_code: int,
    ip: str,
) -> None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO portal_audit_log
                       (user_id, username, method, path, action, status_code, ip)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (user_id, username, method, path, action, status_code, ip),
            )
        conn.commit()
    except Exception as exc:
        conn.rollback()
        logger.debug("record_action failed: %s", exc)
    finally:
        conn.close()


def list_actions(limit: int = 200, hours: int = 24) -> list[dict]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, user_id, username, method, path, action, status_code, ip,
                          EXTRACT(EPOCH FROM created_at)::BIGINT AS clock
                   FROM portal_audit_log
                   WHERE created_at > NOW() - (%s || ' hours')::INTERVAL
                   ORDER BY created_at DESC
                   LIMIT %s""",
                (hours, limit),
            )
            return [dict(r) for r in cur.fetchall()]
    except Exception:
        logger.exception("list_actions failed")
        return []
    finally:
        conn.close()
