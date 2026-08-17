"""Shared constants for portal/Zabbix role and group mapping."""

import os

# How often (seconds) the background thread runs a full sync.
# Override with ZABBIX_SYNC_INTERVAL env var.
SYNC_INTERVAL = int(os.getenv("ZABBIX_SYNC_INTERVAL", "60"))

# ── Role definitions ──────────────────────────────────────────────────────────
#
#   root       — full access across all teams; can create/delete teams,
#                manage all users, see all hosts, grant any role.
#   team_lead  — manages own team: add/remove users, assign hosts,
#                full host & monitoring CRUD within the team.
#   operator   — manages own team's hosts and monitoring (create/delete hosts,
#                add items/triggers); no user management.
#   member     — read-only; can only see hosts assigned to their own team.
#   auditor    — read-only cross-team visibility; cannot write anything.
#                Only root can grant this role.
#
# ── Zabbix user type → portal role mapping ───────────────────────────────────
#
#   Zabbix Super admin (type 3) → root
#   Zabbix Admin       (type 2) → team_lead
#   Zabbix User        (type 1) → member
#
# ── Default Zabbix group → portal role mapping ───────────────────────────────
#
#   "Zabbix administrators" → root      (platform admins)
#   "Guests"                → member    (read-only observers)
#   "Internal"              → member    (internal read-only accounts)
#   "No access to frontend" → skipped   (API-only; cannot use portal)
#
#   Any other group name is treated as a portal team name and imported as-is.
#
# ── Items and triggers ────────────────────────────────────────────────────────
#
#   Items and triggers are read directly from Zabbix API on every request —
#   they are never stored in the portal DB, so they are always up to date.
#   Writes (create item, create trigger) go directly to Zabbix via ItemManager.
#   No separate sync is needed for items or triggers.

ROLE_TO_TYPE: dict[str, int] = {
    "root": 3,  # Zabbix Super admin
    "team_lead": 2,  # Zabbix Admin
    "operator": 1,  # Zabbix User
    "auditor": 1,
    "member": 1,
}

TYPE_TO_ROLES: dict[int, list[str]] = {
    3: ["root"],
    2: ["team_lead"],
    1: ["member"],
}

# Default Zabbix groups that map directly to portal roles (not imported as teams)
GROUP_ROLE_MAP: dict[str, str] = {
    "Zabbix administrators": "root",
    "Guests": "member",
    "Internal": "member",
}

# Groups whose members cannot access the portal frontend — skip entirely
SKIP_GROUPS = {"No access to the frontend"}

# Fallback Zabbix user group for portal users with no team assigned
DEFAULT_GROUP = "Zabbix Portal Users"

# Zabbix host group permission levels
PERM_READ_WRITE = 3
PERM_READ = 2
