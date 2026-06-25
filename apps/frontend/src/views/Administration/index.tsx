"use client";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { Alert, Box, Card, Snackbar, Stack, Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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
  const showToast = (message: string, sev: "success" | "error") =>
    setToast({ open: true, message, severity: sev });

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <SettingsOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Administration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Proxies, macros, queue, housekeeping, and authentication settings.
          </Typography>
        </Box>
      </Box>

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
