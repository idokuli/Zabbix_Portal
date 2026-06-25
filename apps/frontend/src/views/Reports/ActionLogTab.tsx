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
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";
import { TimeBar, fmtTs } from "./shared";

const STATUS_COLORS: Record<number, string> = { 0: "#22C55E", 1: "#F59E0B", 2: "#EF4444" };
const STATUS_LABELS: Record<number, string> = { 0: "Sent", 1: "In progress", 2: "Failed" };

export const ActionLogTab = () => {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<
    Array<{
      alertid: string;
      clock: number;
      subject: string;
      sendto: string;
      status: number;
      error: string;
      alerttype: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getActionLog({ limit: 200, hours })
      .then((r) => setData(r.entries))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hours]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <TimeBar hours={hours} onChange={setHours} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={load}
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
          borderRadius: 1.5,
          maxHeight: 560,
          overflow: "auto",
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 140 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Subject</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 180 }}>Sent to</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Error</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No actions sent in this window.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {data.map((a) => (
              <TableRow key={a.alertid} hover>
                <TableCell
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "0.72rem",
                    color: "text.secondary",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtTs(a.clock)}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                    {a.subject || "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 170 }}>
                    {a.sendto || "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={STATUS_LABELS[a.status] ?? String(a.status)}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: "0.62rem",
                      color: STATUS_COLORS[a.status] ?? "#9E9E9E",
                      bgcolor: `${STATUS_COLORS[a.status] ?? "#9E9E9E"}18`,
                      border: `1px solid ${STATUS_COLORS[a.status] ?? "#9E9E9E"}40`,
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="error.light" noWrap sx={{ maxWidth: 200 }}>
                    {a.error || "—"}
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
