"use client";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import {
  Box,
  Card,
  Chip,
  Grid,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { type AlertEvent, type Problem, type Team, api } from "../../app/api";
import { EmptyState } from "../../app/components/EmptyState";
import { useAuth } from "../../app/context/AuthContext";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { useSync } from "../../app/context/SyncContext";
import { AlertEventRow } from "./AlertEventRow";
import { ProblemRow } from "./ProblemRow";
import { StatusRow } from "./StatusRow";

type Stats = {
  totalHosts: number;
  onlineHosts: number;
  totalTeams: number;
  totalUsers: number;
  assignedServers: number;
};

// ── Summary strip ─────────────────────────────────────────────────────

const SummaryStat = ({
  label,
  value,
  sub,
  href,
  valueColor,
  loading,
}: {
  label: string;
  value: number | string;
  sub?: string;
  href: string;
  valueColor?: string;
  loading: boolean;
}) => (
  <Box
    component={Link}
    href={href}
    sx={{
      flex: 1,
      minWidth: 130,
      px: 2.25,
      py: 1.5,
      textDecoration: "none",
      color: "inherit",
      "&:hover": { bgcolor: "action.hover" },
      transition: "background-color 0.15s ease",
    }}
  >
    <Typography variant="overline" sx={{ color: "text.secondary", display: "block", mb: 0.25 }}>
      {label}
    </Typography>
    {loading ? (
      <Skeleton variant="text" width={48} height={28} />
    ) : (
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography
          sx={{
            fontSize: "1.25rem",
            fontWeight: 600,
            lineHeight: 1.3,
            fontVariantNumeric: "tabular-nums",
            color: valueColor ?? "text.primary",
          }}
        >
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" sx={{ color: "text.disabled" }}>
            {sub}
          </Typography>
        )}
      </Box>
    )}
  </Box>
);

const SummaryStrip = ({
  stats,
  offlineCount,
  problems,
  alertEvents,
  loading,
}: {
  stats: Stats | null;
  offlineCount: number;
  problems: Problem[];
  alertEvents: AlertEvent[];
  loading: boolean;
}) => (
  <Paper
    sx={{
      mb: 2.5,
      display: "flex",
      flexWrap: "wrap",
      alignItems: "stretch",
      overflow: "hidden",
      "& > a:not(:first-of-type)": { borderLeft: "1px solid", borderLeftColor: "divider" },
    }}
  >
    <SummaryStat
      label="Hosts"
      value={stats?.totalHosts ?? 0}
      sub={
        stats
          ? offlineCount > 0
            ? `${stats.onlineHosts} enabled · ${offlineCount} offline`
            : "all enabled"
          : undefined
      }
      href="/hosts"
      loading={loading}
    />
    <SummaryStat
      label="Active problems"
      value={loading ? 0 : problems.length}
      sub={!loading && problems.length === 0 ? "all clear" : undefined}
      valueColor={problems.length > 0 ? "error.main" : undefined}
      href="/metrics?tab=problems"
      loading={loading}
    />
    <SummaryStat
      label="Alert events"
      value={loading ? 0 : alertEvents.length}
      valueColor={alertEvents.length > 0 ? "warning.main" : undefined}
      href="/metrics?tab=alert-rules"
      loading={loading}
    />
    <SummaryStat label="Teams" value={stats?.totalTeams ?? 0} href="/teams" loading={loading} />
    <SummaryStat
      label="Team members"
      value={stats?.totalUsers ?? 0}
      href="/teams"
      loading={loading}
    />
  </Paper>
);

// ── Panel primitive ───────────────────────────────────────────────────

const Panel = ({
  title,
  action,
  fill = true,
  children,
}: {
  title: string;
  action?: ReactNode;
  fill?: boolean;
  children: ReactNode;
}) => (
  <Card sx={{ height: fill ? "100%" : "auto", display: "flex", flexDirection: "column" }}>
    <Box
      sx={{
        px: 2,
        py: 1.25,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid",
        borderColor: "divider",
        flexShrink: 0,
      }}
    >
      <Typography variant="subtitle2">{title}</Typography>
      {action}
    </Box>
    <Box sx={{ p: 2, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {children}
    </Box>
  </Card>
);

const RowSkeletons = ({ count, height }: { count: number; height: number }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
    {Array.from({ length: count }).map((_, n) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length anonymous skeleton placeholders
      <Skeleton key={n} variant="rounded" height={height} />
    ))}
  </Box>
);

// ── Panels ────────────────────────────────────────────────────────────

const ActiveProblemsPanel = ({ loading, problems }: { loading: boolean; problems: Problem[] }) => (
  <Panel
    title="Active problems"
    action={
      !loading && problems.length > 0 ? (
        <Chip
          size="small"
          label={problems.length}
          color="error"
          variant="outlined"
          sx={{ fontWeight: 600, height: 20 }}
        />
      ) : undefined
    }
  >
    {loading ? (
      <RowSkeletons count={4} height={40} />
    ) : problems.length === 0 ? (
      <EmptyState
        icon={<CheckCircleOutlineIcon sx={{ fontSize: 22 }} />}
        title="No active problems"
        description="All monitored hosts are healthy"
      />
    ) : (
      <>
        <Box sx={{ flex: 1, overflow: "auto", maxHeight: 340 }}>
          {problems.slice(0, 8).map((p) => (
            <ProblemRow key={p.eventid} problem={p} />
          ))}
        </Box>
        {problems.length > 8 && (
          <Box sx={{ mt: 1.5, pt: 1.25, borderTop: "1px solid", borderColor: "divider" }}>
            <Typography
              component={Link}
              href="/metrics?tab=problems"
              variant="caption"
              sx={{
                color: "primary.main",
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              View all {problems.length} problems
            </Typography>
          </Box>
        )}
      </>
    )}
  </Panel>
);

const RecentAlertsPanel = ({
  loading,
  alertEvents,
}: {
  loading: boolean;
  alertEvents: AlertEvent[];
}) => (
  <Panel title="Recent alerts">
    {loading ? (
      <RowSkeletons count={3} height={36} />
    ) : alertEvents.length === 0 ? (
      <EmptyState
        icon={<NotificationsNoneOutlinedIcon sx={{ fontSize: 22 }} />}
        title="No recent alert events"
        description="Custom rules have not fired recently"
      />
    ) : (
      <Box sx={{ flex: 1 }}>
        {alertEvents.map((e) => (
          <AlertEventRow key={e.id} event={e} />
        ))}
      </Box>
    )}
  </Panel>
);

const SystemStatusPanel = ({
  loading,
  health,
}: {
  loading: boolean;
  health: { ok: boolean; zabbix: boolean } | null;
}) => (
  <Panel title="System status" fill={false}>
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <StatusRow label="Backend API" ok={health?.ok ?? false} loading={loading} />
      <StatusRow label="Zabbix" ok={health?.zabbix ?? false} loading={loading} />
      <StatusRow label="Database" ok={health?.ok ?? false} loading={loading} />
    </Box>
  </Panel>
);

const QuickActionsPanel = ({ isAdmin }: { isAdmin: boolean }) => {
  const actions: Array<{ icon: ReactNode; label: string; href: string; external?: boolean }> = [
    {
      icon: <StorageOutlinedIcon sx={{ fontSize: 16 }} />,
      label: "Manage hosts",
      href: "/hosts",
    },
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
    <Card sx={{ flex: 1 }}>
      <Box sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle2">Quick actions</Typography>
      </Box>
      <List dense disablePadding sx={{ py: 0.5 }}>
        {actions.map((a) => (
          <ListItemButton
            key={a.label}
            component={a.external ? "a" : Link}
            href={a.href}
            sx={{ px: 2, py: 0.6, borderRadius: 0 }}
          >
            <ListItemIcon sx={{ minWidth: 30, color: "text.secondary" }}>{a.icon}</ListItemIcon>
            <ListItemText
              primary={a.label}
              primaryTypographyProps={{ fontSize: "0.8125rem", color: "text.primary" }}
            />
          </ListItemButton>
        ))}
      </List>
    </Card>
  );
};

// ── Page ──────────────────────────────────────────────────────────────

export const Overview = () => {
  const tick = useRefreshTick();
  const { user } = useAuth();
  const { lastSync } = useSync();

  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; zabbix: boolean } | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <Box>
      <SummaryStrip
        stats={stats}
        offlineCount={offlineCount}
        problems={problems}
        alertEvents={alertEvents}
        loading={loading}
      />

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <ActiveProblemsPanel loading={loading} problems={problems} />
        </Grid>

        <Grid item xs={12} md={4}>
          <RecentAlertsPanel loading={loading} alertEvents={alertEvents} />
        </Grid>

        <Grid item xs={12} md={3}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
            <SystemStatusPanel loading={loading} health={health} />
            <QuickActionsPanel isAdmin={isAdmin} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};
