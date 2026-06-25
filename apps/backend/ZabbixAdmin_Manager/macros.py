"""Zabbix global macros."""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class MacrosMixin:
    """Mixed into ZabbixAdmin_Manager. Assumes `self.zapi` from Zabbix_Base."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"

    def list_global_macros(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            macros = self.zapi.usermacro.get(
                output=["globalmacroid", "macro", "value", "type", "description"],
                globalmacro=True,
                sortfield="macro",
            )
            MACRO_TYPES = {0: "Text", 1: "Secret text", 2: "Vault secret"}
            return [
                {
                    "globalmacroid": m["globalmacroid"],
                    "macro": m["macro"],
                    "value": m["value"] if int(m.get("type", 0)) == 0 else "••••••",
                    "type": int(m.get("type", 0)),
                    "type_label": MACRO_TYPES.get(int(m.get("type", 0)), "Text"),
                    "description": m.get("description", ""),
                }
                for m in macros
            ]
        except Exception as e:
            logger.exception("list_global_macros failed")
            raise RuntimeError(str(e))

    def create_global_macro(
        self, macro: str, value: str, description: str = "", macro_type: int = 0
    ) -> str:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        if not macro.startswith("{$"):
            macro = "{$" + macro.strip("{$}") + "}"
        try:
            result = self.zapi.usermacro.createglobal(
                macro=macro, value=value, description=description, type=macro_type
            )
            return result["globalmacroids"][0]
        except Exception as e:
            raise RuntimeError(str(e))

    def update_global_macro(
        self, globalmacroid: str, value: str, description: str = ""
    ) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.usermacro.updateglobal(
                globalmacroid=globalmacroid, value=value, description=description
            )
            return True
        except Exception as e:
            raise RuntimeError(str(e))

    def delete_global_macro(self, globalmacroid: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.usermacro.deleteglobal([globalmacroid])
            return True
        except Exception as e:
            raise RuntimeError(str(e))
