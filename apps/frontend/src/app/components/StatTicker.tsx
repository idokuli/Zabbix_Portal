"use client";

import { Box, Paper, Typography } from "@mui/material";
import Link from "next/link";
import type { ReactNode } from "react";
import { monoFontFamily } from "../theme";

export type TickerStat = { label: string; value: ReactNode; href?: string; tone?: string };

const TickerContent = ({ s }: { s: TickerStat }) => (
  <>
    <Typography
      sx={{
        fontSize: "0.625rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "text.secondary",
      }}
    >
      {s.label}
    </Typography>
    <Typography
      sx={{
        fontFamily: monoFontFamily,
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: s.tone ?? "text.primary",
      }}
    >
      {s.value}
    </Typography>
  </>
);

// Mono readout line — replaces the boxed "stat card" strip everywhere.
// Same instrument-panel language as Overview's EstateTicker.
export const StatTicker = ({ stats, sx }: { stats: TickerStat[]; sx?: object }) => (
  <Paper
    sx={{
      mb: 2,
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      overflow: "hidden",
      "& > a:not(:first-of-type), & > div:not(:first-of-type)": {
        borderLeft: "1px solid",
        borderLeftColor: "divider",
      },
      ...sx,
    }}
  >
    {stats.map((s) => {
      const itemSx = {
        display: "flex",
        alignItems: "baseline",
        gap: 0.75,
        px: 1.75,
        py: 0.9,
        whiteSpace: "nowrap" as const,
      };
      return s.href ? (
        <Box
          key={s.label}
          component={Link}
          href={s.href}
          sx={{ ...itemSx, textDecoration: "none", "&:hover": { bgcolor: "action.hover" } }}
        >
          <TickerContent s={s} />
        </Box>
      ) : (
        <Box key={s.label} sx={itemSx}>
          <TickerContent s={s} />
        </Box>
      );
    })}
  </Paper>
);
