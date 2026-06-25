"use client";
import CloseIcon from "@mui/icons-material/Close";
import DeleteSweepOutlinedIcon from "@mui/icons-material/DeleteSweepOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import {
  Alert,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  Paper,
  Skeleton,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { Problem, StoredNotif } from "../api";
import { getSev } from "./alertSounds";

const formatAge = (clock: number) => {
  const s = Math.floor(Date.now() / 1000) - clock;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  if (s < 30 * 86400) return `${Math.floor(s / (7 * 86400))}w ago`;
  if (s < 365 * 86400) return `${Math.floor(s / (30 * 86400))}mo ago`;
  return `${Math.floor(s / (365 * 86400))}y ago`;
};

const formatEventTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export const NotifCard = ({
  problem,
  onDismiss,
}: {
  problem: Problem;
  onDismiss: () => void;
}) => {
  const sev = getSev(problem.severity);
  return (
    <Paper
      elevation={8}
      sx={{
        width: 320,
        borderRadius: 2,
        overflow: "hidden",
        border: `1px solid ${sev.color}`,
        bgcolor: "background.paper",
        boxShadow: `0 8px 28px rgba(0,0,0,0.35), 0 0 0 1px ${sev.color}55`,
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
          py: 0.75,
          bgcolor: sev.color,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: "#fff",
            flexShrink: 0,
            animation: "pulse 1.2s ease-in-out infinite",
            "@keyframes pulse": {
              "0%": { opacity: 1, transform: "scale(1)" },
              "50%": { opacity: 0.5, transform: "scale(1.4)" },
              "100%": { opacity: 1, transform: "scale(1)" },
            },
          }}
        />
        <Typography
          sx={{
            flex: 1,
            fontSize: "0.74rem",
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "0.04em",
          }}
        >
          {sev.label}
        </Typography>
        <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.85)" }}>
          {formatAge(problem.clock)}
        </Typography>
        <IconButton
          size="small"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          sx={{
            p: 0.25,
            color: "rgba(255,255,255,0.85)",
            "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.15)" },
          }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
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
  const [tab, setTab] = useState(0);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);

  const visibleHistory = history.filter((n) => n.clock > clearedBefore);
  const unreadEvents = visibleHistory.filter((n) => n.clock > lastReadClock);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: 400, display: "flex", flexDirection: "column" },
      }}
    >
      {/* Header */}
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
        <InboxOutlinedIcon sx={{ fontSize: 20, color: "primary.main" }} />
        <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", flex: 1 }}>
          Notification Center
        </Typography>
        {unreadEvents.length > 0 && (
          <Chip
            label={`${unreadEvents.length} new`}
            size="small"
            color="error"
            sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
          />
        )}
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={onRefresh} disabled={loading}>
            <RefreshOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Mark all as read">
          <IconButton size="small" onClick={onMarkAllRead} disabled={unreadEvents.length === 0}>
            <MarkEmailReadOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear alert history">
          <IconButton size="small" onClick={onClearHistory} disabled={visibleHistory.length === 0}>
            <DeleteSweepOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={onClose} sx={{ ml: 0.5 }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: "1px solid", borderColor: "divider", flexShrink: 0, minHeight: 38 }}
        TabIndicatorProps={{ style: { height: 2 } }}
      >
        <Tab
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              Alert History
              {visibleHistory.length > 0 && (
                <Chip
                  label={visibleHistory.length}
                  size="small"
                  sx={{ height: 16, fontSize: "0.6rem" }}
                />
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
                <Chip
                  label={problems.length}
                  size="small"
                  color="error"
                  sx={{ height: 16, fontSize: "0.6rem" }}
                />
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
              {[...Array(4)].map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                <Skeleton key={i} variant="rectangular" height={64} sx={{ borderRadius: 1 }} />
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
              {visibleHistory.map((n, idx) => {
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
                        borderLeft: `3px solid ${sev.color}`,
                        bgcolor: isNew ? `${sev.color}08` : "transparent",
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
                            gap: 0.75,
                            mb: 0.25,
                            flexWrap: "wrap",
                          }}
                        >
                          <Chip
                            label={sev.label}
                            size="small"
                            sx={{
                              height: 17,
                              fontSize: "0.6rem",
                              fontWeight: 700,
                              color: sev.color,
                              bgcolor: `${sev.color}18`,
                              border: `1px solid ${sev.color}40`,
                            }}
                          />
                          <Chip
                            label={n.source === "zabbix" ? "Zabbix" : "Rule"}
                            size="small"
                            variant="outlined"
                            sx={{ height: 15, fontSize: "0.55rem" }}
                          />
                          {isNew && (
                            <Chip
                              label="NEW"
                              size="small"
                              color="error"
                              sx={{ height: 15, fontSize: "0.55rem", fontWeight: 800 }}
                            />
                          )}
                          {n.acknowledged && (
                            <Chip
                              label="Ack"
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ height: 15, fontSize: "0.55rem" }}
                            />
                          )}
                          <Typography
                            variant="caption"
                            sx={{
                              ml: "auto",
                              color: "text.disabled",
                              fontSize: "0.65rem",
                              flexShrink: 0,
                            }}
                          >
                            {formatEventTime(n.clock)}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 600 }} noWrap>
                          {n.hostname}
                        </Typography>
                        <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }} noWrap>
                          {n.name}
                        </Typography>
                        {n.source === "zabbix" && !n.acknowledged && (
                          <Box
                            component="button"
                            disabled={isAcking}
                            onClick={async () => {
                              setAckingId(n.id);
                              await onAcknowledge(n.id);
                              setAckingId(null);
                            }}
                            sx={{
                              mt: 0.5,
                              px: 1,
                              py: 0.25,
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              borderRadius: 1,
                              border: "1px solid",
                              borderColor: "success.main",
                              color: "success.main",
                              bgcolor: "transparent",
                              cursor: isAcking ? "default" : "pointer",
                              opacity: isAcking ? 0.5 : 1,
                              "&:hover": { bgcolor: "rgba(34,197,94,0.08)" },
                            }}
                          >
                            {isAcking ? "Acknowledging…" : "Acknowledge"}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </List>
          ))}

        {/* Active Problems tab */}
        {tab === 1 && (
          <>
            {ackError && (
              <Box sx={{ px: 2, pt: 1 }}>
                <Alert
                  severity="error"
                  onClose={() => setAckError(null)}
                  sx={{ fontSize: "0.78rem" }}
                >
                  {ackError}
                </Alert>
              </Box>
            )}
            {loading ? (
              <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                {[...Array(3)].map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                  <Skeleton key={i} variant="rectangular" height={64} sx={{ borderRadius: 1 }} />
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
                {problems.map((p, idx) => {
                  const sev = getSev(p.severity);
                  return (
                    <Box key={p.eventid}>
                      {idx > 0 && <Divider />}
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1.5,
                          px: 2,
                          py: 1.25,
                          borderLeft: `3px solid ${sev.color}`,
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
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.25 }}>
                            <Chip
                              label={sev.label}
                              size="small"
                              sx={{
                                height: 17,
                                fontSize: "0.6rem",
                                fontWeight: 700,
                                color: sev.color,
                                bgcolor: `${sev.color}18`,
                                border: `1px solid ${sev.color}40`,
                              }}
                            />
                            <Chip
                              label={p.acknowledged ? "Ack" : "Unack"}
                              size="small"
                              color={p.acknowledged ? "success" : "default"}
                              variant="outlined"
                              sx={{ height: 15, fontSize: "0.55rem" }}
                            />
                            <Typography
                              variant="caption"
                              sx={{
                                ml: "auto",
                                color: "text.disabled",
                                fontSize: "0.65rem",
                                flexShrink: 0,
                              }}
                            >
                              {formatEventTime(p.clock)}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: "0.78rem", fontWeight: 600 }} noWrap>
                            {p.hostname}
                          </Typography>
                          <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }} noWrap>
                            {p.name}
                          </Typography>
                          {!p.acknowledged && (
                            <Box
                              component="button"
                              disabled={ackingId === p.eventid}
                              onClick={async () => {
                                setAckingId(p.eventid);
                                setAckError(null);
                                try {
                                  await onAcknowledge(p.eventid);
                                } catch (e) {
                                  setAckError(
                                    e instanceof Error ? e.message : "Failed to acknowledge",
                                  );
                                } finally {
                                  setAckingId(null);
                                }
                              }}
                              sx={{
                                mt: 0.5,
                                px: 1,
                                py: 0.25,
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                borderRadius: 1,
                                border: "1px solid",
                                borderColor: "success.main",
                                color: "success.main",
                                bgcolor: "transparent",
                                cursor: ackingId === p.eventid ? "default" : "pointer",
                                opacity: ackingId === p.eventid ? 0.5 : 1,
                                "&:hover": { bgcolor: "rgba(34,197,94,0.08)" },
                              }}
                            >
                              {ackingId === p.eventid ? "Acknowledging…" : "Acknowledge"}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </List>
            )}
          </>
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
