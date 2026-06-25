"use client";
import { Chip } from "@mui/material";

export type TriggerRow = {
  triggerid: string;
  description: string;
  expression: string;
  priority: number;
  status: number;
  value: number; // 0 = OK, 1 = PROBLEM
  lastchange: number; // unix timestamp of last state change
};

export const SEVERITY_CONFIG = [
  { severity: 0, label: "Not classified", color: "#9E9E9E" },
  { severity: 1, label: "Information", color: "#2196F3" },
  { severity: 2, label: "Warning", color: "#FFC107" },
  { severity: 3, label: "Average", color: "#FF5722" },
  { severity: 4, label: "High", color: "#F44336" },
  { severity: 5, label: "Disaster", color: "#B71C1C" },
];

export const timeAgo = (ts: number): string => {
  if (!ts) return "never";
  const secs = Math.floor(Date.now() / 1000) - ts;
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

export const SeverityChip = ({ priority }: { priority: number }) => {
  const cfg = SEVERITY_CONFIG.find((s) => s.severity === priority) ?? SEVERITY_CONFIG[0];
  return (
    <Chip
      label={cfg.label}
      size="small"
      variant="outlined"
      sx={{ height: 18, fontSize: "0.65rem", borderColor: cfg.color, color: cfg.color }}
    />
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
