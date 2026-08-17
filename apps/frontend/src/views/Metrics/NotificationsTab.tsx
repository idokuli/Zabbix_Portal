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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { type AlertEvent, api } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { formatDateTime } from "../../app/datetime";
import { filterLabelSx } from "../../components/FilterBar";
import { formatAge, SEVERITY_CONFIG, SeverityChip } from "./shared";

const SkeletonRows = ({ rows, cols }: { rows: number; cols: number }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
      <TableRow key={i}>
        {Array.from({ length: cols }).map((__, j) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cells
          <TableCell key={j}>
            <Skeleton variant="text" height={20} />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

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

const notificationStatusColor = (s: number) =>
  s === 1 ? "success" : s === 2 ? "error" : "default";

const NotificationRow = ({ n, onClick }: { n: ZabbixNotification; onClick: () => void }) => (
  <TableRow hover sx={{ cursor: "pointer" }} onClick={onClick}>
    <TableCell>
      <Tooltip title={formatDateTime(n.clock)}>
        <Typography
          variant="body2"
          sx={{ fontSize: "0.75rem", color: "text.secondary", cursor: "pointer" }}
        >
          {formatAge(Math.floor(Date.now() / 1000) - n.clock)} ago
        </Typography>
      </Tooltip>
    </TableCell>
    <TableCell>
      <Typography
        variant="body2"
        sx={{
          fontSize: "0.8rem",
          color: "primary.main",
          "&:hover": { textDecoration: "underline" },
        }}
      >
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
        color={notificationStatusColor(n.status)}
        sx={{ fontSize: "0.68rem", height: 18 }}
      />
    </TableCell>
  </TableRow>
);

const PortalEventRow = ({ e, onClick }: { e: AlertEvent; onClick: () => void }) => {
  const sev = SEVERITY_CONFIG.find((s) => s.severity === e.severity) ?? SEVERITY_CONFIG[5];
  return (
    <TableRow key={e.id} hover sx={{ cursor: "pointer" }} onClick={onClick}>
      <TableCell>
        <SeverityChip severity={e.severity} />
      </TableCell>
      <TableCell>
        <Typography
          variant="body2"
          sx={{
            fontSize: "0.8rem",
            fontWeight: 500,
            color: "primary.main",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {e.hostname}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
          {e.item_name}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
          {e.operator} {e.threshold}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ fontSize: "0.8rem", fontWeight: 600, color: sev.color }}>
          {e.actual_value}
        </Typography>
      </TableCell>
      <TableCell>
        <Tooltip title={formatDateTime(e.fired_at)}>
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
};

const NotificationStats = ({
  total,
  sent,
  failed,
  pending,
}: {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}) => (
  <>
    <Chip label={`${total} total`} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
    {sent > 0 && (
      <Chip
        label={`${sent} sent`}
        size="small"
        color="success"
        sx={{ height: 18, fontSize: "0.68rem" }}
      />
    )}
    {failed > 0 && (
      <Chip
        label={`${failed} failed`}
        size="small"
        color="error"
        sx={{ height: 18, fontSize: "0.68rem" }}
      />
    )}
    {pending > 0 && (
      <Chip
        label={`${pending} pending`}
        size="small"
        color="warning"
        sx={{ height: 18, fontSize: "0.68rem" }}
      />
    )}
  </>
);

export const NotificationsTab = () => {
  const tick = useRefreshTick();
  const router = useRouter();
  const [notifs, setNotifs] = useState<ZabbixNotification[]>([]);
  const [portalEvents, setPortalEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [hours, setHours] = useState(24);
  const [statusFilter, setStatusFilter] = useState<number | "">("");

  const loadAll = useCallback(
    (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      setFetchError("");
      Promise.all([api.getNotificationHistory({ hours, limit: 500 }), api.getAlertEvents(500)])
        .then(([nr, ar]) => {
          setNotifs(nr.notifications);
          setPortalEvents(ar.events);
        })
        .catch((e) => setFetchError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    },
    [hours],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      void loadAll(true);
    }
  }, [tick]);

  const filtered = statusFilter === "" ? notifs : notifs.filter((n) => n.status === statusFilter);

  const sentCount = notifs.filter((n) => n.status === 1).length;
  const failedCount = notifs.filter((n) => n.status === 2).length;
  const pendingCount = notifs.filter((n) => n.status === 0).length;

  return (
    <Box>
      <TabHeader
        title="Notifications"
        description="View a history of alert notifications sent via configured media types."
      />
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
          <NotificationStats
            total={notifs.length}
            sent={sentCount}
            failed={failedCount}
            pending={pendingCount}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel sx={filterLabelSx}>Period</InputLabel>
          <Select
            label="Period"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            sx={filterLabelSx}
          >
            <MenuItem value={1} sx={filterLabelSx}>
              Last 1h
            </MenuItem>
            <MenuItem value={6} sx={filterLabelSx}>
              Last 6h
            </MenuItem>
            <MenuItem value={24} sx={filterLabelSx}>
              Last 24h
            </MenuItem>
            <MenuItem value={168} sx={filterLabelSx}>
              Last 7d
            </MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel sx={filterLabelSx}>Status</InputLabel>
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as number | "")}
            sx={filterLabelSx}
          >
            <MenuItem value="" sx={filterLabelSx}>
              All
            </MenuItem>
            <MenuItem value={1} sx={filterLabelSx}>
              Sent
            </MenuItem>
            <MenuItem value={2} sx={filterLabelSx}>
              Failed
            </MenuItem>
            <MenuItem value={0} sx={filterLabelSx}>
              Not sent
            </MenuItem>
          </Select>
        </FormControl>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => void loadAll()} disabled={loading}>
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
              <SkeletonRows rows={4} cols={6} />
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
                <NotificationRow
                  key={n.alertid}
                  n={n}
                  onClick={() => router.push("/metrics?tab=problems")}
                />
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
              <SkeletonRows rows={3} cols={6} />
            ) : portalEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
                  No portal alert events
                </TableCell>
              </TableRow>
            ) : (
              portalEvents.map((e) => (
                <PortalEventRow
                  key={e.id}
                  e={e}
                  onClick={() =>
                    router.push(`/metrics?tab=problems&host=${encodeURIComponent(e.hostname)}`)
                  }
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
