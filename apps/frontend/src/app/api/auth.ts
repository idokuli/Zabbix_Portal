import { apiFetch } from "./fetch";

export const authApi = {
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
  me: (opts?: { skipRedirect?: boolean }) =>
    apiFetch<{
      sub: string;
      username: string;
      display_name: string;
      roles: string[];
      team_id: number | null;
    }>("/auth/me", undefined, opts),
  ldapStatus: () =>
    apiFetch<{ enabled: boolean }>("/auth/ldap-status", undefined, { skipRedirect: true }),
};
