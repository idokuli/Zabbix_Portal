import { apiFetch } from "./fetch";

export const itemsApi = {
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
    apply_team_tag?: boolean;
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
  updateItem: (
    itemid: string,
    payload: { name?: string; delay?: string; status?: string; key_?: string },
  ) =>
    apiFetch<{ ok: boolean }>(`/items/${itemid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
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
        host_available: string;
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
      host_available: string;
    }>(`/triggers/${encodeURIComponent(hostname)}`),
  deleteTrigger: (triggerid: string) =>
    apiFetch<{ message: string }>(`/triggers/${triggerid}`, { method: "DELETE" }),
  updateTrigger: (
    triggerid: string,
    payload: {
      description?: string;
      priority?: number;
      status?: number;
      expression?: string;
      event_name?: string;
      comments?: string;
    },
  ) =>
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
    apply_team_tag?: boolean;
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
  addProcessItem: (payload: {
    hostname: string;
    process_name: string;
    run_as_user?: string;
    cmdline_regex?: string;
    state?: string;
    item_name?: string;
    create_trigger?: boolean;
    trigger_priority?: number;
    delay?: string;
    history?: string;
    trends?: string;
    description?: string;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addWindowsServiceItem: (payload: {
    hostname: string;
    service_name: string;
    item_name?: string;
    create_trigger?: boolean;
    trigger_priority?: number;
    delay?: string;
    history?: string;
    trends?: string;
    description?: string;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/winsvc", {
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
    apiFetch<{
      message: string;
      itemid: string;
      triggerid: string | null;
      trigger_error: string | null;
    }>("/items/filewatch", {
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
    apply_team_tag?: boolean;
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
    hostname: string;
    item_name: string;
    item_key?: string;
    snmp_oid: string;
    value_type?: number;
    snmp_version?: number;
    snmp_community?: string;
    snmpv3_securityname?: string;
    snmpv3_securitylevel?: number;
    snmpv3_authprotocol?: number;
    snmpv3_authpassphrase?: string;
    snmpv3_privprotocol?: number;
    snmpv3_privpassphrase?: string;
    snmpv3_contextname?: string;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/snmp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addSnmpTrapItem: (payload: {
    hostname: string;
    item_name: string;
    item_key?: string;
    value_type?: number;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/snmptrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addInternalItem: (payload: {
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
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addTrapperItem: (payload: {
    hostname: string;
    item_name: string;
    item_key: string;
    value_type?: number;
    allow_traps?: boolean;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/trapper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addExternalItem: (payload: {
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
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addIpmiItem: (payload: {
    hostname: string;
    item_name?: string;
    ipmi_sensor: string;
    item_key?: string;
    value_type?: number;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/ipmi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addSshItem: (payload: {
    hostname: string;
    item_name: string;
    params: string;
    item_key?: string;
    authtype?: number;
    username?: string;
    password?: string;
    publickey?: string;
    privatekey?: string;
    value_type?: number;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
    timeout?: string;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/ssh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addTelnetItem: (payload: {
    hostname: string;
    item_name: string;
    params: string;
    item_key?: string;
    username?: string;
    password?: string;
    value_type?: number;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/telnet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addJmxItem: (payload: {
    hostname: string;
    item_name: string;
    item_key: string;
    jmx_endpoint?: string;
    username?: string;
    password?: string;
    value_type?: number;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/jmx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addCalculatedItem: (payload: {
    hostname: string;
    item_name: string;
    item_key: string;
    formula: string;
    value_type?: number;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/calculated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addDependentItem: (payload: {
    hostname: string;
    item_name: string;
    item_key: string;
    master_itemid: string;
    value_type?: number;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/dependent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addZabbixScriptItem: (payload: {
    hostname: string;
    item_name: string;
    item_key: string;
    params: string;
    parameters?: Array<{ name: string; value: string }>;
    value_type?: number;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
    timeout?: string;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/zabbix-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  addBrowserItem: (payload: {
    hostname: string;
    item_name: string;
    item_key: string;
    params: string;
    parameters?: Array<{ name: string; value: string }>;
    value_type?: number;
    delay?: string;
    units?: string;
    history?: string;
    trends?: string;
    description?: string;
    status?: number;
    timeout?: string;
  }) =>
    apiFetch<{ message: string; itemid: string }>("/items/browser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    apply_team_tag?: boolean;
  }) =>
    apiFetch<{
      message: string;
      results: Array<{ hostname: string; item_id: string | null; error: string | null }>;
    }>("/items/bulk", {
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
    apiFetch<{
      message: string;
      results: Array<{ hostname: string; trigger_id: string | null; error: string | null }>;
    }>("/triggers/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};
