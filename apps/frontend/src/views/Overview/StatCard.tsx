"use client";
import { Box, Card, CardContent, LinearProgress, Skeleton, Typography } from "@mui/material";
import Link from "next/link";

export const StatCard = ({
  icon,
  label,
  value,
  sub,
  color = "primary.main",
  loading,
  href,
  availability,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
  loading: boolean;
  href?: string;
  availability?: { value: number; total: number; color: string };
}) => (
  <Card
    component={href ? Link : "div"}
    href={href}
    sx={{
      height: "100%",
      textDecoration: "none",
      cursor: href ? "pointer" : "default",
      border: "none",
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
      "&:hover": href ? { transform: "translateY(-2px)", boxShadow: 6 } : {},
    }}
  >
    <CardContent sx={{ p: 2.5, pb: "20px !important" }}>
      <Box
        sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1.5 }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            bgcolor: `${color}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color,
          }}
        >
          {icon}
        </Box>
        {sub && !loading && (
          <Typography
            variant="caption"
            sx={{ color: "text.disabled", fontSize: "0.68rem", mt: 0.5 }}
          >
            {sub}
          </Typography>
        )}
      </Box>

      {loading ? (
        <>
          <Skeleton variant="text" width={52} height={40} sx={{ mb: 0.25 }} />
          <Skeleton variant="text" width={90} height={16} />
        </>
      ) : (
        <>
          <Typography
            sx={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1.1, letterSpacing: -1, color }}
          >
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: "0.775rem" }}>
            {label}
          </Typography>
        </>
      )}

      {availability && !loading && (
        <Box sx={{ mt: 1.5 }}>
          <LinearProgress
            variant="determinate"
            value={availability.total ? (availability.value / availability.total) * 100 : 0}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: "action.hover",
              "& .MuiLinearProgress-bar": { bgcolor: availability.color, borderRadius: 2 },
            }}
          />
          <Typography
            variant="caption"
            sx={{ color: "text.disabled", fontSize: "0.68rem", mt: 0.5, display: "block" }}
          >
            {availability.value}/{availability.total} available
          </Typography>
        </Box>
      )}
    </CardContent>
  </Card>
);
