"use client";
import { Box, Typography } from "@mui/material";
import { SEVERITIES } from "../../app/severity";

export type TriggerRow = {
  triggerid: string;
  description: string;
  expression: string;
  priority: number;
  status: number;
  value: number; // 0 = OK, 1 = PROBLEM
  lastchange: number; // unix timestamp of last state change
};

export const SEVERITY_CONFIG = SEVERITIES.map((s) => ({
  severity: s.value,
  label: s.label,
  color: s.color,
}));

export const timeAgo = (ts: number): string => {
  if (!ts) {
    return "never";
  }
  const secs = Math.floor(Date.now() / 1000) - ts;
  if (secs < 60) {
    return `${secs}s ago`;
  }
  if (secs < 3600) {
    return `${Math.floor(secs / 60)}m ago`;
  }
  if (secs < 86400) {
    return `${Math.floor(secs / 3600)}h ago`;
  }
  return `${Math.floor(secs / 86400)}d ago`;
};

export const SeverityChip = ({ priority }: { priority: number }) => {
  const cfg = SEVERITY_CONFIG.find((s) => s.severity === priority) ?? SEVERITY_CONFIG[0];
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

export const operators = [
  { value: ">", label: ">" },
  { value: ">=", label: ">=" },
  { value: "<", label: "<" },
  { value: "<=", label: "<=" },
  { value: "=", label: "=" },
  { value: "<>", label: "≠" },
];
