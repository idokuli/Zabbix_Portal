"""Authentication settings, including the Zabbix 6.4+ LDAP userdirectory split.

Zabbix 6.4+ moved LDAP server details (host/port/base_dn/bind_dn/...) out of
authentication.update and into their own userdirectory object (idp_type=1 =
LDAP), and supports multiple LDAP servers at once — authentication.update
only keeps ldap_auth_enabled + ldap_userdirectoryid pointing at which
directory is the default for login. Pre-6.4 still takes the LDAP fields
inline on authentication.update and only ever supports a single server; that
path is intentionally not supported here.
"""

import logging
from typing import TYPE_CHECKING, Any

logger = logging.getLogger(__name__)

_LDAP_LIST_FIELDS = [
    "userdirectoryid",
    "name",
    "host",
    "port",
    "base_dn",
    "bind_dn",
    "search_attribute",
    "description",
    "provision_status",
]

_LDAP_FULL_FIELDS = [
    *_LDAP_LIST_FIELDS,
    "start_tls",
    "search_filter",
    "group_basedn",
    "group_name",
    "group_member",
    "group_filter",
    "group_membership",
    "user_username",
    "user_lastname",
    "user_ref_attr",
]

_ZABBIX_NOT_CONNECTED = "Zabbix not connected"


class AuthMixin:
    """Mixed into ZabbixAdmin_Manager. Assumes `self.zapi`/`self._zabbix_version` from Zabbix_Base."""

    if TYPE_CHECKING:
        zapi: Any
        _zabbix_version: tuple[int, int]

    def _require_ldap_multi_server(self) -> None:
        if not self.zapi:
            raise RuntimeError(_ZABBIX_NOT_CONNECTED)
        if self._zabbix_version < (6, 4):
            raise RuntimeError("LDAP server management requires Zabbix 6.4 or later.")

    def list_ldap_userdirectories(self) -> list[dict]:
        """All configured LDAP userdirectory entries, plus which one (if any) is the active default."""
        self._require_ldap_multi_server()
        try:
            directories = self.zapi.userdirectory.get(
                output=_LDAP_LIST_FIELDS,
                filter={"idp_type": 1},
                selectUsrgrps="count",
                sortfield="name",
            )
            default_id = self.zapi.authentication.get(output=["ldap_userdirectoryid"]).get(
                "ldap_userdirectoryid", "0"
            )
            for d in directories:
                d["is_default"] = d["userdirectoryid"] == default_id
                d["usrgrp_count"] = int(d.pop("usrgrps", 0) or 0)
            return directories
        except Exception as e:
            raise RuntimeError(str(e)) from e

    @staticmethod
    def _prep_provision_params(params: dict) -> dict:
        """Normalise provision_groups/provision_media for the Zabbix API and strip empty strings."""
        params = {k: v for k, v in params.items() if v != ""}
        # Zabbix expects user_groups as [{"usrgrpid": id}], not [id].
        if "provision_groups" in params:
            for g in params["provision_groups"]:
                if (
                    isinstance(g.get("user_groups"), list)
                    and g["user_groups"]
                    and isinstance(g["user_groups"][0], str)
                ):
                    g["user_groups"] = [{"usrgrpid": uid} for uid in g["user_groups"]]
        return params

    def get_ldap_userdirectory(self, userdirectoryid: str) -> dict:
        self._require_ldap_multi_server()
        try:
            directories = self.zapi.userdirectory.get(
                output=_LDAP_FULL_FIELDS,
                userdirectoryids=[userdirectoryid],
                selectProvisionGroups="extend",
                selectProvisionMedia="extend",
            )
            if not directories:
                raise RuntimeError("LDAP server not found.")
            d = directories[0]
            d["bind_password"] = ""
            # Normalise user_groups to flat id list for the frontend.
            for g in d.get("provision_groups") or []:
                g["user_groups"] = [ug["usrgrpid"] for ug in (g.get("user_groups") or [])]
            # Normalise int fields that Zabbix returns as strings.
            for m in d.get("provision_media") or []:
                for f in ("severity", "active"):
                    if f in m:
                        m[f] = int(m[f])
            return d
        except RuntimeError:
            raise
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def create_ldap_userdirectory(self, params: dict) -> str:
        self._require_ldap_multi_server()
        try:
            params = self._prep_provision_params(params)
            result = self.zapi.userdirectory.create(idp_type=1, **params)
            return result["userdirectoryids"][0]
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def update_ldap_userdirectory(self, userdirectoryid: str, params: dict) -> bool:
        self._require_ldap_multi_server()
        try:
            params = self._prep_provision_params(params)
            if not params.get("bind_password"):
                params.pop("bind_password", None)
            self.zapi.userdirectory.update(userdirectoryid=userdirectoryid, **params)
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def delete_ldap_userdirectory(self, userdirectoryid: str) -> bool:
        self._require_ldap_multi_server()
        try:
            self.zapi.userdirectory.delete([userdirectoryid])
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def set_default_ldap_userdirectory(self, userdirectoryid: str) -> bool:
        self._require_ldap_multi_server()
        try:
            self.zapi.authentication.update(ldap_userdirectoryid=userdirectoryid)
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def get_auth_settings(self) -> dict:
        if not self.zapi:
            raise RuntimeError(_ZABBIX_NOT_CONNECTED)
        try:
            return self.zapi.authentication.get(output="extend")
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def update_auth_settings(self, params: dict) -> bool:
        if not self.zapi:
            raise RuntimeError(_ZABBIX_NOT_CONNECTED)
        try:
            params = dict(params)
            # ldap_configured was the pre-6.4 name for the same on/off flag.
            if "ldap_configured" in params:
                params["ldap_auth_enabled"] = params.pop("ldap_configured")
            self.zapi.authentication.update(**params)
            return True
        except Exception as e:
            raise RuntimeError(str(e)) from e

    def test_ldap_connection(self, params: dict, test_username: str, test_password: str) -> dict:
        """Validate LDAP bind/search settings via userdirectory.test (Super Admin only, Zabbix 6.4+).

        bind_password is write-only in the Zabbix API, so the New/Edit server
        dialog can't show a previously-saved password. If the caller supplied
        a userdirectoryid and left bind_password blank, reuse the saved
        directory's credentials by id instead of sending an empty password.
        """
        if not self.zapi:
            raise RuntimeError(_ZABBIX_NOT_CONNECTED)
        if self._zabbix_version < (6, 4):
            raise RuntimeError("LDAP connection testing requires Zabbix 6.4 or later.")
        try:
            # Strip empty strings — Zabbix rejects "" for optional fields; absent is correct.
            payload = {k: v for k, v in params.items() if v != ""}
            userdirectoryid = payload.pop("userdirectoryid", None)
            if not payload.get("bind_password") and userdirectoryid:
                payload = {"userdirectoryid": userdirectoryid}
            payload["test_username"] = test_username
            payload["test_password"] = test_password
            logger.debug(
                "userdirectory.test payload: %r",
                {k: ("***" if "password" in k else v) for k, v in payload.items()},
            )
            return self.zapi.userdirectory.test(**payload)
        except Exception as e:
            logger.exception("userdirectory.test failed")
            raise RuntimeError(str(e)) from e
