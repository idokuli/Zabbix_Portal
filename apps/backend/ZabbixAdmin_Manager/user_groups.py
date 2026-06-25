"""Zabbix user groups and the read-only Zabbix user list."""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)

GUI_ACCESS = {0: "Default", 1: "Internal", 2: "LDAP", 3: "Disabled"}
USERS_STATUS = {0: "Enabled", 1: "Disabled"}


class UserGroupsMixin:
    """Mixed into ZabbixAdmin_Manager. Assumes `self.zapi` from Zabbix_Base."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"

    def list_user_groups(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            groups = self.zapi.usergroup.get(
                output=["usrgrpid", "name", "gui_access", "users_status"],
                selectUsers=["userid", "username"],
                sortfield="name",
            )
            return [
                {
                    "usrgrpid": g["usrgrpid"],
                    "name": g["name"],
                    "gui_access": int(g["gui_access"]),
                    "gui_access_label": GUI_ACCESS.get(int(g["gui_access"]), "Default"),
                    "users_status": int(g["users_status"]),
                    "users_status_label": USERS_STATUS.get(
                        int(g["users_status"]), "Enabled"
                    ),
                    "user_count": len(g.get("users", [])),
                    "users": g.get("users", []),
                }
                for g in groups
            ]
        except Exception as e:
            logger.exception("list_user_groups failed")
            raise RuntimeError(str(e))

    def list_zabbix_users(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            users = self.zapi.user.get(
                output=["userid", "username", "name", "surname"],
                sortfield="username",
            )
            return [
                {
                    "userid": u["userid"],
                    "username": u["username"],
                    "display": f"{u.get('name', '')} {u.get('surname', '')}".strip()
                    or u["username"],
                }
                for u in users
            ]
        except Exception as e:
            logger.error("list_zabbix_users failed: %r", e)
            return []

    def create_user_group(
        self,
        name: str,
        gui_access: int = 0,
        users_status: int = 0,
        debug_mode: int = 0,
        userids: list[str] | None = None,
        hostgroup_rights: list[dict] | None = None,
        templategroup_rights: list[dict] | None = None,
        tag_filters: list[dict] | None = None,
    ) -> str:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            params: dict = {
                "name": name,
                "gui_access": gui_access,
                "users_status": users_status,
                "debug_mode": debug_mode,
            }
            if userids:
                params["userids"] = userids
            if hostgroup_rights:
                params["hostgroup_rights"] = [
                    {"id": r["id"], "permission": r["permission"]}
                    for r in hostgroup_rights
                    if r.get("id")
                ]
            if templategroup_rights:
                params["templategroup_rights"] = [
                    {"id": r["id"], "permission": r["permission"]}
                    for r in templategroup_rights
                    if r.get("id")
                ]
            if tag_filters:
                params["tag_filters"] = [
                    {
                        "groupid": f["groupid"],
                        "tag": f.get("tag", ""),
                        "value": f.get("value", ""),
                    }
                    for f in tag_filters
                    if f.get("groupid")
                ]
            result = self.zapi.usergroup.create(**params)
            return result["usrgrpids"][0]
        except Exception as e:
            raise RuntimeError(str(e))

    def delete_user_group(self, usrgrpid: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.usergroup.delete([usrgrpid])
            return True
        except Exception as e:
            raise RuntimeError(str(e))
