"use client";
import { Alert, Box, Card, Snackbar, Stack } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
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
  // Stable identity is load-bearing — see Administration/index.tsx's showToast
  // for why: without useCallback, a failed load() in any tab would recreate
  // showToast, recreate that tab's load(), and re-fire its fetch effect in an
  // infinite loop (most visibly when a user lacks permission for the tab, since
  // every retry then reliably fails too).
  const showToast = useCallback(
    (message: string, sev: "success" | "error") => setToast({ open: true, message, severity: sev }),
    [],
  );

  return (
    <Stack spacing={3}>
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
