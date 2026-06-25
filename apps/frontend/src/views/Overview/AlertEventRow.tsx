"use client";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
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
      gap: 1.5,
      py: 1,
      "&:not(:last-child)": { borderBottom: "1px solid", borderColor: "divider" },
    }}
  >
    <NotificationsActiveOutlinedIcon sx={{ fontSize: 16, color: "warning.main", flexShrink: 0 }} />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        variant="body2"
        sx={{
          fontSize: "0.78rem",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {event.item_name}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {event.hostname} · {event.operator}
        {event.threshold}
      </Typography>
    </Box>
    <Typography
      variant="caption"
      sx={{ color: "text.disabled", flexShrink: 0, fontSize: "0.68rem" }}
    >
      {formatEventTime(event.fired_at)}
    </Typography>
  </Box>
);
