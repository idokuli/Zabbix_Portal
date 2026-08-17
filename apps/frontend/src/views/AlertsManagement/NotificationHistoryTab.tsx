"use client";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";
import type { StoredNotif } from "../../app/api/types";
import { TabHeader } from "../../app/components/TabHeader";
import { formatDateTime } from "../../app/datetime";
import { FILTER_BAR_SX, FilterSearchField, filterLabelSx } from "../../components/FilterBar";
import { formatAge, SeverityChip } from "../Metrics/shared";

export const NotificationHistoryTab = () => {
  const [history, setHistory] = useState<StoredNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"" | "zabbix" | "rule">("");
  const [severityFilter, setSeverityFilter] = useState<number | "">("");

  const load = useCallback((silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setFetchError("");
    api
      .getNotifHistory()
      .then((r) => setHistory(r.history))
      .catch((e) => setFetchError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = history.filter((n) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q || n.hostname.toLowerCase().includes(q) || n.name.toLowerCase().includes(q);
    const matchesSource = !sourceFilter || n.source === sourceFilter;
    const matchesSeverity = severityFilter === "" || n.severity === severityFilter;
    return matchesSearch && matchesSource && matchesSeverity;
  });

  const now = Math.floor(Date.now() / 1000);

  return (
    <Box>
      <TabHeader
        title="Notification History"
        description="Full archive of all portal alert notifications. Records persist even after clearing the notification bell."
      />

      {fetchError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError("")}>
          {fetchError}
        </Alert>
      )}

      <Box sx={FILTER_BAR_SX}>
        {!loading && <Chip label={`${filtered.length} / ${history.length}`} size="small" />}
        <FilterSearchField placeholder="Search host or name…" value={search} onChange={setSearch} />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={filterLabelSx}>Source</InputLabel>
          <Select
            label="Source"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as "" | "zabbix" | "rule")}
            sx={filterLabelSx}
          >
            <MenuItem value="" sx={filterLabelSx}>
              All
            </MenuItem>
            <MenuItem value="zabbix" sx={filterLabelSx}>
              Zabbix
            </MenuItem>
            <MenuItem value="rule" sx={filterLabelSx}>
              Alert rule
            </MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={filterLabelSx}>Severity</InputLabel>
          <Select
            label="Severity"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as number | "")}
            sx={filterLabelSx}
          >
            <MenuItem value="" sx={filterLabelSx}>
              All
            </MenuItem>
            <MenuItem value={5} sx={filterLabelSx}>
              Disaster
            </MenuItem>
            <MenuItem value={4} sx={filterLabelSx}>
              High
            </MenuItem>
            <MenuItem value={3} sx={filterLabelSx}>
              Average
            </MenuItem>
            <MenuItem value={2} sx={filterLabelSx}>
              Warning
            </MenuItem>
            <MenuItem value={1} sx={filterLabelSx}>
              Information
            </MenuItem>
            <MenuItem value={0} sx={filterLabelSx}>
              Not classified
            </MenuItem>
          </Select>
        </FormControl>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => void load()} disabled={loading}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 130 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 100 }}>
                Severity
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 160 }}>Host</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 100 }}>
                Source
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 100 }}>
                Acknowledged
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cells
                    <TableCell key={j}>
                      <Skeleton variant="text" height={20} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  {history.length === 0
                    ? "No notification history stored yet"
                    : "No notifications match the current filters"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((n) => (
                <TableRow key={n.id} hover>
                  <TableCell>
                    <Tooltip title={formatDateTime(n.clock)}>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: "0.75rem", color: "text.secondary", cursor: "default" }}
                      >
                        {formatAge(now - n.clock)} ago
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <SeverityChip severity={n.severity} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: "0.8rem", fontWeight: 500 }} noWrap>
                      {n.hostname || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                      {n.name || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={n.source === "zabbix" ? "Zabbix" : "Alert rule"}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: "0.68rem", height: 18 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={n.acknowledged ? "Yes" : "No"}
                      size="small"
                      color={n.acknowledged ? "success" : "default"}
                      sx={{ fontSize: "0.68rem", height: 18 }}
                    />
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
