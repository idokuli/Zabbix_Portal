import { apiFetch, apiFetchBlob } from "./fetch";
import type {
  DashboardGraph,
  DashboardLayoutData,
  DashboardPage,
  DashboardPageKind,
  GraphData,
  HostMetrics,
  MetricLayoutData,
  MetricWidgetConfig,
  RecentItem,
  WidgetConfig,
} from "./types";

export const dashboardApi = {
  getDashboardGraphs: (hostid?: string) =>
    apiFetch<{ graphs: DashboardGraph[] }>(
      `/dashboard/graphs${hostid ? `?hostid=${encodeURIComponent(hostid)}` : ""}`,
    ),
  getDashboardGraphImage: (graphid: string, period = 3600) =>
    apiFetchBlob(
      `/dashboard/graphs/${encodeURIComponent(graphid)}/image?period=${period}&width=900&height=200`,
    ),
  getDashboardGraphData: (graphid: string, minutes = 360) =>
    apiFetch<GraphData>(`/dashboard/graphs/${encodeURIComponent(graphid)}/data?minutes=${minutes}`),
  getHostsMetrics: () => apiFetch<{ hosts: HostMetrics[] }>("/dashboard/hosts/metrics"),
  getRecentItems: (limit = 30) =>
    apiFetch<{ items: RecentItem[] }>(`/dashboard/items/recent?limit=${limit}`),
  getDashboardLayout: (scope: "user" | "team" = "user", page = "dashboard") =>
    apiFetch<DashboardLayoutData>(`/dashboard/layout?scope=${scope}&page=${page}`),
  saveDashboardLayout: (scope: "user" | "team", widgets: WidgetConfig[], page = "dashboard") =>
    apiFetch<{ message: string }>(`/dashboard/layout?page=${page}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, widgets }),
    }),
  getMetricLayout: (scope: "user" | "team" = "user", page = "metrics") =>
    apiFetch<MetricLayoutData>(`/dashboard/layout?scope=${scope}&page=${page}`),
  saveMetricLayout: (scope: "user" | "team", widgets: MetricWidgetConfig[], page = "metrics") =>
    apiFetch<{ message: string }>(`/dashboard/layout?page=${page}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, widgets }),
    }),
  listDashboardPages: (scope: "user" | "team", kind: DashboardPageKind) =>
    apiFetch<{ pages: DashboardPage[] }>(`/dashboard/pages?scope=${scope}&kind=${kind}`),
  createDashboardPage: (scope: "user" | "team", kind: DashboardPageKind, name: string) =>
    apiFetch<DashboardPage>("/dashboard/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, kind, name }),
    }),
  renameDashboardPage: (
    scope: "user" | "team",
    kind: DashboardPageKind,
    page: string,
    name: string,
  ) =>
    apiFetch<{ message: string }>(`/dashboard/pages/${encodeURIComponent(page)}?kind=${kind}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, name }),
    }),
  deleteDashboardPage: (scope: "user" | "team", kind: DashboardPageKind, page: string) =>
    apiFetch<{ message: string }>(
      `/dashboard/pages/${encodeURIComponent(page)}?scope=${scope}&kind=${kind}`,
      { method: "DELETE" },
    ),
};
