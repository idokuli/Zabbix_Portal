"use client";
import CloseIcon from "@mui/icons-material/Close";
import ComputerOutlinedIcon from "@mui/icons-material/ComputerOutlined";
import DeleteSweepOutlinedIcon from "@mui/icons-material/DeleteSweepOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SnoozeOutlinedIcon from "@mui/icons-material/SnoozeOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Problem, StoredNotif } from "../api";
import { formatDateTimeCompact } from "../datetime";
import { getSev } from "./alertSounds";

const formatAge = (clock: number) => {
  const s = Math.floor(Date.now() / 1000) - clock;
  if (s < 60) {
    return `${s}s ago`;
  }
  if (s < 3600) {
    return `${Math.floor(s / 60)}m ago`;
  }
  if (s < 86400) {
    return `${Math.floor(s / 3600)}h ago`;
  }
  if (s < 7 * 86400) {
    return `${Math.floor(s / 86400)}d ago`;
  }
  if (s < 30 * 86400) {
    return `${Math.floor(s / (7 * 86400))}w ago`;
  }
  if (s < 365 * 86400) {
    return `${Math.floor(s / (30 * 86400))}mo ago`;
  }
  return `${Math.floor(s / (365 * 86400))}y ago`;
};

const formatEventTime = (ts: number) => formatDateTimeCompact(ts);

// Duration options for the repeat-ring snooze — minutes.
const SNOOZE_OPTIONS: Array<{ label: string; minutes: number }> = [
  { label: "5 minutes", minutes: 5 },
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
];

export const NotifCard = ({
  problem,
  onDismiss,
  onSnooze,
}: {
  problem: Problem;
  onDismiss: () => void;
  onSnooze?: (minutes: number) => void;
}) => {
  const sev = getSev(problem.severity);
  const [snoozeAnchor, setSnoozeAnchor] = useState<null | HTMLElement>(null);
  // Alert-rule events (synthetic "rule-" ids) never acknowledge, so there's nothing
  // to snooze — the repeat-ring only tracks real Zabbix problems.
  const canSnooze = onSnooze && !problem.eventid.startsWith("rule-");
  return (
    <Paper
      sx={{
        width: 320,
        overflow: "hidden",
        bgcolor: "background.paper",
        boxShadow: 3,
        display: "flex",
        flexDirection: "column",
        animation: "slideIn 0.25s ease",
        "@keyframes slideIn": {
          from: { opacity: 0, transform: "translateX(40px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          pt: 1,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: sev.color,
            flexShrink: 0,
          }}
        />
        <Typography variant="caption" sx={{ flex: 1, fontWeight: 600 }}>
          {sev.label}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6875rem" }}>
          {formatAge(problem.clock)}
        </Typography>
        {canSnooze && (
          <Tooltip
            title="Snooze the repeat-ring for this problem"
            // Toasts in NotificationStack (AppShell) are pinned above the default
            // modal layer at zIndex 2000 — see the Menu below — so this tooltip's
            // popper must be raised above that too, or it renders behind the toast.
            slotProps={{ popper: { sx: { zIndex: 2100 } } }}
          >
            <IconButton
              size="small"
              aria-label="Snooze notification"
              onClick={(e) => setSnoozeAnchor(e.currentTarget)}
              sx={{
                p: 0.25,
                color: "text.disabled",
                "&:hover": { color: "text.primary" },
              }}
            >
              <SnoozeOutlinedIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        )}
        <IconButton
          size="small"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          sx={{
            p: 0.25,
            color: "text.disabled",
            "&:hover": { color: "text.primary" },
          }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
        {canSnooze && (
          <Menu
            anchorEl={snoozeAnchor}
            open={snoozeAnchor !== null}
            onClose={() => setSnoozeAnchor(null)}
            // Toasts in NotificationStack (AppShell) are pinned above the
            // default modal layer at zIndex 2000, so this menu's Popover
            // root must be raised above that or it renders behind the toast.
            sx={{ zIndex: 2100 }}
          >
            {SNOOZE_OPTIONS.map((opt) => (
              <MenuItem
                key={opt.minutes}
                onClick={() => {
                  onSnooze?.(opt.minutes);
                  setSnoozeAnchor(null);
                }}
                sx={{ fontSize: "0.8rem" }}
              >
                Snooze {opt.label}
              </MenuItem>
            ))}
          </Menu>
        )}
      </Box>

      <Box sx={{ px: 1.5, py: 1 }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 600 }} noWrap>
          {problem.hostname}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mt: 0.25 }}>
          {problem.name}
        </Typography>
      </Box>
    </Paper>
  );
};

const HistoryItemRow = ({
  n,
  idx,
  lastReadClock,
  ackingId,
  onAcknowledge,
  setAckingId,
}: {
  n: StoredNotif;
  idx: number;
  lastReadClock: number;
  ackingId: string | null;
  onAcknowledge: (id: string) => Promise<void>;
  setAckingId: (id: string | null) => void;
}) => {
  const sev = getSev(n.severity);
  const isNew = n.clock > lastReadClock;
  const isAcking = ackingId === n.id;
  return (
    <Box key={n.id}>
      {idx > 0 && <Divider />}
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          px: 2,
          py: 1.25,
          bgcolor: isNew ? "action.selected" : "transparent",
          transition: "background 0.2s",
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: sev.color,
            mt: 0.6,
            flexShrink: 0,
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 0.25,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
              {sev.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {n.source === "zabbix" ? "Zabbix" : "Rule"}
            </Typography>
            {isNew && (
              <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 600 }}>
                New
              </Typography>
            )}
            {n.acknowledged && (
              <Typography variant="caption" sx={{ color: "success.main" }}>
                Acknowledged
              </Typography>
            )}
            <Typography
              variant="caption"
              sx={{ ml: "auto", color: "text.disabled", flexShrink: 0 }}
            >
              {formatEventTime(n.clock)}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {n.hostname}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {n.name}
          </Typography>
          {n.source === "zabbix" && !n.acknowledged && (
            <Button
              size="small"
              variant="outlined"
              disabled={isAcking}
              onClick={async () => {
                setAckingId(n.id);
                await onAcknowledge(n.id);
                setAckingId(null);
              }}
              sx={{ mt: 0.75, py: 0, minHeight: 24, fontSize: "0.6875rem" }}
            >
              {isAcking ? "Acknowledging…" : "Acknowledge"}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const ProblemRow = ({
  p,
  idx,
  ackingId,
  onClose,
  router,
  onAcknowledge,
  setAckingId,
  setAckError,
}: {
  p: Problem;
  idx: number;
  ackingId: string | null;
  onClose: () => void;
  router: ReturnType<typeof useRouter>;
  onAcknowledge: (id: string) => Promise<void>;
  setAckingId: (id: string | null) => void;
  setAckError: (msg: string | null) => void;
}) => {
  const sev = getSev(p.severity);
  const isAcking = ackingId === p.eventid;
  return (
    <Box key={p.eventid}>
      {idx > 0 && <Divider />}
      <Box
        onClick={() => {
          onClose();
          router.push(`/metrics?tab=problems&host=${encodeURIComponent(p.hostname)}`);
        }}
        sx={{
          display: "flex",
          gap: 1.5,
          px: 2,
          py: 1.25,
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: sev.color,
            mt: 0.6,
            flexShrink: 0,
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
              {sev.label}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: p.acknowledged ? "success.main" : "text.secondary",
                whiteSpace: "nowrap",
              }}
            >
              {p.acknowledged ? "Acknowledged" : "Unacknowledged"}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                ml: "auto",
                color: "text.disabled",
                flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatEventTime(p.clock)}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.625 }}>
            <ComputerOutlinedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {p.hostname}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {p.name}
          </Typography>
          {!p.acknowledged && (
            <Button
              size="small"
              variant="outlined"
              disabled={isAcking}
              onClick={async (e) => {
                e.stopPropagation();
                setAckingId(p.eventid);
                setAckError(null);
                try {
                  await onAcknowledge(p.eventid);
                } catch (err) {
                  setAckError(err instanceof Error ? err.message : "Failed to acknowledge");
                } finally {
                  setAckingId(null);
                }
              }}
              sx={{ mt: 0.75, py: 0, minHeight: 24, fontSize: "0.6875rem" }}
            >
              {isAcking ? "Acknowledging…" : "Acknowledge"}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const NotificationHeader = ({
  unreadCount,
  historyCount,
  loading,
  onRefresh,
  onMarkAllRead,
  onClearHistory,
  onClose,
}: {
  unreadCount: number;
  historyCount: number;
  loading: boolean;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onClearHistory: () => void;
  onClose: () => void;
}) => (
  <Box
    sx={{
      px: 2,
      pt: 2,
      pb: 1.5,
      display: "flex",
      alignItems: "center",
      gap: 1,
      borderBottom: "1px solid",
      borderColor: "divider",
      flexShrink: 0,
    }}
  >
    <Typography variant="subtitle1" sx={{ flex: 1 }}>
      Notifications
    </Typography>
    {unreadCount > 0 && (
      <Chip label={`${unreadCount} new`} size="small" color="error" variant="outlined" />
    )}
    <Tooltip title="Refresh">
      <IconButton size="small" onClick={onRefresh} disabled={loading}>
        <RefreshOutlinedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
    <Tooltip title="Mark all as read">
      <IconButton size="small" onClick={onMarkAllRead} disabled={unreadCount === 0}>
        <MarkEmailReadOutlinedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
    <Tooltip title="Clear alert history">
      <IconButton size="small" onClick={onClearHistory} disabled={historyCount === 0}>
        <DeleteSweepOutlinedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
    <IconButton size="small" onClick={onClose} sx={{ ml: 0.5 }}>
      <CloseIcon sx={{ fontSize: 16 }} />
    </IconButton>
  </Box>
);

const ProblemsTabContent = ({
  ackError,
  setAckError,
  loading,
  problems,
  ackingId,
  onClose,
  router,
  onAcknowledge,
  setAckingId,
}: {
  ackError: string | null;
  setAckError: (msg: string | null) => void;
  loading: boolean;
  problems: Problem[];
  ackingId: string | null;
  onClose: () => void;
  router: ReturnType<typeof useRouter>;
  onAcknowledge: (id: string) => Promise<void>;
  setAckingId: (id: string | null) => void;
}) => (
  <>
    {ackError && (
      <Box sx={{ px: 2, pt: 1 }}>
        <Alert severity="error" onClose={() => setAckError(null)} sx={{ fontSize: "0.78rem" }}>
          {ackError}
        </Alert>
      </Box>
    )}
    {loading ? (
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
        {[...new Array(3)].map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          <Skeleton key={i} variant="rectangular" height={64} sx={{}} />
        ))}
      </Box>
    ) : problems.length === 0 ? (
      <Box sx={{ py: 10, textAlign: "center" }}>
        <WarningAmberOutlinedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No active Zabbix problems
        </Typography>
      </Box>
    ) : (
      <List disablePadding>
        {problems.map((p, idx) => (
          <ProblemRow
            key={p.eventid}
            p={p}
            idx={idx}
            ackingId={ackingId}
            onClose={onClose}
            router={router}
            onAcknowledge={onAcknowledge}
            setAckingId={setAckingId}
            setAckError={setAckError}
          />
        ))}
      </List>
    )}
  </>
);

export const NotificationCenter = ({
  open,
  onClose,
  history,
  problems,
  lastReadClock,
  clearedBefore,
  onMarkAllRead,
  onClearHistory,
  onRefresh,
  onAcknowledge,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  history: StoredNotif[];
  problems: Problem[];
  lastReadClock: number;
  clearedBefore: number;
  onMarkAllRead: () => void;
  onClearHistory: () => void;
  onRefresh: () => void;
  onAcknowledge: (id: string) => Promise<void>;
  loading: boolean;
}) => {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);

  const visibleHistory = history.filter((n) => n.clock > clearedBefore);
  const unreadEvents = visibleHistory.filter((n) => n.clock > lastReadClock);

  return (
    <Drawer
      slotProps={{
        paper: {
          sx: { width: 400, display: "flex", flexDirection: "column" },
        },
      }}
      anchor="right"
      open={open}
      onClose={onClose}
    >
      {/* Header */}
      <NotificationHeader
        unreadCount={unreadEvents.length}
        historyCount={visibleHistory.length}
        loading={loading}
        onRefresh={onRefresh}
        onMarkAllRead={onMarkAllRead}
        onClearHistory={onClearHistory}
        onClose={onClose}
      />

      {/* Tabs */}
      <Tabs
        slotProps={{ indicator: { style: { height: 2 } } }}
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: "1px solid", borderColor: "divider", flexShrink: 0, minHeight: 38 }}
      >
        <Tab
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              Alert History
              {visibleHistory.length > 0 && (
                <Chip label={visibleHistory.length} size="small" sx={{ height: 18 }} />
              )}
            </Box>
          }
          sx={{ fontSize: "0.75rem", textTransform: "none", minHeight: 38, px: 2 }}
        />
        <Tab
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              Active Problems
              {problems.length > 0 && (
                <Chip label={problems.length} size="small" color="error" sx={{ height: 18 }} />
              )}
            </Box>
          }
          sx={{ fontSize: "0.75rem", textTransform: "none", minHeight: 38, px: 2 }}
        />
      </Tabs>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {/* Alert History tab */}
        {tab === 0 &&
          (loading ? (
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
              {[...new Array(4)].map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                <Skeleton key={i} variant="rectangular" height={64} sx={{}} />
              ))}
            </Box>
          ) : visibleHistory.length === 0 ? (
            <Box sx={{ py: 10, textAlign: "center" }}>
              <InboxOutlinedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No notifications yet
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {visibleHistory.map((n, idx) => (
                <HistoryItemRow
                  key={n.id}
                  n={n}
                  idx={idx}
                  lastReadClock={lastReadClock}
                  ackingId={ackingId}
                  onAcknowledge={onAcknowledge}
                  setAckingId={setAckingId}
                />
              ))}
            </List>
          ))}

        {/* Active Problems tab */}
        {tab === 1 && (
          <ProblemsTabContent
            ackError={ackError}
            setAckError={setAckError}
            loading={loading}
            problems={problems}
            ackingId={ackingId}
            onClose={onClose}
            router={router}
            onAcknowledge={onAcknowledge}
            setAckingId={setAckingId}
          />
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderTop: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem" }}>
          {tab === 0
            ? `${visibleHistory.length} notification${visibleHistory.length !== 1 ? "s" : ""} · Zabbix problems + alert rules`
            : `${problems.length} active problem${problems.length !== 1 ? "s" : ""} · from Zabbix triggers`}
        </Typography>
      </Box>
    </Drawer>
  );
};
