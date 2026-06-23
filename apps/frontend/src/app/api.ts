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

export type DashboardLayoutData = {
  widgets: WidgetConfig[];
  scope: "user" | "team";
};

export type DashboardMeta = {
  page: string;
  name: string;
  updated_at: string | null;
};

export type MetricLayoutData = {
  widgets: MetricWidgetConfig[];
  scope: "user" | "team";
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
  item_id: string;
  item_name: string;
  hostname: string;
  operator: ">" | "<" | ">=" | "<=";
  threshold: number;
  severity: number;
  enabled: boolean;
  is_firing: boolean;
  created_at: string;
};

export type AlertEvent = {
  id: number;
  rule_id: number;
  item_id: string; // Zabbix item ID — used to match events to chart widgets
  item_name: string;
  hostname: string;
  operator: string;
  threshold: number;
  actual_value: number;
  severity: number;
  fired_at: number; // unix timestamp
};

export type Problem = {
  eventid: string;
  hostname: string;
  severity: number;
  severity_name: string;
  name: string;
  clock: number;
  age_seconds: number;
  acknowledged: boolean;
  ack_user?: string;
  ack_time?: string;
  ack_note?: string;
};

// Persisted notification history entry (stored in localStorage)
export type StoredNotif = {
  id: string; // eventid for Zabbix problems, "rule-{id}" for custom rules
  source: "zabbix" | "rule";
  hostname: string;
  severity: number;
  name: string;
  clock: number; // unix timestamp
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
  type: string; // "1"=Agent "2"=SNMP "3"=IPMI "4"=JMX
  available: string; // "0"=Unknown "1"=Available "2"=Unavailable
};

export type HostTag = { tag: string; value: string };

export type Host = {
  hostid: string;
  host: string;
  name?: string;
  status: string;
  interfaces?: HostInterface[];
  tags?: HostTag[];
  problem_count?: number;
  proxyid?: string;
};

export type TeamUser = {
  id: number;
  username: string;
  email: string;
  roles: string[];
};

export type UserRow = {
  id: number;
  username: string;
  email: string;
  roles: string[];
  team_id: number | null;
  team_name: string | null;
};

export type Team = {
  id: number;
  name: string;
  description: string;
  users: TeamUser[];
  hosts: string[];
};

import { clearToken, getToken } from "../lib/auth";

const extractDetail = async (res: Response, fallback: string): Promise<string> => {
  try {
    const json: unknown = await res.json();
    if (json && typeof json === "object" && "detail" in json) {
      const d = (json as { detail?: unknown }).detail;
      if (typeof d === "string") return d;
    }
  } catch {
    // ignore
  }
  return fallback;
};

const apiFetchBlob = async (path: string): Promise<Blob | null> => {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    const res = await fetch(`/api${path}`, { headers });
    if (!res.ok) return null;
    return res.blob();
  } catch {
    return null;
  }
};

const apiFetch = async <T>(
  path: string,
  init?: RequestInit,
  opts?: { skipRedirect?: boolean },
): Promise<T> => {
  const token = getToken();
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Any request with a body is JSON. Without this header the browser sends
  // text/plain, which FastAPI refuses to parse into the model → 422.
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    if (res.status === 401 && !opts?.skipRedirect) {
      clearToken();
      window.location.href = "/login";
      throw new Error("Session expired");
    }
    throw new Error(await extractDetail(res, `HTTP ${res.status}`));
  }
  return (await res.json()) as T;
};

export const api = {
  health: () => apiFetch<ApiHealth>("/health"),
  listHosts: () => apiFetch<{ count: number; hosts: Host[] }>("/hosts"),
  listTemplates: () =>
    apiFetch<{ templates: Array<{ templateid: string; name: string }> }>("/templates"),
  createHost: (payload: { hostname: string; ip: string; template?: string; proxyid?: string; group_ids?: string[] }) =>
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
  deleteHost: (hostname: string) =>
    apiFetch<{ message: string }>(`/hosts/${encodeURIComponent(hostname)}`, { method: "DELETE" }),
  updateHostTags: (hostname: string, tags: HostTag[]) =>
    apiFetch<{ message: string }>(`/hosts/${encodeURIComponent(hostname)}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    }),
  addItem: (payload: {
    hostname: string;
    item_name: string;
    item_key: string;
    value_type?: number;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
    timeout?: string;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  listAllItems: (params?: { search?: string; hostname?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.hostname) q.set("hostname", params.hostname);
    if (params?.limit != null) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiFetch<{
      items: Array<{
        itemid: string;
        name: string;
        key_: string;
        value_type: string;
        delay: string;
        status: string;
        state: string;
        hostname: string;
        tags: Array<{ tag: string; value: string }>;
        lastvalue: string;
        lastclock: number | null;
        templateid: string;
      }>;
      total: number;
    }>(`/items${qs ? `?${qs}` : ""}`);
  },

  listItemKeys: () =>
    apiFetch<{
      items: Array<{
        key_: string;
        name: string;
        value_type: string;
        group: string;
        delay: string;
        units: string;
        history: string;
        trends: string;
        description: string;
      }>;
    }>("/items/keys"),

  listItems: (hostname: string, includeInherited = false) =>
    apiFetch<{
      items: Array<{
        itemid: string;
        name: string;
        key_: string;
        value_type: string;
        delay: string;
      }>;
    }>(
      `/items/${encodeURIComponent(hostname)}${includeInherited ? "?include_inherited=true" : ""}`,
    ),

  deleteItem: (itemid: string) =>
    apiFetch<{ message: string }>(`/items/${itemid}`, { method: "DELETE" }),
  updateItem: (itemid: string, payload: { name?: string; delay?: string; status?: string; key_?: string }) =>
    apiFetch<{ ok: boolean }>(`/items/${itemid}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),

  listAllTriggers: (params?: { search?: string; hostname?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.hostname) q.set("hostname", params.hostname);
    if (params?.limit != null) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiFetch<{
      triggers: Array<{
        triggerid: string;
        description: string;
        expression: string;
        priority: number;
        status: number;
        value: number;
        lastchange: number;
        hostname: string;
        templateid: string;
        host_available: string; // "0"=Unknown "1"=Available "2"=Unavailable
      }>;
      total: number;
    }>(`/triggers${qs ? `?${qs}` : ""}`);
  },

  listTriggers: (hostname: string) =>
    apiFetch<{
      triggers: Array<{
        triggerid: string;
        description: string;
        expression: string;
        priority: string;
        status: string;
        value: number;
        lastchange: number;
      }>;
      host_available: string; // "0"=Unknown "1"=Available "2"=Unavailable
    }>(`/triggers/${encodeURIComponent(hostname)}`),

  deleteTrigger: (triggerid: string) =>
    apiFetch<{ message: string }>(`/triggers/${triggerid}`, { method: "DELETE" }),

  updateTrigger: (triggerid: string, payload: { description?: string; priority?: number; status?: number; expression?: string; event_name?: string; comments?: string }) =>
    apiFetch<{ message: string }>(`/triggers/${triggerid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  addTrigger: (payload: {
    hostname: string;
    item_key: string;
    trigger_name: string;
    threshold?: number;
    operator?: string;
    severity?: number;
    string_pattern?: string;
    match_type?: string;
    event_name?: string;
    comments?: string;
  }) =>
    apiFetch<{ message: string; triggerid: string }>("/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  addHttpItem: (payload: {
    hostname: string;
    item_name: string;
    url: string;
    item_key?: string;
    request_method?: number;
    status_codes?: string;
    timeout?: string;
    verify_peer?: boolean;
    verify_host?: boolean;
    follow_redirects?: boolean;
    posts?: string;
    post_type?: number;
    retrieve_mode?: number;
    value_type?: number;
    headers?: string;
    query_fields?: Array<{ name: string; value: string }>;
    http_proxy?: string;
    authtype?: number;
    username?: string;
    password?: string;
    ssl_cert_file?: string;
    ssl_key_file?: string;
    ssl_key_password?: string;
    convert_to_json?: boolean;
    allow_traps?: boolean;
    status?: number;
    regex_preprocessing?: boolean;
    regex_pattern?: string;
    regex_output?: string;
    regex_no_match_value?: string;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    description?: string;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/http", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  addServiceItem: (payload: {
    hostname: string;
    service_type: string;
    port?: number | null;
    item_name?: string;
    delay?: string;
    history?: string;
    trends?: string;
    description?: string;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  addFileWatchItem: (payload: {
    hostname: string;
    file_path: string;
    check_type: "checksum" | "mtime" | "size" | "exists" | "folder_latest";
    item_name?: string;
    folder_os?: "linux" | "windows";
    create_trigger?: boolean;
    trigger_name?: string;
    trigger_priority?: number;
    trigger_type?: "change" | "age";
    max_age_minutes?: number;
    delay?: string;
    history?: string;
    trends?: string;
    description?: string;
  }) =>
    apiFetch<{ message: string; itemid: string; triggerid: string | null; trigger_error: string | null }>("/items/filewatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  addScriptItem: (payload: {
    hostname: string;
    script_type: "bash" | "powershell";
    script_mode: "command" | "file";
    script: string;
    file_arg?: string;
    item_name?: string;
    value_type?: number;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
    timeout?: string;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  addDbOdbcItem: (payload: {
    hostname: string;
    dsn: string;
    sql_query: string;
    description: string;
    item_name?: string;
    value_type?: number;
    username?: string;
    password?: string;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    status?: number;
    timeout?: string;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/db/odbc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  addDbAgent2Item: (payload: {
    hostname: string;
    engine: string;
    conn_string: string;
    metric: string;
    extra_param?: string;
    item_name?: string;
    value_type?: number;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/db/agent2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  addSnmpItem: (payload: {
    hostname: string; item_name: string; item_key?: string; snmp_oid: string;
    value_type?: number; snmp_version?: number; snmp_community?: string;
    snmpv3_securityname?: string; snmpv3_securitylevel?: number;
    snmpv3_authprotocol?: number; snmpv3_authpassphrase?: string;
    snmpv3_privprotocol?: number; snmpv3_privpassphrase?: string;
    snmpv3_contextname?: string;
    delay?: string; units?: string; history?: string; trends?: string;
    description?: string; status?: number;
  }) => apiFetch<{ message: string; itemid: string }>("/items/snmp", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  addSnmpTrapItem: (payload: {
    hostname: string; item_name: string; item_key?: string; value_type?: number;
    history?: string; trends?: string; description?: string; status?: number;
  }) => apiFetch<{ message: string; itemid: string }>("/items/snmptrap", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  addInternalItem: (payload: {
    hostname: string; item_name: string; item_key: string; value_type?: number;
    delay?: string; units?: string; history?: string; trends?: string;
    description?: string; status?: number;
  }) => apiFetch<{ message: string; itemid: string }>("/items/internal", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  addTrapperItem: (payload: {
    hostname: string; item_name: string; item_key: string; value_type?: number;
    allow_traps?: boolean; history?: string; trends?: string;
    description?: string; status?: number;
  }) => apiFetch<{ message: string; itemid: string }>("/items/trapper", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  addExternalItem: (payload: {
    hostname: string; item_name: string; item_key: string; value_type?: number;
    delay?: string; units?: string; history?: string; trends?: string;
    description?: string; status?: number;
  }) => apiFetch<{ message: string; itemid: string }>("/items/external", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  addIpmiItem: (payload: {
    hostname: string; item_name?: string; ipmi_sensor: string; item_key?: string;
    value_type?: number; delay?: string; units?: string;
    history?: string; trends?: string; description?: string; status?: number;
  }) => apiFetch<{ message: string; itemid: string }>("/items/ipmi", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  addSshItem: (payload: {
    hostname: string; item_name: string; params: string; item_key?: string;
    authtype?: number; username?: string; password?: string;
    publickey?: string; privatekey?: string; value_type?: number;
    delay?: string; units?: string; history?: string; trends?: string;
    description?: string; status?: number; timeout?: string;
  }) => apiFetch<{ message: string; itemid: string }>("/items/ssh", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  addTelnetItem: (payload: {
    hostname: string; item_name: string; params: string; item_key?: string;
    username?: string; password?: string; value_type?: number;
    delay?: string; units?: string; history?: string; trends?: string;
    description?: string; status?: number;
  }) => apiFetch<{ message: string; itemid: string }>("/items/telnet", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  addJmxItem: (payload: {
    hostname: string; item_name: string; item_key: string;
    jmx_endpoint?: string; username?: string; password?: string;
    value_type?: number; delay?: string; units?: string;
    history?: string; trends?: string; description?: string; status?: number;
  }) => apiFetch<{ message: string; itemid: string }>("/items/jmx", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  addCalculatedItem: (payload: {
    hostname: string; item_name: string; item_key: string; formula: string;
    value_type?: number; delay?: string; units?: string;
    history?: string; trends?: string; description?: string; status?: number;
  }) => apiFetch<{ message: string; itemid: string }>("/items/calculated", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  addDependentItem: (payload: {
    hostname: string; item_name: string; item_key: string; master_itemid: string;
    value_type?: number; history?: string; trends?: string;
    description?: string; status?: number;
  }) => apiFetch<{ message: string; itemid: string }>("/items/dependent", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  addZabbixScriptItem: (payload: {
    hostname: string; item_name: string; item_key: string; params: string;
    parameters?: Array<{ name: string; value: string }>; value_type?: number;
    delay?: string; units?: string; history?: string; trends?: string;
    description?: string; status?: number; timeout?: string;
  }) => apiFetch<{ message: string; itemid: string }>("/items/zabbix-script", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  addBrowserItem: (payload: {
    hostname: string; item_name: string; item_key: string; params: string;
    parameters?: Array<{ name: string; value: string }>; value_type?: number;
    delay?: string; units?: string; history?: string; trends?: string;
    description?: string; status?: number; timeout?: string;
  }) => apiFetch<{ message: string; itemid: string }>("/items/browser", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }),

  bulkAddItems: (payload: {
    hostnames: string[];
    item_type: string;
    item_name?: string;
    item_key?: string;
    value_type?: number;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    description?: string;
    url?: string;
    request_method?: number;
    status_codes?: string;
    timeout?: string;
    verify_peer?: boolean;
    follow_redirects?: boolean;
    posts?: string;
    service_type?: string;
    port?: number | null;
    script_type?: string;
    script_mode?: string;
    script?: string;
    file_arg?: string;
  }) =>
    apiFetch<{ message: string; results: Array<{ hostname: string; item_id: string | null; error: string | null }> }>("/items/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  bulkAddTriggers: (payload: {
    hostnames: string[];
    item_key: string;
    trigger_name: string;
    threshold: number;
    operator?: string;
    priority?: number;
  }) =>
    apiFetch<{ message: string; results: Array<{ hostname: string; trigger_id: string | null; error: string | null }> }>("/triggers/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  // ── Auth ─────────────────────────────────────────────────────────────
  login: (username: string, password: string) =>
    apiFetch<{
      access_token: string;
      token_type: string;
      user: { id: number; username: string; role: string; team_id: number | null };
    }>(
      "/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      },
      { skipRedirect: true },
    ),

  me: () =>
    apiFetch<{ sub: string; username: string; roles: string[]; team_id: number | null }>("/auth/me"),

  // ── Teams ────────────────────────────────────────────────────────────
  getTeamsOverview: () => apiFetch<{ teams: Team[] }>("/teams/overview"),

  createTeam: (payload: { name: string; description?: string }) =>
    apiFetch<{ id: number; name: string; description: string }>("/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  deleteTeam: (teamId: number) =>
    apiFetch<{ message: string }>(`/teams/${teamId}`, { method: "DELETE" }),

  assignHost: (teamId: number, hostname: string) =>
    apiFetch<{ message: string }>(`/teams/${teamId}/hosts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostname }),
    }),

  unassignHost: (teamId: number, hostname: string) =>
    apiFetch<{ message: string }>(`/teams/${teamId}/hosts/${encodeURIComponent(hostname)}`, {
      method: "DELETE",
    }),

  // ── Users ────────────────────────────────────────────────────────────
  createUser: (payload: {
    username: string;
    password: string;
    email?: string;
    roles?: string[];
    team_id?: number;
  }) =>
    apiFetch<{ id: number; username: string; roles: string[]; team_id: number | null }>("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  listUsers: () => apiFetch<{ users: UserRow[] }>("/users"),

  updateUser: (userId: number, payload: { roles: string[]; team_id: number | null }) =>
    apiFetch<{ message: string }>(`/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  deleteUser: (userId: number) =>
    apiFetch<{ message: string }>(`/users/${userId}`, { method: "DELETE" }),

  changePassword: (userId: number, newPassword: string) =>
    apiFetch<{ message: string }>(`/users/${userId}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: newPassword }),
    }),

  // ── Dashboard ────────────────────────────────────────────────────────
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

  // ── Dashboard layout ─────────────────────────────────────────────────────────
  getDashboardLayout: (scope: "user" | "team" = "user", page = "dashboard") =>
    apiFetch<DashboardLayoutData>(`/dashboard/layout?scope=${scope}&page=${page}`),

  saveDashboardLayout: (scope: "user" | "team", widgets: WidgetConfig[], page = "dashboard") =>
    apiFetch<{ message: string }>(`/dashboard/layout?page=${page}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, widgets }),
    }),

  // ── Multiple dashboards ──────────────────────────────────────────────────
  listDashboards: (scope: "user" | "team" = "user") =>
    apiFetch<{ dashboards: DashboardMeta[] }>(`/dashboard/list?scope=${scope}`),

  createDashboard: (scope: "user" | "team", name: string) =>
    apiFetch<{ page: string; name: string }>("/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, name }),
    }),

  renameDashboard: (scope: "user" | "team", page: string, name: string) =>
    apiFetch<{ message: string }>(`/dashboard/${encodeURIComponent(page)}/rename`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, name }),
    }),

  deleteDashboard: (scope: "user" | "team", page: string) =>
    apiFetch<{ message: string }>(`/dashboard/${encodeURIComponent(page)}?scope=${scope}`, {
      method: "DELETE",
    }),

  getMetricLayout: (scope: "user" | "team" = "user") =>
    apiFetch<MetricLayoutData>(`/dashboard/layout?scope=${scope}&page=metrics`),

  saveMetricLayout: (scope: "user" | "team", widgets: MetricWidgetConfig[]) =>
    apiFetch<{ message: string }>("/dashboard/layout?page=metrics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, widgets }),
    }),

  // ── Metrics ──────────────────────────────────────────────────────────
  getProblems: () => apiFetch<{ problems: Problem[] }>("/metrics/problems"),

  getItemHistory: (itemid: string, minutes = 360) =>
    apiFetch<ItemHistory>(`/metrics/history/${encodeURIComponent(itemid)}?minutes=${minutes}`),

  listAlertRules: () => apiFetch<{ rules: AlertRule[] }>("/alerts/rules"),
  createAlertRule: (data: {
    item_id: string;
    item_name: string;
    hostname: string;
    operator: string;
    threshold: number;
    severity: number;
  }) => apiFetch<{ id: number }>("/alerts/rules", { method: "POST", body: JSON.stringify(data) }),
  updateAlertRule: (
    id: number,
    data: {
      operator: string;
      threshold: number;
      severity: number;
      item_id?: string;
      item_name?: string;
      hostname?: string;
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
  acknowledgeProblem: (
    eventid: string,
    meta: { problem_name: string; hostname: string; severity: number; note: string },
  ) =>
    apiFetch<{ message: string; acknowledged_by: string }>(
      `/metrics/problems/${encodeURIComponent(eventid)}/acknowledge`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meta) },
    ),
  listAcknowledgements: (limit = 200) =>
    apiFetch<{ acknowledgements: { id: number; eventid: string; problem_name: string; hostname: string; severity: number; acknowledged_by: string; note: string; acked_at: string }[] }>(
      `/metrics/acknowledgements?limit=${limit}`,
    ),
  getProblemHistory: (params: { hours?: number; severityMin?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.hours != null) q.set("hours", String(params.hours));
    if (params.severityMin != null) q.set("severity_min", String(params.severityMin));
    if (params.limit != null) q.set("limit", String(params.limit));
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

  // ── Data Collection ──────────────────────────────────────────────────
  listTemplateGroups: () =>
    apiFetch<{ groups: Array<{ groupid: string; name: string; template_count: number }> }>("/dc/template-groups"),
  createTemplateGroup: (name: string) =>
    apiFetch<{ groupid: string; message: string }>("/dc/template-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
  updateTemplateGroup: (groupid: string, name: string) =>
    apiFetch<{ message: string }>(`/dc/template-groups/${groupid}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
  deleteTemplateGroup: (groupid: string) =>
    apiFetch<{ message: string }>(`/dc/template-groups/${groupid}`, { method: "DELETE" }),
  getTemplateGroupMembers: (groupid: string) =>
    apiFetch<{ templates: Array<{ templateid: string; name: string; description: string }> }>(`/dc/template-groups/${groupid}/members`),

  listHostGroups: () =>
    apiFetch<{ groups: Array<{ groupid: string; name: string; host_count: number }> }>("/dc/host-groups"),
  createHostGroup: (name: string) =>
    apiFetch<{ groupid: string; message: string }>("/dc/host-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
  updateHostGroup: (groupid: string, name: string) =>
    apiFetch<{ message: string }>(`/dc/host-groups/${groupid}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
  deleteHostGroup: (groupid: string) =>
    apiFetch<{ message: string }>(`/dc/host-groups/${groupid}`, { method: "DELETE" }),
  getHostGroupMembers: (groupid: string) =>
    apiFetch<{ hosts: Array<{ hostid: string; host: string; name: string; status: number }> }>(`/dc/host-groups/${groupid}/members`),

  listDcTemplates: (search?: string) =>
    apiFetch<{
      templates: Array<{
        templateid: string;
        name: string;
        description: string;
        groups: Array<{ groupid: string; name: string }>;
        linked_templates: Array<{ templateid: string; name: string }>;
      }>;
    }>(`/dc/templates${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createDcTemplate: (payload: {
    name: string;
    group_ids: string[];
    description?: string;
    visible_name?: string;
    template_ids?: string[];
    tags?: Array<{ tag: string; value: string }>;
    macros?: Array<{ macro: string; value: string; description?: string }>;
  }) =>
    apiFetch<{ templateid: string; message: string }>("/dc/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteDcTemplate: (templateid: string) =>
    apiFetch<{ message: string }>(`/dc/templates/${templateid}`, { method: "DELETE" }),

  listMaintenances: () =>
    apiFetch<{
      maintenances: Array<{
        maintenanceid: string;
        name: string;
        maintenance_type: string;
        active_since: number;
        active_till: number;
        description: string;
        hosts: Array<{ hostid: string; name: string }>;
        groups: Array<{ groupid: string; name: string }>;
      }>;
    }>("/dc/maintenances"),
  createMaintenance: (payload: {
    name: string;
    maintenance_type: number;
    active_since: number;
    active_till: number;
    hostids?: string[];
    groupids?: string[];
    description?: string;
  }) =>
    apiFetch<{ maintenanceid: string; message: string }>("/dc/maintenances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteMaintenance: (maintenanceid: string) =>
    apiFetch<{ message: string }>(`/dc/maintenances/${maintenanceid}`, { method: "DELETE" }),

  listCorrelations: () =>
    apiFetch<{
      correlations: Array<{
        correlationid: string;
        name: string;
        description: string;
        status: string;
        condition_count: number;
        operation_count: number;
      }>;
    }>("/dc/correlations"),
  createCorrelation: (payload: { name: string; description?: string; status?: number; conditions?: Array<{ type: number; operator: number; tag?: string; value?: string }>; evaltype?: number; operation_type?: number }) =>
    apiFetch<{ correlationid: string; message: string }>("/dc/correlations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteCorrelation: (correlationid: string) =>
    apiFetch<{ message: string }>(`/dc/correlations/${correlationid}`, { method: "DELETE" }),

  listDiscoveryRules: () =>
    apiFetch<{
      rules: Array<{
        druleid: string;
        name: string;
        iprange: string;
        delay: string;
        status: string;
        nextcheck: number;
        check_count: number;
      }>;
    }>("/dc/discovery-rules"),
  createDiscoveryRule: (payload: { name: string; iprange: string; delay: string; check_types: string[]; ports?: string }) =>
    apiFetch<{ druleid: string; message: string }>("/dc/discovery-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteDiscoveryRule: (druleid: string) =>
    apiFetch<{ message: string }>(`/dc/discovery-rules/${druleid}`, { method: "DELETE" }),

  // ── Reports ──────────────────────────────────────────────────────────
  getTopTriggers: (params?: { limit?: number; severity_min?: number; hours?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.severity_min != null) q.set("severity_min", String(params.severity_min));
    if (params?.hours != null) q.set("hours", String(params.hours));
    return apiFetch<{ triggers: Array<{ triggerid: string; description: string; priority: number; severity_label: string; lastchange: number; status: number; value: number; hosts: Array<{ hostid: string; host: string }>; last_event: Record<string, unknown> | null }> }>(`/reports/top-triggers${q.toString() ? `?${q}` : ""}`);
  },
  getAuditLog: (params?: { limit?: number; hours?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.hours != null) q.set("hours", String(params.hours));
    return apiFetch<{ entries: Array<{ auditid: string; userid: string; username: string; clock: number; action: string; resourcetype: string; resourceid: string; resourcename: string; ip: string; details: string }> }>(`/reports/audit-log${q.toString() ? `?${q}` : ""}`);
  },
  getActionLog: (params?: { limit?: number; hours?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.hours) q.set("hours", String(params.hours));
    return apiFetch<{ entries: Array<{ alertid: string; actionid: string; eventid: string; clock: number; message: string; subject: string; sendto: string; status: number; retries: number; error: string; alerttype: number; mediatypeid: string; userid: string }> }>(`/reports/action-log${q.toString() ? `?${q}` : ""}`);
  },
  getAvailability: (params?: { hours?: number; groupid?: string }) => {
    const q = new URLSearchParams();
    if (params?.hours) q.set("hours", String(params.hours));
    if (params?.groupid) q.set("groupid", params.groupid);
    return apiFetch<{ hosts: Array<{ hostid: string; hostname: string; downtime_seconds: number; problem_count: number; availability_pct: number }> }>(`/reports/availability${q.toString() ? `?${q}` : ""}`);
  },
  getNotificationHistory: (params?: { hours?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.hours) q.set("hours", String(params.hours));
    if (params?.limit) q.set("limit", String(params.limit));
    return apiFetch<{ notifications: Array<{ alertid: string; clock: number; sendto: string; subject: string; status: number; status_label: string; error: string; username: string; media_type: string }> }>(`/reports/notifications${q.toString() ? `?${q}` : ""}`);
  },
  getAuthSettings: () =>
    apiFetch<Record<string, string>>("/admin/auth"),
  updateAuthSettings: (payload: Record<string, string | number>) =>
    apiFetch<{ ok: boolean }>("/admin/auth", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),

  // ── Actions ───────────────────────────────────────────────────────────
  listActions: (eventsource?: number) =>
    apiFetch<{ actions: Array<{ actionid: string; name: string; eventsource: number; eventsource_label: string; status: number; esc_period: string; condition_count: number; operation_count: number }> }>(`/actions${eventsource != null ? `?eventsource=${eventsource}` : ""}`),
  createAction: (payload: { name: string; eventsource: number; esc_period?: string }) =>
    apiFetch<{ actionid: string }>("/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteAction: (actionid: string) =>
    apiFetch<{ ok: boolean }>(`/actions/${actionid}`, { method: "DELETE" }),
  toggleAction: (actionid: string, status: number) =>
    apiFetch<{ ok: boolean }>(`/actions/${actionid}/toggle`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),

  // ── Media Types ───────────────────────────────────────────────────────
  listMediaTypes: () =>
    apiFetch<{ media_types: Array<{ mediatypeid: string; name: string; type: number; type_label: string; status: number; description: string }> }>("/media-types"),
  createMediaType: (payload: { name: string; type: number; description?: string; smtp_server?: string; smtp_helo?: string; smtp_email?: string; script?: string; webhook_script?: string }) =>
    apiFetch<{ mediatypeid: string }>("/media-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteMediaType: (mediatypeid: string) =>
    apiFetch<{ ok: boolean }>(`/media-types/${mediatypeid}`, { method: "DELETE" }),
  toggleMediaType: (mediatypeid: string, status: number) =>
    apiFetch<{ ok: boolean }>(`/media-types/${mediatypeid}/toggle`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),

  // ── Scripts ───────────────────────────────────────────────────────────
  listScripts: () =>
    apiFetch<{ scripts: Array<{ scriptid: string; name: string; command: string; execute_on: number; execute_on_label: string; scope: number; scope_label: string; description: string; groupid: string }> }>("/scripts"),
  createScript: (payload: { name: string; command: string; execute_on?: number; scope?: number; description?: string }) =>
    apiFetch<{ scriptid: string }>("/scripts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteScript: (scriptid: string) =>
    apiFetch<{ ok: boolean }>(`/scripts/${scriptid}`, { method: "DELETE" }),

  // ── Zabbix users (for group assignment) ──────────────────────────────
  listZabbixUsers: () =>
    apiFetch<{ users: Array<{ userid: string; username: string; display: string }> }>("/zabbix-users"),

  // ── User Groups ───────────────────────────────────────────────────────
  listUserGroups: () =>
    apiFetch<{ groups: Array<{ usrgrpid: string; name: string; gui_access: number; gui_access_label: string; users_status: number; users_status_label: string; user_count: number; users: Array<{ userid: string; username: string }> }> }>("/user-groups"),
  createUserGroup: (payload: {
    name: string;
    gui_access?: number;
    users_status?: number;
    debug_mode?: number;
    userids?: string[];
    hostgroup_rights?: Array<{ id: string; permission: number }>;
    templategroup_rights?: Array<{ id: string; permission: number }>;
    tag_filters?: Array<{ groupid: string; tag?: string; value?: string }>;
  }) =>
    apiFetch<{ usrgrpid: string }>("/user-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteUserGroup: (usrgrpid: string) =>
    apiFetch<{ ok: boolean }>(`/user-groups/${usrgrpid}`, { method: "DELETE" }),

  // ── Roles ─────────────────────────────────────────────────────────────
  listZabbixRoles: () =>
    apiFetch<{ roles: Array<{ roleid: string; name: string; type: number; type_label: string; readonly: number; rule_count: number }> }>("/roles"),
  createRole: (payload: {
    name: string;
    type: number;
    ui_access?: Record<string, boolean>;
    ui_default_access?: number;
    services_read_mode?: number;
    services_write_mode?: number;
    modules_default_access?: number;
    api_access?: number;
  }) =>
    apiFetch<{ roleid: string }>("/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  updateRole: (roleid: string, payload: { name: string }) =>
    apiFetch<{ ok: boolean }>(`/roles/${roleid}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteRole: (roleid: string) =>
    apiFetch<{ ok: boolean }>(`/roles/${roleid}`, { method: "DELETE" }),

  // ── API Tokens ────────────────────────────────────────────────────────
  listApiTokens: () =>
    apiFetch<{ tokens: Array<{ tokenid: string; name: string; userid: string; username: string; status: number; expires_at: number; created_at: number; lastaccess: number }> }>("/api-tokens"),
  createApiToken: (payload: { name: string; userid: string; expires_at?: number }) =>
    apiFetch<{ tokenid: string; token: string | null }>("/api-tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteApiToken: (tokenid: string) =>
    apiFetch<{ ok: boolean }>(`/api-tokens/${tokenid}`, { method: "DELETE" }),

  // ── Administration ────────────────────────────────────────────────────
  listProxies: () =>
    apiFetch<{ proxies: Array<{ proxyid: string; name: string; mode: number; mode_label: string; description: string; lastaccess: number; version: string; host_count: number }> }>("/proxies"),
  createProxy: (payload: { name: string; operating_mode: number; description?: string }) =>
    apiFetch<{ proxyid: string }>("/proxies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  updateProxy: (proxyid: string, payload: { name: string; description?: string }) =>
    apiFetch<{ ok: boolean }>(`/proxies/${proxyid}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteProxy: (proxyid: string) =>
    apiFetch<{ ok: boolean }>(`/proxies/${proxyid}`, { method: "DELETE" }),
  listProxyGroups: () =>
    apiFetch<{ proxy_groups: Array<{ proxygroupid: string; name: string; failover_delay: string; min_online: number; description: string; proxy_count: number }> }>("/proxy_groups"),
  createProxyGroup: (payload: { name: string; failover_delay?: string; min_online?: number; description?: string }) =>
    apiFetch<{ proxygroupid: string }>("/proxy_groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteProxyGroup: (proxygroupid: string) =>
    apiFetch<{ ok: boolean }>(`/proxy_groups/${proxygroupid}`, { method: "DELETE" }),
  listMacros: () =>
    apiFetch<{ macros: Array<{ globalmacroid: string; macro: string; value: string; type: number; type_label: string; description: string }> }>("/macros"),
  createMacro: (payload: { macro: string; value: string; description?: string; type?: number }) =>
    apiFetch<{ globalmacroid: string }>("/macros", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  updateMacro: (globalmacroid: string, payload: { value: string; description?: string }) =>
    apiFetch<{ ok: boolean }>(`/macros/${globalmacroid}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteMacro: (globalmacroid: string) =>
    apiFetch<{ ok: boolean }>(`/macros/${globalmacroid}`, { method: "DELETE" }),
  getQueue: () =>
    apiFetch<{ items: Array<Record<string, string>>; total: number; error?: string }>("/admin/queue"),
  getAdminSettings: () =>
    apiFetch<Record<string, string>>("/admin/settings"),
  updateHousekeeping: (payload: Record<string, string | number>) =>
    apiFetch<{ ok: boolean }>("/admin/housekeeping", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),

  // ── Services ──────────────────────────────────────────────────────────
  listServices: (parentid?: string) =>
    apiFetch<{ services: Array<{ serviceid: string; name: string; algorithm: number; algorithm_label: string; sortorder: number; weight: number; status: number; description: string; tags: Array<{ tag: string; value: string }>; children: Array<{ serviceid: string; name: string }>; parents: Array<{ serviceid: string; name: string }> }> }>(`/services${parentid ? `?parentid=${parentid}` : ""}`),
  createService: (payload: { name: string; algorithm?: number; sortorder?: number; weight?: number; description?: string }) =>
    apiFetch<{ serviceid: string }>("/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  updateService: (serviceid: string, payload: { name?: string; algorithm?: number; description?: string }) =>
    apiFetch<{ ok: boolean }>(`/services/${serviceid}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteService: (serviceid: string) =>
    apiFetch<{ ok: boolean }>(`/services/${serviceid}`, { method: "DELETE" }),

  // ── SLA ───────────────────────────────────────────────────────────────
  listSlas: () =>
    apiFetch<{ slas: Array<{ slaid: string; name: string; slo: number; period: string; period_label: string; timezone: string; description: string; status: number; effective_date: number; service_tags: Array<{ tag: string; value: string }> }> }>("/sla"),
  createSla: (payload: { name: string; slo: number; period?: string; timezone?: string; description?: string; service_tags?: Array<{ tag: string; value: string }> }) =>
    apiFetch<{ slaid: string }>("/sla", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteSla: (slaid: string) =>
    apiFetch<{ ok: boolean }>(`/sla/${slaid}`, { method: "DELETE" }),
  getSlaReport: (slaid: string, periods?: number) =>
    apiFetch<{ report: Array<Record<string, unknown>> }>(`/sla/${slaid}/report${periods ? `?periods=${periods}` : ""}`),

  // ── Health Monitors ───────────────────────────────────────────────────
  listHealthMonitors: (hostid?: string) =>
    apiFetch<{ monitors: Array<{ itemid: string; name: string; host: string; hostid: string; url: string; expected: string; running: boolean; working: boolean; last_value: string | null; last_check: number | null; proc_itemid: string | null; has_proc_check: boolean }> }>(`/health-monitors${hostid ? `?hostid=${hostid}` : ""}`),
  createHealthMonitor: (payload: { hostid: string; name: string; url: string; expected_contains?: string; process_name?: string }) =>
    apiFetch<{ itemid: string; proc_itemid: string | null }>("/health-monitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteHealthMonitor: (itemid: string) =>
    apiFetch<{ ok: boolean }>(`/health-monitors/${itemid}`, { method: "DELETE" }),
};
