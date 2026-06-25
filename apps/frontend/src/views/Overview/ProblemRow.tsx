"use client";
import { Box, Chip, Tooltip, Typography } from "@mui/material";
import type { Problem } from "../../app/api";

const SEVERITY = [
  { label: "Not classified", color: "#9E9E9E" },
  { label: "Info", color: "#42A5F5" },
  { label: "Warning", color: "#FF9800" },
  { label: "Average", color: "#F44336" },
  { label: "High", color: "#E91E63" },
  { label: "Disaster", color: "#B71C1C" },
];

const formatAge = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export const ProblemRow = ({ problem }: { problem: Problem }) => {
  const sev = SEVERITY[Math.min(problem.severity, 5)] ?? SEVERITY[0];
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1.25,
        "&:not(:last-child)": { borderBottom: "1px solid", borderColor: "divider" },
      }}
    >
      <Box
        sx={{
          width: 3,
          alignSelf: "stretch",
          minHeight: 32,
          borderRadius: 2,
          bgcolor: sev.color,
          flexShrink: 0,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Tooltip title={problem.name} placement="top-start">
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "0.8125rem",
            }}
          >
            {problem.name}
          </Typography>
        </Tooltip>
        <Typography variant="caption" color="text.secondary">
          {problem.hostname} · {formatAge(problem.age_seconds)}
        </Typography>
      </Box>
      <Chip
        label={sev.label}
        size="small"
        sx={{
          bgcolor: `${sev.color}18`,
          color: sev.color,
          fontWeight: 700,
          fontSize: "0.65rem",
          height: 20,
          flexShrink: 0,
          border: `1px solid ${sev.color}40`,
        }}
      />
    </Box>
  );
};
