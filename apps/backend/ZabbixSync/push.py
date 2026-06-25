"""Portal → Zabbix pushes: users, teams (user group + host group + permissions), host assignments.

Calls self._get_or_create_usergroup / _get_or_create_hostgroup / _get_zabbix_user /
_set_usergroup_permission / _user_type / _roleid_for, which live in SyncHelpersMixin
— resolved via the final ZabbixSync class's MRO at runtime.
"""

import logging
import secrets
from typing import TYPE_CHECKING, Callable

from ZabbixSync.constants import DEFAULT_GROUP

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class SyncPushMixin:
    """Mixed into ZabbixSync."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"
        _ufield: str
        _zabbix_major: int
        _select_hg_param: str
        _host_hg_key: str
        _get_zabbix_user: Callable[[str], dict | None]
        _get_or_create_usergroup: Callable[[str], str | None]
        _get_or_create_hostgroup: Callable[[str], str | None]
        _set_usergroup_permission: Callable[..., None]
        _user_type: Callable[[list[str]], int]
        _roleid_for: Callable[[int], str]

    # ── Portal → Zabbix: users ────────────────────────────────────────────────

    def push_user(
        self, username: str, password: str, roles: list[str], team_name: str | None
    ) -> None:
        """Create or update a Zabbix user to match the portal user."""
        if not self.zapi:
            return
        usrgrpid = self._get_or_create_usergroup(
            team_name if team_name else DEFAULT_GROUP
        )
        if not usrgrpid:
            logger.warning(
                "ZabbixSync.push_user(%r): could not resolve user group — skipping.",
                username,
            )
            return
        usrgrps = [{"usrgrpid": usrgrpid}]
        user_type = self._user_type(roles)
        existing = self._get_zabbix_user(username)
        try:
            if existing:
                update: dict = {"userid": existing["userid"], "usrgrps": usrgrps}
                if password:
                    update["passwd"] = password
                if self._zabbix_major >= 6:
                    update["roleid"] = self._roleid_for(user_type)
                else:
                    update["type"] = user_type
                self.zapi.user.update(**update)
            else:
                payload: dict = {
                    self._ufield: username,
                    "passwd": password or secrets.token_urlsafe(16),
                    "usrgrps": usrgrps,
                    "name": username,
                }
                if self._zabbix_major >= 6:
                    payload["roleid"] = self._roleid_for(user_type)
                else:
                    payload["type"] = user_type
                self.zapi.user.create(**payload)
            logger.info(
                "ZabbixSync: pushed user %r to Zabbix (type=%d).", username, user_type
            )
        except Exception as exc:
            logger.error("ZabbixSync.push_user(%r) failed: %r", username, exc)

    def delete_user(self, username: str) -> None:
        """Delete a Zabbix user matching the portal user."""
        if not self.zapi:
            return
        existing = self._get_zabbix_user(username)
        if not existing:
            return
        try:
            self.zapi.user.delete(existing["userid"])
            logger.info("ZabbixSync: deleted user %r from Zabbix.", username)
        except Exception as exc:
            logger.error("ZabbixSync.delete_user(%r) failed: %r", username, exc)

    def update_password(self, username: str, new_password: str) -> None:
        """Sync a password change to Zabbix."""
        if not self.zapi:
            return
        existing = self._get_zabbix_user(username)
        if not existing:
            return
        try:
            self.zapi.user.update(userid=existing["userid"], passwd=new_password)
            logger.info("ZabbixSync: updated password for %r in Zabbix.", username)
        except Exception as exc:
            logger.error("ZabbixSync.update_password(%r) failed: %r", username, exc)

    # ── Portal → Zabbix: teams and host visibility ────────────────────────────

    def push_team(self, team_name: str) -> None:
        """Create a Zabbix user group and host group for the team, and wire permissions.

        This is what makes team members able to see their hosts in the Zabbix UI:
          user group  → has read-write permission on →  host group (same name)
        Hosts assigned to the team are placed in that host group.
        """
        if not self.zapi:
            return
        usrgrpid = self._get_or_create_usergroup(team_name)
        host_grpid = self._get_or_create_hostgroup(team_name)
        if usrgrpid and host_grpid:
            self._set_usergroup_permission(usrgrpid, host_grpid)
            logger.info(
                "ZabbixSync: team %r — user group + host group + permissions set.",
                team_name,
            )

    def delete_team(self, team_name: str) -> None:
        """Delete the Zabbix user group and host group that match a portal team."""
        if not self.zapi:
            return
        try:
            ug = self.zapi.usergroup.get(
                filter={"name": team_name}, output=["usrgrpid"]
            )
            if ug:
                self.zapi.usergroup.delete(ug[0]["usrgrpid"])
            hg = self.zapi.hostgroup.get(filter={"name": team_name}, output=["groupid"])
            if hg:
                self.zapi.hostgroup.delete(hg[0]["groupid"])
            logger.info(
                "ZabbixSync: deleted Zabbix user group and host group for %r.",
                team_name,
            )
        except Exception as exc:
            logger.error("ZabbixSync.delete_team(%r) failed: %r", team_name, exc)

    # ── Portal → Zabbix: host assignments ────────────────────────────────────

    def push_host_to_team(self, hostname: str, team_name: str) -> None:
        """Add a Zabbix host to the team's host group so team members can see it."""
        if not self.zapi:
            return
        try:
            hosts = self.zapi.host.get(
                filter={"host": hostname},
                output=["hostid"],
                **{self._select_hg_param: ["groupid"]},
            )
            if not hosts:
                logger.warning(
                    "ZabbixSync.push_host_to_team: host %r not found in Zabbix.",
                    hostname,
                )
                return
            host = hosts[0]
            host_grpid = self._get_or_create_hostgroup(team_name)
            if not host_grpid:
                return
            current_groups = [
                {"groupid": g["groupid"]} for g in host.get(self._host_hg_key, [])
            ]
            if not any(g["groupid"] == host_grpid for g in current_groups):
                self.zapi.host.update(
                    hostid=host["hostid"],
                    groups=current_groups + [{"groupid": host_grpid}],
                )
                logger.info(
                    "ZabbixSync: host %r added to Zabbix host group %r.",
                    hostname,
                    team_name,
                )
            else:
                logger.debug(
                    "ZabbixSync: host %r already in host group %r.", hostname, team_name
                )
        except Exception as exc:
            logger.error(
                "ZabbixSync.push_host_to_team(%r, %r) failed: %r",
                hostname,
                team_name,
                exc,
            )

    def remove_host_from_team(self, hostname: str, team_name: str) -> None:
        """Remove a Zabbix host from the team's host group."""
        if not self.zapi:
            return
        try:
            hg = self.zapi.hostgroup.get(filter={"name": team_name}, output=["groupid"])
            if not hg:
                return
            host_grpid = hg[0]["groupid"]
            hosts = self.zapi.host.get(
                filter={"host": hostname},
                output=["hostid"],
                **{self._select_hg_param: ["groupid"]},
            )
            if not hosts:
                return
            host = hosts[0]
            remaining = [
                {"groupid": g["groupid"]}
                for g in host.get(self._host_hg_key, [])
                if g["groupid"] != host_grpid
            ]
            if not remaining:
                # Hosts must belong to at least one group — keep the original if this would leave none
                logger.warning(
                    "ZabbixSync: skipping removal of %r from %r — would leave host with no group.",
                    hostname,
                    team_name,
                )
                return
            self.zapi.host.update(hostid=host["hostid"], groups=remaining)
            logger.info(
                "ZabbixSync: host %r removed from Zabbix host group %r.",
                hostname,
                team_name,
            )
        except Exception as exc:
            logger.error(
                "ZabbixSync.remove_host_from_team(%r, %r) failed: %r",
                hostname,
                team_name,
                exc,
            )
