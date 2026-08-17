"""File-watch agent items (vfs.file.* keys) and system.run[] script items."""

import logging
from typing import TYPE_CHECKING
from collections.abc import Callable
from api.schemas.items import ItemRequest, ScriptItemRequest

if TYPE_CHECKING:
    from zabbix_utils import ZabbixAPI

logger = logging.getLogger(__name__)


class FileScriptItemsMixin:
    """Mixed into ItemManager. Calls self.add_item, which lives in CoreItemsMixin
    — resolved via the final class's MRO at runtime.
    """

    if TYPE_CHECKING:
        zapi: "ZabbixAPI | None"
        add_item: Callable[..., tuple[str | None, str | None]]

    # (check_type → item_key_template, default_name, value_type)
    _FILE_WATCH_CHECKS: dict[str, tuple[str, str, int]] = {
        "checksum": ("vfs.file.md5sum[{path}]", "MD5 checksum", 1),  # string
        "mtime": (
            "vfs.file.time[{path},modify]",
            "Modification time",
            3,
        ),  # integer unix ts
        "size": ("vfs.file.size[{path}]", "File size", 3),  # integer bytes
        "exists": ("vfs.file.exists[{path}]", "File exists", 3),  # integer 0/1
    }

    # Bash / PowerShell commands that return the name of the most recently modified file in a folder.
    _FOLDER_LATEST_CMD = {
        "linux": "find {path} -maxdepth 1 -type f -printf '%T@ %f\\n' 2>/dev/null | sort -n | tail -1 | awk '{{print $2}}'",
        "windows": "powershell -Command \"Get-ChildItem '{path}' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty Name\"",
    }

    def add_file_watch_item(
        self,
        hostname: str,
        file_path: str,
        check_type: str = "checksum",  # checksum | mtime | size | exists | folder_latest
        item_name: str = "",
        team_name: str = "",
        folder_os: str = "linux",  # linux | windows  (only used for folder_latest)
        delay: str = "1m",
        history: str = "31d",
        trends: str = "365d",
        description: str = "",
    ) -> tuple[str | None, str | None]:
        """Add an agent item that monitors a file property.
        folder_latest uses system.run and requires EnableRemoteCommands=1.
        All other types use standard vfs.file.* keys.
        """
        if check_type == "folder_latest":
            os_key = folder_os if folder_os in self._FOLDER_LATEST_CMD else "linux"
            cmd = self._FOLDER_LATEST_CMD[os_key].replace("{path}", file_path)
            item_key = f"system.run[{cmd}]"
            if not item_name:
                item_name = f"Latest modified file in {file_path} on {hostname}"
            return self.add_item(
                ItemRequest(
                    hostname=hostname,
                    item_name=item_name,
                    item_key=item_key,
                    value_type=1,
                    delay=delay,
                    history=history,
                    trends=trends,
                    description=description,
                ),
                team_name,
            )

        if check_type not in self._FILE_WATCH_CHECKS:
            return None, f"Invalid check_type '{check_type}'."
        key_tpl, default_label, value_type = self._FILE_WATCH_CHECKS[check_type]
        item_key = key_tpl.replace("{path}", file_path)
        if not item_name:
            item_name = f"{default_label} — {file_path} on {hostname}"
        return self.add_item(
            ItemRequest(
                hostname=hostname,
                item_name=item_name,
                item_key=item_key,
                value_type=value_type,
                delay=delay,
                history=history,
                trends=trends,
                description=description,
            ),
            team_name,
        )

    def add_script_item(
        self, request: ScriptItemRequest, team_name: str = ""
    ) -> tuple[str | None, str | None]:
        """Add an agent item that runs a bash or PowerShell script via system.run[].
        Requires EnableRemoteCommands=1 in the Zabbix agent config on the target host.
        """
        hostname = request.hostname
        script_type = request.script_type
        script_mode = request.script_mode
        script = request.script
        file_arg = request.file_arg
        item_name = request.item_name
        value_type = request.value_type
        delay = request.delay
        units = request.units
        history = request.history
        trends = request.trends
        description = request.description
        status = request.status
        timeout = request.timeout

        if not self.zapi:
            return None, "Zabbix API not connected."
        if script_mode not in ("command", "file"):
            return None, f"Invalid script_mode '{script_mode}'."
        if script_type not in ("bash", "powershell"):
            return None, f"Invalid script_type '{script_type}'."
        if not script.strip():
            return None, "Script content or path must not be empty."

        if script_mode == "file":
            if script_type == "bash":
                cmd = f"bash {script.strip()}"
            else:
                cmd = f"powershell.exe -File {script.strip()}"
            if file_arg.strip():
                cmd += f" {file_arg.strip()}"
        else:
            cmd = script.strip()

        item_key = f"system.run[{cmd}]"

        if not item_name:
            mode_label = "file" if script_mode == "file" else "cmd"
            item_name = f"{script_type} {mode_label} check on {hostname}"

        return self.add_item(
            ItemRequest(
                hostname=hostname,
                item_name=item_name,
                item_key=item_key,
                value_type=value_type,
                delay=delay,
                units=units,
                history=history,
                trends=trends,
                description=description,
                status=status,
                timeout=timeout,
                create_trigger=request.create_trigger,
                trigger_operator=request.trigger_operator,
                trigger_threshold=request.trigger_threshold,
                trigger_pattern=request.trigger_pattern,
                trigger_match_type=request.trigger_match_type,
                trigger_priority=request.trigger_priority,
            ),
            team_name,
        )
