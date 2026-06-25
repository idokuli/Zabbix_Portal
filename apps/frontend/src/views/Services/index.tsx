"use client";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import { Alert, Box, Card, Snackbar, Stack, Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ServicesTab } from "./ServicesTab";
import { SlaTab } from "./SlaTab";

const TAB_SLUGS = ["services", "sla"];

const ServicesInner = () => {
  const searchParams = useSearchParams();
  const tab =
    TAB_SLUGS.indexOf(searchParams.get("tab") ?? "") >= 0
      ? TAB_SLUGS.indexOf(searchParams.get("tab") ?? "")
      : 0;
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
        <AccountTreeOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Services
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Service health tree and SLA definitions.
          </Typography>
        </Box>
      </Box>
      <Card>
        <Box sx={{ p: 2 }}>
          {tab === 0 && <ServicesTab showToast={showToast} />}
          {tab === 1 && <SlaTab showToast={showToast} />}
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

export const Services = () => (
  <Suspense fallback={null}>
    <ServicesInner />
  </Suspense>
);
