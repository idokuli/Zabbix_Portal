"use client";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import { Alert, Box, Card, Snackbar, Stack, Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CorrelationTab } from "./CorrelationTab";
import { DiscoveryTab } from "./DiscoveryTab";
import { HostGroupsTab } from "./HostGroupsTab";
import { MaintenanceTab } from "./MaintenanceTab";
import { TemplateGroupsTab } from "./TemplateGroupsTab";
import { TemplatesTab } from "./TemplatesTab";

const TAB_SLUGS = [
  "template-groups",
  "host-groups",
  "templates",
  "maintenance",
  "event-correlation",
  "discovery",
];

const DataCollectionInner = () => {
  const searchParams = useSearchParams();
  const tab = Math.max(0, TAB_SLUGS.indexOf(searchParams.get("tab") ?? ""));
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const showToast = (message: string, sev: "success" | "error") =>
    setToast({ open: true, message, severity: sev });

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <StorageOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Data Collection
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage template groups, host groups, templates, maintenance windows, event correlations,
            and discovery rules.
          </Typography>
        </Box>
      </Box>

      <Card>
        <Box sx={{ p: 2 }}>
          {tab === 0 && <TemplateGroupsTab showToast={showToast} />}
          {tab === 1 && <HostGroupsTab showToast={showToast} />}
          {tab === 2 && <TemplatesTab showToast={showToast} />}
          {tab === 3 && <MaintenanceTab showToast={showToast} />}
          {tab === 4 && <CorrelationTab showToast={showToast} />}
          {tab === 5 && <DiscoveryTab showToast={showToast} />}
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

export const DataCollection = () => (
  <Suspense fallback={null}>
    <DataCollectionInner />
  </Suspense>
);
