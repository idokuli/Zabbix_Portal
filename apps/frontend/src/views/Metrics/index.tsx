"use client";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import { Box, Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AlertRulesTab } from "./AlertRulesTab";
import { ItemHistoryTab } from "./ItemHistoryTab";
import { LatestDataTab } from "./LatestDataTab";
import { NotificationsTab } from "./NotificationsTab";
import { ProblemHistoryTab } from "./ProblemHistoryTab";
import { ProblemsTab } from "./ProblemsTab";

const TAB_SLUGS = [
  "problems",
  "notifications",
  "item-graphs",
  "alert-rules",
  "history",
  "latest-data",
];

const MetricsInner = () => {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(() => {
    const i = TAB_SLUGS.indexOf(searchParams.get("tab") ?? "");
    return i >= 0 ? i : 0;
  });

  useEffect(() => {
    const i = TAB_SLUGS.indexOf(searchParams.get("tab") ?? "");
    setTab(i >= 0 ? i : 0);
  }, [searchParams]);

  const PAGE_META = [
    { title: "Metrics", subtitle: "Active problems and alert notifications" },
    { title: "Notifications", subtitle: "Zabbix notification delivery history" },
    { title: "Item Graphs", subtitle: "Item history charts and time-series graphs" },
    { title: "Alerts", subtitle: "Custom threshold alert rules and fired events" },
    { title: "Problem History", subtitle: "Search and filter past Zabbix problem events" },
    {
      title: "Latest Data",
      subtitle: "See the most recent collected value for every item on a host",
    },
  ];
  const meta = PAGE_META[tab] ?? PAGE_META[0];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <ShowChartOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
          <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -0.5 }}>
            {meta.title}
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          {meta.subtitle}
        </Typography>
      </Box>

      {tab === 0 && <ProblemsTab />}
      {tab === 1 && <NotificationsTab />}
      {tab === 2 && <ItemHistoryTab />}
      {tab === 3 && <AlertRulesTab />}
      {tab === 4 && <ProblemHistoryTab />}
      {tab === 5 && <LatestDataTab />}
    </Box>
  );
};

export const Metrics = () => (
  <Suspense fallback={null}>
    <MetricsInner />
  </Suspense>
);
