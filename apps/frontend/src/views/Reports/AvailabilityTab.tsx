"use client";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
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
import { TimeBar } from "./shared";

export const AvailabilityTab = () => {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<
    Array<{
      hostid: string;
      hostname: string;
      availability_pct: number;
      downtime_seconds: number;
      problem_count: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getAvailability({ hours })
      .then((r) => setData(r.hosts))
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
      </Box>
      <Alert severity="info" sx={{ py: 0.5 }}>
        Availability is calculated from Zabbix problems in the selected window. Hosts with no
        problems show 100%.
      </Alert>
      <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Host</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 200 }}>Availability</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Uptime %</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 120 }}>Downtime</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>Problems</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No data — all hosts may be 100% available.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {data.map((h) => {
              const pct = h.availability_pct;
              const color = pct >= 99 ? "#22C55E" : pct >= 95 ? "#F59E0B" : "#EF4444";
              const downMins = Math.floor(h.downtime_seconds / 60);
              const downStr =
                downMins >= 60 ? `${Math.floor(downMins / 60)}h ${downMins % 60}m` : `${downMins}m`;
              return (
                <TableRow key={h.hostid} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {h.hostname}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          bgcolor: "rgba(255,255,255,0.08)",
                          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 },
                        }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color }}>
                      {pct.toFixed(2)}%
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {h.downtime_seconds > 0 ? downStr : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {h.problem_count}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};
