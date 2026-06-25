import { apiFetch } from "./fetch";
import type { ApiHealth, Host, HostTag } from "./types";

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
  }) =>
    apiFetch<{ message: string; hostid: string }>("/hosts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  bulkCreateHosts: (file: File) => {
    const body = new FormData();
    body.append("file", file);
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
};
