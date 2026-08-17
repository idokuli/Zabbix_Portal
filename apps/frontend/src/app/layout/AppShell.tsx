"use client";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import SearchIcon from "@mui/icons-material/Search";
import StopOutlinedIcon from "@mui/icons-material/StopOutlined";
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
  Menu,
  MenuItem,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { PropsWithChildren } from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Problem, type StoredNotif } from "../api";
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";
import { monoFontFamily } from "../theme";
import { SOUND_PRESETS } from "./alertSounds";
import { CommandPalette } from "./CommandPalette";
import { NotifCard, NotificationCenter } from "./NotificationCenter";
import { type NavGroup, visibleNavGroups } from "./nav";
import { useAlertPolling } from "./useAlertPolling";
import { useSoundSettings } from "./useSoundSettings";

const topBarHeight = 48;

// ── Top bar ───────────────────────────────────────────────────────────

const AlertSoundMenu = ({
  anchorEl,
  onClose,
  soundEnabled,
  toggleSound,
  desktopNotifEnabled,
  toggleDesktopNotif,
  desktopNotifPersistentEnabled,
  toggleDesktopNotifPersistent,
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
  desktopNotifPersistentEnabled: boolean;
  toggleDesktopNotifPersistent: () => void;
  soundPreset: string;
  selectSoundPreset: (key: string) => void;
  customSounds: { id: string; name: string }[];
  previewingKey: string | null;
  handlePreview: (key: string) => void;
  handleDeleteCustomSound: (id: string) => void;
  // React 19 types: useRef<T>(null) yields RefObject<T | null>, not RefObject<T>.
  customFileInputRef: React.RefObject<HTMLInputElement | null>;
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
      {desktopNotifSupported && (
        <Tooltip
          title="Keeps the Windows/Chrome popup on screen until someone dismisses it, instead of it auto-vanishing after a few seconds"
          placement="left"
        >
          <MenuItem
            onClick={desktopNotifEnabled ? toggleDesktopNotifPersistent : undefined}
            disabled={!desktopNotifEnabled}
            sx={{ fontSize: "0.8125rem", gap: 2, justifyContent: "space-between" }}
          >
            Keep notifications on screen
            <Switch size="small" checked={desktopNotifPersistentEnabled} tabIndex={-1} />
          </MenuItem>
        </Tooltip>
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
                backgroundColor: ok === null ? "text.disabled" : ok ? "#3FB950" : "#F0564F",
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

// ── Horizontal navigation (rows 2-3 of the chrome) ────────────────────

const groupFirstHref = (g: NavGroup): string => g.href ?? g.items[0]?.href ?? "/";

// Determines which single nav group "owns" the current URL. An exact match
// (tab-aware for query-string hrefs) always wins outright; only when nothing
// matches exactly — e.g. a bare "/metrics" link with no ?tab= — do we fall
// back to whichever group's item shares the base path first, in declaration
// order, mirroring the page's own default-tab behavior. Checking every
// group's exact match before ever consulting the fallback is what prevents
// two groups that share a base path with different tabs (e.g. Monitoring's
// "/metrics?tab=problems" and Alerts' "/metrics?tab=alert-rules") from both
// showing active at once.
const findActiveGroupId = (
  groups: NavGroup[],
  pathname: string | null,
  isNavItemActive: (href: string) => boolean,
): string | undefined => {
  const exact = groups.find((g) =>
    g.href ? pathname === g.href : g.items.some((i) => isNavItemActive(i.href)),
  );
  if (exact) {
    return exact.id;
  }
  return groups.find((g) => g.items.some((i) => i.href.split("?")[0] === pathname))?.id;
};

const railWidth = 56;
const panelWidth = 216;

// Activity rail — narrow, icon-only, always visible. VS Code's activity-bar
// pattern: pick a section here, its sub-pages populate the adjacent panel.
// Chosen because this app has 10 sections and several carry 4-6 sub-pages —
// a horizontal nav row runs out of width fast; a two-tier top-nav did too.
const ActivityRailItem = ({
  g,
  t,
  active,
  problemCount,
  panelCollapsed,
  onToggleCollapse,
}: {
  g: NavGroup;
  t: (key: string) => string;
  active: boolean;
  problemCount: number;
  panelCollapsed: boolean;
  onToggleCollapse: () => void;
}) => {
  const showBadge = g.id === "monitoring" && problemCount > 0;
  const hasPanel = g.items.length > 0;
  return (
    <Tooltip
      title={
        hasPanel && active
          ? `${t(g.labelKey)} (${panelCollapsed ? "show" : "hide"})`
          : t(g.labelKey)
      }
      placement="right"
    >
      <Box
        component={Link}
        href={groupFirstHref(g)}
        aria-current={active ? "page" : undefined}
        onClick={(e) => {
          // Already on this section — toggle the panel instead of a no-op nav.
          if (hasPanel && active) {
            e.preventDefault();
            onToggleCollapse();
          }
        }}
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          flexShrink: 0,
          textDecoration: "none",
          color: active ? "primary.main" : "text.secondary",
          bgcolor: active ? "action.selected" : "transparent",
          "&:hover": {
            color: "text.primary",
            bgcolor: active ? "action.selected" : "action.hover",
          },
        }}
      >
        {g.icon}
        {showBadge && (
          <Box
            sx={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: "#F0564F",
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
};

const ActivityRail = ({
  t,
  roles,
  pathname,
  isNavItemActive,
  problemCount,
  panelCollapsed,
  onToggleCollapse,
}: {
  t: (key: string) => string;
  roles: string[];
  pathname: string | null;
  isNavItemActive: (href: string) => boolean;
  problemCount: number;
  panelCollapsed: boolean;
  onToggleCollapse: () => void;
}) => {
  const groups = visibleNavGroups(roles);
  const activeGroupId = findActiveGroupId(groups, pathname, isNavItemActive);
  return (
    <Box
      component="nav"
      aria-label="Sections"
      sx={{
        width: railWidth,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        py: 1.5,
        bgcolor: "background.paper",
        borderRight: "1px solid",
        borderColor: "divider",
        overflowY: "auto",
      }}
    >
      {groups.map((g) => (
        <ActivityRailItem
          key={g.id}
          g={g}
          t={t}
          active={g.id === activeGroupId}
          problemCount={problemCount}
          panelCollapsed={panelCollapsed}
          onToggleCollapse={onToggleCollapse}
        />
      ))}
    </Box>
  );
};

// Section panel — the active rail item's sub-pages as a real vertical list
// (not a hover flyout, not squeezed into a horizontal row). Absent entirely
// for sections with no sub-pages (Overview, Hosts), which just get the rail.
const SectionPanel = ({
  t,
  roles,
  pathname,
  isNavItemActive,
  onCollapse,
}: {
  t: (key: string) => string;
  roles: string[];
  pathname: string | null;
  isNavItemActive: (href: string) => boolean;
  onCollapse: () => void;
}) => {
  const groups = visibleNavGroups(roles);
  const activeGroupId = findActiveGroupId(groups, pathname, isNavItemActive);
  const activeGroup = groups.find((g) => g.id === activeGroupId && g.items.length > 0);
  if (!activeGroup) {
    return null;
  }
  // On a tabless URL the page renders its first tab — mark that item active.
  const selectedHref =
    activeGroup.items.find((i) => isNavItemActive(i.href))?.href ??
    activeGroup.items.find((i) => i.href.split("?")[0] === pathname)?.href;
  return (
    <Box
      component="nav"
      aria-label={t(activeGroup.labelKey)}
      sx={{
        width: panelWidth,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderRight: "1px solid",
        borderColor: "divider",
        overflowY: "auto",
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          pl: 2,
          pr: 0.5,
          pt: 1.25,
          pb: 0.5,
        }}
      >
        <Typography
          sx={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "text.secondary",
          }}
        >
          {t(activeGroup.labelKey)}
        </Typography>
        <Tooltip title="Collapse">
          <IconButton size="small" onClick={onCollapse} sx={{ color: "text.disabled" }}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {activeGroup.items.map((item) => {
        const sel = item.href === selectedHref;
        return (
          <Box
            key={item.href}
            component={Link}
            href={item.href}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: 2,
              py: 0.9,
              textDecoration: "none",
              fontSize: "0.8125rem",
              fontWeight: sel ? 600 : 400,
              color: sel ? "text.primary" : "text.secondary",
              bgcolor: sel ? "action.selected" : "transparent",
              "&:hover": { bgcolor: sel ? "action.selected" : "action.hover" },
            }}
          >
            <Box
              sx={{
                display: "flex",
                color: sel ? "primary.main" : "text.disabled",
                "& svg": { fontSize: 17 },
              }}
            >
              {item.icon}
            </Box>
            {t(item.labelKey)}
          </Box>
        );
      })}
    </Box>
  );
};

// Stays put after the panel collapses so there's always a visible way back
// in — re-clicking the active rail icon also works, but isn't discoverable.
// Mirrors the panel's own "Collapse" chevron button (same size/color/hover),
// just flipped direction and top-aligned in a narrow bordered column.
const CollapsedPanelHandle = ({ onExpand }: { onExpand: () => void }) => (
  <Box
    sx={{
      flexShrink: 0,
      display: "flex",
      justifyContent: "center",
      pt: 1.25,
      bgcolor: "background.paper",
      borderRight: "1px solid",
      borderColor: "divider",
    }}
  >
    <Tooltip title="Expand section panel">
      <IconButton size="small" onClick={onExpand} sx={{ color: "text.disabled" }}>
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  </Box>
);

// Mobile fallback — the rail + panel are desktop-only (no room on a phone
// for two persistent columns). A temporary drawer with expandable groups
// covers the same nav tree in one scrollable list.
const MobileNavDrawer = ({
  open,
  onClose,
  t,
  roles,
  pathname,
  isNavItemActive,
  problemCount,
}: {
  open: boolean;
  onClose: () => void;
  t: (key: string) => string;
  roles: string[];
  pathname: string | null;
  isNavItemActive: (href: string) => boolean;
  problemCount: number;
}) => {
  const groups = visibleNavGroups(roles);
  const activeGroupId = findActiveGroupId(groups, pathname, isNavItemActive);
  const [openId, setOpenId] = useState<string | null>(() => activeGroupId ?? null);
  return (
    <Drawer
      slotProps={{ paper: { sx: { width: 260, bgcolor: "background.paper" } } }}
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
    >
      <Box
        sx={{
          height: topBarHeight,
          display: "flex",
          alignItems: "center",
          px: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box component="img" src="/Overwatch_sign.png" alt="" sx={{ width: 22, height: 22 }} />
        <Typography
          sx={{
            ml: 1.25,
            fontWeight: 700,
            fontSize: "0.75rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "text.primary",
          }}
        >
          {t("app.name")}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        {groups.map((g) => (
          <MobileNavGroupRow
            key={g.id}
            group={g}
            active={g.id === activeGroupId}
            isOpen={openId === g.id}
            onToggle={() => setOpenId(openId === g.id ? null : g.id)}
            isNavItemActive={isNavItemActive}
            problemCount={problemCount}
            onNavigate={onClose}
            t={t}
          />
        ))}
      </Box>
    </Drawer>
  );
};

const MobileNavGroupRow = ({
  group: g,
  active,
  isOpen,
  onToggle,
  isNavItemActive,
  problemCount,
  onNavigate,
  t,
}: {
  group: NavGroup;
  active: boolean;
  isOpen: boolean;
  onToggle: () => void;
  isNavItemActive: (href: string) => boolean;
  problemCount: number;
  onNavigate: () => void;
  t: (key: string) => string;
}) => {
  const hasItems = g.items.length > 0;
  return (
    <Box>
      <Box
        component={hasItems ? "button" : Link}
        type={hasItems ? "button" : undefined}
        href={hasItems ? undefined : groupFirstHref(g)}
        onClick={hasItems ? onToggle : onNavigate}
        sx={{
          all: "unset",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          width: "100%",
          px: 2,
          py: 1,
          cursor: "pointer",
          color: active ? "text.primary" : "text.secondary",
        }}
      >
        <Box sx={{ display: "flex", color: active ? "primary.main" : "text.secondary" }}>
          {g.icon}
        </Box>
        <Typography sx={{ flex: 1, fontSize: "0.8125rem", fontWeight: active ? 600 : 400 }}>
          {t(g.labelKey)}
        </Typography>
        {g.id === "monitoring" && problemCount > 0 && (
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: "#F0564F",
              mr: hasItems ? 0.5 : 0,
            }}
          />
        )}
        {hasItems && (
          <ExpandMoreIcon
            sx={{
              fontSize: 18,
              color: "text.disabled",
              transform: isOpen ? "rotate(180deg)" : "none",
              transition: "transform 0.15s ease",
            }}
          />
        )}
      </Box>
      {hasItems && (
        <Collapse in={isOpen} timeout="auto" unmountOnExit>
          {g.items.map((item) => {
            const sel = isNavItemActive(item.href);
            return (
              <Box
                key={item.href}
                component={Link}
                href={item.href}
                onClick={onNavigate}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  pl: 5.5,
                  pr: 2,
                  py: 0.85,
                  textDecoration: "none",
                  fontSize: "0.8rem",
                  fontWeight: sel ? 600 : 400,
                  color: sel ? "text.primary" : "text.secondary",
                }}
              >
                {t(item.labelKey)}
              </Box>
            );
          })}
        </Collapse>
      )}
    </Box>
  );
};

const TopBar = ({
  t,
  onOpenPalette,
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
  onOpenPalette: () => void;
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
      flexShrink: 0,
      bgcolor: "background.paper",
      borderBottom: "1px solid",
      borderColor: "divider",
    }}
  >
    {/* Row 1 — brand · search · status cluster */}
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        height: topBarHeight,
        px: { xs: 1, sm: 2.5 },
        overflow: "hidden",
      }}
    >
      <IconButton
        onClick={onOpenMobileNav}
        size="small"
        sx={{ display: { md: "none" }, color: "text.secondary", flexShrink: 0 }}
      >
        <MenuIcon fontSize="small" />
      </IconButton>

      <Box
        component={Link}
        href="/"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          textDecoration: "none",
          mr: { xs: 1, md: 3 },
          flexShrink: 0,
        }}
      >
        <Box
          component="img"
          src="/Overwatch_sign.png"
          alt=""
          sx={{ width: 24, height: 24, objectFit: "contain" }}
        />
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: "0.8125rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "text.primary",
            display: { xs: "none", sm: "block" },
          }}
        >
          {t("app.name")}
        </Typography>
      </Box>

      {/* Global search — the primary navigation instrument */}
      <Box
        component="button"
        type="button"
        onClick={onOpenPalette}
        aria-label="Search pages"
        sx={{
          flex: { xs: "0 0 auto", sm: 1 },
          maxWidth: 440,
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: { xs: 0.75, sm: 1.25 },
          height: 30,
          cursor: "pointer",
          bgcolor: "action.hover",
          border: "1px solid",
          borderColor: "divider",
          color: "text.disabled",
          "&:hover": { borderColor: "text.secondary", color: "text.secondary" },
        }}
      >
        <SearchIcon sx={{ fontSize: 15 }} />
        <Typography sx={{ fontSize: "0.75rem", flex: 1, textAlign: "left", whiteSpace: "nowrap" }}>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            {t("nav.goTo", { defaultValue: "Search or jump to…" })}
          </Box>
        </Typography>
        <Typography
          sx={{
            fontFamily: monoFontFamily,
            fontSize: "0.6563rem",
            display: { xs: "none", sm: "block" },
          }}
        >
          ⌘K
        </Typography>
      </Box>

      <Box sx={{ flex: 1, display: { xs: "none", sm: "block" } }} />

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
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            {problemCount > 0
              ? `${problemCount} problem${problemCount !== 1 ? "s" : ""}`
              : t("metrics.noProblems")}
          </Box>
        }
        sx={{
          height: 24,
          fontSize: "0.72rem",
          fontWeight: 500,
          flexShrink: 0,
          color: problemCount > 0 ? "#F0564F" : "text.secondary",
          bgcolor: problemCount > 0 ? "rgba(240,86,79,0.12)" : "transparent",
          border: "1px solid",
          borderColor: problemCount > 0 ? "rgba(240,86,79,0.4)" : "divider",
          "& .MuiChip-icon": { color: "inherit" },
          "& .MuiChip-label": { px: { xs: 0.75, sm: 1 } },
        }}
      />

      <HealthIndicator health={health} t={t} />

      <Divider
        orientation="vertical"
        flexItem
        sx={{
          my: 1.25,
          display: { xs: "none", sm: "block" },
          borderColor: "divider",
        }}
      />

      {/* Notification center */}
      <Tooltip title={t("nav.notificationCenter")}>
        <IconButton size="small" onClick={openNotifCenter} sx={{ color: "text.secondary" }}>
          <Badge
            badgeContent={unreadCenterCount || null}
            color="error"
            sx={{
              "& .MuiBadge-badge": { fontSize: "0.5rem", height: 13, minWidth: 13, p: "0 2px" },
            }}
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
  </Box>
);

// ── Notification toast stack ──────────────────────────────────────────

const NotificationStack = ({
  notifications,
  setNotifications,
  dismissNotif,
  snoozeProblem,
}: {
  notifications: Problem[];
  setNotifications: (v: Problem[]) => void;
  dismissNotif: (eventid: string) => void;
  snoozeProblem: (eventid: string, minutes: number) => void;
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
        <NotifCard
          key={p.eventid}
          problem={p}
          onDismiss={() => dismissNotif(p.eventid)}
          onSnooze={(minutes) => {
            snoozeProblem(p.eventid, minutes);
            dismissNotif(p.eventid);
          }}
        />
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

  // Section panel collapse — persists while browsing within one section,
  // resets when the user switches to a different top-level section so it
  // never stays hidden somewhere confusing.
  const navGroups = visibleNavGroups(user?.roles ?? []);
  const activeGroupId = findActiveGroupId(navGroups, pathname, isNavItemActive);
  const hasSectionPanel = (navGroups.find((g) => g.id === activeGroupId)?.items.length ?? 0) > 0;
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const prevActiveGroupId = useRef(activeGroupId);
  useEffect(() => {
    if (prevActiveGroupId.current !== activeGroupId) {
      prevActiveGroupId.current = activeGroupId;
      setPanelCollapsed(false);
    }
  }, [activeGroupId]);

  const { mode, toggle: toggleMode } = useThemeMode();
  const isDark = mode === "dark";
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
    desktopNotifPersistentEnabled,
    customSounds,
    soundMenuAnchor,
    setSoundMenuAnchor,
    customFileInputRef,
    previewingKey,
    showDesktopNotification,
    toggleDesktopNotif,
    toggleDesktopNotifPersistent,
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
    snoozeProblem,
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

  // ⌘K / Ctrl+K opens the command palette.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials = (user?.display_name || user?.username)?.slice(0, 2).toUpperCase() ?? "??";
  const problemCount = activeProblems.filter((p) => !p.acknowledged).length;

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar
        t={t}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenMobileNav={() => setMobileNavOpen(true)}
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

      <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Box sx={{ display: { xs: "none", md: "flex" } }}>
          <ActivityRail
            t={t}
            roles={user?.roles ?? []}
            pathname={pathname}
            isNavItemActive={isNavItemActive}
            problemCount={problemCount}
            panelCollapsed={panelCollapsed}
            onToggleCollapse={() => setPanelCollapsed((v) => !v)}
          />
          {hasSectionPanel && panelCollapsed && (
            <CollapsedPanelHandle onExpand={() => setPanelCollapsed(false)} />
          )}
          {!panelCollapsed && (
            <SectionPanel
              t={t}
              roles={user?.roles ?? []}
              pathname={pathname}
              isNavItemActive={isNavItemActive}
              onCollapse={() => setPanelCollapsed(true)}
            />
          )}
        </Box>

        <Box
          component="main"
          sx={{ flex: 1, minWidth: 0, pt: { xs: 2, sm: 2.5 }, px: { xs: 2, sm: 3 }, pb: 5 }}
        >
          {children}
        </Box>
      </Box>

      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        t={t}
        roles={user?.roles ?? []}
        pathname={pathname}
        isNavItemActive={isNavItemActive}
        problemCount={problemCount}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        roles={user?.roles ?? []}
      />

      <AlertSoundMenu
        anchorEl={soundMenuAnchor}
        onClose={() => setSoundMenuAnchor(null)}
        soundEnabled={soundEnabled}
        toggleSound={toggleSound}
        desktopNotifEnabled={desktopNotifEnabled}
        toggleDesktopNotif={toggleDesktopNotif}
        desktopNotifPersistentEnabled={desktopNotifPersistentEnabled}
        toggleDesktopNotifPersistent={toggleDesktopNotifPersistent}
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
        snoozeProblem={snoozeProblem}
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
