import { apiFetch } from "./fetch";
import type { Team } from "./types";

export type MyTeam = { id: number; name: string; display_order: number };

export const teamsApi = {
  getTeamsOverview: () => apiFetch<{ teams: Team[] }>("/teams/overview"),
  getMyTeams: () => apiFetch<{ teams: MyTeam[] }>("/teams/mine"),
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
  addTeamMember: (teamId: number, userId: number) =>
    apiFetch<{ message: string }>(`/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }),
  removeTeamMember: (teamId: number, userId: number) =>
    apiFetch<{ message: string }>(`/teams/${teamId}/members/${userId}`, {
      method: "DELETE",
    }),
  getTeamRoles: (teamId: number) => apiFetch<{ roles: string[] }>(`/teams/${teamId}/roles`),
  setTeamRoles: (teamId: number, roles: string[]) =>
    apiFetch<{ ok: boolean }>(`/teams/${teamId}/roles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles }),
    }),
  setTeamDisplayOrder: (teamId: number, displayOrder: number) =>
    apiFetch<{ ok: boolean }>(`/teams/${teamId}/display-order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_order: displayOrder }),
    }),
  getTeamGroups: (teamId: number) => apiFetch<{ groups: string[] }>(`/teams/${teamId}/groups`),
  linkTeamGroup: (teamId: number, groupName: string) =>
    apiFetch<{ ok: boolean }>(`/teams/${teamId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_name: groupName }),
    }),
  unlinkTeamGroup: (teamId: number, groupName: string) =>
    apiFetch<{ ok: boolean }>(`/teams/${teamId}/groups/${encodeURIComponent(groupName)}`, {
      method: "DELETE",
    }),
};
