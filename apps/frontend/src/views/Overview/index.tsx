"use client";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Skeleton,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type AlertEvent, type Problem, type Team, api } from "../../app/api";
import { useAuth } from "../../app/context/AuthContext";
import { useSync } from "../../app/context/SyncContext";
import { ActionButton } from "./ActionButton";
import { AlertEventRow } from "./AlertEventRow";
import { ProblemRow } from "./ProblemRow";
import { StatCard } from "./StatCard";
import { StatusRow } from "./StatusRow";

export const Overview = () => {
  const { user } = useAuth();
  const { lastSync } = useSync();

  const [stats, setStats] = useState<{
    totalHosts: number;
    onlineHosts: number;
    totalTeams: number;
    totalUsers: number;
    assignedServers: number;
  } | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; zabbix: boolean } | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastSync triggers re-fetch on sync events
  useEffect(() => {
    const load = async () => {
      setLoading(true);
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
    };
    void load();
  }, [lastSync]);

  const offlineCount = stats ? stats.totalHosts - stats.onlineHosts : 0;
  const allOk = health?.ok && health?.zabbix;

  const roles = user?.roles ?? [];
  const isAdmin = roles.includes("root") || roles.includes("team_lead");

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ mb: 3.5 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -0.5, mb: 0.25 }}>
          {greeting}
          {user ? `, ${user.display_name || user.username}` : ""}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          {dateStr}
        </Typography>
      </Box>

      {/* ── Stat cards ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md>
          <StatCard
            icon={<StorageOutlinedIcon sx={{ fontSize: 20 }} />}
            label="Total Hosts"
            value={stats?.totalHosts ?? 0}
            sub={offlineCount > 0 ? `${offlineCount} offline` : undefined}
            color="#3B82F6"
            loading={loading}
            href="/hosts"
            availability={
              stats
                ? { value: stats.onlineHosts, total: stats.totalHosts, color: "#22C55E" }
                : undefined
            }
          />
        </Grid>
        <Grid item xs={6} sm={4} md>
          <StatCard
            icon={<WarningAmberOutlinedIcon sx={{ fontSize: 20 }} />}
            label="Active Problems"
            value={loading ? 0 : problems.length}
            sub={problems.length === 0 && !loading ? "All clear" : undefined}
            color={problems.length > 0 ? "#EF4444" : "#22C55E"}
            loading={loading}
            href="/metrics"
          />
        </Grid>
        <Grid item xs={6} sm={4} md>
          <StatCard
            icon={<NotificationsActiveOutlinedIcon sx={{ fontSize: 20 }} />}
            label="Alert Events"
            value={loading ? 0 : alertEvents.length > 0 ? `${alertEvents.length}+` : 0}
            color={alertEvents.length > 0 ? "#F59E0B" : "#22C55E"}
            loading={loading}
            href="/metrics"
          />
        </Grid>
        <Grid item xs={6} sm={4} md>
          <StatCard
            icon={<GroupsOutlinedIcon sx={{ fontSize: 20 }} />}
            label="Teams"
            value={stats?.totalTeams ?? 0}
            color="#8B5CF6"
            loading={loading}
            href="/teams"
          />
        </Grid>
        <Grid item xs={6} sm={4} md>
          <StatCard
            icon={<PersonOutlinedIcon sx={{ fontSize: 20 }} />}
            label="Team Members"
            value={stats?.totalUsers ?? 0}
            color="#F59E0B"
            loading={loading}
            href="/teams"
          />
        </Grid>
      </Grid>

      {/* ── Main panels ── */}
      <Grid container spacing={2.5}>
        {/* Active Problems */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 0.5,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Active Problems
                </Typography>
                {!loading && problems.length > 0 && (
                  <Chip
                    size="small"
                    label={problems.length}
                    sx={{
                      bgcolor: "rgba(239,68,68,0.12)",
                      color: "error.main",
                      fontWeight: 700,
                      height: 20,
                      fontSize: "0.7rem",
                    }}
                  />
                )}
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, fontSize: "0.78rem" }}
              >
                Live Zabbix trigger alerts
              </Typography>
              <Divider sx={{ mb: 1.5 }} />

              {loading ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {[1, 2, 3, 4].map((n) => (
                    <Skeleton key={n} variant="rounded" height={44} />
                  ))}
                </Box>
              ) : problems.length === 0 ? (
                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    py: 4,
                  }}
                >
                  <CheckCircleOutlineIcon
                    sx={{ fontSize: 40, color: "success.main", opacity: 0.7 }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: "success.main" }}>
                    No active problems
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    All monitored hosts are healthy
                  </Typography>
                </Box>
              ) : (
                <>
                  <Box sx={{ flex: 1, overflow: "auto", maxHeight: 320 }}>
                    {problems.slice(0, 8).map((p) => (
                      <ProblemRow key={p.eventid} problem={p} />
                    ))}
                  </Box>
                  {problems.length > 8 && (
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
                      <Button
                        component={Link}
                        href="/metrics"
                        size="small"
                        sx={{ fontSize: "0.75rem", p: 0 }}
                      >
                        View all {problems.length} problems →
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Alert Events */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 0.5,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Recent Alerts
                </Typography>
                <ErrorOutlineIcon sx={{ fontSize: 18, color: "warning.main" }} />
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, fontSize: "0.78rem" }}
              >
                Custom rule firings
              </Typography>
              <Divider sx={{ mb: 1.5 }} />

              {loading ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {[1, 2, 3].map((n) => (
                    <Skeleton key={n} variant="rounded" height={38} />
                  ))}
                </Box>
              ) : alertEvents.length === 0 ? (
                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    py: 3,
                  }}
                >
                  <CheckCircleOutlineIcon
                    sx={{ fontSize: 36, color: "success.main", opacity: 0.7 }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: "success.main" }}>
                    No recent alert events
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Custom rules have not fired recently
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1 }}>
                  {alertEvents.map((e) => (
                    <AlertEventRow key={e.id} event={e} />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right column: System Status + Quick Actions */}
        <Grid item xs={12} md={3}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, height: "100%" }}>
            {/* System Status */}
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                  System Status
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2, fontSize: "0.78rem" }}
                >
                  Live infrastructure health
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
                  <StatusRow label="Backend API" ok={health?.ok ?? false} loading={loading} />
                  <StatusRow label="Zabbix" ok={health?.zabbix ?? false} loading={loading} />
                  <StatusRow label="Database" ok={health?.ok ?? false} loading={loading} />
                </Box>
                {!loading && health && (
                  <Box
                    sx={{
                      mt: 2,
                      p: 1.25,
                      borderRadius: 1.5,
                      bgcolor: allOk ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                      border: `1px solid ${allOk ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: allOk ? "success.light" : "error.light",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                      }}
                    >
                      {allOk
                        ? "All systems operational"
                        : !health.ok
                          ? "Backend unreachable"
                          : "Zabbix disconnected"}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card sx={{ flex: 1 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Quick Actions
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2, fontSize: "0.78rem" }}
                >
                  Jump to common tasks
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <ActionButton
                    icon={<StorageOutlinedIcon sx={{ fontSize: 16 }} />}
                    label="Manage Hosts"
                    href="/hosts"
                    variant="contained"
                  />
                  <ActionButton
                    icon={<DashboardOutlinedIcon sx={{ fontSize: 16 }} />}
                    label="Dashboard"
                    href="/dashboard"
                  />
                  <ActionButton
                    icon={<TuneOutlinedIcon sx={{ fontSize: 16 }} />}
                    label="Items & Triggers"
                    href="/items"
                  />
                  <ActionButton
                    icon={<RouterOutlinedIcon sx={{ fontSize: 16 }} />}
                    label="Live Metrics"
                    href="/metrics"
                  />
                  {isAdmin && (
                    <ActionButton
                      icon={<GroupsOutlinedIcon sx={{ fontSize: 16 }} />}
                      label="Manage Teams"
                      href="/teams"
                    />
                  )}
                  <ActionButton
                    icon={<DownloadOutlinedIcon sx={{ fontSize: 16 }} />}
                    label="Export Inventory"
                    href="/api/hosts/download"
                    external
                  />
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};
