"""Zabbix user roles (Zabbix 5.2+ role objects)."""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class RolesMixin:
    """Mixed into ZabbixAdmin_Manager. Assumes `self.zapi` from Zabbix_Base."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"

    def list_roles(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            roles = self.zapi.role.get(
                output=["roleid", "name", "type", "readonly"],
                selectRules="extend",
                sortfield="name",
            )
            USER_TYPES = {1: "User", 2: "Admin", 3: "Super admin"}
            return [
                {
                    "roleid": r["roleid"],
                    "name": r["name"],
                    "type": int(r["type"]),
                    "type_label": USER_TYPES.get(int(r["type"]), "User"),
                    "readonly": int(r.get("readonly", 0)),
                    "rule_count": len(r.get("rules", []))
                    if isinstance(r.get("rules"), list)
                    else 0,
                }
                for r in roles
            ]
        except Exception as e:
            logger.exception("list_roles failed")
            raise RuntimeError(str(e))

    def create_role(
        self,
        name: str,
        role_type: int = 1,
        ui_access: dict[str, bool] | None = None,
        ui_default_access: int = 1,
        services_read_mode: int = 0,
        services_write_mode: int = 0,
        modules_default_access: int = 1,
        api_access: int = 1,
    ) -> str:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            params: dict = {"name": name, "type": role_type}
            rules: dict = {
                "ui.default_access": str(ui_default_access),
                "services.read.mode": str(services_read_mode),
                "services.write.mode": str(services_write_mode),
                "modules.default_access": str(modules_default_access),
                "api.access": str(api_access),
                "api.mode": "0",
            }
            if ui_access is not None:
                rules["ui"] = [
                    {"name": element, "status": "1" if enabled else "0"}
                    for element, enabled in ui_access.items()
                ]
            params["rules"] = rules
            result = self.zapi.role.create(**params)
            return result["roleids"][0]
        except Exception as e:
            raise RuntimeError(str(e))

    def update_role(self, roleid: str, name: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.role.update(roleid=roleid, name=name)
            return True
        except Exception as e:
            raise RuntimeError(str(e))

    def delete_role(self, roleid: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.role.delete([roleid])
            return True
        except Exception as e:
            raise RuntimeError(str(e))
