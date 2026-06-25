"""Background sync mechanisms: real-time pg_notify listener and the periodic safety-net thread."""

import logging
import threading
from typing import TYPE_CHECKING, Callable

from ZabbixSync.constants import SYNC_INTERVAL

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class SyncBackgroundMixin:
    """Mixed into ZabbixSync. Calls self.full_sync() (SyncPullMixin) — resolved via MRO."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"
        full_sync: Callable[[], None]

    def start_realtime_sync(self) -> None:
        """Listen for pg_notify events from Zabbix tables and sync immediately on change.

        Requires notify triggers to be installed via install_notify_triggers() in Database.py.
        Falls back gracefully if the connection drops — errors are logged but do not crash.
        """
        import select as sel
        import psycopg2
        import psycopg2.extensions
        from Database import _DATABASE_URL

        def _listen():
            conn = None
            try:
                conn = psycopg2.connect(_DATABASE_URL)
                conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
                with conn.cursor() as cur:
                    cur.execute("LISTEN zabbix_changes;")
                logger.info(
                    "ZabbixSync: real-time listener active — syncing on Zabbix DB changes."
                )
                while True:
                    if sel.select([conn], [], [], 5.0)[0]:
                        conn.poll()
                        if conn.notifies:
                            conn.notifies.clear()
                            try:
                                self.full_sync()
                            except Exception as exc:
                                logger.error("ZabbixSync realtime sync error: %r", exc)
            except Exception as exc:
                logger.error("ZabbixSync real-time listener crashed: %r", exc)
            finally:
                if conn is not None:
                    try:
                        conn.close()
                    except Exception:
                        pass

        t = threading.Thread(target=_listen, daemon=True, name="zabbix-notify-listener")
        t.start()

    def start_background_sync(self) -> None:
        """Start a daemon thread that runs full_sync every ZABBIX_SYNC_INTERVAL seconds.

        Kept as a safety net alongside start_realtime_sync() to catch any notifications
        that might be missed (e.g. listener restart, network blip).
        """
        if not self.zapi:
            return

        def _loop():
            while True:
                threading.Event().wait(SYNC_INTERVAL)
                try:
                    self.full_sync()
                except Exception as exc:
                    logger.error("ZabbixSync background loop error: %r", exc)

        t = threading.Thread(target=_loop, daemon=True, name="zabbix-sync")
        t.start()
        logger.info(
            "ZabbixSync: background full-sync started (interval=%ds).", SYNC_INTERVAL
        )
