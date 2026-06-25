import { apiFetch } from "./fetch";

export const servicesApi = {
  listServices: (parentid?: string) =>
    apiFetch<{
      services: Array<{
        serviceid: string;
        name: string;
        algorithm: number;
        algorithm_label: string;
        sortorder: number;
        weight: number;
        status: number;
        description: string;
        tags: Array<{ tag: string; value: string }>;
        children: Array<{ serviceid: string; name: string }>;
        parents: Array<{ serviceid: string; name: string }>;
      }>;
    }>(`/services${parentid ? `?parentid=${parentid}` : ""}`),
  createService: (payload: {
    name: string;
    algorithm?: number;
    sortorder?: number;
    weight?: number;
    description?: string;
  }) =>
    apiFetch<{ serviceid: string }>("/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateService: (
    serviceid: string,
    payload: { name?: string; algorithm?: number; description?: string },
  ) =>
    apiFetch<{ ok: boolean }>(`/services/${serviceid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteService: (serviceid: string) =>
    apiFetch<{ ok: boolean }>(`/services/${serviceid}`, { method: "DELETE" }),
  listSlas: () =>
    apiFetch<{
      slas: Array<{
        slaid: string;
        name: string;
        slo: number;
        period: string;
        period_label: string;
        timezone: string;
        description: string;
        status: number;
        effective_date: number;
        service_tags: Array<{ tag: string; value: string }>;
      }>;
    }>("/sla"),
  createSla: (payload: {
    name: string;
    slo: number;
    period?: string;
    timezone?: string;
    description?: string;
    service_tags?: Array<{ tag: string; value: string }>;
  }) =>
    apiFetch<{ slaid: string }>("/sla", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteSla: (slaid: string) => apiFetch<{ ok: boolean }>(`/sla/${slaid}`, { method: "DELETE" }),
  getSlaReport: (slaid: string, periods?: number) =>
    apiFetch<{ report: Array<Record<string, unknown>> }>(
      `/sla/${slaid}/report${periods ? `?periods=${periods}` : ""}`,
    ),
  listHealthMonitors: (hostid?: string) =>
    apiFetch<{
      monitors: Array<{
        itemid: string;
        name: string;
        host: string;
        hostid: string;
        url: string;
        expected: string;
        running: boolean;
        working: boolean;
        last_value: string | null;
        last_check: number | null;
        proc_itemid: string | null;
        has_proc_check: boolean;
      }>;
    }>(`/health-monitors${hostid ? `?hostid=${hostid}` : ""}`),
  createHealthMonitor: (payload: {
    hostid: string;
    name: string;
    url: string;
    expected_contains?: string;
    process_name?: string;
  }) =>
    apiFetch<{ itemid: string; proc_itemid: string | null }>("/health-monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteHealthMonitor: (itemid: string) =>
    apiFetch<{ ok: boolean }>(`/health-monitors/${itemid}`, { method: "DELETE" }),
};
