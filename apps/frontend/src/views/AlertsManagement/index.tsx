"use client";
import { Alert, Box, Card, Snackbar, Stack, Tab, Tabs } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ActionsPanel } from "./ActionsPanel";
import { MediaTypesTab } from "./MediaTypesTab";
import { NotificationHistoryTab } from "./NotificationHistoryTab";
import { ScriptsTab } from "./ScriptsTab";

const TABS = [
  { slug: "trigger-actions", label: "Trigger Actions" },
  { slug: "service-actions", label: "Service Actions" },
  { slug: "discovery-actions", label: "Discovery Actions" },
  { slug: "autoregistration", label: "Autoregistration" },
  { slug: "internal", label: "Internal" },
  { slug: "media-types", label: "Media Types" },
  { slug: "scripts", label: "Scripts" },
  { slug: "notification-history", label: "Notification History" },
];

const AlertsManagementInner = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tab, setTab] = useState(() => {
    const i = TABS.findIndex((t) => t.slug === searchParams.get("tab"));
    return i >= 0 ? i : 0;
  });

  useEffect(() => {
    const i = TABS.findIndex((t) => t.slug === searchParams.get("tab"));
    setTab(i >= 0 ? i : 0);
  }, [searchParams]);

  const handleTabChange = (_: React.SyntheticEvent, next: number) => {
    setTab(next);
    router.replace(`/alerts-management?tab=${TABS[next].slug}`, { scroll: false });
  };

  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });
  const showToast = (message: string, sev: "success" | "error") =>
    setToast({ open: true, message, severity: sev });

  return (
    <Stack spacing={3}>
      <Card>
        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            px: 1,
            minHeight: 42,
            "& .MuiTab-root": {
              minHeight: 42,
              fontSize: "0.78rem",
              textTransform: "none",
              fontWeight: 500,
            },
          }}
        >
          {TABS.map((t) => (
            <Tab key={t.slug} label={t.label} />
          ))}
        </Tabs>

        <Box sx={{ p: 2 }}>
          {tab === 0 && (
            <ActionsPanel
              eventsource={0}
              title="Trigger Actions"
              description="Actions triggered by item threshold violations and trigger state changes."
              showToast={showToast}
            />
          )}
          {tab === 1 && (
            <ActionsPanel
              eventsource={4}
              title="Service Actions"
              description="Actions triggered by business service status changes."
              showToast={showToast}
            />
          )}
          {tab === 2 && (
            <ActionsPanel
              eventsource={1}
              title="Discovery Actions"
              description="Actions triggered when hosts or services are automatically discovered."
              showToast={showToast}
            />
          )}
          {tab === 3 && (
            <ActionsPanel
              eventsource={2}
              title="Autoregistration Actions"
              description="Actions triggered when new Zabbix agents register automatically."
              showToast={showToast}
            />
          )}
          {tab === 4 && (
            <ActionsPanel
              eventsource={3}
              title="Internal Actions"
              description="Actions triggered by internal Zabbix events such as item or trigger state changes."
              showToast={showToast}
            />
          )}
          {tab === 5 && <MediaTypesTab showToast={showToast} />}
          {tab === 6 && <ScriptsTab showToast={showToast} />}
          {tab === 7 && <NotificationHistoryTab />}
        </Box>
      </Card>

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export const AlertsManagement = () => (
  <Suspense fallback={null}>
    <AlertsManagementInner />
  </Suspense>
);
