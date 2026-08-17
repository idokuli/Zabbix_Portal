"use client";
import { Box, Typography } from "@mui/material";
import { formatAxisTick } from "../../app/datetime";
import { SEVERITIES } from "../../app/severity";

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
  { label: "1 M", minutes: 43200 },
  { label: "3 M", minutes: 129600 },
  { label: "6 M", minutes: 273600 },
] as const;

export const SEVERITY_CONFIG = [...SEVERITIES]
  .reverse()
  .map((s) => ({ severity: s.value, label: s.label, color: s.color, bg: s.bg }));

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
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
};

/** Chart-axis label. Delegates to the canonical formatter — see app/datetime.ts. */
export const formatTimestamp = (clock: number, minutes?: number): string =>
  formatAxisTick(clock, minutes);

// ── Severity chip ─────────────────────────────────────────────────────

export const SeverityChip = ({ severity }: { severity: number }) => {
  const cfg = SEVERITY_CONFIG.find((s) => s.severity === severity) ?? SEVERITY_CONFIG[5];
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: cfg.color, flexShrink: 0 }} />
      <Typography
        variant="caption"
        sx={{ fontWeight: 500, whiteSpace: "nowrap", color: "text.primary" }}
      >
        {cfg.label}
      </Typography>
    </Box>
  );
};

// ── Re-exports ────────────────────────────────────────────────────────

export { AddMetricDialog } from "./AddMetricDialog";
export { ItemChart } from "./ItemChart";
export { MetricConfigDialog } from "./MetricConfigDialog";
export { MetricWidgetCard } from "./MetricWidgetCard";
