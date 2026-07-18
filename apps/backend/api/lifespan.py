"""App lifespan, background threads, and SSE state."""

import asyncio
import fcntl
import logging
import os
import tempfile
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

import User_Management as um
from Database import init_db, install_notify_triggers
from fastapi import FastAPI

from api.managers import (
    actions_bot,
    alert_bot,
    dashboard_bot,
    dc_bot,
    host_bot,
    item_bot,
    metrics_bot,
    report_bot,
    services_bot,
    sync_bot,
    zadmin_bot,
)

logger = logging.getLogger(__name__)

# ── SSE: real-time push to connected frontend clients ─────────────────
_sync_subscribers: set[asyncio.Queue[str]] = set()
_sync_lock = threading.Lock()
_event_loop: asyncio.AbstractEventLoop | None = None

# How often the background checker evaluates alert rules against the latest
# Zabbix values. Lower = alerts fire sooner after a threshold is breached, at
# the cost of more frequent Zabbix API + DB calls. The true floor on latency is
# the monitored item's own collection interval — the checker can't see a value
# Zabbix hasn't polled yet. Override with ALERT_CHECK_INTERVAL (seconds).
_ALERT_CHECK_INTERVAL = max(5, int(os.getenv("ALERT_CHECK_INTERVAL", "15")))


# Each entry: [name, thread, restart_fn] — mutable so watchdog can update the ref.
_managed_threads: list[list] = []


def _alert_loop() -> None:
    while True:
        try:
            alert_bot.run_checks()
        except Exception:
            logger.exception("Alert checker error")
        time.sleep(_ALERT_CHECK_INTERVAL)


def _start_alert_thread() -> threading.Thread:
    t = threading.Thread(target=_alert_loop, daemon=True, name="alert-checker")
    t.start()
    return t


def _watchdog_loop() -> None:
    while True:
        time.sleep(30)
        for entry in _managed_threads:
            name, thread, restart_fn = entry
            if not thread.is_alive():
                logger.error("Background thread %r died — restarting.", name)
                try:
                    new_thread = restart_fn()
                    if new_thread is not None:
                        entry[1] = new_thread
                except Exception:
                    logger.exception("Failed to restart thread %r", name)


def notify_sync_clients() -> None:
    """Thread-safe: push a sync event to all SSE clients."""
    if not _event_loop:
        return
    with _sync_lock:
        queues = list(_sync_subscribers)
    for q in queues:
        _event_loop.call_soon_threadsafe(q.put_nowait, "sync")


def _sync_tags() -> None:
    try:
        for team in um.get_overview():
            team_name = team["name"]
            for hostname in team["hosts"]:
                host_bot.tag_host(hostname, team_name)
    except Exception as exc:
        logger.warning("Tag sync failed (non-fatal): %r", exc)


_BG_LOCK_PATH = str(Path(tempfile.gettempdir()) / "overwatch_bg.lock")
_bg_lock_fd: int | None = None


def _acquire_bg_lock() -> bool:
    """Try to exclusively lock a file. Returns True for the one worker that wins.
    Uses a non-blocking flock so other workers skip background threads instead of hanging."""
    global _bg_lock_fd
    try:
        fd = os.open(_BG_LOCK_PATH, os.O_CREAT | os.O_WRONLY, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        _bg_lock_fd = fd  # keep open for the lifetime of this process
        return True
    except OSError:
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _event_loop
    # Database — must come first (all workers run schema init; it is idempotent)
    init_db()
    install_notify_triggers()
    um.seed_root()
    # Zabbix user/team bootstrap
    sync_bot.pull_users()
    sync_bot.bootstrap_teams()
    # SSE event-loop reference
    _event_loop = asyncio.get_running_loop()
    # Background threads run in exactly one worker (whichever acquires the lock first).
    # Other workers handle HTTP requests only.
    if _acquire_bg_lock():
        alert_t = _start_alert_thread()
        logger.info("Alert checker started (%s s interval) [bg worker].", _ALERT_CHECK_INTERVAL)
        sync_bot._on_sync = notify_sync_clients
        notify_t = sync_bot.start_realtime_sync()
        bg_t = sync_bot.start_background_sync()
        _managed_threads.extend(
            [
                ["alert-checker", alert_t, _start_alert_thread],
                ["zabbix-notify-listener", notify_t, sync_bot.start_realtime_sync],
            ]
        )
        if bg_t is not None:
            _managed_threads.append(["zabbix-sync", bg_t, sync_bot.start_background_sync])
        threading.Thread(target=_watchdog_loop, daemon=True, name="thread-watchdog").start()
        logger.info("Thread watchdog started.")
    else:
        logger.info("Background threads already running in another worker — skipping.")
    # Backfill host tags for assignments made before tagging was introduced
    _sync_tags()

    yield

    # Shutdown: close all Zabbix sessions
    for bot in (
        host_bot,
        item_bot,
        metrics_bot,
        dashboard_bot,
        alert_bot,
        sync_bot,
        dc_bot,
        report_bot,
        actions_bot,
        zadmin_bot,
        services_bot,
    ):
        bot.close()


# Public aliases for SSE route handlers
sync_lock = _sync_lock
sync_subscribers = _sync_subscribers
