"""Internal Zabbix lookup/create-if-absent helpers shared by the push/pull mixins."""

import logging
from typing import TYPE_CHECKING, Any

from ZabbixSync.constants import PERM_READ_WRITE, ROLE_TO_TYPE

logger = logging.getLogger(__name__)


class SyncHelpersMixin:
    """Mixed into ZabbixSync. Assumes `self.zapi`/`self._ufield`/`self._roleids`
    instance attributes, all set in ZabbixSync.__init__.
    """

    if TYPE_CHECKING:
        # Untyped (Any) to match the original's inferred attribute type — these
        # methods intentionally call self.zapi without a None-guard, relying on
        # the try/except below (same as the pre-split class).
        zapi: Any
        _ufield: str
        _roleids: dict[int, str]
        _rights_field: str

    def _fetch_roleids(self) -> dict[int, str]:
        """Query Zabbix for its role IDs and map them to user types 1/2/3."""
        result: dict[int, str] = {}
        try:
            roles = self.zapi.role.get(output=["roleid", "name", "type"])
            for role in roles:
                t = int(role.get("type", 0))
                if t in (1, 2, 3) and t not in result:
                    result[t] = str(role["roleid"])
            logger.debug("ZabbixSync: resolved roleids = %s", result)
        except Exception:
            logger.exception("ZabbixSync._fetch_roleids failed")
        return result

    def _roleid_for(self, user_type: int) -> str:
        if user_type in self._roleids:
            return self._roleids[user_type]
        for t in range(user_type, 0, -1):
            if t in self._roleids:
                return self._roleids[t]
        return "1"

    def _get_zabbix_user(self, username: str) -> dict | None:
        try:
            rows = self.zapi.user.get(
                filter={self._ufield: username},
                output=["userid", self._ufield],
            )
            return rows[0] if rows else None
        except Exception:
            logger.exception("ZabbixSync._get_zabbix_user(%r) failed", username)
            return None

    def _get_or_create_usergroup(self, name: str) -> str | None:
        """Return usrgrpid for a Zabbix user group, creating it if absent."""
        try:
            existing = self.zapi.usergroup.get(filter={"name": name}, output=["usrgrpid"])
            if existing:
                return existing[0]["usrgrpid"]
            result = self.zapi.usergroup.create(name=name, gui_access=0, users_status=0)
            return result["usrgrpids"][0]
        except Exception:
            logger.exception("ZabbixSync._get_or_create_usergroup(%r) failed", name)
            return None

    def _get_or_create_hostgroup(self, name: str) -> str | None:
        """Return groupid for a Zabbix host group, creating it if absent."""
        try:
            existing = self.zapi.hostgroup.get(filter={"name": name}, output=["groupid"])
            if existing:
                return existing[0]["groupid"]
            result = self.zapi.hostgroup.create(name=name)
            return result["groupids"][0]
        except Exception:
            logger.exception("ZabbixSync._get_or_create_hostgroup(%r) failed", name)
            return None

    def _set_usergroup_permission(
        self, usrgrpid: str, host_groupid: str, perm: int = PERM_READ_WRITE
    ) -> None:
        """Give a user group read-write access to a host group.

        Sets the rights directly. permission must be an integer:
          2 = read, 3 = read-write (Zabbix rejects strings).
        """
        try:
            self.zapi.usergroup.update(
                usrgrpid=usrgrpid,
                **{self._rights_field: [{"permission": perm, "id": host_groupid}]},
            )
            logger.debug(
                "ZabbixSync: set permission=%d for usrgrp=%s on hostgroup=%s.",
                perm,
                usrgrpid,
                host_groupid,
            )
        except Exception:
            logger.exception("ZabbixSync._set_usergroup_permission failed")

    def _user_type(self, roles: list[str]) -> int:
        return max((ROLE_TO_TYPE.get(r, 1) for r in roles), default=1)
