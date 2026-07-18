"use client";

import { Box, Typography } from "@mui/material";

export const TabHeader = ({ title, description }: { title: string; description: string }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="subtitle1">{title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
      {description}
    </Typography>
  </Box>
);
