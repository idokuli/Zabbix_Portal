"use client";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
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
import { type AlertEvent, api } from "../../app/api";
import { SEVERITY_CONFIG, SeverityChip, formatAge } from "./shared";

// ── Notifications tab ─────────────────────────────────────────────────

type ZabbixNotification = {
  alertid: string;
  clock: number;
  sendto: string;
  subject: string;
  status: number;
  status_label: string;
  error: string;
  username: string;
  media_type: string;
};

export const NotificationsTab = () => {
  const [notifs, setNotifs] = useState<ZabbixNotification[]>([]);
  const [portalEvents, setPortalEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [hours, setHours] = useState(24);
  const [statusFilter, setStatusFilter] = useState<number | "">("");

  const loadAll = useCallback(() => {
    setLoading(true);
    setFetchError("");
    Promise.all([api.getNotificationHistory({ hours, limit: 500 }), api.getAlertEvents(500)])
      .then(([nr, ar]) => {
        setNotifs(nr.notifications);
        setPortalEvents(ar.events);
      })
      .catch((e) => setFetchError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [hours]);

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 10_000);
    return () => clearInterval(t);
  }, [loadAll]);

  const filtered = statusFilter === "" ? notifs : notifs.filter((n) => n.status === statusFilter);

  const sentCount = notifs.filter((n) => n.status === 1).length;
  const failedCount = notifs.filter((n) => n.status === 2).length;
  const pendingCount = notifs.filter((n) => n.status === 0).length;

  const statusColor = (s: number) => (s === 1 ? "success" : s === 2 ? "error" : "default");

  return (
    <Box>
      {fetchError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError("")}>
          {fetchError}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
        <NotificationsActiveOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
          Zabbix Notification Deliveries
        </Typography>
        {!loading && (
          <Chip
            label={`${notifs.length} total`}
            size="small"
            sx={{ height: 18, fontSize: "0.68rem" }}
          />
        )}
        {!loading && sentCount > 0 && (
          <Chip
            label={`${sentCount} sent`}
            size="small"
            color="success"
            sx={{ height: 18, fontSize: "0.68rem" }}
          />
        )}
        {!loading && failedCount > 0 && (
          <Chip
            label={`${failedCount} failed`}
            size="small"
            color="error"
            sx={{ height: 18, fontSize: "0.68rem" }}
          />
        )}
        {!loading && pendingCount > 0 && (
          <Chip
            label={`${pendingCount} pending`}
            size="small"
            color="warning"
            sx={{ height: 18, fontSize: "0.68rem" }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel sx={{ fontSize: "0.78rem" }}>Period</InputLabel>
          <Select
            label="Period"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            sx={{ fontSize: "0.78rem" }}
          >
            <MenuItem value={1}>Last 1h</MenuItem>
            <MenuItem value={6}>Last 6h</MenuItem>
            <MenuItem value={24}>Last 24h</MenuItem>
            <MenuItem value={168}>Last 7d</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel sx={{ fontSize: "0.78rem" }}>Status</InputLabel>
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as number | "")}
            sx={{ fontSize: "0.78rem" }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value={1}>Sent</MenuItem>
            <MenuItem value={2}>Failed</MenuItem>
            <MenuItem value={0}>Not sent</MenuItem>
          </Select>
        </FormControl>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={loadAll} disabled={loading}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Zabbix delivery table */}
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 130 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Subject</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 160 }}>
                Sent to
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 120 }}>User</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 120 }}>
                Media type
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 90 }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
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
                  {notifs.length === 0
                    ? "No notification deliveries in this period"
                    : "No notifications match filters"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((n) => (
                <TableRow key={n.alertid} hover>
                  <TableCell>
                    <Tooltip title={new Date(n.clock * 1000).toLocaleString()}>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: "0.75rem", color: "text.secondary", cursor: "default" }}
                      >
                        {formatAge(Math.floor(Date.now() / 1000) - n.clock)} ago
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                      {n.subject || "—"}
                    </Typography>
                    {n.error && (
                      <Typography variant="caption" color="error.main" sx={{ display: "block" }}>
                        {n.error}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>
                    <Tooltip title={n.sendto || ""} placement="top">
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: "0.78rem",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {n.sendto || "—"}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>
                      {n.username || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>
                      {n.media_type || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={n.status_label}
                      size="small"
                      color={statusColor(n.status)}
                      sx={{ fontSize: "0.68rem", height: 18 }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Portal alert events section */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        <WarningAmberOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
          Portal Alert Events
        </Typography>
        {!loading && (
          <Chip label={portalEvents.length} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
        )}
        <Typography variant="caption" color="text.secondary">
          Custom threshold rules defined in Alert Rules
        </Typography>
      </Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 100 }}>
                Severity
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 150 }}>Host</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Item</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 120 }}>
                Condition
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 90 }}>Value</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 100 }}>Fired</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
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
            ) : portalEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
                  No portal alert events
                </TableCell>
              </TableRow>
            ) : (
              portalEvents.map((e) => {
                const sev =
                  SEVERITY_CONFIG.find((s) => s.severity === e.severity) ?? SEVERITY_CONFIG[5];
                return (
                  <TableRow key={e.id} sx={{ "&:hover": { backgroundColor: "action.hover" } }}>
                    <TableCell>
                      <SeverityChip severity={e.severity} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: "0.8rem", fontWeight: 500 }}>
                        {e.hostname}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                        {e.item_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: "0.8rem", fontFamily: "monospace" }}
                      >
                        {e.operator} {e.threshold}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: "0.8rem", fontWeight: 600, color: sev.color }}
                      >
                        {e.actual_value}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={new Date(e.fired_at * 1000).toLocaleString()}>
                        <Typography
                          variant="body2"
                          sx={{ fontSize: "0.75rem", color: "text.secondary", cursor: "default" }}
                        >
                          {formatAge(Math.floor(Date.now() / 1000) - e.fired_at)} ago
                        </Typography>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
