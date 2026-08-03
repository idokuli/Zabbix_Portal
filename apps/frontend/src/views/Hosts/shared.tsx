"use client";
import { Box, Tooltip, Typography } from "@mui/material";
import type { HostInterface } from "../../app/api";

export const IFACE_BADGE: Record<string, string> = {
  "1": "ZBX",
  "2": "SNM",
  "3": "IPMI",
  "4": "JMX",
};

export const AVAIL_CONFIG: Record<
  string,
  { bg: string; border: string; text: string; label: string }
> = {
  "1": { bg: "#1A7F37", border: "#2EA043", text: "#fff", label: "Available" },
  "2": { bg: "#A40E26", border: "#D1383D", text: "#fff", label: "Unavailable" },
  "0": { bg: "#3A414D", border: "#6E7681", text: "#E2E4E8", label: "Unknown" },
};

// State badge — solid fill, high-contrast. Reserved for health/status
// signals (Availability, Enabled/Disabled). Metadata (proxy, tags) uses the
// separate outlined chip language instead — two clear tiers, not four.
export const AvailabilityCell = ({ interfaces }: { interfaces?: HostInterface[] }) => {
  if (!interfaces || interfaces.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }
  const iface = interfaces.find((i) => i.type === "1") ?? interfaces[0];
  const badge = IFACE_BADGE[iface.type] ?? "N/A";
  const avail = AVAIL_CONFIG[iface.available] ?? AVAIL_CONFIG["0"];
  return (
    <Tooltip title={avail.label} placement="top">
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          px: 1,
          py: 0.3,
          border: `1px solid ${avail.border}`,
          bgcolor: avail.bg,
          cursor: "default",
          userSelect: "none",
        }}
      >
        <Typography
          sx={{ fontSize: "0.65rem", fontWeight: 700, color: avail.text, letterSpacing: "0.06em" }}
        >
          {badge}
        </Typography>
      </Box>
    </Tooltip>
  );
};

export const ProblemsCell = ({ count }: { count?: number }) => {
  if (!count) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
        —
      </Typography>
    );
  }
  const bg = count >= 5 ? "#D1383D" : "#BC4C00";
  return (
    <Tooltip title={`${count} active problem${count !== 1 ? "s" : ""}`} placement="top">
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 26,
          height: 22,
          borderRadius: "11px",
          bgcolor: bg,
          px: 0.8,
          cursor: "default",
        }}
      >
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff" }}>
          {count}
        </Typography>
      </Box>
    </Tooltip>
  );
};
