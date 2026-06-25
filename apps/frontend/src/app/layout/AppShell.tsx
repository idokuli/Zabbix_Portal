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
import { Suspense, useCallback, useMemo, useState } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { type StoredNotif, api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";
import { NotifCard, NotificationCenter } from "./NotificationCenter";
import { SOUND_PRESETS } from "./alertSounds";
import { useAlertPolling } from "./useAlertPolling";
import { useSoundSettings } from "./useSoundSettings";

const drawerWidth = 240;

type NavItem = { href: string; label: string; icon: ReactNode; adminOnly?: boolean };
type NavGroup = {
  id: string;
  label: string;
  icon: ReactNode;
  items: NavItem[];
  adminOnly?: boolean;
  href?: string;
  sectionLabel?: string;
};

const navGroups: NavGroup[] = [
  // ── Overview ──────────────────────────────────────────────────────────
  {
    id: "overview",
    label: "Overview",
    icon: <DashboardOutlinedIcon sx={{ fontSize: 18 }} />,
    href: "/",
    items: [],
  },
  // ── Hosts ─────────────────────────────────────────────────────────────
  {
    id: "hosts",
    label: "Hosts",
    icon: <ComputerOutlinedIcon sx={{ fontSize: 18 }} />,
    href: "/hosts",
    items: [],
  },
  // ── Monitoring ────────────────────────────────────────────────────────
  {
    id: "monitoring",
    label: "Monitoring",
    icon: <ShowChartOutlinedIcon sx={{ fontSize: 18 }} />,
    items: [
      {
        href: "/metrics?tab=problems",
        label: "Problems",
        icon: <WarningAmberOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/metrics?tab=latest-data",
        label: "Latest Data",
        icon: <StorageOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      { href: "/items", label: "Items", icon: <UploadFileOutlinedIcon sx={{ fontSize: 18 }} /> },
      {
        href: "/triggers",
        label: "Triggers",
        icon: <NotificationsActiveOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  // ── Dashboard ─────────────────────────────────────────────────────────
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <SpaceDashboardOutlinedIcon sx={{ fontSize: 18 }} />,
    items: [
      {
        href: "/dashboard?tab=graphs",
        label: "Graphs",
        icon: <ShowChartOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/dashboard?tab=host-metrics",
        label: "Host Metrics",
        icon: <ComputerOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/dashboard?tab=recent-items",
        label: "Recent Items",
        icon: <StorageOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  // ── Services ──────────────────────────────────────────────────────────
  {
    id: "services",
    label: "Services",
    icon: <TaskAltOutlinedIcon sx={{ fontSize: 18 }} />,
    items: [
      {
        href: "/services",
        label: "Business Services",
        icon: <TaskAltOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  // ── Alerts ────────────────────────────────────────────────────────────
  {
    id: "alerts",
    label: "Alerts",
    icon: <NotificationsActiveOutlinedIcon sx={{ fontSize: 18 }} />,
    items: [
      {
        href: "/alerts-management",
        label: "Alert Rules",
        icon: <NotificationsActiveOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  // ── Data Collection ───────────────────────────────────────────────────
  {
    id: "datacollection",
    label: "Data Collection",
    icon: <AccountTreeOutlinedIcon sx={{ fontSize: 18 }} />,
    items: [
      {
        href: "/data-collection?tab=template-groups",
        label: "Template Groups",
        icon: <AccountTreeOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/data-collection?tab=host-groups",
        label: "Host Groups",
        icon: <GroupsOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/data-collection?tab=templates",
        label: "Templates",
        icon: <StorageOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/data-collection?tab=maintenance",
        label: "Maintenance",
        icon: <SettingsOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/data-collection?tab=event-correlation",
        label: "Event Correlation",
        icon: <ShowChartOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/data-collection?tab=discovery",
        label: "Discovery",
        icon: <ComputerOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  // ── Reports ───────────────────────────────────────────────────────────
  {
    id: "reports",
    label: "Reports",
    icon: <AssessmentOutlinedIcon sx={{ fontSize: 18 }} />,
    items: [
      {
        href: "/reports?tab=availability",
        label: "Availability",
        icon: <AssessmentOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/reports?tab=top-triggers",
        label: "Top Triggers",
        icon: <WarningAmberOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/reports?tab=audit-log",
        label: "Audit Log",
        icon: <StorageOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/reports?tab=action-log",
        label: "Action Log",
        icon: <PlayArrowOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/reports?tab=notifications",
        label: "Alert History",
        icon: <NotificationsNoneOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  // ── Management section ────────────────────────────────────────────────
  {
    id: "users",
    label: "Users",
    icon: <PeopleOutlinedIcon sx={{ fontSize: 18 }} />,
    sectionLabel: "Management",
    items: [
      { href: "/users", label: "Portal Users", icon: <PeopleOutlinedIcon sx={{ fontSize: 18 }} /> },
      { href: "/teams", label: "Teams", icon: <GroupsOutlinedIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  // ── Administration section ────────────────────────────────────────────
  {
    id: "useradmin",
    label: "User Admin",
    icon: <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 18 }} />,
    sectionLabel: "Administration",
    adminOnly: true,
    items: [
      {
        href: "/users-management?tab=user-groups",
        label: "User Groups",
        icon: <GroupsOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/users-management?tab=roles",
        label: "User Roles",
        icon: <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/users-management?tab=api-tokens",
        label: "API Tokens",
        icon: <KeyOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/users-management?tab=authentication",
        label: "Portal Login",
        icon: <LockOutlinedIcon sx={{ fontSize: 18 }} />,
      },
    ],
  },
  {
    id: "administration",
    label: "Zabbix Server",
    icon: <SettingsOutlinedIcon sx={{ fontSize: 18 }} />,
    adminOnly: true,
    items: [
      {
        href: "/administration?tab=proxies",
        label: "Proxies",
        icon: <RouterOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/administration?tab=proxy-groups",
        label: "Proxy Groups",
        icon: <AccountTreeOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/administration?tab=macros",
        label: "Global Macros",
        icon: <CodeOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/administration?tab=housekeeping",
        label: "Housekeeping",
        icon: <SettingsOutlinedIcon sx={{ fontSize: 18 }} />,
      },
      {
        href: "/administration?tab=authentication",
        label: "Zabbix Auth",
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
        backgroundColor: ok === null ? "#64748B" : ok ? "#22C55E" : "#EF4444",
        boxShadow: ok ? "0 0 6px rgba(34,197,94,0.7)" : "none",
        flexShrink: 0,
      }}
    />
    <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
      {label}
    </Typography>
  </Box>
);

// ── AppShell ──────────────────────────────────────────────────────────────────

const loadStoredHistory = (): StoredNotif[] => {
  try {
    return JSON.parse(localStorage.getItem("notifHistory") ?? "[]");
  } catch {
    return [];
  }
};

const AppShellInner = ({ children }: PropsWithChildren) => {
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

  const { mode, toggle: toggleMode, direction, toggleDirection } = useThemeMode();
  const isDark = mode === "dark";
  const isRtl = direction === "rtl";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    for (const g of navGroups) state[g.id] = false;
    return state;
  });
  const toggleGroup = (id: string) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Notification center state ─────────────────────────────────────────────
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);
  const [storedHistory, setStoredHistory] = useState<StoredNotif[]>(() => loadStoredHistory());
  const [centerLoading, setCenterLoading] = useState(false);
  const [lastReadClock, setLastReadClock] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number.parseInt(localStorage.getItem("notifLastReadClock") ?? "0");
  });
  const [clearedBefore, setClearedBefore] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number.parseInt(localStorage.getItem("notifClearedBefore") ?? "0");
  });

  const unreadCenterCount = storedHistory.filter(
    (n) => n.clock > lastReadClock && n.clock > clearedBefore,
  ).length;

  const saveToHistory = useCallback((entries: StoredNotif[]) => {
    const current = loadStoredHistory();
    const existingIds = new Set(current.map((n) => n.id));
    const fresh = entries.filter((e) => !existingIds.has(e.id));
    if (fresh.length === 0) return;
    const merged = [...fresh, ...current].slice(0, 200);
    localStorage.setItem("notifHistory", JSON.stringify(merged));
    setStoredHistory(merged);
  }, []);

  // ── Sound settings ────────────────────────────────────────────────────────
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

  // ── Alert polling ─────────────────────────────────────────────────────────
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
    setStoredHistory(loadStoredHistory());
    api
      .getProblems()
      .then((prRes) => setActiveProblems(prRes.problems))
      .catch(() => {})
      .finally(() => setCenterLoading(false));
  };

  const acknowledgeInHistory = (id: string) => {
    setStoredHistory((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, acknowledged: true } : n));
      localStorage.setItem("notifHistory", JSON.stringify(updated));
      return updated;
    });
  };

  const pageTitle = useMemo(() => {
    for (const g of navGroups) {
      if (g.href && pathname === g.href) return g.label;
      const found = g.items.find((n) => isNavItemActive(n.href));
      if (found) return found.label;
    }
    return "Overwatch";
  }, [pathname, isNavItemActive]);

  const initials = user?.username.slice(0, 2).toUpperCase() ?? "??";
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
              Overwatch
            </Typography>
            <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", lineHeight: 1.3 }}>
              Control Plane
            </Typography>
          </Box>
          <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton
              size="small"
              onClick={toggleMode}
              sx={{
                color: "text.secondary",
                flexShrink: 0,
                "&:hover": { color: "primary.main", backgroundColor: "rgba(59,130,246,0.1)" },
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
          <Tooltip
            title={isRtl ? "Switch to LTR layout" : "Switch to RTL layout (Hebrew / Arabic)"}
          >
            <IconButton
              size="small"
              aria-label={isRtl ? "Switch to LTR layout" : "Switch to RTL layout"}
              onClick={toggleDirection}
              sx={{
                color: isRtl ? "primary.main" : "text.secondary",
                flexShrink: 0,
                fontSize: "0.6rem",
                fontWeight: 700,
                "&:hover": { color: "primary.main", backgroundColor: "rgba(59,130,246,0.1)" },
                transition: "all 0.2s ease",
              }}
            >
              <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, lineHeight: 1 }}>
                {isRtl ? "LTR" : "RTL"}
              </Typography>
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
                  {group.sectionLabel && (
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
                        {group.sectionLabel}
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
                      backgroundColor: isActive ? "rgba(59,130,246,0.1)" : "transparent",
                      "&:hover": {
                        bgcolor: isActive ? "rgba(59,130,246,0.13)" : "rgba(255,255,255,0.04)",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{ minWidth: 26, color: isActive ? "primary.main" : "text.disabled" }}
                    >
                      {group.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={group.label}
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
                {group.sectionLabel && (
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
                      {group.sectionLabel}
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
                    "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
                  }}
                >
                  <ListItemIcon
                    sx={{ minWidth: 26, color: hasActive ? "primary.main" : "text.disabled" }}
                  >
                    {group.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={group.label}
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
                            borderLeft: `2px solid ${selected ? "#3B82F6" : "transparent"}`,
                            backgroundColor: selected ? "rgba(59,130,246,0.1)" : "transparent",
                            "&:hover": {
                              backgroundColor: selected
                                ? "rgba(59,130,246,0.13)"
                                : "rgba(255,255,255,0.04)",
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
                            primary={item.label}
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
            "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" },
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
            primary="Notification Center"
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
            borderLeft: `2px solid ${problemCount > 0 ? "rgba(239,68,68,0.6)" : "transparent"}`,
            backgroundColor: problemCount > 0 ? "rgba(239,68,68,0.06)" : "transparent",
            "&:hover": {
              backgroundColor: problemCount > 0 ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)",
            },
            transition: "all 0.15s ease",
          }}
        >
          <ListItemIcon
            sx={{ minWidth: 30, color: problemCount > 0 ? "#EF4444" : "text.disabled" }}
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
                : "No active problems"
            }
            primaryTypographyProps={{
              fontSize: "0.8rem",
              fontWeight: problemCount > 0 ? 600 : 400,
              color: problemCount > 0 ? "#EF4444" : "text.disabled",
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
        <StatusDot ok={health?.ok ?? null} label="Backend API" />
        <StatusDot ok={health?.zabbix ?? null} label="Zabbix" />
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
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
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
              {user.username}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.25 }}>
              {(user.roles ?? []).map((r) => (
                <Chip
                  key={r}
                  label={r === "team_lead" ? "Team Lead" : r.charAt(0).toUpperCase() + r.slice(1)}
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
          <Tooltip title="Sign out">
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
    <Box sx={{ display: "flex", minHeight: "100%", flexDirection: isRtl ? "row-reverse" : "row" }}>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          anchor={isRtl ? "right" : "left"}
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
          anchor={isRtl ? "right" : "left"}
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              overflowY: "hidden",
              ...(isRtl
                ? {
                    borderLeft: isDark
                      ? "1px solid rgba(255,255,255,0.06)"
                      : "1px solid rgba(15,23,42,0.08)",
                  }
                : {
                    borderRight: isDark
                      ? "1px solid rgba(255,255,255,0.06)"
                      : "1px solid rgba(15,23,42,0.08)",
                  }),
              backgroundColor: isDark ? "rgba(9,18,34,0.94)" : "rgba(255,255,255,0.97)",
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

      {/* ── Notification stack (bottom-right) ── */}
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

      {/* ── Notification center drawer ── */}
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
