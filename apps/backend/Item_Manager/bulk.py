"""Bulk item creation across multiple hosts — dispatches to the per-type add_* methods."""

import logging
from typing import TYPE_CHECKING
from collections.abc import Callable
from api.schemas.items import HttpItemRequest, ItemRequest, ScriptItemRequest, ServiceItemRequest

logger = logging.getLogger(__name__)

_AddResult = Callable[..., tuple[str | None, str | None]]


class BulkItemsMixin:
    """Mixed into ItemManager. Calls self.add_script_item/add_http_item/add_service_item/add_item,
    which live in other mixins — resolved via the final class's MRO at runtime.
    """

    if TYPE_CHECKING:
        add_script_item: _AddResult
        add_http_item: _AddResult
        add_service_item: _AddResult
        add_item: _AddResult

    def bulk_add_items(self, hostnames: list[str], item_config: dict) -> list[dict]:
        """Add the same item to multiple hosts. Returns [{hostname, item_id, error}]."""
        item_type = item_config.get("item_type", "agent")
        results = []
        for hostname in hostnames:
            common = dict(
                delay=item_config.get("delay", "1m"),
                units=item_config.get("units", ""),
                history=item_config.get("history", "31d"),
                trends=item_config.get("trends", "0d" if item_type == "http" else "365d"),
                description=item_config.get("description", ""),
            )
            if item_type == "script":
                script_request = ScriptItemRequest(
                    hostname=hostname,
                    script_type=item_config.get("script_type", "bash"),
                    script_mode=item_config.get("script_mode", "command"),
                    script=item_config.get("script", ""),
                    file_arg=item_config.get("file_arg", ""),
                    item_name=item_config.get("item_name", ""),
                    value_type=item_config.get("value_type", 1),
                    **common,
                )
                item_id, err = self.add_script_item(
                    script_request, item_config.get("team_name", "")
                )
            elif item_type == "http":
                http_request = HttpItemRequest(
                    hostname=hostname,
                    item_name=item_config.get("item_name", ""),
                    url=item_config.get("url", ""),
                    item_key=item_config.get("item_key", ""),
                    request_method=item_config.get("request_method", 0),
                    status_codes=item_config.get("status_codes", "200"),
                    timeout=item_config.get("timeout", "15s"),
                    verify_peer=item_config.get("verify_peer", True),
                    follow_redirects=item_config.get("follow_redirects", True),
                    posts=item_config.get("posts", ""),
                    value_type=item_config.get("value_type", 4),
                    authtype=item_config.get("authtype", 0),
                    username=item_config.get("username", ""),
                    password=item_config.get("password", ""),
                    regex_preprocessing=item_config.get("regex_preprocessing", False),
                    regex_pattern=item_config.get("regex_pattern", ""),
                    regex_output=item_config.get("regex_output", "\\1"),
                    regex_no_match_value=item_config.get("regex_no_match_value", "0"),
                    **common,
                )
                item_id, err = self.add_http_item(http_request, item_config.get("team_name", ""))
            elif item_type == "service":
                service_request = ServiceItemRequest(
                    hostname=hostname,
                    service_type=item_config.get("service_type", ""),
                    port=item_config.get("port"),
                    item_name=item_config.get("item_name", ""),
                    **{k: v for k, v in common.items() if k != "units"},
                )
                item_id, err = self.add_service_item(
                    service_request, item_config.get("team_name", "")
                )
            else:
                item_request = ItemRequest(
                    hostname=hostname,
                    item_name=item_config.get("item_name", ""),
                    item_key=item_config.get("item_key", ""),
                    value_type=item_config.get("value_type", 3),
                    **common,
                )
                item_id, err = self.add_item(item_request, item_config.get("team_name", ""))
            results.append({"hostname": hostname, "item_id": item_id, "error": err})

        ok = sum(1 for r in results if not r["error"])
        logger.info("bulk_add_items: %d/%d succeeded (type=%s).", ok, len(hostnames), item_type)
        return results
