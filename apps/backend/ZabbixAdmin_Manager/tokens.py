"""Zabbix API tokens (per-user, used for scripted/automation access)."""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class TokensMixin:
    """Mixed into ZabbixAdminManager. Assumes `self.zapi` from ZabbixBase."""

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"

    def list_api_tokens(self) -> list[dict]:
        if not self.zapi:
            return []
        try:
            tokens = self.zapi.token.get(
                output=[
                    "tokenid",
                    "name",
                    "userid",
                    "status",
                    "expires_at",
                    "created_at",
                    "lastaccess",
                ],
                sortfield="name",
            )
            # Build userid → username map for display
            try:
                uids = list({t["userid"] for t in tokens})
                users = (
                    self.zapi.user.get(output=["userid", "username"], userids=uids) if uids else []
                )
                uid_map = {u["userid"]: u.get("username", "") for u in users}
            except Exception:
                uid_map = {}
            return [
                {
                    "tokenid": t["tokenid"],
                    "name": t["name"],
                    "userid": t["userid"],
                    "username": uid_map.get(t["userid"], t["userid"]),
                    "status": int(t["status"]),
                    "expires_at": int(t.get("expires_at", 0)),
                    "created_at": int(t.get("created_at", 0)),
                    "lastaccess": int(t.get("lastaccess", 0)),
                }
                for t in tokens
            ]
        except Exception as e:
            logger.warning("list_api_tokens failed (may need Super Admin rights): %s", e)
            return []

    def create_api_token(
        self, name: str, userid: str, expires_at: int = 0
    ) -> tuple[str, str | None]:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            params: dict = {"name": name, "userid": userid, "status": 0}
            if expires_at:
                params["expires_at"] = expires_at
            result = self.zapi.token.create(**params)
            tokenid = result["tokenids"][0]
            gen = self.zapi.token.generate([tokenid])
            token_value = gen[0]["token"] if gen else None
            return tokenid, token_value
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def delete_api_token(self, tokenid: str) -> bool:
        if not self.zapi:
            raise RuntimeError("Zabbix not connected")
        try:
            self.zapi.token.delete([tokenid])
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e
