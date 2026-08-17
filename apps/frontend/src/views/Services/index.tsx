"use client";
import { Alert, Box, Card, Snackbar, Stack } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
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
