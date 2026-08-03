"use client";

import { Box, CircularProgress, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { monoFontFamily } from "../theme";

// Terminal-style section header: uppercase tracked title, mono count,
// muted description, right-aligned actions, closed by a hairline rule.
// Tabs must not repeat their own title in a toolbar row below — pass
// `count`/`actions` here instead.
export const TabHeader = ({
  title,
  description,
  count,
  loading = false,
  actions,
}: {
  title: string;
  description: string;
  count?: number;
  loading?: boolean;
  actions?: ReactNode;
}) => (
  <Box
    sx={{
      mb: 2,
      pb: 1.5,
      borderBottom: "1px solid",
      borderColor: "divider",
      display: "flex",
      alignItems: "flex-start",
      gap: 2,
    }}
  >
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Typography
          component="h2"
          sx={{
            fontSize: "0.8125rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {title}
        </Typography>
        {loading ? (
          <CircularProgress size={12} />
        ) : (
          count !== undefined && (
            <Typography
              component="span"
              sx={{
                fontFamily: monoFontFamily,
                fontSize: "0.6875rem",
                color: "text.secondary",
                border: "1px solid",
                borderColor: "divider",
                px: 0.75,
                lineHeight: 1.7,
              }}
            >
              {count}
            </Typography>
          )
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
        {description}
      </Typography>
    </Box>
    {actions && (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>{actions}</Box>
    )}
  </Box>
);
