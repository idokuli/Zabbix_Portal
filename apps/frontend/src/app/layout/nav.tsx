import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import ComputerOutlinedIcon from "@mui/icons-material/ComputerOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/Security";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import type { ReactNode } from "react";

export type NavItem = { href: string; labelKey: string; icon: ReactNode; adminOnly?: boolean };
export type NavGroup = {
  id: string;
  labelKey: string;
  icon: ReactNode;
  items: NavItem[];
  adminOnly?: boolean;
  href?: string;
  sectionLabelKey?: string;
};

export const navGroups: NavGroup[] = [
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

// Groups visible for the given roles (admin-only groups need root/team_lead).
export const visibleNavGroups = (roles: string[]): NavGroup[] =>
  navGroups.filter((g) => !g.adminOnly || roles.includes("root") || roles.includes("team_lead"));
