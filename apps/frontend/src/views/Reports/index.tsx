"use client";
import { Box, Card, Stack } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { NotificationsTab } from "../Metrics/NotificationsTab";
import { ActionLogTab } from "./ActionLogTab";
import { AuditLogTab } from "./AuditLogTab";
import { AvailabilityTab } from "./AvailabilityTab";
import { TopTriggersTab } from "./TopTriggersTab";

const TAB_SLUGS = ["availability", "top-triggers", "audit-log", "action-log", "notifications"];

const ReportsInner = () => {
  const searchParams = useSearchParams();
  const tab = Math.max(0, TAB_SLUGS.indexOf(searchParams.get("tab") ?? ""));

  return (
    <Stack spacing={3}>
      <Card>
        <Box sx={{ p: 2 }}>
          {tab === 0 && <AvailabilityTab />}
          {tab === 1 && <TopTriggersTab />}
          {tab === 2 && <AuditLogTab />}
          {tab === 3 && <ActionLogTab />}
          {tab === 4 && <NotificationsTab />}
        </Box>
      </Card>
    </Stack>
  );
};

export const Reports = () => (
  <Suspense fallback={null}>
    <ReportsInner />
  </Suspense>
);
