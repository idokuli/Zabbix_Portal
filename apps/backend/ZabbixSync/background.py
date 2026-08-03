"""Background sync mechanisms: real-time pg_notify listener and the periodic safety-net thread."""

import logging
import threading
from typing import TYPE_CHECKING
from collections.abc import Callable

from ZabbixSync.constants import SYNC_INTERVAL

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class SyncBackgroundMixin:
    """Mixed into ZabbixSync. Calls self.full_sync() (SyncPullMixin) — resolved via MRO."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"
        full_sync: Callable[[], None]

    def _handle_pg_notification(self, conn) -> None:
        conn.poll()
        if not conn.notifies:
            return
        conn.notifies.clear()
        try:
            self.full_sync()
        except Exception:
            logger.exception("ZabbixSync realtime sync error")

    def _run_realtime_listener(self) -> None:
        import select as sel
        import psycopg2
        import psycopg2.extensions
        from Database import _DATABASE_URL

        conn = None
        try:
            conn = psycopg2.connect(_DATABASE_URL)
            conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
            with conn.cursor() as cur:
                cur.execute("LISTEN zabbix_changes;")
            logger.info("ZabbixSync: real-time listener active — syncing on Zabbix DB changes.")
            while True:
                if sel.select([conn], [], [], 5.0)[0]:
                    self._handle_pg_notification(conn)
        except Exception:
            logger.exception("ZabbixSync real-time listener crashed")
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception as exc:
                    logger.debug("Failed to close pg notify connection: %s", exc)

    def start_realtime_sync(self) -> threading.Thread:
        """Listen for pg_notify events from Zabbix tables and sync immediately on change.

        Requires notify triggers to be installed via install_notify_triggers() in Database.py.
        Falls back gracefully if the connection drops — errors are logged but do not crash.
        """
        t = threading.Thread(
            target=self._run_realtime_listener, daemon=True, name="zabbix-notify-listener"
        )
        t.start()
        return t

    def start_background_sync(self) -> threading.Thread | None:
        """Start a daemon thread that runs full_sync every ZABBIX_SYNC_INTERVAL seconds.

        Kept as a safety net alongside start_realtime_sync() to catch any notifications
        that might be missed (e.g. listener restart, network blip).
        """
        if not self.zapi:
            return None

        def _loop():
            while True:
                threading.Event().wait(SYNC_INTERVAL)
                try:
                    self.full_sync()
                except Exception:
                    logger.exception("ZabbixSync background loop error")

        t = threading.Thread(target=_loop, daemon=True, name="zabbix-sync")
        t.start()
        logger.info("ZabbixSync: background full-sync started (interval=%ds).", SYNC_INTERVAL)
        return t
