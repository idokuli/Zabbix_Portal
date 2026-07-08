export const fmtTs = (ts: number): string =>
  ts
    ? new Date(ts * 1000).toLocaleString("en-US", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

// crypto.randomUUID() requires a secure context (HTTPS / localhost).
// This fallback works on plain HTTP too.
export const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};
