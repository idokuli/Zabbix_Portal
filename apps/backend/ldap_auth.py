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
    except Exception:
        logger.exception("Failed to parse portal LDAP config from DB")
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


class LdapUserNotFoundError(Exception):
    """Raised when the username doesn't exist in the LDAP directory at all."""


def _build_ldap_search_filter(search_attribute: str, search_filter_tpl: str, safe_user: str) -> str:
    if not search_filter_tpl:
        return f"({search_attribute}={safe_user})"
    return (
        search_filter_tpl.replace("%(attr)s", search_attribute)
        .replace("%(user)s", safe_user)
        .replace("%(attr)", search_attribute)
        .replace("%(user)", safe_user)
    )


def _find_ldap_user(
    server,
    bind_dn: str,
    bind_password: str,
    start_tls: bool,
    base_dn: str,
    search_filter: str,
    username: str,
) -> tuple[str, str]:
    """Service-account bind + directory search for the user's DN and display name.
    Returns (user_dn, display_name). Raises LdapUserNotFoundError / RuntimeError."""
    import ldap3

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

    service_conn.search(base_dn, search_filter, attributes=["dn", "displayName", "cn"])
    if not service_conn.entries:
        logger.info("LDAP: user %r not found in directory", username)
        service_conn.unbind()
        raise LdapUserNotFoundError(username)

    entry = service_conn.entries[0]
    user_dn = entry.entry_dn

    def _attr(name: str) -> str:
        try:
            v = entry[name].value
            return str(v).strip() if v else ""
        except Exception:
            return ""

    display_name = _attr("displayName") or _attr("cn")
    service_conn.unbind()
    return user_dn, display_name


def _verify_ldap_password(server, user_dn: str, password: str, username: str) -> bool:
    import ldap3

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

    logger.warning("LDAP: wrong password for %r: %s", username, user_conn.last_error)
    return False


def _do_ldap_auth(cfg: dict, username: str, password: str) -> tuple[bool, str]:
    """
    Core LDAP auth against a given config dict.
    Returns (True, display_name) on success, (False, "") on wrong password.
    display_name is pulled from AD displayName → cn → falls back to "".
    Raises LdapUserNotFoundError if the user doesn't exist in the directory.
    Raises RuntimeError on connection/config errors.
    """
    try:
        import ldap3
        from ldap3.utils.conv import escape_filter_chars
    except ImportError as exc:
        raise RuntimeError("ldap3 is not installed. Run: pip install ldap3") from exc

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
    search_filter = _build_ldap_search_filter(search_attribute, search_filter_tpl, safe_user)
    logger.debug("LDAP search: base=%r filter=%r", base_dn, search_filter)

    try:
        server = ldap3.Server(
            host, port=port, use_ssl=use_ssl, get_info=ldap3.NONE, connect_timeout=10
        )
        user_dn, display_name = _find_ldap_user(
            server, bind_dn, bind_password, start_tls, base_dn, search_filter, username
        )
        if _verify_ldap_password(server, user_dn, password, username):
            return True, display_name
        return False, ""
    except (LdapUserNotFoundError, RuntimeError):
        raise
    except Exception as exc:
        logger.exception("LDAP: connection error for %r", username)
        raise RuntimeError(f"LDAP connection error: {exc}") from exc


def authenticate_ldap(username: str, password: str) -> tuple[bool, str]:
    """
    Validate username/password against the LDAP server stored in portal config.
    Returns (True, display_name) on success, (False, "") on wrong password.
    Raises LdapUserNotFoundError when the user isn't in the directory (caller may fall back to local auth).
    Raises RuntimeError on connection/config errors.
    """
    cfg = get_portal_ldap_config()
    if not cfg or not cfg.get("enabled"):
        raise RuntimeError("LDAP portal login is not enabled.")
    return _do_ldap_auth(cfg, username, password)
