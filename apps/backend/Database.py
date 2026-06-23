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

_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/zabbix_portal",
)

_pool: psycopg2.pool.ThreadedConnectionPool | None = None


class _PooledConn:
    """Wraps a psycopg2 connection so close() returns it to the pool."""

    def __init__(self, conn: psycopg2.extensions.connection, pool: psycopg2.pool.ThreadedConnectionPool) -> None:
        self._conn = conn
        self._pool = pool

    def __getattr__(self, name: str):  # type: ignore[override]
        return getattr(self._conn, name)

    def close(self) -> None:
        try:
            if not self._conn.closed:
                self._conn.rollback()  # ensure clean state before returning
        except Exception:
            pass
        self._pool.putconn(self._conn)


def _init_pool() -> None:
    global _pool
    _pool = psycopg2.pool.ThreadedConnectionPool(
        2, 20, _DATABASE_URL, cursor_factory=RealDictCursor
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
    hostname VARCHAR(255) PRIMARY KEY,
    team_id  INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dashboard_layouts (
    id         SERIAL PRIMARY KEY,
    owner_type VARCHAR(10) NOT NULL CHECK (owner_type IN ('user', 'team')),
    owner_id   INTEGER NOT NULL,
    layout     JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(owner_type, owner_id)
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
"""

_MIGRATIONS = """
ALTER TABLE team_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) DEFAULT '';

ALTER TABLE dashboard_layouts ADD COLUMN IF NOT EXISTS page VARCHAR(50) NOT NULL DEFAULT 'dashboard';
ALTER TABLE dashboard_layouts ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'Dashboard';
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

CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id    ON alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled    ON alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_events_user_id   ON alert_events(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_fired_at  ON alert_events(fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_owner ON dashboard_layouts(owner_type, owner_id, page);
CREATE INDEX IF NOT EXISTS idx_problem_acks_eventid  ON problem_acknowledgements(eventid);
CREATE INDEX IF NOT EXISTS idx_problem_acks_acked_at ON problem_acknowledgements(acked_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_users_team_id    ON team_users(team_id);
CREATE INDEX IF NOT EXISTS idx_host_assignments_team_id ON host_assignments(team_id);

DELETE FROM alert_events WHERE fired_at < NOW() - INTERVAL '90 days';
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
    except Exception as exc:
        conn.rollback()
        logger.error("Database init failed: %r", exc)
        raise
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
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE OR REPLACE FUNCTION zabbix_portal_notify()
                RETURNS trigger AS $$
                BEGIN
                    PERFORM pg_notify('zabbix_changes', TG_TABLE_NAME);
                    RETURN COALESCE(NEW, OLD);
                END;
                $$ LANGUAGE plpgsql;
            """)
            for table in _WATCHED_ZABBIX_TABLES:
                cur.execute("SAVEPOINT sp")
                trigger_name = f"zabbix_portal_notify_{table}"
                try:
                    cur.execute(
                        psycopg2.sql.SQL(
                            "DROP TRIGGER IF EXISTS {trigger} ON {table};"
                            " CREATE TRIGGER {trigger}"
                            " AFTER INSERT OR UPDATE OR DELETE ON {table}"
                            " FOR EACH ROW EXECUTE FUNCTION zabbix_portal_notify();"
                        ).format(
                            trigger=psycopg2.sql.Identifier(trigger_name),
                            table=psycopg2.sql.Identifier(table),
                        )
                    )
                    cur.execute("RELEASE SAVEPOINT sp")
                except Exception:
                    cur.execute("ROLLBACK TO SAVEPOINT sp")
        conn.commit()
        logger.info("ZabbixSync: notify triggers installed on Zabbix tables.")
    except Exception as exc:
        conn.rollback()
        logger.warning("install_notify_triggers failed (non-fatal): %r", exc)
    finally:
        conn.close()
