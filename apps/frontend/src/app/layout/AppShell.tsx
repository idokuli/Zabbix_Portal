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
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
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
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
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
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { type Problem, type StoredNotif, api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";

import { NotifCard, NotificationCenter } from "./NotificationCenter";
import { SOUND_PRESETS } from "./alertSounds";
import { useAlertPolling } from "./useAlertPolling";
import { useSoundSettings } from "./useSoundSettings";

const drawerWidth = 224;
const topBarHeight = 52;

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

// ── Sidebar navigation ────────────────────────────────────────────────

const NavSubItem = ({
  item,
  selected,
  problemCount,
  t,
}: {
  item: NavItem;
  selected: boolean;
  problemCount: number;
  t: (key: string) => string;
}) => {
  const isProblems = item.href === "/metrics?tab=problems";
  return (
    <ListItemButton
      component={Link}
      href={item.href}
      sx={{
        borderRadius: "6px",
        mb: 0.25,
        pl: 1.5,
        pr: 1,
        py: 0.6,
        backgroundColor: selected ? "action.selected" : "transparent",
        "&:hover": {
          backgroundColor: selected ? "action.selected" : "action.hover",
        },
        transition: "background-color 0.15s ease",
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
              "& .MuiBadge-badge": { fontSize: "0.5rem", height: 13, minWidth: 13, p: "0 2px" },
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
          fontSize: "0.8125rem",
          fontWeight: selected ? 600 : 400,
          color: selected ? "text.primary" : "text.secondary",
        }}
      />
    </ListItemButton>
  );
};

const NavSectionLabel = ({ labelKey, t }: { labelKey: string; t: (key: string) => string }) => (
  <Typography
    variant="overline"
    sx={{
      px: 1.5,
      pt: 2,
      pb: 0.5,
      display: "block",
      color: "text.disabled",
      fontSize: "0.625rem",
    }}
  >
    {t(labelKey)}
  </Typography>
);

const NavGroupLink = ({
  group,
  isActive,
  t,
}: {
  group: NavGroup;
  isActive: boolean;
  t: (key: string) => string;
}) => (
  <Box sx={{ mb: 0.25 }}>
    {group.sectionLabelKey && <NavSectionLabel labelKey={group.sectionLabelKey} t={t} />}
    <ListItemButton
      component={Link}
      href={group.href ?? "/"}
      sx={{
        borderRadius: "6px",
        px: 1.5,
        py: 0.6,
        minHeight: 32,
        backgroundColor: isActive ? "action.selected" : "transparent",
        "&:hover": {
          bgcolor: isActive ? "action.selected" : "action.hover",
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 30, color: isActive ? "primary.main" : "text.secondary" }}>
        {group.icon}
      </ListItemIcon>
      <ListItemText
        primary={t(group.labelKey)}
        primaryTypographyProps={{
          fontSize: "0.8125rem",
          fontWeight: isActive ? 600 : 500,
          color: isActive ? "text.primary" : "text.secondary",
        }}
      />
    </ListItemButton>
  </Box>
);

const NavGroupCollapsible = ({
  group,
  isNavItemActive,
  isOpen,
  toggleGroup,
  problemCount,
  t,
}: {
  group: NavGroup;
  isNavItemActive: (href: string) => boolean;
  isOpen: boolean;
  toggleGroup: (id: string) => void;
  problemCount: number;
  t: (key: string) => string;
}) => {
  const hasActive = group.items.some((item) => isNavItemActive(item.href));
  return (
    <Box sx={{ mb: 0.25 }}>
      {group.sectionLabelKey && <NavSectionLabel labelKey={group.sectionLabelKey} t={t} />}
      <ListItemButton
        onClick={() => toggleGroup(group.id)}
        sx={{
          borderRadius: "6px",
          px: 1.5,
          py: 0.6,
          minHeight: 32,
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <ListItemIcon sx={{ minWidth: 30, color: hasActive ? "primary.main" : "text.secondary" }}>
          {group.icon}
        </ListItemIcon>
        <ListItemText
          primary={t(group.labelKey)}
          primaryTypographyProps={{
            fontSize: "0.8125rem",
            fontWeight: hasActive ? 600 : 500,
            color: hasActive ? "text.primary" : "text.secondary",
          }}
        />
        {isOpen ? (
          <ExpandMoreIcon sx={{ fontSize: 15, color: "text.disabled" }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 15, color: "text.disabled" }} />
        )}
      </ListItemButton>

      <Collapse in={isOpen} timeout="auto" unmountOnExit>
        <List
          disablePadding
          sx={{ pl: 2, borderLeft: "1px solid", borderColor: "divider", ml: 2.25, mt: 0.25 }}
        >
          {group.items.map((item) => (
            <NavSubItem
              key={item.href}
              item={item}
              selected={isNavItemActive(item.href)}
              problemCount={problemCount}
              t={t}
            />
          ))}
        </List>
      </Collapse>
    </Box>
  );
};

const NavGroupRow = ({
  group,
  pathname,
  isNavItemActive,
  isOpen,
  toggleGroup,
  problemCount,
  t,
}: {
  group: NavGroup;
  pathname: string | null;
  isNavItemActive: (href: string) => boolean;
  isOpen: boolean;
  toggleGroup: (id: string) => void;
  problemCount: number;
  t: (key: string) => string;
}) =>
  group.href ? (
    <NavGroupLink group={group} isActive={pathname === group.href} t={t} />
  ) : (
    <NavGroupCollapsible
      group={group}
      isNavItemActive={isNavItemActive}
      isOpen={isOpen}
      toggleGroup={toggleGroup}
      problemCount={problemCount}
      t={t}
    />
  );

const Sidebar = ({
  t,
  user,
  pathname,
  isNavItemActive,
  openGroups,
  toggleGroup,
  problemCount,
}: {
  t: (key: string, opts?: { defaultValue: string }) => string;
  user: { roles?: string[] } | null;
  pathname: string | null;
  isNavItemActive: (href: string) => boolean;
  openGroups: Record<string, boolean>;
  toggleGroup: (id: string) => void;
  problemCount: number;
}) => (
  <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
    {/* Brand */}
    <Box
      component={Link}
      href="/"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 2,
        height: topBarHeight,
        flexShrink: 0,
        textDecoration: "none",
        color: "inherit",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        component="img"
        src="/Overwatch_sign.png"
        alt="Overwatch"
        sx={{ width: 26, height: 26, objectFit: "contain", flexShrink: 0 }}
      />
      <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", letterSpacing: 0.1 }}>
        {t("app.name")}
      </Typography>
    </Box>

    {/* Nav */}
    <List sx={{ px: 1.25, pt: 1.25, pb: 2, flex: 1, overflowY: "auto" }} disablePadding>
      {navGroups
        .filter((group) => {
          if (!group.adminOnly) {
            return true;
          }
          const roles = user?.roles ?? [];
          return roles.includes("root") || roles.includes("team_lead");
        })
        .map((group) => (
          <NavGroupRow
            key={group.id}
            group={group}
            pathname={pathname}
            isNavItemActive={isNavItemActive}
            isOpen={openGroups[group.id] !== false}
            toggleGroup={toggleGroup}
            problemCount={problemCount}
            t={t}
          />
        ))}
    </List>
  </Box>
);

// ── Top bar ───────────────────────────────────────────────────────────

const AlertSoundMenu = ({
  anchorEl,
  onClose,
  soundEnabled,
  toggleSound,
  desktopNotifEnabled,
  toggleDesktopNotif,
  soundPreset,
  selectSoundPreset,
  customSounds,
  previewingKey,
  handlePreview,
  handleDeleteCustomSound,
  customFileInputRef,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  desktopNotifEnabled: boolean;
  toggleDesktopNotif: () => void;
  soundPreset: string;
  selectSoundPreset: (key: string) => void;
  customSounds: { id: string; name: string }[];
  previewingKey: string | null;
  handlePreview: (key: string) => void;
  handleDeleteCustomSound: (id: string) => void;
  customFileInputRef: React.RefObject<HTMLInputElement>;
}) => {
  const desktopNotifSupported = typeof window !== "undefined" && "Notification" in window;
  const desktopNotifDenied = desktopNotifSupported && Notification.permission === "denied";
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem
        onClick={toggleSound}
        sx={{ fontSize: "0.8125rem", gap: 2, justifyContent: "space-between" }}
      >
        Alert sound
        <Switch size="small" checked={soundEnabled} tabIndex={-1} />
      </MenuItem>
      {desktopNotifSupported && (
        <MenuItem
          onClick={desktopNotifDenied ? undefined : toggleDesktopNotif}
          disabled={desktopNotifDenied}
          sx={{ fontSize: "0.8125rem", gap: 2, justifyContent: "space-between" }}
        >
          Desktop notifications
          <Switch size="small" checked={desktopNotifEnabled} tabIndex={-1} />
        </MenuItem>
      )}
      <Divider />
      {Object.entries(SOUND_PRESETS).map(([key, preset]) => (
        <MenuItem
          key={key}
          selected={key === soundPreset}
          onClick={() => selectSoundPreset(key)}
          sx={{
            fontSize: "0.8125rem",
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
            fontSize: "0.8125rem",
            display: "flex",
            justifyContent: "space-between",
            gap: 1,
            pr: 0.5,
          }}
        >
          <Typography noWrap sx={{ fontSize: "0.8125rem", maxWidth: 130, flex: 1 }}>
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
        sx={{ fontSize: "0.8125rem", gap: 1, color: "text.secondary" }}
      >
        <UploadFileOutlinedIcon sx={{ fontSize: "1rem" }} />
        Upload sound…
      </MenuItem>
    </Menu>
  );
};

const HealthIndicator = ({
  health,
  t,
}: {
  health: { ok: boolean; zabbix: boolean } | null;
  t: (key: string) => string;
}) => {
  const items: Array<{ label: string; ok: boolean | null }> = [
    { label: t("health.backend"), ok: health?.ok ?? null },
    { label: t("health.zabbix"), ok: health?.zabbix ?? null },
  ];
  return (
    <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1.25, px: 1 }}>
      {items.map(({ label, ok }) => (
        <Tooltip
          key={label}
          title={`${label}: ${ok === null ? "unknown" : ok ? "online" : "offline"}`}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, cursor: "default" }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: ok === null ? "text.disabled" : ok ? "success.main" : "error.main",
              }}
            />
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
              {label}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
};

const UserMenu = ({
  user,
  initials,
  logout,
  t,
}: {
  user: { display_name?: string; username: string; roles?: string[] };
  initials: string;
  logout: () => void;
  t: (key: string, opts?: { defaultValue: string }) => string;
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip title={user.display_name || user.username}>
        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.25 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              bgcolor: "action.selected",
              color: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography sx={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: 0.5 }}>
              {initials}
            </Typography>
          </Box>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <Box sx={{ px: 2, py: 1, minWidth: 180 }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }} noWrap>
            {user.display_name || user.username}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
            {(user.roles ?? []).map((r) => (
              <Chip
                key={r}
                label={t(`teams.roles.${r}`, {
                  defaultValue: r.charAt(0).toUpperCase() + r.slice(1),
                })}
                size="small"
                variant="outlined"
                color={r === "root" ? "error" : r === "team_lead" ? "primary" : "default"}
                sx={{ height: 18, fontSize: "0.625rem" }}
              />
            ))}
          </Box>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            logout();
          }}
          sx={{ fontSize: "0.8125rem", gap: 1.25, color: "text.secondary" }}
        >
          <LogoutIcon sx={{ fontSize: 16 }} />
          {t("auth.logout")}
        </MenuItem>
      </Menu>
    </>
  );
};

const TopBar = ({
  t,
  pageTitle,
  onOpenMobileNav,
  problemCount,
  health,
  unreadCenterCount,
  openNotifCenter,
  setSoundMenuAnchor,
  soundEnabled,
  toggleMode,
  isDark,
  user,
  initials,
  logout,
}: {
  t: (key: string, opts?: { defaultValue: string }) => string;
  pageTitle: string;
  onOpenMobileNav: () => void;
  problemCount: number;
  health: { ok: boolean; zabbix: boolean } | null;
  unreadCenterCount: number;
  openNotifCenter: () => void;
  setSoundMenuAnchor: (el: HTMLElement | null) => void;
  soundEnabled: boolean;
  toggleMode: () => void;
  isDark: boolean;
  user: { display_name?: string; username: string; roles?: string[] } | null;
  initials: string;
  logout: () => void;
}) => (
  <Box
    component="header"
    sx={{
      position: "sticky",
      top: 0,
      zIndex: (theme) => theme.zIndex.appBar,
      height: topBarHeight,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: 1,
      px: { xs: 1.5, sm: 2.5 },
      borderBottom: "1px solid",
      borderColor: "divider",
      bgcolor: "background.paper",
    }}
  >
    <IconButton
      onClick={onOpenMobileNav}
      size="small"
      sx={{ display: { md: "none" }, color: "text.secondary" }}
    >
      <MenuIcon fontSize="small" />
    </IconButton>

    <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, flex: 1 }} noWrap>
      {pageTitle}
    </Typography>

    {/* Active problems */}
    <Chip
      component={Link}
      href="/metrics?tab=problems"
      clickable
      size="small"
      icon={
        problemCount > 0 ? (
          <WarningAmberOutlinedIcon sx={{ fontSize: "0.85rem !important" }} />
        ) : (
          <TaskAltOutlinedIcon sx={{ fontSize: "0.85rem !important" }} />
        )
      }
      label={
        problemCount > 0
          ? `${problemCount} problem${problemCount !== 1 ? "s" : ""}`
          : t("metrics.noProblems")
      }
      sx={{
        height: 24,
        fontSize: "0.72rem",
        fontWeight: 500,
        color: problemCount > 0 ? "error.main" : "text.secondary",
        bgcolor: (theme) =>
          problemCount > 0 ? alpha(theme.palette.error.main, 0.1) : "transparent",
        border: "1px solid",
        borderColor: (theme) =>
          problemCount > 0 ? alpha(theme.palette.error.main, 0.35) : theme.palette.divider,
        "& .MuiChip-icon": { color: "inherit" },
      }}
    />

    <HealthIndicator health={health} t={t} />

    <Divider
      orientation="vertical"
      flexItem
      sx={{ my: 1.25, display: { xs: "none", sm: "block" } }}
    />

    {/* Notification center */}
    <Tooltip title={t("nav.notificationCenter")}>
      <IconButton size="small" onClick={openNotifCenter} sx={{ color: "text.secondary" }}>
        <Badge
          badgeContent={unreadCenterCount || null}
          color="error"
          sx={{ "& .MuiBadge-badge": { fontSize: "0.5rem", height: 13, minWidth: 13, p: "0 2px" } }}
        >
          <InboxOutlinedIcon sx={{ fontSize: 18 }} />
        </Badge>
      </IconButton>
    </Tooltip>

    {/* Alert sound & notification settings */}
    <Tooltip title="Alert settings">
      <IconButton
        size="small"
        onClick={(e) => setSoundMenuAnchor(e.currentTarget)}
        sx={{ color: soundEnabled ? "text.secondary" : "text.disabled" }}
      >
        <TuneOutlinedIcon sx={{ fontSize: 17 }} />
      </IconButton>
    </Tooltip>

    {/* Theme */}
    <Tooltip title={t("theme.toggle")}>
      <IconButton size="small" onClick={toggleMode} sx={{ color: "text.secondary" }}>
        {isDark ? (
          <LightModeOutlinedIcon sx={{ fontSize: 17 }} />
        ) : (
          <DarkModeOutlinedIcon sx={{ fontSize: 17 }} />
        )}
      </IconButton>
    </Tooltip>

    {user && <UserMenu user={user} initials={initials} logout={logout} t={t} />}
  </Box>
);

// ── Notification toast stack ──────────────────────────────────────────

const NotificationStack = ({
  notifications,
  setNotifications,
  dismissNotif,
}: {
  notifications: Problem[];
  setNotifications: (v: Problem[]) => void;
  dismissNotif: (eventid: string) => void;
}) =>
  notifications.length > 0 && (
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
  );

// ── Shell ─────────────────────────────────────────────────────────────

const AppShellInner = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();

  const isNavItemActive = useCallback(
    (href: string): boolean => {
      const qi = href.indexOf("?");
      if (qi === -1) {
        return pathname === href;
      }
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
    for (const g of navGroups) {
      state[g.id] = false;
    }
    return state;
  });
  const toggleGroup = (id: string) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const [notifCenterOpen, setNotifCenterOpen] = useState(false);
  const [storedHistory, setStoredHistory] = useState<StoredNotif[]>([]);
  const [centerLoading, setCenterLoading] = useState(false);
  const [lastReadClock, setLastReadClock] = useState(() => {
    if (typeof window === "undefined") {
      return 0;
    }
    return Number.parseInt(localStorage.getItem("notifLastReadClock") ?? "0");
  });
  const [clearedBefore, setClearedBefore] = useState(() => {
    if (typeof window === "undefined") {
      return 0;
    }
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
      if (fresh.length === 0) {
        return current;
      }
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
      if (entry) {
        void api.saveNotifHistory([entry]);
      }
      return updated;
    });
  };

  const pageTitle = useMemo(() => {
    for (const g of navGroups) {
      if (g.href && pathname === g.href) {
        return t(g.labelKey);
      }
      const found = g.items.find((n) => isNavItemActive(n.href));
      if (found) {
        return t(found.labelKey);
      }
    }
    return "Overwatch";
  }, [pathname, isNavItemActive, t]);

  const initials = (user?.display_name || user?.username)?.slice(0, 2).toUpperCase() ?? "??";
  const problemCount = activeProblems.filter((p) => !p.acknowledged).length;

  const drawer = (
    <Sidebar
      t={t}
      user={user}
      pathname={pathname}
      isNavItemActive={isNavItemActive}
      openGroups={openGroups}
      toggleGroup={toggleGroup}
      problemCount={problemCount}
    />
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
              borderRight: "1px solid",
              borderRightColor: "divider",
              backgroundColor: "background.paper",
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        <TopBar
          t={t}
          pageTitle={pageTitle}
          onOpenMobileNav={() => setMobileOpen(true)}
          problemCount={problemCount}
          health={health}
          unreadCenterCount={unreadCenterCount}
          openNotifCenter={openNotifCenter}
          setSoundMenuAnchor={setSoundMenuAnchor}
          soundEnabled={soundEnabled}
          toggleMode={toggleMode}
          isDark={isDark}
          user={user}
          initials={initials}
          logout={logout}
        />

        <Box
          component="main"
          sx={{ flex: 1, pt: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3.5 }, pb: 5, maxWidth: "100%" }}
        >
          {children}
        </Box>
      </Box>

      <AlertSoundMenu
        anchorEl={soundMenuAnchor}
        onClose={() => setSoundMenuAnchor(null)}
        soundEnabled={soundEnabled}
        toggleSound={toggleSound}
        desktopNotifEnabled={desktopNotifEnabled}
        toggleDesktopNotif={toggleDesktopNotif}
        soundPreset={soundPreset}
        selectSoundPreset={selectSoundPreset}
        customSounds={customSounds}
        previewingKey={previewingKey}
        handlePreview={handlePreview}
        handleDeleteCustomSound={handleDeleteCustomSound}
        customFileInputRef={customFileInputRef}
      />

      {/* Notification stack */}
      <NotificationStack
        notifications={notifications}
        setNotifications={setNotifications}
        dismissNotif={dismissNotif}
      />

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
