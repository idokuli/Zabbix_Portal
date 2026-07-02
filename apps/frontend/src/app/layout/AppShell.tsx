"use client";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import ComputerOutlinedIcon from "@mui/icons-material/ComputerOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import MusicNoteOutlinedIcon from "@mui/icons-material/MusicNoteOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import NotificationsOffOutlinedIcon from "@mui/icons-material/NotificationsOffOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/Security";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import StopOutlinedIcon from "@mui/icons-material/StopOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import VolumeMuteOutlinedIcon from "@mui/icons-material/VolumeMuteOutlined";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import {
  Badge,
  Box,
  Chip,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { type StoredNotif, api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";

import { NotifCard, NotificationCenter } from "./NotificationCenter";
import { SOUND_PRESETS } from "./alertSounds";
import { useAlertPolling } from "./useAlertPolling";
import { useSoundSettings } from "./useSoundSettings";

const drawerWidth = 240;

type NavItem = { href: string; labelKey: string; icon: ReactNode; adminOnly?: boolean };
type NavGroup = {
  id: string;
  labelKey: string;
  icon: ReactNode;
  items: NavItem[];
  adminOnly?: boolean;
  href?: string;
  sectionLabelKey?: string;
};

const navGroups: NavGroup[] = [
  {
    id: "overview",
    labelKey: "nav.overview",
    icon: <DashboardOutlinedIcon sx={{ fontSize: 18 }} />,
    href: "/",
    items: [],
  },
  {
    id: "hosts",
    labelKey: "nav.hosts",
    icon: <ComputerOutlinedIcon sx={{ fontSize: 18 }} />,
    href: "/hosts",
    items: [],
  },
  {
    id: "monitoring",
    labelKey: "nav.monitoring",
    icon: <ShowChartOutlinedIcon sx={{ fontSize: 18 }} />,
    items: [
      {
        href: "/metrics?tab=problems",
        labelKey: "nav.problems",
        icon: <WarningAmberOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/metrics?tab=latest-data",
        labelKey: "nav.latestData",
        icon: <StorageOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/items",
        labelKey: "nav.items",
        icon: <UploadFileOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/triggers",
        labelKey: "nav.triggers",
        icon: <NotificationsActiveOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  {
    id: "dashboard",
    labelKey: "nav.dashboard",
    icon: <SpaceDashboardOutlinedIcon sx={{ fontSize: 18 }} />,
    items: [
      {
        href: "/dashboard?tab=graphs",
        labelKey: "nav.graphs",
        icon: <ShowChartOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/dashboard?tab=host-metrics",
        labelKey: "nav.hostMetrics",
        icon: <ComputerOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/dashboard?tab=recent-items",
        labelKey: "nav.recentItems",
        icon: <StorageOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  {
    id: "services",
    labelKey: "nav.services",
    icon: <TaskAltOutlinedIcon sx={{ fontSize: 18 }} />,
    items: [
      {
        href: "/services",
        labelKey: "nav.businessServices",
        icon: <TaskAltOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  {
    id: "alerts",
    labelKey: "nav.alerts",
    icon: <NotificationsActiveOutlinedIcon sx={{ fontSize: 18 }} />,
    items: [
      {
        href: "/metrics?tab=alert-rules",
        labelKey: "nav.alertRules",
        icon: <NotificationsActiveOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/alerts-management",
        labelKey: "nav.zabbixActions",
        icon: <PlayArrowOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  {
    id: "datacollection",
    labelKey: "nav.dataCollection",
    icon: <AccountTreeOutlinedIcon sx={{ fontSize: 18 }} />,
    items: [
      {
        href: "/data-collection?tab=template-groups",
        labelKey: "nav.templateGroups",
        icon: <AccountTreeOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/data-collection?tab=host-groups",
        labelKey: "nav.hostGroups",
        icon: <GroupsOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/data-collection?tab=templates",
        labelKey: "nav.templates",
        icon: <StorageOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/data-collection?tab=maintenance",
        labelKey: "nav.maintenance",
        icon: <SettingsOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/data-collection?tab=event-correlation",
        labelKey: "nav.eventCorrelation",
        icon: <ShowChartOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/data-collection?tab=discovery",
        labelKey: "nav.discovery",
        icon: <ComputerOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  {
    id: "reports",
    labelKey: "nav.reports",
    icon: <AssessmentOutlinedIcon sx={{ fontSize: 18 }} />,
    items: [
      {
        href: "/reports?tab=availability",
        labelKey: "nav.availability",
        icon: <AssessmentOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/reports?tab=top-triggers",
        labelKey: "nav.topTriggers",
        icon: <WarningAmberOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/reports?tab=audit-log",
        labelKey: "nav.auditLog",
        icon: <StorageOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/reports?tab=action-log",
        labelKey: "nav.actionLog",
        icon: <PlayArrowOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/reports?tab=notifications",
        labelKey: "nav.alertHistory",
        icon: <NotificationsNoneOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  {
    id: "users",
    labelKey: "nav.usersGroup",
    icon: <PeopleOutlinedIcon sx={{ fontSize: 18 }} />,
    sectionLabelKey: "nav.sectionManagement",
    items: [
      {
        href: "/users",
        labelKey: "nav.portalUsers",
        icon: <PeopleOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      { href: "/teams", labelKey: "nav.teams", icon: <GroupsOutlinedIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  {
    id: "useradmin",
    labelKey: "nav.userAdmin",
    icon: <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 18 }} />,
    sectionLabelKey: "nav.sectionAdministration",
    adminOnly: true,
    items: [
      {
        href: "/users-management?tab=user-groups",
        labelKey: "nav.userGroups",
        icon: <GroupsOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/users-management?tab=roles",
        labelKey: "nav.userRoles",
        icon: <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/users-management?tab=api-tokens",
        labelKey: "nav.apiTokens",
        icon: <KeyOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/users-management?tab=authentication",
        labelKey: "nav.portalLogin",
        icon: <LockOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  {
    id: "administration",
    labelKey: "nav.zabbixServer",
    icon: <SettingsOutlinedIcon sx={{ fontSize: 18 }} />,
    adminOnly: true,
    items: [
      {
        href: "/administration?tab=proxies",
        labelKey: "nav.proxies",
        icon: <RouterOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/administration?tab=proxy-groups",
        labelKey: "nav.proxyGroups",
        icon: <AccountTreeOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/administration?tab=macros",
        labelKey: "nav.globalMacros",
        icon: <CodeOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/administration?tab=housekeeping",
        labelKey: "nav.housekeeping",
        icon: <SettingsOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/administration?tab=authentication",
        labelKey: "nav.zabbixAuth",
        icon: <SecurityOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
];

const StatusDot = ({ ok, label }: { ok: boolean | null; label: string }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
    <Box
      sx={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        backgroundColor: ok === null ? "#575E6E" : ok ? "#5A9E70" : "#C96060",
        boxShadow: ok ? "0 0 6px rgba(34,197,94,0.7)" : "none",
        flexShrink: 0,
      }}
    />
    <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
      {label}
    </Typography>
  </Box>
);

const AppShellInner = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();

  const isNavItemActive = useCallback(
    (href: string): boolean => {
      const qi = href.indexOf("?");
      if (qi === -1) return pathname === href;
      const itemTab = new URLSearchParams(href.slice(qi + 1)).get("tab");
      return pathname === href.slice(0, qi) && searchParams.get("tab") === itemTab;
    },
    [pathname, searchParams],
  );

  const { mode, toggle: toggleMode } = useThemeMode();
  const isDark = mode === "dark";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    for (const g of navGroups) state[g.id] = false;
    return state;
  });
  const toggleGroup = (id: string) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const [notifCenterOpen, setNotifCenterOpen] = useState(false);
  const [storedHistory, setStoredHistory] = useState<StoredNotif[]>([]);
  const [centerLoading, setCenterLoading] = useState(false);
  const [lastReadClock, setLastReadClock] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number.parseInt(localStorage.getItem("notifLastReadClock") ?? "0");
  });
  const [clearedBefore, setClearedBefore] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number.parseInt(localStorage.getItem("notifClearedBefore") ?? "0");
  });

  // Load history from DB on mount
  useEffect(() => {
    api
      .getNotifHistory()
      .then((r) => setStoredHistory(r.history))
      .catch(() => {});
  }, []);

  const unreadCenterCount = storedHistory.filter(
    (n) => n.clock > lastReadClock && n.clock > clearedBefore,
  ).length;

  const saveToHistory = useCallback((entries: StoredNotif[]) => {
    setStoredHistory((current) => {
      const existingIds = new Set(current.map((n) => n.id));
      const fresh = entries.filter((e) => !existingIds.has(e.id));
      if (fresh.length === 0) return current;
      const merged = [...fresh, ...current].slice(0, 2000);
      // Persist to DB (fire-and-forget — UI already updated above)
      void api.saveNotifHistory(fresh);
      return merged;
    });
  }, []);

  const {
    soundEnabled,
    soundPreset,
    desktopNotifEnabled,
    customSounds,
    soundMenuAnchor,
    setSoundMenuAnchor,
    customFileInputRef,
    previewingKey,
    showDesktopNotification,
    toggleDesktopNotif,
    toggleSound,
    selectSoundPreset,
    handlePreview,
    handleDeleteCustomSound,
    handleCustomFileChange,
    soundRef,
    soundPresetRef,
  } = useSoundSettings();

  const {
    health,
    activeProblems,
    setActiveProblems,
    notifications,
    setNotifications,
    dismissNotif,
  } = useAlertPolling({
    saveToHistory,
    showDesktopNotification,
    soundRef,
    soundPresetRef,
  });

  const openNotifCenter = () => {
    setNotifCenterOpen(true);
    setCenterLoading(true);
    const now = Math.floor(Date.now() / 1000);
    setLastReadClock(now);
    localStorage.setItem("notifLastReadClock", String(now));
    Promise.all([api.getAlertEvents(500), api.getProblems()])
      .then(([_evRes, prRes]) => {
        setActiveProblems(prRes.problems);
      })
      .catch(() => {})
      .finally(() => setCenterLoading(false));
  };

  const markAllRead = () => {
    const now = Math.floor(Date.now() / 1000);
    setLastReadClock(now);
    localStorage.setItem("notifLastReadClock", String(now));
  };

  const clearHistory = () => {
    const now = Math.floor(Date.now() / 1000);
    setClearedBefore(now);
    localStorage.setItem("notifClearedBefore", String(now));
  };

  const refreshCenter = () => {
    setCenterLoading(true);
    Promise.all([api.getNotifHistory(), api.getProblems()])
      .then(([hr, prRes]) => {
        setStoredHistory(hr.history);
        setActiveProblems(prRes.problems);
      })
      .catch(() => {})
      .finally(() => setCenterLoading(false));
  };

  const acknowledgeInHistory = (id: string) => {
    setStoredHistory((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, acknowledged: true } : n));
      const entry = updated.find((n) => n.id === id);
      if (entry) void api.saveNotifHistory([entry]);
      return updated;
    });
  };

  const pageTitle = useMemo(() => {
    for (const g of navGroups) {
      if (g.href && pathname === g.href) return t(g.labelKey);
      const found = g.items.find((n) => isNavItemActive(n.href));
      if (found) return t(found.labelKey);
    }
    return "Overwatch";
  }, [pathname, isNavItemActive, t]);

  const initials = (user?.display_name || user?.username)?.slice(0, 2).toUpperCase() ?? "??";
  const problemCount = activeProblems.filter((p) => !p.acknowledged).length;

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Brand */}
      <Box sx={{ px: 2, pt: 2, pb: 1.75 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            component="img"
            src="/Overwatch_sign.png"
            alt="Overwatch"
            sx={{ width: 34, height: 34, objectFit: "contain", flexShrink: 0 }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{ fontWeight: 700, fontSize: "0.875rem", lineHeight: 1.2, letterSpacing: 0.1 }}
            >
              {t("app.name")}
            </Typography>
            <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", lineHeight: 1.3 }}>
              {t("app.subtitle")}
            </Typography>
          </Box>
          <Tooltip title={t("theme.toggle")}>
            <IconButton
              size="small"
              onClick={toggleMode}
              sx={{
                color: "text.secondary",
                flexShrink: 0,
                "&:hover": { color: "primary.main", backgroundColor: "rgba(122,162,212,0.1)" },
                transition: "all 0.2s ease",
              }}
            >
              {isDark ? (
                <LightModeOutlinedIcon sx={{ fontSize: 17 }} />
              ) : (
                <DarkModeOutlinedIcon sx={{ fontSize: 17 }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider />

      {/* Nav */}
      <List sx={{ px: 1, pt: 1, flex: 1, overflowY: "auto" }} disablePadding>
        {navGroups
          .filter((group) => {
            if (!group.adminOnly) return true;
            const roles = user?.roles ?? [];
            return roles.includes("root") || roles.includes("team_lead");
          })
          .map((group) => {
            if (group.href) {
              const isActive = pathname === group.href;
              return (
                <Box key={group.id} sx={{ mb: 0.25 }}>
                  {group.sectionLabelKey && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          px: 1.5,
                          py: 0.25,
                          display: "block",
                          color: "text.disabled",
                          fontSize: "0.6rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                        }}
                      >
                        {t(group.sectionLabelKey)}
                      </Typography>
                    </>
                  )}
                  <ListItemButton
                    component={Link}
                    href={group.href}
                    sx={{
                      borderRadius: "6px",
                      px: 1,
                      py: 0.5,
                      minHeight: 30,
                      backgroundColor: isActive ? "rgba(140,114,232,0.1)" : "transparent",
                      "&:hover": {
                        bgcolor: isActive ? "rgba(140,114,232,0.14)" : "rgba(212,207,235,0.04)",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{ minWidth: 26, color: isActive ? "primary.main" : "text.disabled" }}
                    >
                      {group.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={t(group.labelKey)}
                      primaryTypographyProps={{
                        fontSize: "0.68rem",
                        fontWeight: isActive ? 700 : 600,
                        color: isActive ? "primary.main" : "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                      }}
                    />
                  </ListItemButton>
                </Box>
              );
            }

            const isOpen = openGroups[group.id] !== false;
            const hasActive = group.items.some((item) => isNavItemActive(item.href));
            return (
              <Box key={group.id} sx={{ mb: 0.25 }}>
                {group.sectionLabelKey && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography
                      variant="caption"
                      sx={{
                        px: 1.5,
                        py: 0.25,
                        display: "block",
                        color: "text.disabled",
                        fontSize: "0.6rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {t(group.sectionLabelKey)}
                    </Typography>
                  </>
                )}
                <ListItemButton
                  onClick={() => toggleGroup(group.id)}
                  sx={{
                    borderRadius: "6px",
                    px: 1,
                    py: 0.5,
                    minHeight: 30,
                    "&:hover": { bgcolor: "rgba(212,207,235,0.04)" },
                  }}
                >
                  <ListItemIcon
                    sx={{ minWidth: 26, color: hasActive ? "primary.main" : "text.disabled" }}
                  >
                    {group.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={t(group.labelKey)}
                    primaryTypographyProps={{
                      fontSize: "0.68rem",
                      fontWeight: hasActive ? 700 : 600,
                      color: hasActive ? "primary.main" : "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}
                  />
                  {isOpen ? (
                    <ExpandMoreIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                  ) : (
                    <ChevronRightIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                  )}
                </ListItemButton>

                <Collapse in={isOpen} timeout="auto" unmountOnExit>
                  <List disablePadding sx={{ pl: 1 }}>
                    {group.items.map((item) => {
                      const selected = isNavItemActive(item.href);
                      const isProblems = item.href === "/metrics?tab=problems";
                      return (
                        <ListItemButton
                          key={item.href}
                          component={Link}
                          href={item.href}
                          sx={{
                            borderRadius: "6px",
                            mb: 0.25,
                            pl: 1.5,
                            pr: 1,
                            py: 0.65,
                            borderLeft: `2px solid ${selected ? "#8C72E8" : "transparent"}`,
                            backgroundColor: selected ? "rgba(140,114,232,0.1)" : "transparent",
                            "&:hover": {
                              backgroundColor: selected
                                ? "rgba(140,114,232,0.14)"
                                : "rgba(212,207,235,0.04)",
                            },
                            transition: "all 0.15s ease",
                          }}
                        >
                          <ListItemIcon
                            sx={{
                              minWidth: 30,
                              color: selected ? "primary.main" : "text.secondary",
                              transition: "color 0.15s ease",
                            }}
                          >
                            {isProblems && problemCount > 0 ? (
                              <Badge
                                badgeContent={problemCount > 99 ? "99+" : problemCount}
                                color="error"
                                sx={{
                                  "& .MuiBadge-badge": {
                                    fontSize: "0.5rem",
                                    height: 13,
                                    minWidth: 13,
                                    p: "0 2px",
                                  },
                                }}
                              >
                                {item.icon}
                              </Badge>
                            ) : (
                              item.icon
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={t(item.labelKey)}
                            primaryTypographyProps={{
                              fontSize: "0.8rem",
                              fontWeight: selected ? 600 : 400,
                              color: selected ? "text.primary" : "text.secondary",
                            }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Collapse>
              </Box>
            );
          })}

        <Divider sx={{ my: 0.75, mx: 1 }} />

        {/* Notification Center nav item */}
        <ListItemButton
          onClick={openNotifCenter}
          sx={{
            borderRadius: "6px",
            mb: 0.25,
            pl: 1.5,
            pr: 1,
            py: 0.65,
            borderLeft: "2px solid transparent",
            "&:hover": { backgroundColor: "rgba(212,207,235,0.04)" },
            transition: "all 0.15s ease",
          }}
        >
          <ListItemIcon
            sx={{ minWidth: 30, color: unreadCenterCount > 0 ? "primary.main" : "text.secondary" }}
          >
            <Badge
              badgeContent={unreadCenterCount || null}
              color="error"
              sx={{
                "& .MuiBadge-badge": { fontSize: "0.5rem", height: 13, minWidth: 13, p: "0 2px" },
              }}
            >
              <InboxOutlinedIcon sx={{ fontSize: 18 }} />
            </Badge>
          </ListItemIcon>
          <ListItemText
            primary={t("nav.notificationCenter")}
            primaryTypographyProps={{
              fontSize: "0.8rem",
              fontWeight: unreadCenterCount > 0 ? 600 : 400,
              color: unreadCenterCount > 0 ? "text.primary" : "text.secondary",
            }}
          />
          {unreadCenterCount > 0 && (
            <Chip
              label={`${unreadCenterCount} new`}
              size="small"
              color="error"
              sx={{ height: 16, fontSize: "0.58rem" }}
            />
          )}
        </ListItemButton>

        {/* Active problems nav item */}
        <ListItemButton
          component={Link}
          href="/metrics"
          sx={{
            borderRadius: "6px",
            mb: 0.25,
            pl: 1.5,
            pr: 1,
            py: 0.65,
            borderLeft: `2px solid ${problemCount > 0 ? "rgba(201,96,96,0.6)" : "transparent"}`,
            backgroundColor: problemCount > 0 ? "rgba(201,96,96,0.06)" : "transparent",
            "&:hover": {
              backgroundColor: problemCount > 0 ? "rgba(201,96,96,0.1)" : "rgba(212,207,235,0.04)",
            },
            transition: "all 0.15s ease",
          }}
        >
          <ListItemIcon
            sx={{ minWidth: 30, color: problemCount > 0 ? "#C96060" : "text.disabled" }}
          >
            <Badge
              badgeContent={problemCount || null}
              color="error"
              sx={{
                "& .MuiBadge-badge": { fontSize: "0.5rem", height: 13, minWidth: 13, p: "0 2px" },
              }}
            >
              {problemCount > 0 ? (
                <NotificationsActiveOutlinedIcon sx={{ fontSize: 18 }} />
              ) : (
                <NotificationsNoneOutlinedIcon sx={{ fontSize: 18 }} />
              )}
            </Badge>
          </ListItemIcon>
          <ListItemText
            primary={
              problemCount > 0
                ? `${problemCount} active problem${problemCount !== 1 ? "s" : ""}`
                : t("metrics.noProblems")
            }
            primaryTypographyProps={{
              fontSize: "0.8rem",
              fontWeight: problemCount > 0 ? 600 : 400,
              color: problemCount > 0 ? "#C96060" : "text.disabled",
            }}
          />
          <Tooltip title="Notification sound">
            <IconButton
              size="small"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSoundMenuAnchor(e.currentTarget);
              }}
              sx={{ p: 0.25, color: "text.secondary", "&:hover": { color: "text.primary" } }}
            >
              <MusicNoteOutlinedIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={soundEnabled ? "Mute alerts" : "Unmute alerts"}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSound();
              }}
              sx={{
                p: 0.25,
                color: soundEnabled ? "text.secondary" : "text.disabled",
                "&:hover": { color: "text.primary" },
              }}
            >
              {soundEnabled ? (
                <VolumeUpOutlinedIcon sx={{ fontSize: 15 }} />
              ) : (
                <VolumeMuteOutlinedIcon sx={{ fontSize: 15 }} />
              )}
            </IconButton>
          </Tooltip>
          {typeof window !== "undefined" && "Notification" in window && (
            <Tooltip
              title={
                Notification.permission === "denied"
                  ? "Desktop notifications blocked — enable in your browser's site settings"
                  : desktopNotifEnabled
                    ? "Disable desktop notifications"
                    : "Enable desktop notifications (shows even when this tab isn't focused)"
              }
            >
              <span>
                <IconButton
                  size="small"
                  disabled={Notification.permission === "denied"}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleDesktopNotif();
                  }}
                  sx={{
                    p: 0.25,
                    color: desktopNotifEnabled ? "text.secondary" : "text.disabled",
                    "&:hover": { color: "text.primary" },
                  }}
                >
                  {desktopNotifEnabled ? (
                    <NotificationsActiveOutlinedIcon sx={{ fontSize: 15 }} />
                  ) : (
                    <NotificationsOffOutlinedIcon sx={{ fontSize: 15 }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          )}
        </ListItemButton>
      </List>

      {/* Sound preset menu */}
      <Menu
        anchorEl={soundMenuAnchor}
        open={Boolean(soundMenuAnchor)}
        onClose={() => setSoundMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        {Object.entries(SOUND_PRESETS).map(([key, preset]) => (
          <MenuItem
            key={key}
            selected={key === soundPreset}
            onClick={() => selectSoundPreset(key)}
            sx={{
              fontSize: "0.8rem",
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              pr: 0.5,
            }}
          >
            {preset.label}
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handlePreview(key);
              }}
              sx={{ p: 0.25 }}
            >
              {previewingKey === key ? (
                <StopOutlinedIcon sx={{ fontSize: "0.95rem" }} />
              ) : (
                <PlayArrowOutlinedIcon sx={{ fontSize: "0.95rem" }} />
              )}
            </IconButton>
          </MenuItem>
        ))}
        {customSounds.length > 0 && <Divider />}
        {customSounds.map((s) => (
          <MenuItem
            key={s.id}
            selected={s.id === soundPreset}
            onClick={() => selectSoundPreset(s.id)}
            sx={{
              fontSize: "0.8rem",
              display: "flex",
              justifyContent: "space-between",
              gap: 1,
              pr: 0.5,
            }}
          >
            <Typography noWrap sx={{ fontSize: "0.8rem", maxWidth: 130, flex: 1 }}>
              {s.name}
            </Typography>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handlePreview(s.id);
              }}
              sx={{ p: 0.25 }}
            >
              {previewingKey === s.id ? (
                <StopOutlinedIcon sx={{ fontSize: "0.95rem" }} />
              ) : (
                <PlayArrowOutlinedIcon sx={{ fontSize: "0.95rem" }} />
              )}
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteCustomSound(s.id);
              }}
              sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}
            >
              <CloseIcon sx={{ fontSize: "0.85rem" }} />
            </IconButton>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => customFileInputRef.current?.click()}
          sx={{ fontSize: "0.8rem", gap: 1, color: "text.secondary" }}
        >
          <UploadFileOutlinedIcon sx={{ fontSize: "1rem" }} />
          Upload sound…
        </MenuItem>
      </Menu>

      {/* Health status */}
      <Box sx={{ px: 2.5, py: 1.5, display: "flex", flexDirection: "column", gap: 0.75 }}>
        <StatusDot ok={health?.ok ?? null} label={t("health.backend")} />
        <StatusDot ok={health?.zabbix ?? null} label={t("health.zabbix")} />
      </Box>

      <Divider />

      {/* User */}
      {user && (
        <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #8C72E8, #C478A8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Typography
              sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}
            >
              {initials}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.2 }} noWrap>
              {user.display_name || user.username}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.25 }}>
              {(user.roles ?? []).map((r) => (
                <Chip
                  key={r}
                  label={t(`teams.roles.${r}`, {
                    defaultValue: r.charAt(0).toUpperCase() + r.slice(1),
                  })}
                  size="small"
                  color={
                    r === "root"
                      ? "error"
                      : r === "team_lead"
                        ? "primary"
                        : r === "operator"
                          ? "secondary"
                          : r === "auditor"
                            ? "warning"
                            : "default"
                  }
                  sx={{ height: 16, fontSize: "0.58rem" }}
                />
              ))}
            </Box>
          </Box>
          <Tooltip title={t("auth.logout")}>
            <IconButton
              size="small"
              onClick={logout}
              sx={{
                color: "text.secondary",
                "&:hover": { color: "error.light" },
                transition: "color 0.15s",
              }}
            >
              <LogoutIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100%" }}>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          anchor="left"
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              overflowY: "hidden",
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          anchor="left"
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              overflowY: "hidden",
              borderRight: isDark
                ? "1px solid rgba(212,207,235,0.07)"
                : "1px solid rgba(28,24,40,0.08)",
              backgroundColor: isDark ? "rgba(8,7,12,0.96)" : "rgba(253,250,246,0.97)",
              backdropFilter: "blur(20px)",
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          pt: { xs: 2, sm: 3 },
          px: { xs: 2, sm: 3.5 },
          pb: 5,
          maxWidth: "100%",
        }}
      >
        {/* Mobile top bar */}
        <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", mb: 2.5, gap: 1 }}>
          <IconButton
            onClick={() => setMobileOpen(true)}
            size="small"
            sx={{ color: "text.secondary" }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 700 }}>
            {pageTitle}
          </Typography>
          <Chip
            size="small"
            label={health?.ok && health?.zabbix ? "Healthy" : "Degraded"}
            color={health?.ok && health?.zabbix ? "success" : "warning"}
            variant="outlined"
          />
        </Box>

        {children}
      </Box>

      {/* Notification stack */}
      {notifications.length > 0 && (
        <Box
          sx={{
            position: "fixed",
            bottom: { xs: 16, sm: 24 },
            right: { xs: 8, sm: 24 },
            zIndex: 2000,
            display: "flex",
            flexDirection: "column-reverse",
            gap: 1,
            maxHeight: "80vh",
            overflowY: "auto",
            pointerEvents: "none",
            "& > *": { pointerEvents: "auto", maxWidth: "calc(100vw - 16px)" },
          }}
        >
          {notifications.length > 3 && (
            <Box
              sx={{ display: "flex", justifyContent: "flex-end", pr: 0.5 }}
              onClick={() => setNotifications([])}
            >
              <Typography
                sx={{
                  fontSize: "0.72rem",
                  color: "text.secondary",
                  cursor: "pointer",
                  "&:hover": { color: "text.primary" },
                }}
              >
                Dismiss all ({notifications.length})
              </Typography>
            </Box>
          )}
          {notifications.map((p) => (
            <NotifCard key={p.eventid} problem={p} onDismiss={() => dismissNotif(p.eventid)} />
          ))}
        </Box>
      )}

      {/* Notification center drawer */}
      <NotificationCenter
        open={notifCenterOpen}
        onClose={() => setNotifCenterOpen(false)}
        history={storedHistory}
        problems={activeProblems}
        lastReadClock={lastReadClock}
        clearedBefore={clearedBefore}
        onMarkAllRead={markAllRead}
        onClearHistory={clearHistory}
        onRefresh={refreshCenter}
        onAcknowledge={async (id) => {
          await api.acknowledgeProblem(id, {
            problem_name: "",
            hostname: "",
            severity: 0,
            note: "",
          });
          acknowledgeInHistory(id);
          api
            .getProblems()
            .then((r) => setActiveProblems(r.problems))
            .catch(() => {});
        }}
        loading={centerLoading}
      />

      {/* Hidden file input for custom alert sound */}
      <input
        ref={customFileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: "none" }}
        onChange={handleCustomFileChange}
      />
    </Box>
  );
};

export const AppShell = ({ children }: PropsWithChildren) => (
  <Suspense fallback={<Box sx={{ minHeight: "100vh" }} />}>
    <AppShellInner>{children}</AppShellInner>
  </Suspense>
);
