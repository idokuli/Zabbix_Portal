"use client";
import { Box, Skeleton, Typography } from "@mui/material";

export const StatusRow = ({
  label,
  ok,
  loading,
}: {
  label: string;
  ok: boolean;
  loading: boolean;
}) => (
  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    {loading ? (
      <Skeleton variant="text" width={64} height={16} />
    ) : (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            bgcolor: ok ? "success.main" : "error.main",
          }}
        />
        <Typography
          variant="caption"
          sx={{ color: ok ? "text.secondary" : "error.main", fontWeight: 500 }}
        >
          {ok ? "Operational" : "Down"}
        </Typography>
      </Box>
    )}
  </Box>
);
