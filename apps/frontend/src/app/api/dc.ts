import { apiFetch } from "./fetch";
import type { HostGroup } from "./types";

export const dcApi = {
  listTemplateGroups: () =>
    apiFetch<{ groups: Array<{ groupid: string; name: string; template_count: number }> }>(
      "/dc/template-groups",
    ),
  createTemplateGroup: (name: string) =>
    apiFetch<{ groupid: string; message: string }>("/dc/template-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  updateTemplateGroup: (groupid: string, name: string) =>
    apiFetch<{ message: string }>(`/dc/template-groups/${groupid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  deleteTemplateGroup: (groupid: string) =>
    apiFetch<{ message: string }>(`/dc/template-groups/${groupid}`, { method: "DELETE" }),
  getTemplateGroupMembers: (groupid: string) =>
    apiFetch<{ templates: Array<{ templateid: string; name: string; description: string }> }>(
      `/dc/template-groups/${groupid}/members`,
    ),
  setTemplateGroupMembers: (groupid: string, templateids: string[]) =>
    apiFetch<{ ok: boolean }>(`/dc/template-groups/${groupid}/members`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateids }),
    }),
  listHostGroups: (opts?: { mine?: boolean }) =>
    apiFetch<{ groups: HostGroup[] }>(`/dc/host-groups${opts?.mine ? "?scope=mine" : ""}`),
  createHostGroup: (name: string) =>
    apiFetch<{ groupid: string; message: string }>("/dc/host-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  updateHostGroup: (groupid: string, name: string) =>
    apiFetch<{ message: string }>(`/dc/host-groups/${groupid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  deleteHostGroup: (groupid: string) =>
    apiFetch<{ message: string }>(`/dc/host-groups/${groupid}`, { method: "DELETE" }),
  getHostGroupMembers: (groupid: string) =>
    apiFetch<{ hosts: Array<{ hostid: string; host: string; name: string; status: number }> }>(
      `/dc/host-groups/${groupid}/members`,
    ),
  setHostGroupMembers: (groupid: string, hostids: string[]) =>
    apiFetch<{ ok: boolean }>(`/dc/host-groups/${groupid}/members`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostids }),
    }),
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
    apiFetch<{ templateid: string; message: string }>("/dc/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getDcTemplate: (templateid: string) =>
    apiFetch<{
      templateid: string;
      name: string;
      visible_name: string;
      description: string;
      item_count: number;
      groups: Array<{ groupid: string; name: string }>;
      linked_templates: Array<{ templateid: string; name: string }>;
      tags: Array<{ tag: string; value: string }>;
      macros: Array<{ macro: string; value: string; description: string }>;
    }>(`/dc/templates/${templateid}`),
  updateDcTemplate: (
    templateid: string,
    payload: {
      name?: string;
      visible_name?: string;
      description?: string;
      group_ids?: string[];
      template_ids?: string[];
      tags?: Array<{ tag: string; value: string }>;
      macros?: Array<{ macro: string; value: string; description?: string }>;
    },
  ) =>
    apiFetch<{ message: string }>(`/dc/templates/${templateid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
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
    apiFetch<{ maintenanceid: string; message: string }>("/dc/maintenances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
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
  createCorrelation: (payload: {
    name: string;
    description?: string;
    status?: number;
    conditions?: Array<{ type: number; operator: number; tag?: string; value?: string }>;
    evaltype?: number;
    operation_type?: number;
  }) =>
    apiFetch<{ correlationid: string; message: string }>("/dc/correlations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
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
  createDiscoveryRule: (payload: {
    name: string;
    iprange: string;
    delay: string;
    check_types: string[];
    ports?: string;
  }) =>
    apiFetch<{ druleid: string; message: string }>("/dc/discovery-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteDiscoveryRule: (druleid: string) =>
    apiFetch<{ message: string }>(`/dc/discovery-rules/${druleid}`, { method: "DELETE" }),
};
