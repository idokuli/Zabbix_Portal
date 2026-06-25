"""LDAP credential validation for portal login.

Config is stored in the portal DB (settings table, key = 'portal_ldap_config')
and managed via the portal UI — no .env variables needed.

Flow:
  1. Load config from DB.
  2. Bind as service account (or anonymously) to find the user's DN.
  3. Re-bind as the found DN with the supplied password.
  4. Return True/False on wrong password; raises RuntimeError on connection/config errors.
"""

import json
import logging

logger = logging.getLogger(__name__)

_SETTINGS_KEY = "portal_ldap_config"


def get_portal_ldap_config() -> dict | None:
    """Return the saved portal LDAP config dict, or None if not configured."""
    from Database import get_setting

    raw = get_setting(_SETTINGS_KEY)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception as exc:
        logger.error("Failed to parse portal LDAP config from DB: %r", exc)
        return None


def save_portal_ldap_config(config: dict) -> None:
    from Database import set_setting

    set_setting(_SETTINGS_KEY, json.dumps(config))


def test_portal_ldap_connection(config: dict) -> tuple[bool, str]:
    """Try to reach the LDAP server and perform a service-account bind.
    Returns (True, 'ok') on success or (False, reason) on failure.
    Times out after 5 s so a bad host doesn't hang the request.
    """
    try:
        import ldap3
    except ImportError:
        return False, "ldap3 is not installed on the backend"

    host = (config.get("host") or "").strip()
    if not host:
        return False, "LDAP host is required"

    port = int(config.get("port") or 389)
    use_ssl = bool(config.get("use_ssl"))
    bind_dn = (config.get("bind_dn") or "").strip()
    bind_password = config.get("bind_password") or ""

    try:
        server = ldap3.Server(
            host, port=port, use_ssl=use_ssl, get_info=ldap3.NONE, connect_timeout=5
        )
        conn = ldap3.Connection(
            server,
            user=bind_dn or None,
            password=bind_password or None,
            auto_bind=ldap3.AUTO_BIND_NONE,
            raise_exceptions=False,
        )
        if conn.bind():
            conn.unbind()
            return True, "ok"
        return False, conn.last_error or "bind rejected"
    except Exception as exc:
        return False, str(exc)


def is_ldap_enabled() -> bool:
    cfg = get_portal_ldap_config()
    return bool(cfg and cfg.get("enabled"))


class LdapUserNotFound(Exception):
    """Raised when the username doesn't exist in the LDAP directory at all."""


def _do_ldap_auth(cfg: dict, username: str, password: str) -> bool:
    """
    Core LDAP auth against a given config dict.
    Returns True on success, False on wrong password.
    Raises LdapUserNotFound if the user doesn't exist in the directory.
    Raises RuntimeError on connection/config errors.
    """
    try:
        import ldap3
        from ldap3.utils.conv import escape_filter_chars
    except ImportError:
        raise RuntimeError("ldap3 is not installed. Run: pip install ldap3")

    host = cfg.get("host", "").strip()
    base_dn = cfg.get("base_dn", "").strip()
    if not host or not base_dn:
        raise RuntimeError("LDAP host and base DN must be configured.")

    port = int(cfg.get("port") or 389)
    use_ssl = bool(cfg.get("use_ssl"))
    start_tls = bool(cfg.get("start_tls"))
    bind_dn = cfg.get("bind_dn", "").strip()
    bind_password = cfg.get("bind_password", "")
    search_attribute = (cfg.get("search_attribute") or "sAMAccountName").strip()
    search_filter_tpl = (cfg.get("search_filter") or "").strip()

    safe_user = escape_filter_chars(username.strip())
    if search_filter_tpl:
        search_filter = (
            search_filter_tpl.replace("%(attr)s", search_attribute)
            .replace("%(user)s", safe_user)
            .replace("%(attr)", search_attribute)
            .replace("%(user)", safe_user)
        )
    else:
        search_filter = f"({search_attribute}={safe_user})"
    logger.debug("LDAP search: base=%r filter=%r", base_dn, search_filter)

    try:
        server = ldap3.Server(
            host, port=port, use_ssl=use_ssl, get_info=ldap3.NONE, connect_timeout=10
        )

        service_conn = ldap3.Connection(
            server,
            user=bind_dn or None,
            password=bind_password or None,
            auto_bind=ldap3.AUTO_BIND_NONE,
            raise_exceptions=False,
        )
        if start_tls:
            service_conn.start_tls()
        if not service_conn.bind():
            err = service_conn.last_error or "unknown error"
            logger.error("LDAP service-account bind failed: %s", err)
            raise RuntimeError(f"LDAP service-account bind failed: {err}")

        service_conn.search(base_dn, search_filter, attributes=["dn"])
        if not service_conn.entries:
            logger.info("LDAP: user %r not found in directory", username)
            service_conn.unbind()
            raise LdapUserNotFound(username)

        user_dn = service_conn.entries[0].entry_dn
        service_conn.unbind()

        user_conn = ldap3.Connection(
            server,
            user=user_dn,
            password=password,
            auto_bind=ldap3.AUTO_BIND_NONE,
            raise_exceptions=False,
        )
        if user_conn.bind():
            user_conn.unbind()
            logger.info("LDAP: authentication succeeded for %r", username)
            return True

        logger.warning(
            "LDAP: wrong password for %r: %s", username, user_conn.last_error
        )
        return False

    except (LdapUserNotFound, RuntimeError):
        raise
    except Exception as exc:
        logger.error("LDAP: connection error for %r: %s", username, exc)
        raise RuntimeError(f"LDAP connection error: {exc}")


def authenticate_ldap(username: str, password: str) -> bool:
    """
    Validate username/password against the LDAP server stored in portal config.
    Returns True on success, False on wrong password.
    Raises LdapUserNotFound when the user isn't in the directory (caller may fall back to local auth).
    Raises RuntimeError on connection/config errors.
    """
    cfg = get_portal_ldap_config()
    if not cfg or not cfg.get("enabled"):
        raise RuntimeError("LDAP portal login is not enabled.")
    return _do_ldap_auth(cfg, username, password)
