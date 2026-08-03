import { apiFetch } from "./fetch";
import type {
  AlertEvent,
  AlertRule,
  ItemHistory,
  Problem,
  ProblemNote,
  StoredNotif,
} from "./types";

export const metricsApi = {
  getProblems: () => apiFetch<{ problems: Problem[] }>("/metrics/problems"),
  getItemHistory: (itemid: string, minutes = 360) =>
    apiFetch<ItemHistory>(`/metrics/history/${encodeURIComponent(itemid)}?minutes=${minutes}`),
  listAlertRules: () => apiFetch<{ rules: AlertRule[] }>("/alerts/rules"),
  createAlertRule: (data: {
    rule_type?: "item" | "service";
    item_id: string;
    item_name: string;
    hostname: string;
    operator?: string;
    threshold?: number;
    severity: number;
    expected_contains?: string;
  }) => apiFetch<{ id: number }>("/alerts/rules", { method: "POST", body: JSON.stringify(data) }),
  updateAlertRule: (
    id: number,
    data: {
      severity: number;
      operator?: string;
      threshold?: number;
      item_id?: string;
      item_name?: string;
      hostname?: string;
      expected_contains?: string;
    },
  ) =>
    apiFetch<{ message: string }>(`/alerts/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteAlertRule: (id: number) =>
    apiFetch<{ message: string }>(`/alerts/rules/${id}`, { method: "DELETE" }),
  toggleAlertRule: (id: number) =>
    apiFetch<{ enabled: boolean }>(`/alerts/rules/${id}/toggle`, { method: "PATCH" }),
  getAlertEvents: (limit = 200) =>
    apiFetch<{ events: AlertEvent[] }>(`/alerts/events?limit=${limit}`),
  getNotifHistory: () => apiFetch<{ history: StoredNotif[] }>("/alerts/notification-history"),
  saveNotifHistory: (entries: StoredNotif[]) =>
    apiFetch<void>("/alerts/notification-history", {
      method: "POST",
      body: JSON.stringify(entries),
    }),
  acknowledgeProblem: (
    eventid: string,
    meta: { problem_name: string; hostname: string; severity: number; note: string },
  ) =>
    apiFetch<{ message: string; acknowledged_by: string }>(
      `/metrics/problems/${encodeURIComponent(eventid)}/acknowledge`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meta),
      },
    ),
  addProblemNote: (eventid: string, meta: { hostname: string; note: string }) =>
    apiFetch<{ message: string } & ProblemNote>(
      `/metrics/problems/${encodeURIComponent(eventid)}/note`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meta),
      },
    ),
  listAcknowledgements: (limit = 200) =>
    apiFetch<{
      acknowledgements: {
        id: number;
        eventid: string;
        problem_name: string;
        hostname: string;
        severity: number;
        acknowledged_by: string;
        note: string;
        acked_at: string;
      }[];
    }>(`/metrics/acknowledgements?limit=${limit}`),
  getProblemHistory: (params: { hours?: number; severityMin?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.hours != null) {
      q.set("hours", String(params.hours));
    }
    if (params.severityMin != null) {
      q.set("severity_min", String(params.severityMin));
    }
    if (params.limit != null) {
      q.set("limit", String(params.limit));
    }
    return apiFetch<{
      problems: {
        eventid: string;
        name: string;
        hostname: string;
        severity: number;
        severity_name: string;
        clock: number;
        r_clock: number;
        resolved: boolean;
        duration_seconds: number;
        acknowledged: boolean;
        ack_user: string | null;
        ack_note: string;
        ack_time: number | null;
      }[];
    }>(`/metrics/problems/history?${q}`);
  },
};
