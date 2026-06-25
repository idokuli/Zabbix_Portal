import { clearToken, getToken } from "../../lib/auth";

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

export const apiFetchBlob = async (path: string): Promise<Blob | null> => {
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

export const apiFetch = async <T>(
  path: string,
  init?: RequestInit,
  opts?: { skipRedirect?: boolean },
): Promise<T> => {
  const token = getToken();
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (token) headers.set("Authorization", `Bearer ${token}`);
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
