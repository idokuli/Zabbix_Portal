"use client";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useCallback, useState } from "react";
import { api } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { fmtTs, TimeBar } from "./shared";
import { useReportLoader } from "./useReportLoader";

const ACTION_COLOR: Record<string, "success" | "info" | "error" | "default"> = {
  create: "success",
  update: "info",
  delete: "error",
};

export const PortalActionsTab = () => {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<
    Array<{
      id: number;
      username: string;
      method: string;
      path: string;
      action: string;
      status_code: number;
      ip: string;
      clock: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      api
        .getPortalActions({ limit: 200, hours })
        .then((r) => setData(r.entries))
        .catch((err: unknown) => {
          console.error("Failed to load portal action log:", err);
        })
        .finally(() => setLoading(false));
    },
    [hours],
  );
  useReportLoader(load);

  return (
    <Stack spacing={2}>
      <TabHeader
        title="Portal Actions"
        description="Who did what inside the portal, correctly attributed to the real logged-in user. Unlike the Zabbix Audit Log, every write to Zabbix goes through one shared service account, so Zabbix's own log can't show this."
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <TimeBar hours={hours} onChange={setHours} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </Button>
        {loading && <CircularProgress size={14} />}
        <Chip
          label={`${data.length} entries`}
          size="small"
          sx={{ height: 20, fontSize: "0.65rem" }}
        />
      </Box>
      <TableContainer
        sx={{
          border: "1px solid",
          borderColor: "divider",
          maxHeight: 560,
          overflow: "auto",
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 140 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 130 }}>User</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 90 }}>Action</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Endpoint</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 90 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 120 }}>IP</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No portal actions in this window.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {data.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "0.72rem",
                    color: "text.secondary",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtTs(e.clock)}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {e.username || "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={e.action}
                    size="small"
                    color={ACTION_COLOR[e.action] ?? "default"}
                    variant="outlined"
                    sx={{ height: 18, fontSize: "0.6rem" }}
                  />
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                    noWrap
                  >
                    {e.method} {e.path}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: "monospace",
                      color: e.status_code >= 400 ? "error.main" : "text.disabled",
                    }}
                  >
                    {e.status_code}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: "monospace", color: "text.disabled" }}
                  >
                    {e.ip || "—"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};
