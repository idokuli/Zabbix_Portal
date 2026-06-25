"use client";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import { Alert, Box, Card, Snackbar, Stack, Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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
  const showToast = (message: string, sev: "success" | "error") =>
    setToast({ open: true, message, severity: sev });

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <PeopleOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Zabbix user groups, roles, API tokens, and authentication settings.
          </Typography>
        </Box>
      </Box>

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
