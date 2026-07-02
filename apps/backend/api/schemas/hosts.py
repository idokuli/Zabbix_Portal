"""Pydantic request models for host endpoints."""

from pydantic import BaseModel


class HostRequest(BaseModel):
    hostname: str
    ip: str
    template: str | None = "Linux by Zabbix agent"
    proxyid: str | None = None  # optional — "0" or "" means direct (no proxy)
    group_ids: list[str] = []  # Zabbix host group IDs; defaults to group "2" if empty


class HostUpdateRequest(BaseModel):
    name: str | None = None
    ip: str | None = None
    proxyid: str | None = None
    status: int | None = None
    group_ids: list[str] | None = None


class HostTagItem(BaseModel):
    tag: str
    value: str = ""


class TagsUpdateRequest(BaseModel):
    tags: list[HostTagItem]


class HostTemplateLinkRequest(BaseModel):
    templateid: str
