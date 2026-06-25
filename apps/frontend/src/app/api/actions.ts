import { apiFetch } from "./fetch";

export const actionsApi = {
  listActions: (eventsource?: number) =>
    apiFetch<{
      actions: Array<{
        actionid: string;
        name: string;
        eventsource: number;
        eventsource_label: string;
        status: number;
        esc_period: string;
        condition_count: number;
        operation_count: number;
      }>;
    }>(`/actions${eventsource != null ? `?eventsource=${eventsource}` : ""}`),
  createAction: (payload: { name: string; eventsource: number; esc_period?: string }) =>
    apiFetch<{ actionid: string }>("/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteAction: (actionid: string) =>
    apiFetch<{ ok: boolean }>(`/actions/${actionid}`, { method: "DELETE" }),
  toggleAction: (actionid: string, status: number) =>
    apiFetch<{ ok: boolean }>(`/actions/${actionid}/toggle`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  listMediaTypes: () =>
    apiFetch<{
      media_types: Array<{
        mediatypeid: string;
        name: string;
        type: number;
        type_label: string;
        status: number;
        description: string;
      }>;
    }>("/media-types"),
  createMediaType: (payload: {
    name: string;
    type: number;
    description?: string;
    smtp_server?: string;
    smtp_helo?: string;
    smtp_email?: string;
    script?: string;
    webhook_script?: string;
  }) =>
    apiFetch<{ mediatypeid: string }>("/media-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateMediaType: (
    mediatypeid: string,
    payload: {
      name: string;
      type: number;
      description?: string;
      smtp_server?: string;
      smtp_email?: string;
      script?: string;
      webhook_script?: string;
    },
  ) =>
    apiFetch<{ ok: boolean }>(`/media-types/${mediatypeid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteMediaType: (mediatypeid: string) =>
    apiFetch<{ ok: boolean }>(`/media-types/${mediatypeid}`, { method: "DELETE" }),
  toggleMediaType: (mediatypeid: string, status: number) =>
    apiFetch<{ ok: boolean }>(`/media-types/${mediatypeid}/toggle`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  listScripts: () =>
    apiFetch<{
      scripts: Array<{
        scriptid: string;
        name: string;
        command: string;
        execute_on: number;
        execute_on_label: string;
        scope: number;
        scope_label: string;
        description: string;
        groupid: string;
      }>;
    }>("/scripts"),
  createScript: (payload: {
    name: string;
    command: string;
    execute_on?: number;
    scope?: number;
    description?: string;
  }) =>
    apiFetch<{ scriptid: string }>("/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteScript: (scriptid: string) =>
    apiFetch<{ ok: boolean }>(`/scripts/${scriptid}`, { method: "DELETE" }),
};
