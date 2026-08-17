"""Zabbix → Portal full sync: bootstrap, initial import, and the periodic bidirectional sync."""

import logging
import secrets
from typing import TYPE_CHECKING
from collections.abc import Callable

from ZabbixSync.constants import (
    DEFAULT_GROUP,
    GROUP_ROLE_MAP,
    SKIP_GROUPS,
    TYPE_TO_ROLES,
)

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class SyncPullMixin:
    """Mixed into ZabbixSync. Calls self.push_team / self.push_host_to_team
    (SyncPushMixin) — resolved via the final class's MRO at runtime.
    """

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"
        _ufield: str
        _zabbix_major: int
        _roleids: dict[int, str]
        _select_hg_param: str
        _host_hg_key: str
        _on_sync: Callable[[], None] | None
        push_team: Callable[[str], None]
        push_host_to_team: Callable[[str, str], None]

    def bootstrap_teams(self) -> None:
        """Ensure every portal team is fully set up in Zabbix.

        For each portal team this creates (if missing):
          - Zabbix user group
          - Zabbix host group
          - Read-write permission from user group → host group
          - Adds every assigned host to the host group

        Call this once at startup so pre-existing teams and host assignments
        are visible to team members in the Zabbix UI.
        """
        if not self.zapi:
            return
        import User_Management as um

        teams = um.list_teams()
        for team in teams:
            team_name = team["name"]
            self.push_team(team_name)

            hostnames = um.get_team_hostnames(team["id"])
            for hostname in hostnames:
                self.push_host_to_team(hostname, team_name)

        logger.info("ZabbixSync.bootstrap_teams: bootstrapped %d team(s).", len(teams))

    @staticmethod
    def _first_relevant_group(usrgrps: list[dict]) -> str | None:
        """First non-empty, non-skipped Zabbix user-group name, in usrgrps order."""
        for grp in usrgrps:
            grp_name = grp.get("name", "").strip()
            if grp_name and grp_name not in SKIP_GROUPS:
                return grp_name
        return None

    @staticmethod
    def _get_or_create_team_id(grp_name: str, portal_teams: dict[str, int]) -> int | None:
        """Look up grp_name's portal team id, creating the team if it doesn't exist
        yet. Mutates portal_teams in place when a new team is created."""
        import User_Management as um

        if grp_name not in portal_teams:
            team = um.create_team(grp_name)
            if team:
                portal_teams[grp_name] = team["id"]
        return portal_teams.get(grp_name)

    def _resolve_role_and_team(
        self, zu: dict, roleid_to_type: dict, portal_teams: dict[str, int]
    ) -> tuple[list[str], int | None]:
        """Resolve (roles, team_id) for a Zabbix user from their usrgrps.

        Creates a portal team for any new Zabbix group encountered.
        Mutates portal_teams in place when a new team is created.
        """
        if self._zabbix_major >= 6:
            user_type = roleid_to_type.get(str(zu.get("roleid", "1")), 1)
        else:
            user_type = int(zu.get("type", 1))
        roles = list(TYPE_TO_ROLES.get(user_type, ["member"]))

        grp_name = self._first_relevant_group(zu.get("usrgrps", []))
        if grp_name is None:
            return roles, None
        if grp_name in GROUP_ROLE_MAP:
            return [GROUP_ROLE_MAP[grp_name]], None
        return roles, self._get_or_create_team_id(grp_name, portal_teams)

    def pull_users(self) -> None:
        """Import Zabbix users and groups into the portal (runs on startup).

        Skips users already in the portal. Generates a temporary password for
        each imported user — logged at INFO, reset via portal after first login.
        """
        if not self.zapi:
            return
        import User_Management as um
        from Auth import hash_password

        type_field = "roleid" if self._zabbix_major >= 6 else "type"
        roleid_to_type = {v: k for k, v in self._roleids.items()}

        try:
            zabbix_users = self.zapi.user.get(
                output=["userid", self._ufield, type_field],
                selectUsrgrps=["usrgrpid", "name"],
            )
        except Exception:
            logger.exception("ZabbixSync.pull_users: failed to list Zabbix users")
            return

        portal_teams = {t["name"]: t["id"] for t in um.list_teams()}
        existing_usernames = {u["username"].lower() for u in um.list_users()}

        for zu in zabbix_users:
            username = zu.get(self._ufield, "").strip()
            if not username or username.lower() == "guest":
                continue
            if username.lower() in existing_usernames:
                continue

            roles, team_id = self._resolve_role_and_team(zu, roleid_to_type, portal_teams)

            temp_password = secrets.token_urlsafe(16)
            um.create_user(
                username=username,
                password_hash=hash_password(temp_password),
                roles=roles,
                team_id=team_id,
                source="zabbix",
            )
            logger.info(
                "ZabbixSync: imported %r → portal (roles=%s, team_id=%s).",
                username,
                roles,
                team_id,
            )

    @staticmethod
    def _update_existing_zabbix_user(
        existing: dict, roles: list[str], team_id: int | None, username: str
    ) -> None:
        import User_Management as um

        current_roles = set(existing.get("roles") or [])
        if current_roles != set(roles) or existing.get("team_id") != team_id:
            um.update_user_profile(existing["id"], roles, team_id)
            logger.info(
                "ZabbixSync: updated %r → roles=%s, team_id=%s.",
                username,
                roles,
                team_id,
            )

    @staticmethod
    def _import_new_zabbix_user(username: str, roles: list[str], team_id: int | None) -> None:
        import User_Management as um
        from Auth import hash_password

        temp_password = secrets.token_urlsafe(16)
        um.create_user(
            username=username,
            password_hash=hash_password(temp_password),
            roles=roles,
            team_id=team_id,
            source="zabbix",
        )
        logger.info(
            "ZabbixSync: auto-imported new Zabbix user %r → portal.",
            username,
        )

    def _sync_users_import(self, zabbix_users: list[dict]) -> None:
        """Import new Zabbix users not yet in the portal, and update role/team on
        existing Zabbix-sourced users when Zabbix's own group membership changed."""
        import User_Management as um

        roleid_to_type = {v: k for k, v in self._roleids.items()}
        try:
            portal_teams = {t["name"]: t["id"] for t in um.list_teams()}
            portal_users = {u["username"].lower(): u for u in um.list_users()}
            for zu in zabbix_users:
                username = zu.get(self._ufield, "").strip()
                if not username or username.lower() == "guest":
                    continue

                roles, team_id = self._resolve_role_and_team(zu, roleid_to_type, portal_teams)
                existing = portal_users.get(username.lower())

                # Only let Zabbix drive roles/team for users that originated from Zabbix.
                # Local and LDAP users are managed by the portal — don't overwrite them.
                if existing is not None and existing.get("source") != "zabbix":
                    continue
                if existing is not None:
                    self._update_existing_zabbix_user(existing, roles, team_id, username)
                else:
                    self._import_new_zabbix_user(username, roles, team_id)
        except Exception:
            logger.exception("ZabbixSync.full_sync: user import failed")

    @staticmethod
    def _sync_users_removed(zabbix_usernames: set[str]) -> None:
        """Remove portal users deleted from Zabbix. Only removes users that were
        originally imported from Zabbix (source='zabbix') — local and LDAP
        JIT-provisioned users are not managed by Zabbix and must not be deleted."""
        import User_Management as um

        try:
            for u in um.list_users():
                if "root" in (u.get("roles") or []):
                    continue
                if u.get("source") != "zabbix":
                    continue
                if u["username"].lower() not in zabbix_usernames:
                    um.delete_user(u["id"])
                    logger.info(
                        "ZabbixSync: removed portal user %r — deleted from Zabbix.",
                        u["username"],
                    )
        except Exception:
            logger.exception("ZabbixSync.full_sync: user deletion sync failed")

    def _sync_groups(self) -> None:
        """Import new Zabbix user groups as portal teams; remove portal teams
        whose Zabbix user group was deleted."""
        if not self.zapi:
            return
        import User_Management as um

        try:
            zabbix_groups = self.zapi.usergroup.get(output=["usrgrpid", "name"])
            zabbix_group_names = {zg["name"].strip() for zg in zabbix_groups if zg.get("name")}
            portal_team_list = um.list_teams()
            portal_team_names = {t["name"] for t in portal_team_list}

            # Import new groups
            for zg in zabbix_groups:
                name = zg.get("name", "").strip()
                if not name or name in SKIP_GROUPS or name in GROUP_ROLE_MAP:
                    continue
                if name not in portal_team_names:
                    um.create_team(name)
                    logger.info("ZabbixSync: imported new Zabbix group %r as portal team.", name)

            # Remove portal teams whose Zabbix user group was deleted
            for team in portal_team_list:
                name = team["name"]
                if name in GROUP_ROLE_MAP or name == DEFAULT_GROUP:
                    continue
                if name not in zabbix_group_names:
                    um.delete_team(team["id"])
                    logger.info(
                        "ZabbixSync: removed portal team %r — Zabbix group deleted.",
                        name,
                    )
        except Exception:
            logger.exception("ZabbixSync.full_sync: group sync failed")

    @staticmethod
    def _host_group_assignments(
        hostname: str, zh: dict, host_hg_key: str, portal_team_map: dict[str, int]
    ) -> set[tuple[str, str]]:
        """(hostname, team_name) pairs from zh's Zabbix host-group membership,
        pushing any missing portal assignment via assign_host() as a side effect."""
        import User_Management as um

        assignments: set[tuple[str, str]] = set()
        for hg in zh.get(host_hg_key, []):
            grp_name = hg.get("name", "").strip()
            if grp_name in portal_team_map:
                assignments.add((hostname, grp_name))
                um.assign_host(portal_team_map[grp_name], hostname)
        return assignments

    @staticmethod
    def _host_tag_assignments(hostname: str, zh: dict, portal_team_map: dict[str, int]) -> set:
        """(hostname, team_name) pairs from zh's "team" tag — set by create_host / tag_host."""
        assignments = set()
        for tag in zh.get("tags", []):
            if tag.get("tag") != "team":
                continue
            tag_team = tag.get("value", "").strip()
            if tag_team in portal_team_map:
                assignments.add((hostname, tag_team))
        return assignments

    @classmethod
    def _collect_zabbix_host_assignments(
        cls, zabbix_hosts: list[dict], host_hg_key: str, portal_team_map: dict[str, int]
    ) -> set[tuple[str, str]]:
        """Build the set of (hostname, team_name) pairs that Zabbix currently has,
        via either host-group membership or a "team" tag."""
        zabbix_assignments: set[tuple[str, str]] = set()
        for zh in zabbix_hosts:
            hostname = zh.get("host", "").strip()
            if not hostname:
                continue
            zabbix_assignments |= cls._host_group_assignments(
                hostname, zh, host_hg_key, portal_team_map
            )
            zabbix_assignments |= cls._host_tag_assignments(hostname, zh, portal_team_map)
        return zabbix_assignments

    @staticmethod
    def _remove_stale_host_assignments(
        portal_team_map: dict[str, int], zabbix_assignments: set[tuple[str, str]]
    ) -> None:
        import User_Management as um

        for team in um.get_overview():
            team_name = team["name"]
            if team_name not in portal_team_map:
                continue
            for hostname in team.get("hosts", []):
                if (hostname, team_name) not in zabbix_assignments:
                    um.unassign_host(team["id"], hostname)
                    logger.info(
                        "ZabbixSync: removed portal assignment %r → %r — no longer in Zabbix.",
                        hostname,
                        team_name,
                    )

    def _sync_host_assignments(self) -> None:
        """Sync Zabbix host group membership (and "team" tags) → portal host
        assignments, and remove portal assignments no longer present in Zabbix."""
        if not self.zapi:
            return
        import User_Management as um

        try:
            portal_team_map = {t["name"]: t["id"] for t in um.list_teams()}
            zabbix_hosts = self.zapi.host.get(
                output=["hostid", "host"],
                selectTags="extend",
                **{self._select_hg_param: ["groupid", "name"]},
            )

            zabbix_assignments = self._collect_zabbix_host_assignments(
                zabbix_hosts, self._host_hg_key, portal_team_map
            )
            self._remove_stale_host_assignments(portal_team_map, zabbix_assignments)
        except Exception:
            logger.exception("ZabbixSync.full_sync: host assignment sync failed")

    def full_sync(self) -> None:
        """Periodic bidirectional sync covering users, groups, and host assignments.

        Runs in the background thread every ZABBIX_SYNC_INTERVAL seconds.

        What it does:
          Users   — import new Zabbix users not yet in portal;
                    remove portal users deleted from Zabbix (root users protected).
          Groups  — import new Zabbix user groups as portal teams.
          Hosts   — sync Zabbix host group memberships to portal host assignments.
          Items / Triggers — read directly from Zabbix per request; no sync needed.
        """
        if not self.zapi:
            return

        type_field = "roleid" if self._zabbix_major >= 6 else "type"

        # ── 1. Fetch current Zabbix state ─────────────────────────────────────
        try:
            zabbix_users = self.zapi.user.get(
                output=["userid", self._ufield, type_field],
                selectUsrgrps=["usrgrpid", "name"],
            )
        except Exception:
            logger.exception("ZabbixSync.full_sync: failed to fetch users")
            return

        zabbix_usernames = {u.get(self._ufield, "").strip().lower() for u in zabbix_users}

        # ── 2. Users: import new ones and update changed existing ones ───────
        self._sync_users_import(zabbix_users)
        # ── 3. Users: remove portal users deleted from Zabbix ─────────────────
        self._sync_users_removed(zabbix_usernames)
        # ── 4. Groups: import new Zabbix user groups as portal teams; remove deleted ──
        self._sync_groups()
        # ── 5. Hosts: sync Zabbix host group membership → portal assignments ──
        self._sync_host_assignments()

        if self._on_sync:
            try:
                self._on_sync()
            except Exception as exc:
                logger.debug("ZabbixSync: on_sync callback failed: %s", exc)
