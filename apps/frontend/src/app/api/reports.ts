import { apiFetch } from "./fetch";

export const reportsApi = {
  getTopTriggers: (params?: { limit?: number; severity_min?: number; hours?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.severity_min != null) q.set("severity_min", String(params.severity_min));
    if (params?.hours != null) q.set("hours", String(params.hours));
    return apiFetch<{
      triggers: Array<{
        triggerid: string;
        description: string;
        priority: number;
        severity_label: string;
        lastchange: number;
        status: number;
        value: number;
        hosts: Array<{ hostid: string; host: string }>;
        last_event: Record<string, unknown> | null;
      }>;
    }>(`/reports/top-triggers${q.toString() ? `?${q}` : ""}`);
  },
  getAuditLog: (params?: { limit?: number; hours?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.hours != null) q.set("hours", String(params.hours));
    return apiFetch<{
      entries: Array<{
        auditid: string;
        userid: string;
        username: string;
        clock: number;
        action: string;
        resourcetype: string;
        resourceid: string;
        resourcename: string;
        ip: string;
        details: string;
      }>;
    }>(`/reports/audit-log${q.toString() ? `?${q}` : ""}`);
  },
  getActionLog: (params?: { limit?: number; hours?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.hours) q.set("hours", String(params.hours));
    return apiFetch<{
      entries: Array<{
        alertid: string;
        actionid: string;
        eventid: string;
        clock: number;
        message: string;
        subject: string;
        sendto: string;
        status: number;
        retries: number;
        error: string;
        alerttype: number;
        mediatypeid: string;
        userid: string;
      }>;
    }>(`/reports/action-log${q.toString() ? `?${q}` : ""}`);
  },
  getAvailability: (params?: { hours?: number; groupid?: string }) => {
    const q = new URLSearchParams();
    if (params?.hours) q.set("hours", String(params.hours));
    if (params?.groupid) q.set("groupid", params.groupid);
    return apiFetch<{
      hosts: Array<{
        hostid: string;
        hostname: string;
        downtime_seconds: number;
        problem_count: number;
        availability_pct: number;
      }>;
    }>(`/reports/availability${q.toString() ? `?${q}` : ""}`);
  },
  getNotificationHistory: (params?: { hours?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.hours) q.set("hours", String(params.hours));
    if (params?.limit) q.set("limit", String(params.limit));
    return apiFetch<{
      notifications: Array<{
        alertid: string;
        clock: number;
        sendto: string;
        subject: string;
        status: number;
        status_label: string;
        error: string;
        username: string;
        media_type: string;
      }>;
    }>(`/reports/notifications${q.toString() ? `?${q}` : ""}`);
  },
};
