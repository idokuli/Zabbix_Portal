import json
import logging
import os
import uuid
from Database import get_conn

logger = logging.getLogger(__name__)


# ── Teams ─────────────────────────────────────────────────────────────────────


def create_team(name: str, description: str = "") -> dict | None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO teams (name, description) VALUES (%s, %s) RETURNING id, name, description",
                (name, description),
            )
            row = dict(cur.fetchone())
        conn.commit()
        return row
    except Exception:
        conn.rollback()
        logger.exception("create_team failed")
        return None
    finally:
        conn.close()


def list_teams() -> list[dict]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, description FROM teams ORDER BY name")
            return [dict(r) for r in cur.fetchall()]
    except Exception:
        logger.exception("list_teams failed")
        return []
    finally:
        conn.close()


def delete_team(team_id: int) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM teams WHERE id = %s", (team_id,))
            deleted = cur.rowcount > 0
        conn.commit()
        return deleted
    except Exception:
        conn.rollback()
        logger.exception("delete_team failed")
        return False
    finally:
        conn.close()


# ── Users ─────────────────────────────────────────────────────────────────────


def create_user(
    username: str,
    password_hash: str,
    email: str = "",
    roles: list[str] | None = None,
    team_id: int | None = None,
    source: str = "local",
    display_name: str = "",
) -> dict | None:
    if roles is None:
        roles = ["member"]
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO team_users (username, email, roles, team_id, password_hash, source, display_name)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   RETURNING id, username, email, roles, team_id, source, display_name""",
                (username, email, roles, team_id, password_hash, source, display_name),
            )
            row = dict(cur.fetchone())
            if team_id is not None:
                cur.execute(
                    """INSERT INTO user_team_memberships (user_id, team_id)
                       VALUES (%s, %s) ON CONFLICT DO NOTHING""",
                    (row["id"], team_id),
                )
        conn.commit()
        return row
    except Exception:
        conn.rollback()
        logger.exception("create_user failed")
        return None
    finally:
        conn.close()


def get_user_by_username(username: str) -> dict | None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, email, roles, team_id, password_hash, source, display_name FROM team_users WHERE username = %s",
                (username,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    except Exception:
        logger.exception("get_user_by_username failed")
        return None
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> dict | None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, email, roles, team_id FROM team_users WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    except Exception:
        logger.exception("get_user_by_id failed")
        return None
    finally:
        conn.close()


def delete_user(user_id: int) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM team_users WHERE id = %s", (user_id,))
            deleted = cur.rowcount > 0
        conn.commit()
        return deleted
    except Exception:
        conn.rollback()
        logger.exception("delete_user failed")
        return False
    finally:
        conn.close()


# ── Host assignments ──────────────────────────────────────────────────────────


def assign_host(team_id: int, hostname: str) -> bool:
    """Assign a host to a team. A host may belong to multiple teams at once —
    this adds a new (hostname, team_id) pairing rather than replacing any
    existing one."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO host_assignments (hostname, team_id)
                   VALUES (%s, %s)
                   ON CONFLICT (hostname, team_id) DO NOTHING""",
                (hostname, team_id),
            )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        logger.exception("assign_host failed")
        return False
    finally:
        conn.close()


def unassign_host(team_id: int, hostname: str) -> bool:
    """Remove a single team's assignment for a host, leaving any other
    teams' assignments for that host untouched."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM host_assignments WHERE hostname = %s AND team_id = %s",
                (hostname, team_id),
            )
            deleted = cur.rowcount > 0
        conn.commit()
        return deleted
    except Exception:
        conn.rollback()
        logger.exception("unassign_host failed")
        return False
    finally:
        conn.close()


def unassign_host_all(hostname: str) -> bool:
    """Remove every team assignment for a host — used when the host itself is deleted."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM host_assignments WHERE hostname = %s", (hostname,))
            deleted = cur.rowcount > 0
        conn.commit()
        return deleted
    except Exception:
        conn.rollback()
        logger.exception("unassign_host_all failed")
        return False
    finally:
        conn.close()


def add_team_membership(user_id: int, team_id: int) -> bool:
    """Add a user to a team. A user may belong to multiple teams simultaneously."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO user_team_memberships (user_id, team_id)
                   VALUES (%s, %s) ON CONFLICT DO NOTHING""",
                (user_id, team_id),
            )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        logger.exception("add_team_membership failed")
        return False
    finally:
        conn.close()


def remove_team_membership(user_id: int, team_id: int) -> bool:
    """Remove a user from a single team, leaving other memberships intact."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM user_team_memberships WHERE user_id = %s AND team_id = %s",
                (user_id, team_id),
            )
            deleted = cur.rowcount > 0
        conn.commit()
        return deleted
    except Exception:
        conn.rollback()
        logger.exception("remove_team_membership failed")
        return False
    finally:
        conn.close()


def get_host_teams(hostname: str) -> list[dict]:
    """Return [{team_id, team_name}] for every team this host is assigned to."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT t.id AS team_id, t.name AS team_name
                   FROM host_assignments ha
                   JOIN teams t ON t.id = ha.team_id
                   WHERE ha.hostname = %s
                   ORDER BY t.name""",
                (hostname,),
            )
            return [dict(r) for r in cur.fetchall()]
    except Exception:
        logger.exception("get_host_teams failed")
        return []
    finally:
        conn.close()


# ── Overview ──────────────────────────────────────────────────────────────────


def get_overview(team_id: int | None = None) -> list[dict]:
    """Returns teams with members and assigned hostnames. Pass team_id to filter to one team."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if team_id is not None:
                cur.execute(
                    """
                    WITH user_agg AS (
                        SELECT utm.team_id,
                               json_agg(json_build_object(
                                   'id', u.id, 'username', u.username,
                                   'email', u.email, 'roles', u.roles,
                                   'source', u.source, 'display_name', u.display_name
                               )) AS users
                        FROM user_team_memberships utm
                        JOIN team_users u ON u.id = utm.user_id
                        WHERE utm.team_id = %s
                        GROUP BY utm.team_id
                    ),
                    host_agg AS (
                        SELECT team_id, json_agg(hostname) AS hosts
                        FROM host_assignments
                        WHERE team_id = %s
                        GROUP BY team_id
                    )
                    SELECT t.id, t.name, t.description,
                           COALESCE(ua.users, '[]'::json) AS users,
                           COALESCE(ha.hosts, '[]'::json) AS hosts
                    FROM teams t
                    LEFT JOIN user_agg ua ON ua.team_id = t.id
                    LEFT JOIN host_agg  ha ON ha.team_id = t.id
                    WHERE t.id = %s
                    ORDER BY t.name
                    """,
                    (team_id, team_id, team_id),
                )
            else:
                cur.execute(
                    """
                    WITH user_agg AS (
                        SELECT utm.team_id,
                               json_agg(json_build_object(
                                   'id', u.id, 'username', u.username,
                                   'email', u.email, 'roles', u.roles,
                                   'source', u.source, 'display_name', u.display_name
                               )) AS users
                        FROM user_team_memberships utm
                        JOIN team_users u ON u.id = utm.user_id
                        GROUP BY utm.team_id
                    ),
                    host_agg AS (
                        SELECT team_id, json_agg(hostname) AS hosts
                        FROM host_assignments
                        GROUP BY team_id
                    )
                    SELECT t.id, t.name, t.description,
                           COALESCE(ua.users, '[]'::json) AS users,
                           COALESCE(ha.hosts, '[]'::json) AS hosts
                    FROM teams t
                    LEFT JOIN user_agg ua ON ua.team_id = t.id
                    LEFT JOIN host_agg  ha ON ha.team_id = t.id
                    ORDER BY t.name
                    """
                )
            return [dict(r) for r in cur.fetchall()]
    except Exception:
        logger.exception("get_overview failed")
        return []
    finally:
        conn.close()


def update_password(user_id: int, password_hash: str) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE team_users SET password_hash = %s WHERE id = %s",
                (password_hash, user_id),
            )
            updated = cur.rowcount > 0
        conn.commit()
        return updated
    except Exception:
        conn.rollback()
        logger.exception("update_password failed")
        return False
    finally:
        conn.close()


def list_users(team_id: int | None = None) -> list[dict]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if team_id is not None:
                cur.execute(
                    """SELECT u.id, u.username, u.email, u.roles, u.team_id, u.source, u.display_name, t.name AS team_name
                       FROM team_users u
                       LEFT JOIN teams t ON u.team_id = t.id
                       WHERE u.team_id = %s
                       ORDER BY u.username""",
                    (team_id,),
                )
            else:
                cur.execute(
                    """SELECT u.id, u.username, u.email, u.roles, u.team_id, u.source, u.display_name, t.name AS team_name
                       FROM team_users u
                       LEFT JOIN teams t ON u.team_id = t.id
                       ORDER BY u.username"""
                )
            return [dict(r) for r in cur.fetchall()]
    except Exception:
        logger.exception("list_users failed")
        return []
    finally:
        conn.close()


def update_user_profile(user_id: int, roles: list[str], team_id: int | None) -> bool:
    """Update roles and home team. Setting team_id also grants membership in that
    team — otherwise the user keeps the old team's host visibility even after their
    home team changes, since that's resolved from user_team_memberships, not team_id."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE team_users SET roles = %s, team_id = %s WHERE id = %s",
                (roles, team_id, user_id),
            )
            updated = cur.rowcount > 0
            if updated and team_id is not None:
                cur.execute(
                    """INSERT INTO user_team_memberships (user_id, team_id)
                       VALUES (%s, %s) ON CONFLICT DO NOTHING""",
                    (user_id, team_id),
                )
        conn.commit()
        return updated
    except Exception:
        conn.rollback()
        logger.exception("update_user_profile failed")
        return False
    finally:
        conn.close()


def get_team_roles(team_id: int) -> list[str]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT roles FROM teams WHERE id = %s", (team_id,))
            row = cur.fetchone()
            return list(row["roles"] or []) if row else []
    except Exception as exc:
        logger.debug("get_team_roles failed: %s", exc)
        return []
    finally:
        conn.close()


def set_team_roles(team_id: int, roles: list[str]) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE teams SET roles = %s WHERE id = %s", (roles, team_id))
            updated = cur.rowcount > 0
        conn.commit()
        return updated
    except Exception:
        conn.rollback()
        logger.exception("set_team_roles failed")
        return False
    finally:
        conn.close()


def get_effective_roles(user_id: int, personal_roles: list[str]) -> list[str]:
    """Return union of a user's personal roles and all roles granted by their teams."""
    try:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT DISTINCT unnest(t.roles) AS role
                    FROM user_team_memberships utm
                    JOIN teams t ON t.id = utm.team_id
                    WHERE utm.user_id = %s AND array_length(t.roles, 1) > 0
                    """,
                    (user_id,),
                )
                team_roles = [r["role"] for r in cur.fetchall()]
            return list(set(personal_roles + team_roles))
        finally:
            conn.close()
    except Exception as exc:
        logger.debug("get_effective_roles failed: %s", exc)
        return personal_roles


def get_team_hostnames(team_id: int) -> set[str]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT hostname FROM host_assignments WHERE team_id = %s", (team_id,))
            return {row["hostname"] for row in cur.fetchall()}
    except Exception:
        logger.exception("get_team_hostnames failed")
        return set()
    finally:
        conn.close()


def get_team_name(team_id: int) -> str | None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM teams WHERE id = %s", (team_id,))
            row = cur.fetchone()
            return row["name"] if row else None
    except Exception:
        logger.exception("get_team_name failed")
        return None
    finally:
        conn.close()


# ── Seed default root on first boot ─────────────────────────────────────


def seed_root():
    from Auth import hash_password

    username = os.getenv("ADMIN_USERNAME") or os.getenv("ZABBIX_USER", "Admin")
    password = os.getenv("ADMIN_PASSWORD") or os.getenv("ZABBIX_PASS")
    password_from_env = bool(password)
    if not password:
        import secrets as _secrets

        password = _secrets.token_urlsafe(16)
        logger.warning(
            "ADMIN_PASSWORD/ZABBIX_PASS env var is not set — root account seeded with a generated password: %s "
            "Change it immediately after first login.",
            password,
        )
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS cnt FROM team_users")
            is_empty = cur.fetchone()["cnt"] == 0
            if is_empty:
                cur.execute(
                    """INSERT INTO team_users (id, username, email, roles, team_id, password_hash)
                       OVERRIDING SYSTEM VALUE
                       VALUES (1, %s, '', %s, NULL, %s)
                       ON CONFLICT DO NOTHING""",
                    (username, ["root"], hash_password(password)),
                )
                cur.execute("SELECT setval('team_users_id_seq', 1, true)")
                logger.info(
                    "Seeded default root user: %r (id=1) — change the password after first login.",
                    username,
                )
            elif password_from_env:
                # ADMIN_PASSWORD is explicitly set — keep the root account in sync with the env var
                cur.execute(
                    "UPDATE team_users SET password_hash = %s WHERE id = 1",
                    (hash_password(password),),
                )
                logger.info("Root user password synced from ADMIN_PASSWORD env var.")
        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("seed_root failed")
    finally:
        conn.close()


# ── Dashboard layouts ──────────────────────────────────────────────────────────


def get_dashboard_layout(owner_type: str, owner_id: int, page: str = "dashboard") -> list:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT layout FROM dashboard_layouts WHERE owner_type=%s AND owner_id=%s AND page=%s",
                (owner_type, owner_id, page),
            )
            row = cur.fetchone()
            return row["layout"] if row else []
    except Exception:
        logger.exception("get_dashboard_layout failed")
        return []
    finally:
        conn.close()


def save_dashboard_layout(
    owner_type: str, owner_id: int, widgets: list, page: str = "dashboard"
) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO dashboard_layouts (owner_type, owner_id, page, layout, updated_at)
                   VALUES (%s, %s, %s, %s::jsonb, NOW())
                   ON CONFLICT (owner_type, owner_id, page) DO UPDATE
                   SET layout = EXCLUDED.layout, updated_at = NOW()""",
                (owner_type, owner_id, page, json.dumps(widgets)),
            )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        logger.exception("save_dashboard_layout failed")
        return False
    finally:
        conn.close()


# ── Dashboard pages (multiple named dashboards per kind) ───────────────────────


def list_dashboard_pages(owner_type: str, owner_id: int, kind: str) -> list[dict]:
    pages = [{"page": kind, "name": "Default", "is_default": True}]
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT page_key, name FROM dashboard_pages
                   WHERE owner_type=%s AND owner_id=%s AND kind=%s
                   ORDER BY created_at ASC""",
                (owner_type, owner_id, kind),
            )
            rows = cur.fetchall()
        pages.extend({"page": r["page_key"], "name": r["name"], "is_default": False} for r in rows)
        return pages
    except Exception:
        logger.exception("list_dashboard_pages failed")
        return pages
    finally:
        conn.close()


def list_all_team_dashboard_pages(kind: str) -> list[dict]:
    """Every team's custom dashboard pages for `kind`, in a single query
    (LEFT JOIN teams x dashboard_pages) instead of one query per team."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT t.id AS team_id, t.name AS team_name,
                          dp.page_key, dp.name AS page_name
                   FROM teams t
                   LEFT JOIN dashboard_pages dp
                     ON dp.owner_type = 'team' AND dp.owner_id = t.id AND dp.kind = %s
                   ORDER BY t.name, dp.created_at ASC""",
                (kind,),
            )
            return [dict(r) for r in cur.fetchall()]
    except Exception:
        logger.exception("list_all_team_dashboard_pages failed")
        return []
    finally:
        conn.close()


def create_dashboard_page(owner_type: str, owner_id: int, kind: str, name: str) -> dict | None:
    page_key = f"{kind}-{uuid.uuid4().hex[:12]}"
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO dashboard_pages (owner_type, owner_id, kind, page_key, name)
                   VALUES (%s, %s, %s, %s, %s)""",
                (owner_type, owner_id, kind, page_key, name),
            )
        conn.commit()
        return {"page": page_key, "name": name, "is_default": False}
    except Exception:
        conn.rollback()
        logger.exception("create_dashboard_page failed")
        return None
    finally:
        conn.close()


def rename_dashboard_page(
    owner_type: str, owner_id: int, kind: str, page_key: str, name: str
) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE dashboard_pages SET name=%s
                   WHERE owner_type=%s AND owner_id=%s AND kind=%s AND page_key=%s""",
                (name, owner_type, owner_id, kind, page_key),
            )
            updated = cur.rowcount > 0
        conn.commit()
        return updated
    except Exception:
        conn.rollback()
        logger.exception("rename_dashboard_page failed")
        return False
    finally:
        conn.close()


def delete_dashboard_page(owner_type: str, owner_id: int, kind: str, page_key: str) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """DELETE FROM dashboard_pages
                   WHERE owner_type=%s AND owner_id=%s AND kind=%s AND page_key=%s""",
                (owner_type, owner_id, kind, page_key),
            )
            deleted = cur.rowcount > 0
            cur.execute(
                "DELETE FROM dashboard_layouts WHERE owner_type=%s AND owner_id=%s AND page=%s",
                (owner_type, owner_id, page_key),
            )
        conn.commit()
        return deleted
    except Exception:
        conn.rollback()
        logger.exception("delete_dashboard_page failed")
        return False
    finally:
        conn.close()


# ── Notification history ──────────────────────────────────────────────────────

NOTIF_RETENTION_DAYS = 90


def save_notification_history(user_id: int, entries: list[dict]) -> None:
    if not entries:
        return
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            for e in entries:
                cur.execute(
                    """INSERT INTO notification_history
                           (id, user_id, source, hostname, severity, name, clock, acknowledged)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                       ON CONFLICT (id, user_id) DO UPDATE
                           SET acknowledged = EXCLUDED.acknowledged""",
                    (
                        e["id"],
                        user_id,
                        e.get("source", "zabbix"),
                        e.get("hostname", ""),
                        e.get("severity", 0),
                        e.get("name", ""),
                        e.get("clock", 0),
                        e.get("acknowledged", False),
                    ),
                )
        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("save_notification_history failed")
    finally:
        conn.close()


def get_notification_history(user_id: int, days: int = NOTIF_RETENTION_DAYS) -> list[dict]:
    import time

    conn = get_conn()
    try:
        cutoff = int(time.time()) - days * 86400
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, source, hostname, severity, name, clock, acknowledged
                   FROM notification_history
                   WHERE user_id = %s AND clock >= %s
                   ORDER BY clock DESC
                   LIMIT 2000""",
                (user_id, cutoff),
            )
            return [dict(r) for r in cur.fetchall()]
    except Exception:
        logger.exception("get_notification_history failed")
        return []
    finally:
        conn.close()
