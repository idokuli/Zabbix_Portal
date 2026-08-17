"use client";
import { Alert, Box, Card, Snackbar, Stack } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { ApiTokensTab } from "./ApiTokensTab";
import { AuthenticationTab } from "./AuthenticationTab";
import { RolesTab } from "./RolesTab";
import { UserGroupsTab } from "./UserGroupsTab";

const TAB_SLUGS = ["user-groups", "roles", "api-tokens", "authentication"];

const UsersManagementInner = () => {
  const searchParams = useSearchParams();
  const tab = Math.max(0, TAB_SLUGS.indexOf(searchParams.get("tab") ?? ""));
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });
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
          {tab === 0 && <UserGroupsTab showToast={showToast} />}
          {tab === 1 && <RolesTab showToast={showToast} />}
          {tab === 2 && <ApiTokensTab showToast={showToast} />}
          {tab === 3 && <AuthenticationTab showToast={showToast} />}
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

export const UsersManagement = () => (
  <Suspense fallback={null}>
    <UsersManagementInner />
  </Suspense>
);
