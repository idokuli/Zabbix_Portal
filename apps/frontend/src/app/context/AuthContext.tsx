"use client";

import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { type AuthUser, clearToken, setToken } from "../../lib/auth";
import { api } from "../api";

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me({ skipRedirect: true })
      .then((me) => setUser(me))
      .catch(() => {
        clearToken();
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    setToken(res.access_token);
    const me = await api.me();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    // Clear HttpOnly cookie server-side, then clear any legacy client-side cookie.
    void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      clearToken();
      setUser(null);
      window.location.href = "/login";
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be inside AuthProvider");
  }
  return ctx;
};

// root/auditor can see every team's data (e.g. the "All Teams" dashboard scope) —
// mirrors is_global_viewer() in apps/backend/api/deps.py.
export const useCanViewAllTeams = () => {
  const { user } = useAuth();
  return !!user?.roles?.some((r) => r === "root" || r === "auditor");
};
