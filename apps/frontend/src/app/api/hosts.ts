import { apiFetch } from "./fetch";
import type { ApiHealth, Host, HostTag, TemplateItem } from "./types";

export const hostsApi = {
  health: () => apiFetch<ApiHealth>("/health"),
  listHosts: () => apiFetch<{ count: number; hosts: Host[] }>("/hosts"),
  listTemplates: () =>
    apiFetch<{ templates: Array<{ templateid: string; name: string }> }>("/templates"),
  createHost: (payload: {
    hostname: string;
    ip: string;
    template?: string;
    proxyid?: string;
    group_ids?: string[];
    apply_team_tag?: boolean;
  }) =>
    apiFetch<{ message: string; hostid: string }>("/hosts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  bulkCreateHosts: (file: File, applyTeamTag = true) => {
    const body = new FormData();
    body.append("file", file);
    body.append("apply_team_tag", String(applyTeamTag));
    return apiFetch<{
      message: string;
      total_rows: number;
      created_count: number;
      failed_count: number;
      created: Array<{ row: number; hostname: string; hostid: string }>;
      failed: Array<{ row: number; hostname?: string; reason: string }>;
    }>("/hosts/bulk", {
      method: "POST",
      body,
    });
  },
  updateHost: (
    hostname: string,
    payload: {
      name?: string;
      ip?: string;
      proxyid?: string;
      status?: number;
      group_ids?: string[];
    },
  ) =>
    apiFetch<{ ok: boolean }>(`/hosts/${encodeURIComponent(hostname)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteHost: (hostname: string) =>
    apiFetch<{ message: string }>(`/hosts/${encodeURIComponent(hostname)}`, { method: "DELETE" }),
  updateHostTags: (hostname: string, tags: HostTag[]) =>
    apiFetch<{ message: string }>(`/hosts/${encodeURIComponent(hostname)}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    }),
  getHostTemplates: (hostname: string) =>
    apiFetch<{ templates: Array<{ templateid: string; name: string }> }>(
      `/hosts/${encodeURIComponent(hostname)}/templates`,
    ),
  linkTemplate: (hostname: string, templateid: string) =>
    apiFetch<{ message: string }>(`/hosts/${encodeURIComponent(hostname)}/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateid }),
    }),
  unlinkTemplate: (hostname: string, templateid: string) =>
    apiFetch<{ message: string }>(
      `/hosts/${encodeURIComponent(hostname)}/templates/${encodeURIComponent(templateid)}`,
      { method: "DELETE" },
    ),
  getTemplateItems: (templateid: string) =>
    apiFetch<{ items: TemplateItem[] }>(`/templates/${encodeURIComponent(templateid)}/items`),
  addTemplateItem: (
    templateid: string,
    payload: {
      name: string;
      key_: string;
      type_?: number;
      value_type?: number;
      delay?: string;
      history?: string;
      trends?: string;
      units?: string;
      description?: string;
    },
  ) =>
    apiFetch<{ message: string; itemid: string }>(
      `/templates/${encodeURIComponent(templateid)}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  updateTemplateItem: (
    templateid: string,
    itemid: string,
    payload: { name?: string; delay?: string; status?: number; key_?: string },
  ) =>
    apiFetch<{ ok: boolean }>(
      `/templates/${encodeURIComponent(templateid)}/items/${encodeURIComponent(itemid)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  deleteTemplateItem: (templateid: string, itemid: string) =>
    apiFetch<{ message: string }>(
      `/templates/${encodeURIComponent(templateid)}/items/${encodeURIComponent(itemid)}`,
      { method: "DELETE" },
    ),
};
