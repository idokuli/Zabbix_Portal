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

export const AuditLogTab = () => {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<
    Array<{
      auditid: string;
      username: string;
      clock: number;
      action: string;
      resourcetype: string;
      resourcename: string;
      ip: string;
      details: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getAuditLog({ limit: 200, hours })
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
              <TableCell sx={{ fontWeight: 700, width: 120 }}>User</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 90 }}>Action</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 130 }}>Resource type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Resource</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 120 }}>IP</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No audit entries in this window.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {data.map((e) => (
              <TableRow key={e.auditid} hover>
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
                    variant="outlined"
                    sx={{ height: 18, fontSize: "0.6rem" }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {e.resourcetype}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 280 }}>
                    {e.resourcename || "—"}
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
