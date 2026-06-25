"use client";
import { Chip } from "@mui/material";

// ── Constants ────────────────────────────────────────────────────────

export const getRuleSounds = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem("alertRuleSounds") ?? "{}");
  } catch {
    return {};
  }
};

export const PERIOD_OPTIONS = [
  { label: "1 m", minutes: 1 },
  { label: "5 m", minutes: 5 },
  { label: "15 m", minutes: 15 },
  { label: "30 m", minutes: 30 },
  { label: "1 h", minutes: 60 },
  { label: "3 h", minutes: 180 },
  { label: "6 h", minutes: 360 },
  { label: "12 h", minutes: 720 },
  { label: "24 h", minutes: 1440 },
  { label: "7 d", minutes: 10080 },
] as const;

export const SEVERITY_CONFIG = [
  { severity: 5, label: "Critical", color: "#B71C1C", bg: "rgba(183,28,28,0.12)" },
  { severity: 4, label: "High", color: "#F44336", bg: "rgba(244,67,54,0.12)" },
  { severity: 3, label: "Medium", color: "#FF5722", bg: "rgba(255,87,34,0.12)" },
  { severity: 2, label: "Low", color: "#FFC107", bg: "rgba(255,193,7,0.12)" },
  { severity: 1, label: "Info", color: "#2196F3", bg: "rgba(33,150,243,0.12)" },
  { severity: 0, label: "None", color: "#9E9E9E", bg: "rgba(158,158,158,0.12)" },
] as const;

export const PRESET_COLORS = [
  "#1BA7F5",
  "#00BFB3",
  "#F77B00",
  "#9170B8",
  "#E7664C",
  "#22C55E",
  "#F44336",
  "#FFC107",
  "#8B5CF6",
  "#D36086",
  "#54B399",
  "#D6BF57",
];

// ── Types ─────────────────────────────────────────────────────────────

export type ItemDef = {
  itemid: string;
  name: string;
  key_: string;
  value_type: string;
  delay: string;
};

// ── Helpers ───────────────────────────────────────────────────────────

export const formatAge = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
};

export const formatTimestamp = (clock: number, minutes?: number): string => {
  const d = new Date(clock * 1000);
  if (minutes !== undefined && minutes <= 5) {
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }
  if (minutes !== undefined && minutes >= 1440) {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
};

// ── Severity chip ─────────────────────────────────────────────────────

export const SeverityChip = ({ severity }: { severity: number }) => {
  const cfg = SEVERITY_CONFIG.find((s) => s.severity === severity) ?? SEVERITY_CONFIG[5];
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        height: 20,
        fontSize: "0.68rem",
        fontWeight: 700,
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.color}40`,
      }}
    />
  );
};

// ── Re-exports ────────────────────────────────────────────────────────

export { ItemChart } from "./ItemChart";
export { AddMetricDialog } from "./AddMetricDialog";
export { MetricConfigDialog } from "./MetricConfigDialog";
export { MetricWidgetCard } from "./MetricWidgetCard";
