"use client";
import { Box, Button } from "@mui/material";

export const fmtTs = (ts: number) =>
  ts
    ? new Date(ts * 1000).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })
    : "—";

export const TIME_OPTS = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
];

export const TimeBar = ({ hours, onChange }: { hours: number; onChange: (h: number) => void }) => (
  <Box sx={{ display: "flex", gap: 0.5 }}>
    {TIME_OPTS.map((o) => (
      <Button
        key={o.label}
        size="small"
        variant={hours === o.hours ? "contained" : "outlined"}
        onClick={() => onChange(o.hours)}
        sx={{ minWidth: 40, px: 1, fontSize: "0.72rem", textTransform: "none" }}
      >
        {o.label}
      </Button>
    ))}
  </Box>
);
