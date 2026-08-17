import logging
import os
import re
import threading
import time
from pathlib import Path
from typing import Any
from collections.abc import Callable

import requests
from dotenv import load_dotenv
from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)

_ZBX_WRAPPER = re.compile(
    r"^(?:APIRequestError|ProcessingError|ZabbixAPIException)\('?(.+?)'?\)$",
    re.DOTALL,
)
_INVALID_PARAMS = re.compile(r"^Invalid params\.\s*")


def zabbix_err(e: Exception) -> str:
    """Return a clean, user-facing message from a Zabbix (or any) exception."""
    msg = str(e).strip()
    m = _ZBX_WRAPPER.match(msg)
    if m:
        msg = m.group(1).strip()
    return _INVALID_PARAMS.sub("", msg).strip() or str(e)


class ZabbixBase:
    def __init__(self) -> None:
        self._cache: dict[str, tuple[float, Any]] = {}
        self._cache_lock = threading.Lock()
        dotenv_path = Path(__file__).resolve().parent / ".env"
        load_dotenv(dotenv_path=dotenv_path, override=False)

        url = os.getenv("ZABBIX_URL")
        user = os.getenv("ZABBIX_USER")
        password = os.getenv("ZABBIX_PASS")

        # Accept either a base Zabbix URL or the full JSON-RPC endpoint.
        # If a bare base URL is given, detect the web server to pick the right path.
        self._ssl_verify = os.getenv("ZABBIX_SSL_VERIFY", "true").lower() != "false"
        if url and not url.rstrip("/").endswith("api_jsonrpc.php"):
            url = self._resolve_api_url(url)

        self._zabbix_version: tuple[int, int] = (5, 4)  # fallback; updated after login
        try:
            # zabbix_utils performs login during construction when creds are provided.
            self.zapi = ZabbixAPI(url=url, user=user, password=password, skip_version_check=True)
            logger.info("Successfully connected to Zabbix API.")
            # Detect server version so callers can choose the right API syntax
            try:
                ver = str(self.zapi.apiinfo.version())
                parts = [int(x) for x in ver.split(".")[:2]]
                self._zabbix_version = (parts[0], parts[1])
                logger.info("Zabbix API version: %s (parsed %s)", ver, self._zabbix_version)
            except Exception as ve:
                logger.warning("Could not detect Zabbix version: %r — defaulting to 5.4 syntax", ve)
        except Exception:
            logger.exception("Zabbix connection failed")
            self.zapi = None

    def _resolve_api_url(self, base_url: str) -> str:
        """Probe both known Zabbix API paths and return whichever responds.

        Tries /api_jsonrpc.php first (nginx default), then /zabbix/api_jsonrpc.php
        (Apache default). Falls back to the nginx path if both fail.
        """
        clean = base_url.rstrip("/")
        candidates = [
            f"{clean}/api_jsonrpc.php",
            f"{clean}/zabbix/api_jsonrpc.php",
        ]
        payload: dict[str, Any] = {
            "jsonrpc": "2.0",
            "method": "apiinfo.version",
            "params": [],
            "id": 1,
        }
        for api_url in candidates:
            try:
                resp = requests.post(api_url, json=payload, timeout=5, verify=self._ssl_verify)
                if resp.status_code == 200 and "jsonrpc" in resp.text:
                    logger.info("Zabbix API found at: %s", api_url)
                    return api_url
            except Exception as exc:
                logger.debug("Zabbix API probe failed for %s: %s", api_url, exc)
                continue
        logger.warning("Could not probe Zabbix API — falling back to %s", candidates[0])
        return candidates[0]

    def _cached(self, key: str, ttl: float, fn: Callable[[], Any]) -> Any:
        """Return cached value if still within TTL, otherwise call fn() and store."""
        with self._cache_lock:
            entry = self._cache.get(key)
            if entry is not None and time.monotonic() - entry[0] < ttl:
                return entry[1]
        result = fn()
        with self._cache_lock:
            self._cache[key] = (time.monotonic(), result)
        return result

    def _invalidate(self, key: str) -> None:
        with self._cache_lock:
            self._cache.pop(key, None)

    def close(self) -> None:
        """Cleanly logout from Zabbix. Call this explicitly on shutdown."""
        if hasattr(self, "zapi") and self.zapi:
            try:
                self.zapi.logout()
                logger.info("Zabbix session closed.")
            except Exception as exc:
                logger.debug("Zabbix logout failed during close: %s", exc)
            self.zapi = None
