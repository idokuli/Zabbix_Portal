"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CategoryScale,
  Chart as ChartJS,
  Tooltip as ChartTooltip,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
} from "chart.js";
import ZoomPlugin from "chartjs-plugin-zoom";
import { useCallback, useEffect, useState } from "react";
import { api, type HostMetrics } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { formatTime } from "../../app/datetime";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler,
  ZoomPlugin,
);
const utilColor = (val: number): string => {
  if (val >= 90) {
    return "#E45959";
  }
  if (val >= 75) {
    return "#F58E45";
  }
  if (val >= 50) {
    return "#DBA243";
  }
  return "#2EA043";
};

const MetricBar = ({ value, label }: { value?: number; label: string }) => {
  if (value === undefined) {
    return (
      <Typography variant="caption" color="text.disabled">
        —
      </Typography>
    );
  }
  return (
    <Tooltip title={`${label}: ${value}%`}>
      <Box sx={{ minWidth: 80 }}>
        <Typography variant="caption" sx={{ color: utilColor(value), fontWeight: 700 }}>
          {value}%
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(value, 100)}
          sx={{
            height: 4,
            mt: 0.25,
            backgroundColor: "action.hover",
            "& .MuiLinearProgress-bar": { backgroundColor: utilColor(value) },
          }}
        />
      </Box>
    </Tooltip>
  );
};

export const HostMetricsTab = () => {
  const tick = useRefreshTick();
  const [hosts, setHosts] = useState<HostMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    api
      .getHostsMetrics()
      .then((res) => {
        setHosts(res.hosts);
        setLastUpdated(new Date());
      })
      .catch(() => setHosts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      void load(true);
    }
  }, [tick]);

  const filtered = hosts.filter((h) => h.hostname.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Box>
      <TabHeader
        title="Host Metrics"
        description="Live CPU, memory, disk, and network metrics for all monitored hosts."
      />
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
        <TextField
          size="small"
          placeholder="Filter hosts…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ flex: 1 }}
        />
        <Tooltip title="Refresh now">
          <IconButton size="small" onClick={() => load(false)} disabled={loading}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        {lastUpdated && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.7rem" }}>
            Updated {formatTime(lastUpdated)}
          </Typography>
        )}
        {!loading && (
          <Chip
            label={`${filtered.length} host${filtered.length !== 1 ? "s" : ""}`}
            size="small"
            sx={{ fontSize: "0.72rem" }}
          />
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Host</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 110 }}>CPU</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 110 }}>
                Memory
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 110 }}>
                Disk /
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                    <TableCell key={j}>
                      <Skeleton variant="text" height={20} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  {filter ? "No hosts match filter" : "No hosts found"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((h) => (
                <TableRow key={h.hostid} sx={{ "&:hover": { backgroundColor: "action.hover" } }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: "0.8rem", fontWeight: 500 }}>
                      {h.hostname}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <MetricBar value={h.cpu_util} label="CPU" />
                  </TableCell>
                  <TableCell>
                    <MetricBar value={h.mem_util} label="Memory" />
                  </TableCell>
                  <TableCell>
                    <MetricBar value={h.disk_util} label="Disk /" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
