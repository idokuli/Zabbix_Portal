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
    except Exception as exc:
        conn.rollback()
        logger.error("create_team failed: %r", exc)
        return None
    finally:
        conn.close()


def list_teams() -> list[dict]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, description FROM teams ORDER BY name")
            return [dict(r) for r in cur.fetchall()]
    except Exception as exc:
        logger.error("list_teams failed: %r", exc)
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
    except Exception as exc:
        conn.rollback()
        logger.error("delete_team failed: %r", exc)
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
        conn.commit()
        return row
    except Exception as exc:
        conn.rollback()
        logger.error("create_user failed: %r", exc)
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
    except Exception as exc:
        logger.error("get_user_by_username failed: %r", exc)
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
    except Exception as exc:
        logger.error("get_user_by_id failed: %r", exc)
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
    except Exception as exc:
        conn.rollback()
        logger.error("delete_user failed: %r", exc)
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
    except Exception as exc:
        conn.rollback()
        logger.error("assign_host failed: %r", exc)
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
    except Exception as exc:
        conn.rollback()
        logger.error("unassign_host failed: %r", exc)
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
    except Exception as exc:
        conn.rollback()
        logger.error("unassign_host_all failed: %r", exc)
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
    except Exception as exc:
        logger.error("get_host_teams failed: %r", exc)
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
                        SELECT team_id,
                               json_agg(json_build_object(
                                   'id', id, 'username', username,
                                   'email', email, 'roles', roles
                               )) AS users
                        FROM team_users
                        WHERE team_id = %s
                        GROUP BY team_id
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
                        SELECT team_id,
                               json_agg(json_build_object(
                                   'id', id, 'username', username,
                                   'email', email, 'roles', roles
                               )) AS users
                        FROM team_users
                        WHERE team_id IS NOT NULL
                        GROUP BY team_id
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
    except Exception as exc:
        logger.error("get_overview failed: %r", exc)
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
    except Exception as exc:
        conn.rollback()
        logger.error("update_password failed: %r", exc)
        return False
    finally:
        conn.close()


def list_users(team_id: int | None = None) -> list[dict]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if team_id is not None:
                cur.execute(
                    """SELECT u.id, u.username, u.email, u.roles, u.team_id, u.source, t.name AS team_name
                       FROM team_users u
                       LEFT JOIN teams t ON u.team_id = t.id
                       WHERE u.team_id = %s
                       ORDER BY u.username""",
                    (team_id,),
                )
            else:
                cur.execute(
                    """SELECT u.id, u.username, u.email, u.roles, u.team_id, u.source, t.name AS team_name
                       FROM team_users u
                       LEFT JOIN teams t ON u.team_id = t.id
                       ORDER BY u.username"""
                )
            return [dict(r) for r in cur.fetchall()]
    except Exception as exc:
        logger.error("list_users failed: %r", exc)
        return []
    finally:
        conn.close()


def update_user_profile(user_id: int, roles: list[str], team_id: int | None) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE team_users SET roles = %s, team_id = %s WHERE id = %s",
                (roles, team_id, user_id),
            )
            updated = cur.rowcount > 0
        conn.commit()
        return updated
    except Exception as exc:
        conn.rollback()
        logger.error("update_user_profile failed: %r", exc)
        return False
    finally:
        conn.close()


def get_team_hostnames(team_id: int) -> set[str]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT hostname FROM host_assignments WHERE team_id = %s", (team_id,)
            )
            return {row["hostname"] for row in cur.fetchall()}
    except Exception as exc:
        logger.error("get_team_hostnames failed: %r", exc)
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
    except Exception as exc:
        logger.error("get_team_name failed: %r", exc)
        return None
    finally:
        conn.close()


# ── Seed default root on first boot ─────────────────────────────────────


def seed_root():
    from Auth import hash_password

    username = os.getenv("ADMIN_USERNAME", "Admin")
    password = os.getenv("ADMIN_PASSWORD")
    if not password:
        password = "admin"
        logger.warning(
            "ADMIN_PASSWORD env var is not set — root account seeded with a default password. "
            "Change it immediately after first login."
        )
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS cnt FROM team_users")
            if cur.fetchone()["cnt"] == 0:
                cur.execute(
                    """INSERT INTO team_users (id, username, email, roles, team_id, password_hash)
                       OVERRIDING SYSTEM VALUE
                       VALUES (1, %s, '', %s, NULL, %s)
                       ON CONFLICT DO NOTHING""",
                    (username, ["root"], hash_password(password)),
                )
                # Advance the sequence so the next user gets ID 2
                cur.execute("SELECT setval('team_users_id_seq', 1, true)")
                logger.info(
                    "Seeded default root user: %r (id=1) — change the password after first login.",
                    username,
                )
        conn.commit()
    except Exception as exc:
        conn.rollback()
        logger.error("seed_root failed: %r", exc)
    finally:
        conn.close()


# ── Dashboard layouts ──────────────────────────────────────────────────────────


def get_dashboard_layout(
    owner_type: str, owner_id: int, page: str = "dashboard"
) -> list:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT layout FROM dashboard_layouts WHERE owner_type=%s AND owner_id=%s AND page=%s",
                (owner_type, owner_id, page),
            )
            row = cur.fetchone()
            return row["layout"] if row else []
    except Exception as exc:
        logger.error("get_dashboard_layout failed: %r", exc)
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
    except Exception as exc:
        conn.rollback()
        logger.error("save_dashboard_layout failed: %r", exc)
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
        pages.extend(
            {"page": r["page_key"], "name": r["name"], "is_default": False}
            for r in rows
        )
        return pages
    except Exception as exc:
        logger.error("list_dashboard_pages failed: %r", exc)
        return pages
    finally:
        conn.close()


def create_dashboard_page(
    owner_type: str, owner_id: int, kind: str, name: str
) -> dict | None:
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
    except Exception as exc:
        conn.rollback()
        logger.error("create_dashboard_page failed: %r", exc)
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
    except Exception as exc:
        conn.rollback()
        logger.error("rename_dashboard_page failed: %r", exc)
        return False
    finally:
        conn.close()


def delete_dashboard_page(
    owner_type: str, owner_id: int, kind: str, page_key: str
) -> bool:
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
    except Exception as exc:
        conn.rollback()
        logger.error("delete_dashboard_page failed: %r", exc)
        return False
    finally:
        conn.close()
