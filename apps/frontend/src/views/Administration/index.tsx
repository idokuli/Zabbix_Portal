"use client";
import { Alert, Box, Card, Snackbar, Stack } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { AuthenticationTab } from "../UsersManagement/AuthenticationTab";
import { HousekeepingTab } from "./HousekeepingTab";
import { MacrosTab } from "./MacrosTab";
import { ProxiesTab } from "./ProxiesTab";
import { ProxyGroupsTab } from "./ProxyGroupsTab";

const TAB_SLUGS = ["proxies", "proxy-groups", "macros", "housekeeping", "authentication"];

const AdministrationInner = () => {
  const searchParams = useSearchParams();
  const tab = Math.max(0, TAB_SLUGS.indexOf(searchParams.get("tab") ?? ""));
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });
  // Stable identity is load-bearing: each tab's data-loading useCallback depends
  // on showToast, so a fresh function reference here on every render would give
  // that useCallback a new identity too, re-firing its fetch-on-mount effect —
  // harmless while every load() succeeds (this component doesn't re-render on
  // its own), but the moment a load() fails and calls showToast(), the toast
  // state update re-renders this component, which — without useCallback — would
  // recreate showToast, recreate the tab's load(), re-fire the effect, fail
  // again, call showToast again... an infinite request loop. Exactly what
  // happens when a user without the right role hits an admin-only tab: every
  // attempt reliably 403s, so nothing ever breaks the cycle.
  const showToast = useCallback(
    (message: string, sev: "success" | "error") => setToast({ open: true, message, severity: sev }),
    [],
  );

  return (
    <Stack spacing={3}>
      <Card>
        <Box sx={{ p: 2 }}>
          {tab === 0 && <ProxiesTab showToast={showToast} />}
          {tab === 1 && <ProxyGroupsTab showToast={showToast} />}
          {tab === 2 && <MacrosTab showToast={showToast} />}
          {tab === 3 && <HousekeepingTab showToast={showToast} />}
          {tab === 4 && <AuthenticationTab showToast={showToast} />}
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

export const Administration = () => (
  <Suspense fallback={null}>
    <AdministrationInner />
  </Suspense>
);
