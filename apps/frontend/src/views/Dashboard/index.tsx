"use client";
import { Box } from "@mui/material";
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
