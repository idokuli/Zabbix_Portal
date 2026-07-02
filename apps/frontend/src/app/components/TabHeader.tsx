"use client";

import { Box, Typography } from "@mui/material";

export const TabHeader = ({ title, description }: { title: string; description: string }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="h5" fontWeight={700}>
      {title}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {description}
    </Typography>
  </Box>
);
