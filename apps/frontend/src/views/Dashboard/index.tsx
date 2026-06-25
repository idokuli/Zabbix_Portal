"use client";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChart";
import { Box, Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GraphsTab } from "./GraphsTab";
import { HostMetricsTab } from "./HostMetricsTab";
import { RecentItemsTab } from "./RecentItemsTab";

const TAB_SLUGS = ["graphs", "host-metrics", "recent-items"];

const DashboardInner = () => {
  const searchParams = useSearchParams();
  const tab = Math.max(0, TAB_SLUGS.indexOf(searchParams.get("tab") ?? ""));

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <ShowChartOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
          <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -0.5 }}>
            Dashboard
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          Zabbix graphs, host metrics, and monitoring activity
        </Typography>
      </Box>

      {tab === 0 && <GraphsTab />}
      {tab === 1 && <HostMetricsTab />}
      {tab === 2 && <RecentItemsTab />}
    </Box>
  );
};

export const Dashboard = () => (
  <Suspense fallback={null}>
    <DashboardInner />
  </Suspense>
);
