import logging
import os
from pathlib import Path

import psycopg2
import psycopg2.pool
import psycopg2.sql
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=dotenv_path, override=False)

_DATABASE_URL = os.getenv("DATABASE_URL")
if not _DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable must be set before starting the server.")

_pool: psycopg2.pool.ThreadedConnectionPool | None = None


class _PooledConn:
    """Wraps a psycopg2 connection so close() returns it to the pool."""

    def __init__(
        self,
        conn: psycopg2.extensions.connection,
        pool: psycopg2.pool.ThreadedConnectionPool,
    ) -> None:
        self._conn = conn
        self._pool = pool

    def __getattr__(self, name: str):  # type: ignore[override]
        return getattr(self._conn, name)

    def close(self) -> None:
        try:
            if not self._conn.closed:
                self._conn.rollback()  # ensure clean state before returning
        except Exception as exc:
            logger.debug("Connection rollback on return to pool failed: %s", exc)
        self._pool.putconn(self._conn)


def _init_pool() -> None:
    global _pool
    # connect_timeout bounds the initial TCP handshake. Without it, an unreachable
    # DATABASE_URL host (wrong address, or a firewall silently dropping packets
    # instead of rejecting) hangs here indefinitely — and since this runs as the
    # first line of the FastAPI lifespan startup, uvicorn never opens its listening
    # socket until startup finishes, so OpenShift's liveness/readiness probes see
    # "connection refused" forever and keep restarting a container that never
    # actually crashed or logged anything. A bounded timeout turns that silent
    # hang into a clear, fast, loggable connection error instead.
    _pool = psycopg2.pool.ThreadedConnectionPool(
        2, 20, _DATABASE_URL, cursor_factory=RealDictCursor, connect_timeout=10
    )


def get_conn() -> _PooledConn:
    if _pool is None:
        raise RuntimeError("Database pool not initialised — call init_db() first")
    return _PooledConn(_pool.getconn(), _pool)


_SCHEMA = """
CREATE TABLE IF NOT EXISTS teams (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) UNIQUE NOT NULL,
    description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS team_users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(255) UNIQUE NOT NULL,
    email         VARCHAR(255) DEFAULT '',
    roles         TEXT[]       DEFAULT '{member}',
    team_id       INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    password_hash VARCHAR(255) DEFAULT ''
);

CREATE TABLE IF NOT EXISTS host_assignments (
    hostname VARCHAR(255) NOT NULL,
    team_id  INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(hostname, team_id)
);

CREATE TABLE IF NOT EXISTS dashboard_layouts (
    id         SERIAL PRIMARY KEY,
    owner_type VARCHAR(10) NOT NULL CHECK (owner_type IN ('user', 'team')),
    owner_id   INTEGER NOT NULL,
    layout     JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(owner_type, owner_id)
);

CREATE TABLE IF NOT EXISTS dashboard_pages (
    id         SERIAL PRIMARY KEY,
    owner_type VARCHAR(10) NOT NULL CHECK (owner_type IN ('user', 'team')),
    owner_id   INTEGER NOT NULL,
    kind       VARCHAR(20) NOT NULL CHECK (kind IN ('dashboard', 'metrics')),
    page_key   VARCHAR(50) NOT NULL,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_type, owner_id, kind, page_key)
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES team_users(id) ON DELETE CASCADE,
    item_id    VARCHAR(64) NOT NULL,
    item_name  TEXT NOT NULL,
    hostname   TEXT NOT NULL,
    operator   VARCHAR(4) NOT NULL CHECK (operator IN ('>', '<', '>=', '<=')),
    threshold  FLOAT NOT NULL,
    severity   INTEGER NOT NULL DEFAULT 2,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    is_firing  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_events (
    id           SERIAL PRIMARY KEY,
    rule_id      INTEGER REFERENCES alert_rules(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL,
    item_name    TEXT NOT NULL,
    hostname     TEXT NOT NULL,
    operator     VARCHAR(4) NOT NULL,
    threshold    FLOAT NOT NULL,
    actual_value FLOAT NOT NULL,
    severity     INTEGER NOT NULL,
    fired_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problem_acknowledgements (
    id              SERIAL PRIMARY KEY,
    eventid         TEXT        NOT NULL,
    problem_name    TEXT        NOT NULL DEFAULT '',
    hostname        TEXT        NOT NULL DEFAULT '',
    severity        INTEGER     NOT NULL DEFAULT 0,
    acknowledged_by TEXT        NOT NULL,
    note            TEXT        NOT NULL DEFAULT '',
    acked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problem_notes (
    id         SERIAL PRIMARY KEY,
    eventid    TEXT        NOT NULL,
    hostname   TEXT        NOT NULL DEFAULT '',
    username   TEXT        NOT NULL,
    note       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portal_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_team_memberships (
    user_id INTEGER NOT NULL REFERENCES team_users(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, team_id)
);

CREATE TABLE IF NOT EXISTS notification_history (
    id          TEXT    NOT NULL,
    user_id     INTEGER NOT NULL REFERENCES team_users(id) ON DELETE CASCADE,
    source      TEXT    NOT NULL DEFAULT 'zabbix',
    hostname    TEXT    NOT NULL DEFAULT '',
    severity    INTEGER NOT NULL DEFAULT 0,
    name        TEXT    NOT NULL DEFAULT '',
    clock       INTEGER NOT NULL DEFAULT 0,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id, user_id)
);
"""

_MIGRATIONS = """
ALTER TABLE team_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) DEFAULT '';

-- Allow a host to belong to more than one team (existing deployments).
ALTER TABLE host_assignments DROP CONSTRAINT IF EXISTS host_assignments_pkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'host_assignments_hostname_team_id_key'
  ) THEN
    ALTER TABLE host_assignments ADD CONSTRAINT host_assignments_hostname_team_id_key
      UNIQUE (hostname, team_id);
  END IF;
END $$;

ALTER TABLE dashboard_layouts ADD COLUMN IF NOT EXISTS page VARCHAR(50) NOT NULL DEFAULT 'dashboard';
ALTER TABLE dashboard_layouts DROP CONSTRAINT IF EXISTS dashboard_layouts_owner_type_owner_id_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_layouts_owner_page_key'
  ) THEN
    ALTER TABLE dashboard_layouts ADD CONSTRAINT dashboard_layouts_owner_page_key
      UNIQUE(owner_type, owner_id, page);
  END IF;
END $$;

DO $$
BEGIN
  -- Migrate single role column → roles array (existing deployments)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_users' AND column_name = 'roles'
  ) THEN
    ALTER TABLE team_users ADD COLUMN roles TEXT[] DEFAULT '{member}';
    UPDATE team_users SET roles = ARRAY[role] WHERE role IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_users' AND column_name = 'role'
  ) THEN
    ALTER TABLE team_users DROP COLUMN role;
  END IF;
END $$;

ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS item_id VARCHAR(64);

-- Track how each user was created: 'local' (manual), 'zabbix' (synced from Zabbix), 'ldap' (JIT from LDAP).
ALTER TABLE team_users ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'local';

-- Display name pulled from AD/LDAP (cn / displayName). Falls back to username in the UI.
ALTER TABLE team_users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255) DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id    ON alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled    ON alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_events_user_id   ON alert_events(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_fired_at  ON alert_events(fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_owner ON dashboard_layouts(owner_type, owner_id, page);
CREATE INDEX IF NOT EXISTS idx_dashboard_pages_owner ON dashboard_pages(owner_type, owner_id, kind);
CREATE INDEX IF NOT EXISTS idx_problem_acks_eventid  ON problem_acknowledgements(eventid);
CREATE INDEX IF NOT EXISTS idx_problem_acks_acked_at ON problem_acknowledgements(acked_at DESC);
CREATE INDEX IF NOT EXISTS idx_problem_notes_eventid ON problem_notes(eventid);
CREATE INDEX IF NOT EXISTS idx_team_users_team_id    ON team_users(team_id);
CREATE INDEX IF NOT EXISTS idx_host_assignments_team_id ON host_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_host_assignments_hostname ON host_assignments(hostname);

-- Multi-team membership: copy existing single-team assignments into the join table (idempotent).
INSERT INTO user_team_memberships (user_id, team_id)
SELECT id, team_id FROM team_users
WHERE team_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_user_team_memberships_user_id ON user_team_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_team_memberships_team_id ON user_team_memberships(team_id);

DELETE FROM alert_events WHERE fired_at < NOW() - INTERVAL '90 days';

CREATE INDEX IF NOT EXISTS idx_notification_history_user_clock ON notification_history(user_id, clock DESC);

DELETE FROM notification_history WHERE clock < EXTRACT(EPOCH FROM NOW() - INTERVAL '90 days');

-- Team-level roles: members inherit these on login (union with their personal roles).
ALTER TABLE teams ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}';

-- Service-status alert rules: 'item' (numeric threshold) or 'service' (health-monitor string check).
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS rule_type VARCHAR(16) NOT NULL DEFAULT 'item';
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS expected_contains TEXT NOT NULL DEFAULT 'ok';

-- Widen operator column and extend check constraint to support text-match operators.
ALTER TABLE alert_rules ALTER COLUMN operator TYPE VARCHAR(16);
ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS alert_rules_operator_check;
ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_operator_check
  CHECK (operator IN ('>', '<', '>=', '<=', 'contains', '!contains'));
"""


def init_db() -> None:
    _init_pool()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(_SCHEMA)
            cur.execute(_MIGRATIONS)
        conn.commit()
        logger.info("Database schema ready.")
    except Exception:
        conn.rollback()
        logger.exception("Database init failed")
        raise
    finally:
        conn.close()


def get_setting(key: str) -> str | None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM portal_settings WHERE key = %s", (key,))
            row = cur.fetchone()
            return row["value"] if row else None
    finally:
        conn.close()


def set_setting(key: str, value: str) -> None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO portal_settings (key, value, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                """,
                (key, value),
            )
        conn.commit()
    finally:
        conn.close()


# Zabbix tables to watch for real-time change notifications.
# Uses savepoints so missing tables (version differences) are silently skipped.
_WATCHED_ZABBIX_TABLES = ["users", "usrgrp", "users_groups", "hosts_groups", "hstgrp"]


def install_notify_triggers() -> None:
    """Install pg_notify triggers on Zabbix tables.

    Fires NOTIFY zabbix_changes whenever users, groups, or host-group
    memberships change in the Zabbix DB so the portal can sync immediately.
    """
    conn = get_conn()
    lock_held = False
    try:
        with conn.cursor() as cur:
            # Serialize across workers: only one installs at a time; others wait then skip
            # (triggers are idempotent once the first worker finishes).
            # Advisory lock key is a fixed arbitrary integer — scoped to this session.
            #
            # The wait must be bounded: a SIGKILLed backend leaves its server-side
            # session (and this lock) alive until TCP keepalive expiry, and an
            # unbounded pg_advisory_lock then wedges every future startup. With a
            # timeout the worst case is a logged warning and startup proceeds.
            cur.execute("SET lock_timeout = '30s'")
            # Make the server reap this session within ~1 min if we die holding
            # the lock, instead of the multi-hour TCP keepalive default.
            cur.execute("SET tcp_keepalives_idle = 30")
            cur.execute("SET tcp_keepalives_interval = 10")
            cur.execute("SET tcp_keepalives_count = 3")
            cur.execute("SELECT pg_advisory_lock(8472910234)")
            lock_held = True

            # This function definition gets its own savepoint, exactly like the per-table
            # loop below — without it, a transient failure here (e.g. a concurrent-DDL
            # conflict from another worker mid-timeout-wait) aborts the whole transaction,
            # and the unconditional pg_advisory_unlock/RESET calls that used to sit in a
            # `finally` right after this would then ALSO fail (you can't run anything on
            # an aborted transaction without rolling back first) — which both masked the
            # real error behind a generic "current transaction is aborted" message and,
            # critically, left pg_advisory_lock's session-scoped lock held forever on this
            # pooled connection, wedging every future call to this function until someone
            # manually pg_terminate_backend()s it.
            cur.execute("SAVEPOINT sp_fn")
            try:
                cur.execute("""
                    CREATE OR REPLACE FUNCTION overwatch_notify()
                    RETURNS trigger AS $$
                    BEGIN
                        PERFORM pg_notify('zabbix_changes', TG_TABLE_NAME);
                        RETURN COALESCE(NEW, OLD);
                    END;
                    $$ LANGUAGE plpgsql;
                """)
                cur.execute("RELEASE SAVEPOINT sp_fn")
            except Exception as exc:
                cur.execute("ROLLBACK TO SAVEPOINT sp_fn")
                logger.warning(
                    "install_notify_triggers: could not (re)create overwatch_notify(): %s", exc
                )
            else:
                for table in _WATCHED_ZABBIX_TABLES:
                    cur.execute("SAVEPOINT sp")
                    trigger_name = f"overwatch_notify_{table}"
                    try:
                        cur.execute(
                            psycopg2.sql.SQL(
                                "DROP TRIGGER IF EXISTS {trigger} ON {table};"
                                " CREATE TRIGGER {trigger}"
                                " AFTER INSERT OR UPDATE OR DELETE ON {table}"
                                " FOR EACH ROW EXECUTE FUNCTION overwatch_notify();"
                            ).format(
                                trigger=psycopg2.sql.Identifier(trigger_name),
                                table=psycopg2.sql.Identifier(table),
                            )
                        )
                        cur.execute("RELEASE SAVEPOINT sp")
                    except Exception as exc:
                        cur.execute("ROLLBACK TO SAVEPOINT sp")
                        logger.debug(
                            "install_notify_triggers: trigger on %s skipped: %s", table, exc
                        )

            # Every failure path above is now savepoint-contained, so the transaction is
            # never left aborted here — these two are safe to run unconditionally.
            cur.execute("SELECT pg_advisory_unlock(8472910234)")
            cur.execute("RESET lock_timeout")
        conn.commit()
        logger.info("ZabbixSync: notify triggers installed on Zabbix tables.")
    except Exception as exc:
        conn.rollback()
        logger.warning("install_notify_triggers failed (non-fatal): %r", exc)
        if lock_held:
            # conn.rollback() above fully clears any aborted-transaction state, so the
            # lock can still be released safely here even after an unanticipated failure —
            # this is the belt-and-suspenders backstop for whatever the savepoints above
            # didn't foresee, so the lock is (almost) never leaked outright.
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT pg_advisory_unlock(8472910234)")
                    cur.execute("RESET lock_timeout")
                conn.commit()
            except Exception as unlock_exc:
                logger.warning(
                    "install_notify_triggers: failed to release advisory lock after error — "
                    "it will remain held until this pooled connection is recycled: %s",
                    unlock_exc,
                )
    finally:
        conn.close()
