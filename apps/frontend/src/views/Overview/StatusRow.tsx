"use client";
import { Box, Chip, Skeleton, Typography } from "@mui/material";

export const StatusRow = ({
  label,
  ok,
  loading,
}: { label: string; ok: boolean; loading: boolean }) => (
  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          bgcolor: loading ? "action.disabled" : ok ? "success.main" : "error.main",
          boxShadow: loading
            ? "none"
            : ok
              ? "0 0 6px rgba(34,197,94,0.6)"
              : "0 0 6px rgba(239,68,68,0.6)",
        }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8125rem" }}>
        {label}
      </Typography>
    </Box>
    {loading ? (
      <Skeleton variant="rounded" width={48} height={18} />
    ) : (
      <Chip
        size="small"
        label={ok ? "Online" : "Offline"}
        color={ok ? "success" : "error"}
        variant="outlined"
        sx={{ height: 20, fontSize: "0.67rem", fontWeight: 600 }}
      />
    )}
  </Box>
);
