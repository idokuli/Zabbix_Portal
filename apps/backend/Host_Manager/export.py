"""Host inventory export — Excel/CSV byte generation, shared by the file-path and bytes APIs."""

import csv
import io
import logging
from io import BytesIO

import openpyxl

logger = logging.getLogger(__name__)


class HostExportMixin:
    """Mixed into Host_Manager. Assumes `self.zapi` from Zabbix_Base."""

    _AVAIL_LABEL = {"0": "Unknown", "1": "Available", "2": "Unavailable"}
    _EXPORT_HEADERS = [
        "Host ID",
        "Technical Name",
        "Visible Name",
        "Status",
        "Availability",
        "IP Address",
        "Port",
        "Proxy",
        "Host Groups",
        "Templates",
        "Description",
    ]

    def _build_proxy_map(self) -> dict[str, str]:
        """Returns {proxyid: proxy_name}. Tries the 6.0+ 'name' field, falls back to 'host'."""
        try:
            proxies = self.zapi.proxy.get(output=["proxyid", "name", "host"])  # type: ignore[union-attr,attr-defined]
            return {
                p["proxyid"]: (p.get("name") or p.get("host") or "") for p in proxies
            }
        except Exception:
            return {}

    def _fetch_export_rows(
        self, hostname_filter: set[str] | None = None
    ) -> list[list[str]]:
        """Returns a list of rows (each a list of str) for the host export."""
        hosts = self.zapi.host.get(  # type: ignore[union-attr,attr-defined]
            output=[
                "hostid",
                "host",
                "name",
                "status",
                "description",
                "proxyid",
                "proxy_hostid",
            ],
            selectInterfaces=["ip", "port", "available", "type"],
            selectGroups=["name"],
            selectParentTemplates=["name"],
        )
        if hostname_filter is not None:
            hosts = [h for h in hosts if h["host"] in hostname_filter]

        proxy_map = self._build_proxy_map()

        rows: list[list[str]] = []
        for h in hosts:
            interfaces = h.get("interfaces") or []
            primary = next(
                (i for i in interfaces if str(i.get("type")) == "1"), None
            ) or (interfaces[0] if interfaces else None)
            ip = primary["ip"] if primary else "N/A"
            port = primary["port"] if primary else "N/A"
            avail = (
                self._AVAIL_LABEL.get(str(primary.get("available", "0")), "Unknown")
                if primary
                else "Unknown"
            )
            status = "Enabled" if h["status"] == "0" else "Disabled"
            # proxyid is used in Zabbix 6.0+; proxy_hostid in older versions
            pid = h.get("proxyid") or h.get("proxy_hostid") or "0"
            proxy = proxy_map.get(pid, "") if pid and pid != "0" else "—"
            groups = ", ".join(g["name"] for g in (h.get("groups") or []))
            templates = ", ".join(t["name"] for t in (h.get("parentTemplates") or []))
            description = (h.get("description") or "").strip()
            rows.append(
                [
                    h["hostid"],
                    h["host"],
                    h["name"],
                    status,
                    avail,
                    ip,
                    port,
                    proxy,
                    groups,
                    templates,
                    description,
                ]
            )
        return rows

    def export_hosts_to_excel(self, file_path="zabbix_inventory.xlsx"):
        """Fetches all hosts and writes them to an Excel (.xlsx) file."""
        if not self.zapi:  # type: ignore[attr-defined]
            logger.error("export_hosts_to_excel: no Zabbix API connection.")
            return None

        try:
            excel_bytes = self.export_hosts_to_excel_bytes()
            if not excel_bytes:
                return None

            with open(file_path, "wb") as f:
                f.write(excel_bytes)
            logger.info("Exported hosts to %r.", file_path)
            return file_path

        except Exception as e:
            logger.error("export_hosts_to_excel failed: %r", e)
            return None

    def export_hosts_to_excel_bytes(
        self, hostname_filter: set[str] | None = None
    ) -> bytes | None:
        """Returns host inventory as .xlsx bytes."""
        if not self.zapi:  # type: ignore[attr-defined]
            logger.error("export_hosts_to_excel_bytes: no Zabbix API connection.")
            return None
        try:
            rows = self._fetch_export_rows(hostname_filter)
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Zabbix Hosts"
            ws.append(self._EXPORT_HEADERS)
            for row in rows:
                ws.append(row)
            buf = BytesIO()
            wb.save(buf)
            return buf.getvalue()
        except Exception as e:
            logger.error("export_hosts_to_excel_bytes failed: %r", e)
            return None

    def export_hosts_to_csv_bytes(
        self, hostname_filter: set[str] | None = None
    ) -> bytes | None:
        """Returns host inventory as .csv bytes (UTF-8 with BOM for Excel compat)."""
        if not self.zapi:  # type: ignore[attr-defined]
            logger.error("export_hosts_to_csv_bytes: no Zabbix API connection.")
            return None
        try:
            rows = self._fetch_export_rows(hostname_filter)
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow(self._EXPORT_HEADERS)
            writer.writerows(rows)
            # UTF-8 BOM so Excel opens it correctly without an import wizard
            return ("﻿" + buf.getvalue()).encode("utf-8")
        except Exception as e:
            logger.error("export_hosts_to_csv_bytes failed: %r", e)
            return None
