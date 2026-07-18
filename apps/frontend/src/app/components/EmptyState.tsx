"use client";

import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

export const EmptyState = ({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) => (
  <Box
    sx={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 0.5,
      py: 4,
      color: "text.disabled",
    }}
  >
    {icon}
    <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500 }}>
      {title}
    </Typography>
    {description && (
      <Typography variant="caption" sx={{ color: "text.disabled" }}>
        {description}
      </Typography>
    )}
  </Box>
);
