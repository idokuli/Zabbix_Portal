"use client";
import { Box } from "@mui/material";
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

  return (
    <Box>
      {tab === 0 && <ProblemsTab initialHost={searchParams.get("host") ?? ""} />}
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
