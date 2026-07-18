import logging

from Zabbix_Base import Zabbix_Base

logger = logging.getLogger(__name__)

EVENTSOURCE_LABELS = {
    0: "Trigger",
    1: "Discovery",
    2: "Autoregistration",
    3: "Internal",
    4: "Service",
}
MEDIATYPE_TYPES = {
    0: "Email",
    1: "SMS",
    2: "Script",
    4: "Webhook",
    5: "Teams",
    6: "Slack",
}
SCRIPT_EXECUTE_ON = {0: "Agent", 1: "Server", 2: "Proxy or server"}
SCRIPT_SCOPE = {1: "Action operation", 2: "Manual host", 4: "Manual event"}


class Actions_Manager(Zabbix_Base):
    def __init__(self):
        super().__init__()
        logger.info("Actions Manager ready.")

    # ── Actions ────────────────────────────────────────────────────────

    def list_actions(self, eventsource: int | None = None) -> list[dict]:
        if not self.zapi:
            return []
        try:
            params: dict = dict(
                output=["actionid", "name", "eventsource", "status", "esc_period"],
                selectFilter="count",
                selectOperations="count",
                selectRecoveryOperations="count",
                sortfield="name",
            )
            if eventsource is not None:
                params["filter"] = {"eventsource": eventsource}
            actions = self.zapi.action.get(**params)
            return [
                {
                    "actionid": a["actionid"],
                    "name": a["name"],
                    "eventsource": int(a["eventsource"]),
                    "eventsource_label": EVENTSOURCE_LABELS.get(
                        int(a["eventsource"]), str(a["eventsource"])
                    ),
                    "status": int(a["status"]),
                    "esc_period": a.get("esc_period", "1h"),
                    "condition_count": (
                        int(a["filter"])
                        if isinstance(a.get("filter"), (int, str))
                        else len(a["filter"])
                        if isinstance(a.get("filter"), list)
                        else len(a.get("filter", {}).get("conditions", []))
                    ),
                    "operation_count": int(a["operations"])
                    if isinstance(a.get("operations"), (int, str))
                    else len(a.get("operations", [])),
                }
                for a in actions
            ]
        except Exception as e:
            logger.exception("list_actions failed")
            raise RuntimeError(str(e)) from e

    def create_action(self, name: str, eventsource: int, esc_period: str = "1h") -> str:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            result = self.zapi.action.create(
                name=name,
                eventsource=eventsource,
                status=0,
                esc_period=esc_period,
                filter={"evaltype": 0, "conditions": []},
                operations=[],
            )
            return result["actionids"][0]
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def delete_action(self, actionid: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.action.delete([actionid])
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def toggle_action(self, actionid: str, status: int) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.action.update(actionid=actionid, status=status)
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e

    # ── Media Types ────────────────────────────────────────────────────

    def list_media_types(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            mts = self.zapi.mediatype.get(
                output=["mediatypeid", "name", "type", "status", "description"],
            )
            return sorted(
                [
                    {
                        "mediatypeid": m["mediatypeid"],
                        "name": m["name"],
                        "type": int(m["type"]),
                        "type_label": MEDIATYPE_TYPES.get(int(m["type"]), f"Type {m['type']}"),
                        "status": int(m["status"]),
                        "description": m.get("description", ""),
                    }
                    for m in mts
                ],
                key=lambda x: x["name"].lower(),
            )
        except Exception as e:
            logger.exception("list_media_types failed")
            raise RuntimeError(str(e)) from e

    def create_media_type(
        self,
        name: str,
        mtype: int,
        description: str = "",
        smtp_server: str = "",
        smtp_helo: str = "",
        smtp_email: str = "",
        script: str = "",
        webhook_script: str = "",
    ) -> str:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            params: dict = {
                "name": name,
                "type": mtype,
                "status": 0,
                "description": description,
            }
            if mtype == 0:  # email
                params.update(
                    {
                        "smtp_server": smtp_server or "localhost",
                        "smtp_helo": smtp_helo or "localhost",
                        "smtp_email": smtp_email or "zabbix@localhost",
                    }
                )
            elif mtype == 2:  # script
                params["exec_path"] = script
            elif mtype == 4:  # webhook
                params["script"] = webhook_script
            result = self.zapi.mediatype.create(**params)
            return result["mediatypeids"][0]
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def update_media_type(
        self,
        mediatypeid: str,
        name: str,
        mtype: int,
        description: str = "",
        smtp_server: str = "",
        smtp_email: str = "",
        script: str = "",
        webhook_script: str = "",
    ) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            params: dict = {
                "mediatypeid": mediatypeid,
                "name": name,
                "type": mtype,
                "description": description,
            }
            if mtype == 0:
                params.update(
                    {
                        "smtp_server": smtp_server or "localhost",
                        "smtp_email": smtp_email or "zabbix@localhost",
                    }
                )
            elif mtype == 2:
                params["exec_path"] = script
            elif mtype == 4:
                params["script"] = webhook_script
            self.zapi.mediatype.update(**params)
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def delete_media_type(self, mediatypeid: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.mediatype.delete([mediatypeid])
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def toggle_media_type(self, mediatypeid: str, status: int) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.mediatype.update(mediatypeid=mediatypeid, status=status)
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e

    # ── Scripts ────────────────────────────────────────────────────────

    def list_scripts(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            scripts = self.zapi.script.get(
                output=[
                    "scriptid",
                    "name",
                    "command",
                    "execute_on",
                    "scope",
                    "description",
                    "groupid",
                ],
                sortfield="name",
            )
            return [
                {
                    "scriptid": s["scriptid"],
                    "name": s["name"],
                    "command": s.get("command", ""),
                    "execute_on": int(s.get("execute_on", 1)),
                    "execute_on_label": SCRIPT_EXECUTE_ON.get(
                        int(s.get("execute_on", 1)), "Server"
                    ),
                    "scope": int(s.get("scope", 2)),
                    "scope_label": SCRIPT_SCOPE.get(int(s.get("scope", 2)), "Manual host"),
                    "description": s.get("description", ""),
                    "groupid": s.get("groupid", "0"),
                }
                for s in scripts
            ]
        except Exception as e:
            logger.exception("list_scripts failed")
            raise RuntimeError(str(e)) from e

    def create_script(
        self,
        name: str,
        command: str,
        execute_on: int = 1,
        scope: int = 2,
        description: str = "",
    ) -> str:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            result = self.zapi.script.create(
                name=name,
                command=command,
                execute_on=execute_on,
                scope=scope,
                description=description,
            )
            return result["scriptids"][0]
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def delete_script(self, scriptid: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.script.delete([scriptid])
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e
