"use client";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ComputerOutlinedIcon from "@mui/icons-material/ComputerOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import {
  Box,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
  Typography,
} from "@mui/material";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { type AlertEvent, api, type Problem, type Team } from "../../app/api";
import { EmptyState } from "../../app/components/EmptyState";
import { useAuth } from "../../app/context/AuthContext";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { useSync } from "../../app/context/SyncContext";
import { formatDateTime } from "../../app/datetime";
import { SEVERITIES, severityOf } from "../../app/severity";
import { monoFontFamily } from "../../app/theme";
import { AlertEventRow } from "./AlertEventRow";
import { StatusRow } from "./StatusRow";

type Stats = {
  totalHosts: number;
  onlineHosts: number;
  totalTeams: number;
  totalUsers: number;
  assignedServers: number;
};

type Health = { ok: boolean; zabbix: boolean } | null;

const fmtAge = (seconds: number): string => {
  if (seconds < 3600) {
    return `${Math.max(1, Math.floor(seconds / 60))}m`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  }
  return `${Math.floor(seconds / 86400)}d`;
};

// ── Severity band — NOC-style counters, worst first ───────────────────

const SeverityBand = ({ problems, loading }: { problems: Problem[]; loading: boolean }) => (
  <Paper
    sx={{
      mb: 2,
      display: "flex",
      alignItems: "stretch",
      overflow: "hidden",
      "& > a:not(:first-of-type)": { borderLeft: "1px solid", borderLeftColor: "divider" },
    }}
  >
    {[...SEVERITIES].reverse().map((sev) => {
      const count = problems.filter((p) => p.severity === sev.value).length;
      const lit = !loading && count > 0;
      return (
        <Box
          key={sev.value}
          component={Link}
          href="/metrics?tab=problems"
          sx={{
            flex: 1,
            minWidth: 0,
            px: 1.75,
            py: 1.25,
            textDecoration: "none",
            backgroundColor: lit ? sev.bg : "transparent",
            "&:hover": { backgroundColor: lit ? sev.bg : "action.hover" },
            transition: "background-color 0.15s ease",
          }}
        >
          <Typography
            sx={{
              fontFamily: monoFontFamily,
              fontSize: "1.375rem",
              lineHeight: 1.2,
              fontWeight: 600,
              color: lit ? sev.color : "text.disabled",
            }}
          >
            {loading ? "–" : count}
          </Typography>
          <Typography
            noWrap
            sx={{
              fontSize: "0.625rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: lit ? "text.primary" : "text.secondary",
            }}
          >
            {sev.label}
          </Typography>
        </Box>
      );
    })}
  </Paper>
);

// ── Estate ticker — one mono readout line instead of stat cards ───────

const TickerItem = ({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string;
  href: string;
  tone?: string;
}) => (
  <Box
    component={Link}
    href={href}
    sx={{
      display: "flex",
      alignItems: "baseline",
      gap: 0.75,
      px: 1.75,
      py: 0.9,
      textDecoration: "none",
      whiteSpace: "nowrap",
      "&:hover": { bgcolor: "action.hover" },
    }}
  >
    <Typography
      sx={{
        fontSize: "0.625rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "text.secondary",
      }}
    >
      {label}
    </Typography>
    <Typography
      sx={{
        fontFamily: monoFontFamily,
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: tone ?? "text.primary",
      }}
    >
      {value}
    </Typography>
  </Box>
);

const tickerItems = (
  stats: Stats | null,
  offlineCount: number,
  alertEvents: AlertEvent[],
  health: Health,
): Array<{ label: string; value: string; href: string; tone?: string }> => [
  { label: "Hosts", value: String(stats?.totalHosts ?? 0), href: "/hosts" },
  {
    label: "Offline",
    value: String(offlineCount),
    href: "/hosts",
    tone: offlineCount > 0 ? "warning.main" : undefined,
  },
  {
    label: "Alert events",
    value: String(alertEvents.length),
    href: "/metrics?tab=alert-rules",
    tone: alertEvents.length > 0 ? "warning.main" : undefined,
  },
  { label: "Teams", value: String(stats?.totalTeams ?? 0), href: "/teams" },
  { label: "Members", value: String(stats?.totalUsers ?? 0), href: "/teams" },
  {
    label: "API",
    value: health?.ok ? "UP" : "DOWN",
    href: "/",
    tone: health?.ok ? "success.main" : "error.main",
  },
  {
    label: "Zabbix",
    value: health?.zabbix ? "UP" : "DOWN",
    href: "/",
    tone: health?.zabbix ? "success.main" : "error.main",
  },
];

const EstateTicker = ({
  stats,
  offlineCount,
  alertEvents,
  health,
  loading,
}: {
  stats: Stats | null;
  offlineCount: number;
  alertEvents: AlertEvent[];
  health: Health;
  loading: boolean;
}) => (
  <Paper
    sx={{
      mb: 2,
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      overflow: "hidden",
      "& > a:not(:first-of-type)": { borderLeft: "1px solid", borderLeftColor: "divider" },
    }}
  >
    {loading ? (
      <Skeleton variant="text" sx={{ mx: 2, my: 0.5, flex: 1, maxWidth: 420 }} />
    ) : (
      tickerItems(stats, offlineCount, alertEvents, health).map((item) => (
        <TickerItem key={item.label} {...item} />
      ))
    )}
  </Paper>
);

// ── Problem feed (master) ─────────────────────────────────────────────

const FeedRow = ({
  problem,
  selected,
  onSelect,
}: {
  problem: Problem;
  selected: boolean;
  onSelect: () => void;
}) => {
  const sev = severityOf(problem.severity);
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      sx={{
        all: "unset",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        width: "100%",
        px: 2,
        py: 1.1,
        cursor: "pointer",
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: selected ? "action.selected" : "transparent",
        "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: sev.color, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {problem.name}
        </Typography>
        <Typography
          sx={{
            fontFamily: monoFontFamily,
            fontSize: "0.6875rem",
            color: "text.secondary",
            fontVariantNumeric: "tabular-nums",
          }}
          noWrap
        >
          {problem.hostname} · {fmtAge(problem.age_seconds)}
          {problem.acknowledged ? " · ack" : ""}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        sx={{
          color: sev.color,
          fontWeight: 700,
          flexShrink: 0,
          whiteSpace: "nowrap",
          minWidth: 64,
          textAlign: "right",
        }}
      >
        {sev.label}
      </Typography>
    </Box>
  );
};

// ── Inspector (detail) ────────────────────────────────────────────────

const InspectorField = ({
  icon,
  label,
  children,
}: {
  icon?: ReactNode;
  label: string;
  children: ReactNode;
}) => (
  <Box sx={{ display: "flex", alignItems: "flex-start", gap: icon ? 0.875 : 0 }}>
    {icon && (
      <Box sx={{ display: "flex", color: "text.disabled", mt: "2px", "& svg": { fontSize: 15 } }}>
        {icon}
      </Box>
    )}
    <Box>
      <Typography
        sx={{
          fontSize: "0.625rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "text.secondary",
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  </Box>
);

const ProblemInspector = ({ problem }: { problem: Problem }) => {
  const sev = severityOf(problem.severity);
  return (
    <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: sev.color }} />
        <Typography variant="caption" sx={{ fontWeight: 700, color: sev.color }}>
          {sev.label.toUpperCase()}
        </Typography>
        {problem.acknowledged && (
          <Chip label="acknowledged" size="small" variant="outlined" color="success" />
        )}
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5 }}>
        {problem.name}
      </Typography>

      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "action.hover",
          px: 1.75,
          py: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <InspectorField icon={<ComputerOutlinedIcon />} label="Host">
          <Typography sx={{ fontFamily: monoFontFamily, fontSize: "0.8125rem" }}>
            {problem.hostname}
          </Typography>
        </InspectorField>

        <InspectorField icon={<AccessTimeOutlinedIcon />} label="Started">
          <Typography
            sx={{
              fontFamily: monoFontFamily,
              fontSize: "0.8125rem",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatDateTime(problem.clock)} · {fmtAge(problem.age_seconds)} ago
          </Typography>
        </InspectorField>

        {problem.groups.length > 0 && (
          <InspectorField label="Host groups">
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.25 }}>
              {problem.groups.map((g) => (
                <Chip key={g} label={g} size="small" variant="outlined" />
              ))}
            </Box>
          </InspectorField>
        )}

        {problem.acknowledged && problem.ack_user && (
          <InspectorField icon={<CheckCircleOutlineIcon />} label="Acknowledged by">
            <Typography variant="body2" sx={{ fontWeight: 600, color: "success.main" }}>
              {problem.ack_user}
              {problem.ack_note && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 0.75, fontWeight: 400 }}
                >
                  — {problem.ack_note}
                </Typography>
              )}
            </Typography>
          </InspectorField>
        )}
      </Box>

      <Button
        component={Link}
        href={`/metrics?tab=problems&host=${encodeURIComponent(problem.hostname)}`}
        variant="outlined"
        size="small"
        startIcon={<LaunchOutlinedIcon sx={{ fontSize: 14 }} />}
        sx={{ alignSelf: "flex-start" }}
      >
        Open in problems
      </Button>
    </Box>
  );
};

const InspectorHome = ({
  health,
  alertEvents,
  isAdmin,
  loading,
}: {
  health: Health;
  alertEvents: AlertEvent[];
  isAdmin: boolean;
  loading: boolean;
}) => {
  const actions: Array<{ icon: ReactNode; label: string; href: string; external?: boolean }> = [
    { icon: <StorageOutlinedIcon sx={{ fontSize: 16 }} />, label: "Manage hosts", href: "/hosts" },
    {
      icon: <DashboardOutlinedIcon sx={{ fontSize: 16 }} />,
      label: "Dashboard",
      href: "/dashboard",
    },
    {
      icon: <TuneOutlinedIcon sx={{ fontSize: 16 }} />,
      label: "Items & triggers",
      href: "/items",
    },
    {
      icon: <RouterOutlinedIcon sx={{ fontSize: 16 }} />,
      label: "Live metrics",
      href: "/metrics",
    },
    ...(isAdmin
      ? [
          {
            icon: <GroupsOutlinedIcon sx={{ fontSize: 16 }} />,
            label: "Manage teams",
            href: "/teams",
          },
        ]
      : []),
    {
      icon: <DownloadOutlinedIcon sx={{ fontSize: 16 }} />,
      label: "Export inventory",
      href: "/api/hosts/download",
      external: true,
    },
  ];

  return (
    <>
      <SectionLabel>System status</SectionLabel>
      <Box sx={{ px: 2, py: 1.5, display: "flex", flexDirection: "column", gap: 1.25 }}>
        <StatusRow label="Backend API" ok={health?.ok ?? false} loading={loading} />
        <StatusRow label="Zabbix" ok={health?.zabbix ?? false} loading={loading} />
        <StatusRow label="Database" ok={health?.ok ?? false} loading={loading} />
      </Box>

      <SectionLabel>Recent alerts</SectionLabel>
      <Box sx={{ px: 2, py: 1 }}>
        {alertEvents.length === 0 ? (
          <Typography variant="caption" color="text.disabled">
            Custom rules have not fired recently.
          </Typography>
        ) : (
          alertEvents.slice(0, 4).map((e) => <AlertEventRow key={e.id} event={e} />)
        )}
      </Box>

      <SectionLabel>Quick actions</SectionLabel>
      <List dense disablePadding sx={{ py: 0.5 }}>
        {actions.map((a) => (
          <ListItemButton
            key={a.label}
            component={a.external ? "a" : Link}
            href={a.href}
            sx={{ px: 2, py: 0.6 }}
          >
            <ListItemIcon sx={{ minWidth: 30, color: "text.secondary" }}>{a.icon}</ListItemIcon>
            <ListItemText
              slotProps={{ primary: { sx: { fontSize: "0.8125rem" }, color: "text.primary" } }}
              primary={a.label}
            />
          </ListItemButton>
        ))}
      </List>
    </>
  );
};

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <Typography
    sx={{
      px: 2,
      pt: 1.5,
      pb: 0.75,
      fontSize: "0.625rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: "text.secondary",
      borderBottom: "1px solid",
      borderColor: "divider",
    }}
  >
    {children}
  </Typography>
);

// ── Page ──────────────────────────────────────────────────────────────

export const Overview = () => {
  const tick = useRefreshTick();
  const { user } = useAuth();
  const { lastSync } = useSync();

  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<Health>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const [hostsRes, teamsRes, healthRes, problemsRes, eventsRes] = await Promise.all([
        api.listHosts(),
        api.getTeamsOverview(),
        api.health(),
        api.getProblems(),
        api.getAlertEvents(10),
      ]);

      const online = hostsRes.hosts.filter((h) => h.status === "0").length;
      const teams: Team[] = teamsRes.teams;
      const users = teams.reduce((sum, t) => sum + t.users.length, 0);
      const assigned = new Set(teams.flatMap((t) => t.hosts)).size;

      setStats({
        totalHosts: hostsRes.count,
        onlineHosts: online,
        totalTeams: teams.length,
        totalUsers: users,
        assignedServers: assigned,
      });
      setHealth({ ok: healthRes.status === "online", zabbix: !!healthRes.zabbix_connected });
      setProblems(problemsRes.problems ?? []);
      setAlertEvents((eventsRes.events ?? []).slice(0, 6));
    } catch {
      /* individual sections stay in loading / empty state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(lastSync > 0);
  }, [load, lastSync]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      void load(true);
    }
  }, [tick]);

  const offlineCount = stats ? stats.totalHosts - stats.onlineHosts : 0;
  const roles = user?.roles ?? [];
  const isAdmin = roles.includes("root") || roles.includes("team_lead");

  const sorted = [...problems].sort((a, b) => b.severity - a.severity || b.clock - a.clock);
  const selected = sorted.find((p) => p.eventid === selectedId) ?? null;

  return (
    <Box>
      <SeverityBand problems={problems} loading={loading} />
      <EstateTicker
        stats={stats}
        offlineCount={offlineCount}
        alertEvents={alertEvents}
        health={health}
        loading={loading}
      />

      {/* Operations workspace: problem feed (master) · inspector (detail) */}
      <Paper
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 340px" },
          alignItems: "stretch",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            borderRight: { md: "1px solid" },
            borderColor: { md: "divider" },
            display: "flex",
            flexDirection: "column",
            minHeight: 420,
          }}
        >
          <SectionLabel>
            Problem feed{!loading && problems.length > 0 ? ` — ${problems.length}` : ""}
          </SectionLabel>
          {loading ? (
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
              {Array.from({ length: 5 }).map((_, n) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeletons
                <Skeleton key={n} variant="rectangular" height={44} />
              ))}
            </Box>
          ) : sorted.length === 0 ? (
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmptyState
                icon={<CheckCircleOutlineIcon sx={{ fontSize: 22 }} />}
                title="No active problems"
                description="All monitored hosts are healthy"
              />
            </Box>
          ) : (
            <Box sx={{ flex: 1, overflowY: "auto", maxHeight: 520 }}>
              {sorted.map((p) => (
                <FeedRow
                  key={p.eventid}
                  problem={p}
                  selected={p.eventid === selectedId}
                  onSelect={() => setSelectedId((cur) => (cur === p.eventid ? null : p.eventid))}
                />
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          {selected ? (
            <>
              <SectionLabel>Inspector</SectionLabel>
              <ProblemInspector problem={selected} />
            </>
          ) : (
            <InspectorHome
              health={health}
              alertEvents={alertEvents}
              isAdmin={isAdmin}
              loading={loading}
            />
          )}
        </Box>
      </Paper>
    </Box>
  );
};
