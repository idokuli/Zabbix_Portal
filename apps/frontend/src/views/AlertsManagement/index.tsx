"use client";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import { Alert, Box, Card, Snackbar, Stack, Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ActionsPanel } from "./ActionsPanel";
import { MediaTypesTab } from "./MediaTypesTab";
import { ScriptsTab } from "./ScriptsTab";

const TAB_SLUGS = [
  "trigger-actions",
  "service-actions",
  "discovery-actions",
  "autoregistration",
  "internal",
  "media-types",
  "scripts",
];

const AlertsManagementInner = () => {
  const searchParams = useSearchParams();
  const tab = Math.max(0, TAB_SLUGS.indexOf(searchParams.get("tab") ?? ""));
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });
  const showToast = (message: string, sev: "success" | "error") =>
    setToast({ open: true, message, severity: sev });

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <NotificationsActiveOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Alerts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Trigger, service, discovery, autoregistration, and internal actions; media types and
            scripts.
          </Typography>
        </Box>
      </Box>
      <Card>
        <Box sx={{ p: 2 }}>
          {tab === 0 && (
            <ActionsPanel eventsource={0} title="Trigger Actions" showToast={showToast} />
          )}
          {tab === 1 && (
            <ActionsPanel eventsource={4} title="Service Actions" showToast={showToast} />
          )}
          {tab === 2 && (
            <ActionsPanel eventsource={1} title="Discovery Actions" showToast={showToast} />
          )}
          {tab === 3 && (
            <ActionsPanel eventsource={2} title="Autoregistration Actions" showToast={showToast} />
          )}
          {tab === 4 && (
            <ActionsPanel eventsource={3} title="Internal Actions" showToast={showToast} />
          )}
          {tab === 5 && <MediaTypesTab showToast={showToast} />}
          {tab === 6 && <ScriptsTab showToast={showToast} />}
        </Box>
      </Card>
      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
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
