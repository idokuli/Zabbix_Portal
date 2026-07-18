"use client";
import { Box, Typography } from "@mui/material";
import type { AlertEvent } from "../../app/api";

const formatEventTime = (ts: number): string => {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const AlertEventRow = ({ event }: { event: AlertEvent }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.25,
      py: 1,
      "&:not(:last-child)": { borderBottom: "1px solid", borderColor: "divider" },
    }}
  >
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        bgcolor: "warning.main",
        flexShrink: 0,
      }}
    />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
        {event.item_name}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {event.hostname} · {event.operator}
        {event.threshold}
      </Typography>
    </Box>
    <Typography variant="caption" sx={{ color: "text.disabled", flexShrink: 0 }}>
      {formatEventTime(event.fired_at)}
    </Typography>
  </Box>
);
