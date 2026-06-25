export type {
  WidgetConfig,
  MetricWidgetConfig,
  DashboardLayoutData,
  MetricLayoutData,
  DashboardPageKind,
  DashboardPage,
  ProxyConfig,
  Proxy,
  HostGroup,
  DashboardGraph,
  GraphSeries,
  GraphData,
  HostMetrics,
  RecentItem,
  AlertRule,
  AlertEvent,
  Problem,
  StoredNotif,
  HistoryPoint,
  ItemHistory,
  ApiHealth,
  HostInterface,
  HostTag,
  Host,
  TeamUser,
  UserRow,
  Team,
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
