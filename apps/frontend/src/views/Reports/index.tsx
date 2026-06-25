"use client";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import { Box, Card, Stack, Typography } from "@mui/material";
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <AssessmentOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Availability, top triggers, audit log, action log, and notifications.
          </Typography>
        </Box>
      </Box>
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
