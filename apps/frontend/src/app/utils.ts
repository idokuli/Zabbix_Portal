import { formatDateTime } from "./datetime";

// Uppercase "B" = bytes (Zabbix "B", "KB", ...ps variants); lowercase "b" = bits
// (Zabbix "bps", "Kbps", ...) and must never be treated as the byte scale — a
// 1000 Kbps link is 1000 kilobits/sec, not 1000 kilobytes/sec.
const BYTE_UNIT_SCALE = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
const RATE_SUFFIX_RE = /ps$/;

const parseByteUnit = (units: string): { rateSuffix: string; scaleIndex: number } | null => {
  const trimmed = units.trim();
  const isRate = RATE_SUFFIX_RE.test(trimmed);
  const base = isRate ? trimmed.slice(0, -2) : trimmed;
  const scaleIndex = BYTE_UNIT_SCALE.findIndex((u) => u === base);
  return scaleIndex === -1 ? null : { rateSuffix: isRate ? "ps" : "", scaleIndex };
};

export const isByteUnit = (units: string): boolean => !!units && parseByteUnit(units) !== null;

// Rescales a value already labeled with a byte-size unit (B/KB/MB/GB/TB/.../Bps/KBps/...)
// to whichever unit reads best, e.g. formatSizeValue(100000000, "MB") -> "95.4 TB".
// Falls back to plain "value units" for anything that isn't a recognized byte unit.
export const formatSizeValue = (rawValue: string | number, units: string): string => {
  const parsed = units ? parseByteUnit(units) : null;
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!parsed || Number.isNaN(value)) {
    return units ? `${rawValue} ${units}` : `${rawValue}`;
  }
  if (value === 0) {
    return `0 ${BYTE_UNIT_SCALE[parsed.scaleIndex]}${parsed.rateSuffix}`;
  }

  let scaled = value * 1024 ** parsed.scaleIndex;
  let scaleIndex = 0;
  while (Math.abs(scaled) >= 1024 && scaleIndex < BYTE_UNIT_SCALE.length - 1) {
    scaled /= 1024;
    scaleIndex++;
  }
  const abs = Math.abs(scaled);
  const rounded =
    abs < 10 ? scaled.toFixed(2) : abs < 100 ? scaled.toFixed(1) : Math.round(scaled).toString();
  return `${rounded} ${BYTE_UNIT_SCALE[scaleIndex]}${parsed.rateSuffix}`;
};

/** Kept as a thin alias so existing call sites keep working; the format lives in datetime.ts. */
export const fmtTs = (ts: number): string => formatDateTime(ts);

// crypto.randomUUID() requires a secure context (HTTPS / localhost).
// This fallback works on plain HTTP too.
export const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};
