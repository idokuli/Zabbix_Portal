export type {
  AlertEvent,
  AlertRule,
  ApiHealth,
  DashboardGraph,
  DashboardLayoutData,
  DashboardPage,
  DashboardPageKind,
  DashboardScope,
  GraphData,
  GraphSeries,
  HistoryPoint,
  Host,
  HostGroup,
  HostInterface,
  HostMetrics,
  HostTag,
  ItemHistory,
  MetricLayoutData,
  MetricWidgetConfig,
  Problem,
  ProblemNote,
  Proxy,
  ProxyConfig,
  RecentItem,
  StoredNotif,
  Team,
  TeamUser,
  UserRow,
  WidgetConfig,
} from "./api/types";

import { actionsApi } from "./api/actions";
import { adminApi } from "./api/admin";
import { authApi } from "./api/auth";
import { dashboardApi } from "./api/dashboard";
import { dcApi } from "./api/dc";
import { hostsApi } from "./api/hosts";
import { itemsApi } from "./api/items";
import { metricsApi } from "./api/metrics";
import { reportsApi } from "./api/reports";
import { servicesApi } from "./api/services";
import { teamsApi } from "./api/teams";
import { usersApi } from "./api/users";

export const api = {
  ...hostsApi,
  ...itemsApi,
  ...authApi,
  ...teamsApi,
  ...usersApi,
  ...dashboardApi,
  ...metricsApi,
  ...dcApi,
  ...reportsApi,
  ...adminApi,
  ...actionsApi,
  ...servicesApi,
};
