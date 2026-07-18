"use client";
import { Box, Tooltip, Typography } from "@mui/material";
import type { Problem } from "../../app/api";
import { severityOf } from "../../app/severity";

const formatAge = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  return `${Math.floor(seconds / 86400)}d ago`;
};

export const ProblemRow = ({ problem }: { problem: Problem }) => {
  const sev = severityOf(problem.severity);
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        py: 1,
        "&:not(:last-child)": { borderBottom: "1px solid", borderColor: "divider" },
      }}
    >
      <Tooltip title={sev.label} placement="top">
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: sev.color,
            flexShrink: 0,
          }}
        />
      </Tooltip>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Tooltip title={problem.name} placement="top-start">
          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
            {problem.name}
          </Typography>
        </Tooltip>
        <Typography variant="caption" color="text.secondary">
          {problem.hostname} · {formatAge(problem.age_seconds)}
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: sev.color, fontWeight: 500, flexShrink: 0 }}>
        {sev.label}
      </Typography>
    </Box>
  );
};
