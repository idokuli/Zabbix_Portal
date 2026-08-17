import { apiFetch } from "./fetch";
import type { UserRow } from "./types";

export const usersApi = {
  createUser: (payload: {
    username: string;
    password: string;
    email?: string;
    roles?: string[];
    restrictions?: string[];
    team_id?: number;
  }) =>
    apiFetch<{ id: number; username: string; roles: string[]; team_id: number | null }>("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  listUsers: () => apiFetch<{ users: UserRow[] }>("/users"),
  updateUser: (
    userId: number,
    payload: { roles: string[]; restrictions?: string[]; team_id: number | null },
  ) =>
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
};
