export type WidgetConfig = {
  i: string;
  graphid: string;
  graphName: string;
  hostId?: string;
  hostName?: string;
  mode: "native" | "chartjs";
  periodIdx: number;
  x: number;
  y: number;
  w: number;
  h: number;
  customTitle?: string;
  lineColor?: string;
};

export type MetricWidgetConfig = {
  i: string;
  hostname: string;
  itemid: string;
  itemName: string;
  units: string;
  periodIdx: number;
  x: number;
  y: number;
  w: number;
  h: number;
  customTitle?: string;
  lineColor?: string;
};

export type DashboardScope = "user" | "team" | "all";

export type DashboardLayoutData = {
  widgets: WidgetConfig[];
  scope: DashboardScope;
};

export type MetricLayoutData = {
  widgets: MetricWidgetConfig[];
  scope: DashboardScope;
};

export type DashboardPageKind = "dashboard" | "metrics";

export type DashboardPage = {
  page: string;
  name: string;
  is_default: boolean;
  team_id?: number;
  team_name?: string;
};

export type ProxyConfig = {
  name: string;
  operating_mode: number;
  description: string;
  proxy_groupid: string;
  local_address: string;
  local_port: string;
  address: string;
  port: string;
  allowed_addresses: string;
  tls_connect: number;
  tls_accept: number;
  tls_issuer: string;
  tls_subject: string;
  tls_psk_identity: string;
  tls_psk: string;
  custom_timeouts: number;
  timeout_zabbix_agent: string;
  timeout_simple_check: string;
  timeout_snmp_agent: string;
  timeout_external_check: string;
  timeout_db_monitor: string;
  timeout_http_agent: string;
  timeout_ssh_agent: string;
  timeout_telnet_agent: string;
  timeout_script: string;
  timeout_browser: string;
};

export type Proxy = ProxyConfig & {
  proxyid: string;
  mode: number;
  mode_label: string;
  lastaccess: number;
  version: string;
  host_count: number;
};

export type HostGroup = {
  groupid: string;
  name: string;
  host_count: number;
};

export type DashboardGraph = {
  graphid: string;
  name: string;
  width: string;
  height: string;
  graphtype: string;
  hosts: { hostid: string; host: string }[];
};

export type GraphSeries = {
  itemid: string;
  name: string;
  units: string;
  color: string;
  points: HistoryPoint[];
};

export type GraphData = {
  graph: { graphid: string; name: string };
  series: GraphSeries[];
};

export type HostMetrics = {
  hostid: string;
  hostname: string;
  cpu_util?: number;
  mem_util?: number;
  disk_util?: number;
};

export type RecentItem = {
  itemid: string;
  name: string;
  key_: string;
  value_type: string;
  delay: string;
  lastvalue: string;
  units: string;
  lastclock: number | null;
  hostname: string;
};

export type AlertRule = {
  id: number;
  rule_type: "item" | "service";
  item_id: string;
  item_name: string;
  hostname: string;
  operator: ">" | "<" | ">=" | "<=" | "contains" | "!contains";
  threshold: number;
  severity: number;
  enabled: boolean;
  is_firing: boolean;
  created_at: string;
  expected_contains: string;
};

export type AlertEvent = {
  id: number;
  rule_id: number;
  item_id: string;
  item_name: string;
  hostname: string;
  operator: string;
  threshold: number;
  actual_value: number;
  severity: number;
  fired_at: number;
};

export type ProblemNote = {
  username: string;
  note: string;
  created_at: string;
};

export type Problem = {
  eventid: string;
  hostname: string;
  groups: string[];
  severity: number;
  severity_name: string;
  name: string;
  clock: number;
  age_seconds: number;
  acknowledged: boolean;
  ack_user?: string;
  ack_time?: string;
  ack_note?: string;
  notes?: ProblemNote[];
};

export type StoredNotif = {
  id: string;
  source: "zabbix" | "rule";
  hostname: string;
  severity: number;
  name: string;
  clock: number;
  acknowledged: boolean;
};

export type HistoryPoint = { clock: number; value: number };

export type ItemHistory = {
  history: HistoryPoint[];
  item_name: string;
  units: string;
  hostname: string;
};

export type ApiHealth = {
  status: string;
  zabbix_connected: boolean;
};

export type HostInterface = {
  ip: string;
  port: string;
  type: string;
  available: string;
};

export type HostTag = { tag: string; value: string };

export type Host = {
  hostid: string;
  host: string;
  name?: string;
  status: string;
  interfaces?: HostInterface[];
  tags?: HostTag[];
  groups?: Array<{ groupid: string; name: string }>;
  problem_count?: number;
  proxyid?: string;
};

export type TeamUser = {
  id: number;
  username: string;
  email: string;
  roles: string[];
  source?: "local" | "ldap" | "zabbix";
  display_name?: string;
};

export type UserRow = {
  id: number;
  username: string;
  email: string;
  roles: string[];
  restrictions?: string[];
  team_id: number | null;
  team_name: string | null;
  display_name?: string;
  source?: "local" | "ldap" | "zabbix";
};

export type TemplateItem = {
  itemid: string;
  name: string;
  key_: string;
  type: string;
  value_type: string;
  delay: string;
  history: string;
  trends: string;
  status: string;
  units: string;
  description: string;
  templateid: string;
};

export type Team = {
  id: number;
  name: string;
  description: string;
  users: TeamUser[];
  hosts: string[];
  roles: string[];
};
