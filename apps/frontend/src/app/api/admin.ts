import { apiFetch } from "./fetch";
// biome-ignore lint/suspicious/noShadowRestrictedNames: Zabbix domain type
import type { Proxy, ProxyConfig } from "./types";

export const adminApi = {
  getAuthSettings: () => apiFetch<Record<string, string>>("/admin/auth"),
  updateAuthSettings: (payload: Record<string, string | number>) =>
    apiFetch<{ ok: boolean }>("/admin/auth", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  testLdapConnection: (payload: {
    host: string;
    port: number;
    base_dn: string;
    bind_dn?: string;
    bind_password?: string;
    search_attribute: string;
    start_tls?: number;
    search_filter?: string;
    userdirectoryid?: string;
    test_username: string;
    test_password: string;
  }) =>
    apiFetch<{ result: boolean | Record<string, unknown> }>("/admin/auth/ldap/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  listLdapServers: () =>
    apiFetch<{
      servers: Array<{
        userdirectoryid: string;
        name: string;
        host: string;
        port: string;
        base_dn: string;
        bind_dn: string;
        search_attribute: string;
        description: string;
        provision_status: string;
        usrgrp_count: number;
        is_default: boolean;
      }>;
    }>("/admin/auth/ldap/servers"),
  getLdapServer: (id: string) =>
    apiFetch<{
      userdirectoryid: string;
      name: string;
      host: string;
      port: string;
      base_dn: string;
      search_attribute: string;
      bind_dn: string;
      bind_password: string;
      description: string;
      start_tls: string;
      search_filter: string;
      provision_status: string;
      group_name: string;
      group_member: string;
      user_username: string;
      user_lastname: string;
      provision_groups: Array<{ name: string; roleid: string; user_groups: string[] }>;
      provision_media: Array<{
        name: string;
        mediatypeid: string;
        attribute: string;
        period: string;
        severity: number;
        active: number;
      }>;
    }>(`/admin/auth/ldap/servers/${id}`),
  createLdapServer: (payload: {
    name: string;
    host: string;
    port: number;
    base_dn: string;
    search_attribute: string;
    bind_dn?: string;
    bind_password?: string;
    description?: string;
    start_tls?: number;
    search_filter?: string;
    provision_status?: number;
  }) =>
    apiFetch<{ userdirectoryid: string }>("/admin/auth/ldap/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateLdapServer: (
    id: string,
    payload: {
      name: string;
      host: string;
      port: number;
      base_dn: string;
      search_attribute: string;
      bind_dn?: string;
      bind_password?: string;
      description?: string;
      start_tls?: number;
      search_filter?: string;
      provision_status?: number;
    },
  ) =>
    apiFetch<{ ok: boolean }>(`/admin/auth/ldap/servers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteLdapServer: (id: string) =>
    apiFetch<{ ok: boolean }>(`/admin/auth/ldap/servers/${id}`, { method: "DELETE" }),
  setDefaultLdapServer: (id: string) =>
    apiFetch<{ ok: boolean }>(`/admin/auth/ldap/servers/${id}/default`, { method: "POST" }),
  getPortalLdapConfig: () =>
    apiFetch<{
      enabled: boolean;
      host: string;
      port: number;
      use_ssl: boolean;
      start_tls: boolean;
      base_dn: string;
      bind_dn: string;
      bind_password: string;
      search_attribute: string;
      search_filter: string;
    }>("/admin/auth/portal-ldap"),
  savePortalLdapConfig: (payload: {
    enabled: boolean;
    host: string;
    port: number;
    use_ssl: boolean;
    start_tls: boolean;
    base_dn: string;
    bind_dn: string;
    bind_password: string;
    search_attribute: string;
    search_filter: string;
  }) =>
    apiFetch<{ ok: boolean }>("/admin/auth/portal-ldap", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  testPortalLdap: (payload: {
    host?: string;
    port?: number;
    use_ssl?: boolean;
    start_tls?: boolean;
    base_dn?: string;
    bind_dn?: string;
    bind_password?: string;
    search_attribute?: string;
    search_filter?: string;
    test_username?: string;
    test_password?: string;
  }) =>
    apiFetch<{ ok: boolean; message: string }>("/admin/auth/portal-ldap/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  listZabbixUsers: () =>
    apiFetch<{ users: Array<{ userid: string; username: string; display: string }> }>(
      "/zabbix-users",
    ),
  listUserGroups: () =>
    apiFetch<{
      groups: Array<{
        usrgrpid: string;
        name: string;
        gui_access: number;
        gui_access_label: string;
        users_status: number;
        users_status_label: string;
        user_count: number;
        users: Array<{ userid: string; username: string }>;
      }>;
    }>("/user-groups"),
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
    apiFetch<{ usrgrpid: string }>("/user-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteUserGroup: (usrgrpid: string) =>
    apiFetch<{ ok: boolean }>(`/user-groups/${usrgrpid}`, { method: "DELETE" }),
  listZabbixRoles: () =>
    apiFetch<{
      roles: Array<{
        roleid: string;
        name: string;
        type: number;
        type_label: string;
        readonly: number;
        rule_count: number;
      }>;
    }>("/roles"),
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
    apiFetch<{ roleid: string }>("/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateRole: (roleid: string, payload: { name: string }) =>
    apiFetch<{ ok: boolean }>(`/roles/${roleid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteRole: (roleid: string) =>
    apiFetch<{ ok: boolean }>(`/roles/${roleid}`, { method: "DELETE" }),
  listApiTokens: () =>
    apiFetch<{
      tokens: Array<{
        tokenid: string;
        name: string;
        userid: string;
        username: string;
        status: number;
        expires_at: number;
        created_at: number;
        lastaccess: number;
      }>;
    }>("/api-tokens"),
  createApiToken: (payload: { name: string; userid: string; expires_at?: number }) =>
    apiFetch<{ tokenid: string; token: string | null }>("/api-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteApiToken: (tokenid: string) =>
    apiFetch<{ ok: boolean }>(`/api-tokens/${tokenid}`, { method: "DELETE" }),
  listProxies: () => apiFetch<{ proxies: Proxy[] }>("/proxies"),
  createProxy: (payload: ProxyConfig) =>
    apiFetch<{ proxyid: string }>("/proxies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateProxy: (proxyid: string, payload: ProxyConfig) =>
    apiFetch<{ ok: boolean }>(`/proxies/${proxyid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteProxy: (proxyid: string) =>
    apiFetch<{ ok: boolean }>(`/proxies/${proxyid}`, { method: "DELETE" }),
  listProxyGroups: () =>
    apiFetch<{
      proxy_groups: Array<{
        proxygroupid: string;
        name: string;
        failover_delay: string;
        min_online: number;
        description: string;
        proxy_count: number;
      }>;
    }>("/proxy_groups"),
  createProxyGroup: (payload: {
    name: string;
    failover_delay?: string;
    min_online?: number;
    description?: string;
  }) =>
    apiFetch<{ proxygroupid: string }>("/proxy_groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteProxyGroup: (proxygroupid: string) =>
    apiFetch<{ ok: boolean }>(`/proxy_groups/${proxygroupid}`, { method: "DELETE" }),
  listMacros: () =>
    apiFetch<{
      macros: Array<{
        globalmacroid: string;
        macro: string;
        value: string;
        type: number;
        type_label: string;
        description: string;
      }>;
    }>("/macros"),
  createMacro: (payload: { macro: string; value: string; description?: string; type?: number }) =>
    apiFetch<{ globalmacroid: string }>("/macros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateMacro: (globalmacroid: string, payload: { value: string; description?: string }) =>
    apiFetch<{ ok: boolean }>(`/macros/${globalmacroid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteMacro: (globalmacroid: string) =>
    apiFetch<{ ok: boolean }>(`/macros/${globalmacroid}`, { method: "DELETE" }),
  getQueue: () =>
    apiFetch<{ items: Array<Record<string, string>>; total: number; error?: string }>(
      "/admin/queue",
    ),
  getAdminSettings: () => apiFetch<Record<string, string>>("/admin/settings"),
  updateHousekeeping: (payload: Record<string, string | number>) =>
    apiFetch<{ ok: boolean }>("/admin/housekeeping", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};
