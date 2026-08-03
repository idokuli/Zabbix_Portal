#!/usr/bin/env python3
"""Report portal accounts whose usernames collide case-insensitively.

READ-ONLY — this script never writes to or deletes from the database.

Why this exists
---------------
Portal logins resolve case-insensitively (`LOWER(username) = LOWER(...)`), but the
table's UNIQUE(username) constraint is case-SENSITIVE. On a database written before
the case-insensitive duplicate guard was added, one person could end up with several
rows — classically an LDAP user who typed a new capitalisation each time and got a
freshly JIT-provisioned account on each login (`idokuli`, `IdOkUlI`, `IDOKULI`).

Each such group is a problem: one login now matches several rows, so which account
(and therefore which roles and team) a person gets is decided by tie-break rules
rather than intent.

Usage
-----
    # From apps/backend/, with DATABASE_URL set (or apps/backend/.env present):
    python3 scripts/find_duplicate_usernames.py

    # Against a backend running in docker compose:
    docker compose exec backend python3 scripts/find_duplicate_usernames.py

Exit codes: 0 = no duplicates found, 1 = duplicates found, 2 = could not connect.
"""

import os
import sys
from pathlib import Path


def _load_database_url() -> str | None:
    """DATABASE_URL from the environment, falling back to apps/backend/.env."""
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    try:
        from dotenv import load_dotenv

        load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    except ImportError:
        return None
    return os.getenv("DATABASE_URL")


# Groups rows by lowercased username and keeps only the names that occur more than
# once. array_agg preserves per-row detail so the report can show what differs.
_QUERY = """
SELECT LOWER(username)                AS key,
       COUNT(*)                       AS n,
       array_agg(id ORDER BY id)      AS ids,
       array_agg(username ORDER BY id) AS usernames,
       array_agg(COALESCE(source, '') ORDER BY id) AS sources,
       array_agg(COALESCE(display_name, '') ORDER BY id) AS display_names,
       array_agg(COALESCE(array_to_string(roles, '+'), '') ORDER BY id) AS roles,
       array_agg(COALESCE(team_id::text, '-') ORDER BY id) AS team_ids
FROM team_users
GROUP BY LOWER(username)
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, LOWER(username)
"""


def main() -> int:
    url = _load_database_url()
    if not url:
        print("ERROR: DATABASE_URL is not set and apps/backend/.env was not readable.")
        return 2

    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("ERROR: psycopg2 is not installed. Run this inside the backend environment.")
        return 2

    try:
        conn = psycopg2.connect(url)
    except Exception as exc:
        print(f"ERROR: could not connect to the database: {exc}")
        return 2

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) AS n FROM team_users")
            total = cur.fetchone()["n"]
            cur.execute(_QUERY)
            groups = cur.fetchall()
    finally:
        conn.close()

    print(f"Scanned {total} portal user(s).\n")

    if not groups:
        print("No case-insensitive duplicate usernames found — the database is clean.")
        print("It is safe to add a unique index:")
        print("  CREATE UNIQUE INDEX CONCURRENTLY idx_team_users_username_lower")
        print("      ON team_users (LOWER(username));")
        return 0

    affected = sum(g["n"] for g in groups)
    print(f"Found {len(groups)} colliding name(s) covering {affected} account(s):\n")

    for g in groups:
        print(f'  "{g["key"]}" — {g["n"]} accounts')
        for i, uid in enumerate(g["ids"]):
            marker = "keeper?" if i == 0 else "       "
            print(
                f"    {marker} id={uid:<5} username={g['usernames'][i]!r:<20} "
                f"source={g['sources'][i]:<7} roles={g['roles'][i]:<20} "
                f"team={g['team_ids'][i]:<4} display_name={g['display_names'][i]!r}"
            )
        print()

    print("Notes:")
    print("  * 'keeper?' marks the lowest (oldest) id — the row a login currently resolves")
    print("    to when no exact-case match exists. Confirm it is the right one before acting;")
    print("    the newer rows may hold the roles/team the person actually uses today.")
    print("  * Nothing was changed. Reassign roles/teams onto the account you keep, then")
    print("    delete the extras through the portal Users page so Zabbix sync stays in step.")
    print("  * Re-run this script until it reports clean, then add the unique index above.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
