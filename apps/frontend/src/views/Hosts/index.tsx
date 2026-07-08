"use client";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  Menu,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Host, type HostInterface, type HostTag, api } from "../../app/api";
import { hostsApi } from "../../app/api/hosts";
import { ConfirmDelete } from "../../app/components/ConfirmDelete";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { useSync } from "../../app/context/SyncContext";
import { useFavorites } from "../../lib/favorites";
import { AddHostAccordion } from "./AddHostAccordion";
import { BulkImportAccordion } from "./BulkImportAccordion";
import { EditHostDialog } from "./EditHostDialog";
import { HostDetailDrawer } from "./HostDetailDrawer";
import { TagEditorDialog } from "./TagEditorDialog";
import { AvailabilityCell, ProblemsCell } from "./shared";

export const Hosts = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { lastSync } = useSync();
  const tick = useRefreshTick();

  const [hostname, setHostname] = useState("");
  const [ip, setIp] = useState("");
  const [template, setTemplate] = useState("Linux by Zabbix agent");
  const [templates, setTemplates] = useState<Array<{ templateid: string; name: string }>>([]);
  const [proxyid, setProxyid] = useState("");
  const [proxies, setProxies] = useState<Array<{ proxyid: string; name: string }>>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [hostGroups, setHostGroups] = useState<Array<{ groupid: string; name: string }>>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [applyTeamTag, setApplyTeamTag] = useState(true);
  const [bulkApplyTeamTag, setBulkApplyTeamTag] = useState(true);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Host | null>(null);
  const [editHost, setEditHost] = useState<Host | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    ip: "",
    proxyid: "",
    status: "0",
    group_ids: [] as string[],
  });
  const [editSaving, setEditSaving] = useState(false);
  const [tagHost, setTagHost] = useState<Host | null>(null);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  // ── Export menu ─────────────────────────────────────────────────────
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);

  // ── Host detail drawer ──────────────────────────────────────────────
  const [selectedHost, setSelectedHost] = useState<Host | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  type DrawerItem = {
    itemid: string;
    name: string;
    key_: string;
    lastvalue: string;
    lastclock: number | null;
  };
  type DrawerTrigger = {
    triggerid: string;
    description: string;
    priority: number;
    value: number;
    lastchange: number;
    status: number;
  };
  const [drawerItems, setDrawerItems] = useState<DrawerItem[]>([]);
  const [drawerTriggers, setDrawerTriggers] = useState<DrawerTrigger[]>([]);
  const { isFav: isFavItem } = useFavorites("favorite_items");
  const { isFav: isFavTrigger } = useFavorites("favorite_triggers");

  const openDrawer = useCallback(async (host: Host) => {
    setSelectedHost(host);
    setDrawerItems([]);
    setDrawerTriggers([]);
    setDrawerLoading(true);
    try {
      const [itemsRes, triggersRes] = await Promise.all([
        api.listAllItems({ hostname: host.host }),
        api.listAllTriggers({ hostname: host.host }),
      ]);
      setDrawerItems(itemsRes.items);
      setDrawerTriggers(triggersRes.triggers);
    } catch {
      /* non-critical — drawer shows empty state */
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedHost(null);
  }, []);

  const showToast = useCallback((message: string, severity: "success" | "error") => {
    setToast({ open: true, message, severity });
  }, []);

  const reload = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await api.listHosts();
        setHosts(res.hosts);
      } catch (e) {
        showToast(e instanceof Error ? e.message : String(e), "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastSync triggers re-fetch on sync events
  useEffect(() => {
    void reload();
  }, [reload, lastSync]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) void reload(true);
  }, [tick]);

  useEffect(() => {
    api
      .listTemplates()
      .then((r) => setTemplates(r.templates))
      .catch(() => {});
    api
      .listProxies()
      .then((r) => setProxies(r.proxies))
      .catch(() => {});
    api
      .listHostGroups()
      .then((r) => setHostGroups(r.groups))
      .catch(() => {});
  }, []);

  const onCreate = async () => {
    try {
      await api.createHost({
        hostname,
        ip,
        template,
        proxyid: proxyid || undefined,
        group_ids: groupIds.length ? groupIds : undefined,
        apply_team_tag: applyTeamTag,
      });
      showToast("Host added successfully.", "success");
      setHostname("");
      setIp("");
      setProxyid("");
      setGroupIds([]);
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const onDelete = useCallback(
    async (h: Host) => {
      try {
        await api.deleteHost(h.host);
        showToast(`Host '${h.host}' deleted.`, "success");
        setConfirmDelete(null);
        await reload();
      } catch (e) {
        showToast(e instanceof Error ? e.message : String(e), "error");
      }
    },
    [reload, showToast],
  );

  const openEditHost = useCallback((h: Host) => {
    const ip = h.interfaces?.find((i) => i.type === "1")?.ip ?? "";
    setEditForm({
      name: h.name ?? h.host,
      ip,
      proxyid: h.proxyid ?? "",
      status: h.status ?? "0",
      group_ids: (h.groups ?? []).map((g) => g.groupid),
    });
    setEditHost(h);
  }, []);

  const onEditSave = async () => {
    if (!editHost) return;
    setEditSaving(true);
    try {
      const payload: {
        name?: string;
        ip?: string;
        proxyid?: string;
        status?: number;
        group_ids?: string[];
      } = {};
      if (editForm.name !== (editHost.name ?? editHost.host)) payload.name = editForm.name;
      const origIp = editHost.interfaces?.find((i) => i.type === "1")?.ip ?? "";
      if (editForm.ip !== origIp) payload.ip = editForm.ip;
      if (editForm.proxyid !== (editHost.proxyid ?? "")) payload.proxyid = editForm.proxyid;
      if (editForm.status !== editHost.status) payload.status = Number(editForm.status);
      const origGroupIds = (editHost.groups ?? [])
        .map((g) => g.groupid)
        .sort()
        .join(",");
      const newGroupIds = [...editForm.group_ids].sort().join(",");
      if (origGroupIds !== newGroupIds) payload.group_ids = editForm.group_ids;
      await api.updateHost(editHost.host, payload);
      showToast("Host updated.", "success");
      setEditHost(null);
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setEditSaving(false);
    }
  };

  const openTagEditor = useCallback((h: Host) => {
    setTagHost(h);
  }, []);

  // ── Template management dialog ────────────────────────────────────────
  const [tplHost, setTplHost] = useState<Host | null>(null);
  const [hostTemplates, setHostTemplates] = useState<Array<{ templateid: string; name: string }>>(
    [],
  );
  const [tplLoading, setTplLoading] = useState(false);
  const [tplLinkId, setTplLinkId] = useState("");
  const [tplLinking, setTplLinking] = useState(false);

  const openTplDialog = useCallback(async (h: Host) => {
    setTplHost(h);
    setTplLinkId("");
    setTplLoading(true);
    try {
      const r = await hostsApi.getHostTemplates(h.host);
      setHostTemplates(r.templates);
    } catch {
      setHostTemplates([]);
    } finally {
      setTplLoading(false);
    }
  }, []);

  const onLinkTemplate = async () => {
    if (!tplHost || !tplLinkId) return;
    setTplLinking(true);
    try {
      await hostsApi.linkTemplate(tplHost.host, tplLinkId);
      showToast("Template linked.", "success");
      const r = await hostsApi.getHostTemplates(tplHost.host);
      setHostTemplates(r.templates);
      setTplLinkId("");
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setTplLinking(false);
    }
  };

  const onUnlinkTemplate = async (templateid: string) => {
    if (!tplHost) return;
    try {
      await hostsApi.unlinkTemplate(tplHost.host, templateid);
      showToast("Template unlinked.", "success");
      setHostTemplates((prev) => prev.filter((t) => t.templateid !== templateid));
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const onSaveTags = async (tags: HostTag[]) => {
    if (!tagHost) return;
    try {
      await api.updateHostTags(tagHost.host, tags);
      showToast("Tags updated.", "success");
      setTagHost(null);
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const deleteTagInline = useCallback(
    async (host: Host, tagToRemove: HostTag) => {
      const remaining = (host.tags ?? []).filter(
        (t) => t.tag !== "team" && !(t.tag === tagToRemove.tag && t.value === tagToRemove.value),
      );
      const teamTag = (host.tags ?? []).filter((t) => t.tag === "team");
      setHosts((prev) =>
        prev.map((h) => (h.host === host.host ? { ...h, tags: [...teamTag, ...remaining] } : h)),
      );
      try {
        await api.updateHostTags(host.host, remaining);
      } catch (e) {
        showToast(e instanceof Error ? e.message : String(e), "error");
        await reload();
      }
    },
    [showToast, reload],
  );

  const onBulkUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const res = await api.bulkCreateHosts(uploadFile, bulkApplyTeamTag);
      if (res.failed_count > 0) {
        const failLines = (res.failed as { hostname?: string; reason?: string }[])
          .map((f) =>
            f.hostname ? `• ${f.hostname}: ${f.reason ?? "failed"}` : `• ${f.reason ?? "failed"}`,
          )
          .join("\n");
        const summary =
          res.created_count > 0
            ? `${res.created_count} created, ${res.failed_count} failed:\n${failLines}`
            : `All ${res.failed_count} hosts failed:\n${failLines}`;
        showToast(summary, "error");
      } else {
        showToast(`Bulk import: ${res.created_count} hosts created.`, "success");
      }
      setUploadFile(null);
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setUploading(false);
    }
  };

  const pickUploadFile = (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      showToast("Only .csv and .xlsx files are supported.", "error");
      return;
    }
    setUploadFile(file);
  };

  const filteredHosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter((h) => {
      if (h.host.toLowerCase().includes(q)) return true;
      if ((h.name ?? "").toLowerCase().includes(q)) return true;
      return (h.interfaces ?? []).some((i) => i.ip.toLowerCase().includes(q));
    });
  }, [hosts, search]);

  const rows = useMemo(() => filteredHosts.map((h) => ({ id: h.hostid, ...h })), [filteredHosts]);

  const headerSx = useMemo(
    () => ({
      fontSize: "0.7rem",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "0.07em",
      color: isDark ? "#64748B" : "#6B7280",
    }),
    [isDark],
  );

  const columns = useMemo<GridColDef[]>(
    () => [
      {
        field: "host",
        headerName: "Name",
        flex: 1.2,
        minWidth: 180,
        renderHeader: () => <Typography sx={headerSx}>Name</Typography>,
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <RouterOutlinedIcon sx={{ fontSize: 15, color: "text.disabled", flexShrink: 0 }} />
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>{params.value}</Typography>
          </Box>
        ),
      },
      {
        field: "ip",
        headerName: "IP",
        width: 220,
        sortable: false,
        filterable: false,
        renderHeader: () => <Typography sx={headerSx}>IP Address</Typography>,
        renderCell: (params) => {
          const ifaces = params.row.interfaces as HostInterface[] | undefined;
          const iface = ifaces?.find((i) => i.type === "1") ?? ifaces?.[0];
          if (!iface)
            return (
              <Typography variant="caption" color="text.disabled">
                —
              </Typography>
            );
          return (
            <Tooltip title={`${iface.ip}:${iface.port}`} placement="top">
              <Typography
                noWrap
                sx={{ fontSize: "0.8rem", fontFamily: "monospace", color: "text.secondary" }}
              >
                {iface.ip}
                <Typography
                  component="span"
                  sx={{ opacity: 0.5, fontSize: "inherit", fontFamily: "inherit" }}
                >
                  :{iface.port}
                </Typography>
              </Typography>
            </Tooltip>
          );
        },
      },
      {
        field: "proxyid",
        headerName: "Proxy",
        width: 140,
        sortable: false,
        filterable: false,
        renderHeader: () => <Typography sx={headerSx}>Proxy</Typography>,
        renderCell: (params) => {
          const pid = params.value as string | undefined;
          if (!pid || pid === "0")
            return (
              <Typography variant="caption" color="text.disabled">
                Direct
              </Typography>
            );
          const proxy = proxies.find((p) => p.proxyid === pid);
          return (
            <Chip
              label={proxy?.name ?? pid}
              size="small"
              variant="outlined"
              sx={{ height: 18, fontSize: "0.65rem" }}
            />
          );
        },
      },
      {
        field: "parentTemplates",
        headerName: "Templates",
        flex: 1,
        minWidth: 160,
        sortable: false,
        filterable: false,
        renderHeader: () => <Typography sx={headerSx}>Templates</Typography>,
        renderCell: (params) => {
          const tmpls =
            (params.value as Array<{ templateid: string; name: string }> | undefined) ?? [];
          if (tmpls.length === 0)
            return (
              <Typography variant="caption" color="text.disabled">
                —
              </Typography>
            );
          return (
            <Tooltip title={tmpls.map((t) => t.name).join(", ")} placement="top">
              <Box sx={{ display: "flex", gap: 0.4, overflow: "hidden", flexWrap: "nowrap" }}>
                {tmpls.slice(0, 2).map((t) => (
                  <Chip
                    key={t.templateid}
                    label={t.name}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: "0.62rem", height: 20, maxWidth: 140 }}
                  />
                ))}
                {tmpls.length > 2 && (
                  <Chip
                    label={`+${tmpls.length - 2}`}
                    size="small"
                    sx={{ fontSize: "0.62rem", height: 20 }}
                  />
                )}
              </Box>
            </Tooltip>
          );
        },
      },
      {
        field: "availability",
        headerName: "Availability",
        width: 140,
        sortable: false,
        filterable: false,
        renderHeader: () => <Typography sx={headerSx}>Availability</Typography>,
        renderCell: (params) => (
          <AvailabilityCell interfaces={params.row.interfaces as HostInterface[]} />
        ),
      },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        renderHeader: () => <Typography sx={headerSx}>Status</Typography>,
        renderCell: (params) => (
          <Chip
            size="small"
            label={params.value === "0" ? "Enabled" : "Disabled"}
            sx={{
              fontSize: "0.7rem",
              height: 20,
              fontWeight: 600,
              bgcolor:
                params.value === "0"
                  ? isDark
                    ? "rgba(22,163,74,0.18)"
                    : "rgba(22,163,74,0.12)"
                  : "action.hover",
              color: params.value === "0" ? "#16a34a" : "text.disabled",
              border: "none",
            }}
          />
        ),
      },
      {
        field: "tags",
        headerName: "Tags",
        flex: 1.4,
        minWidth: 140,
        sortable: false,
        filterable: false,
        renderHeader: () => <Typography sx={headerSx}>Tags</Typography>,
        renderCell: (params) => {
          const tags = (params.value as HostTag[] | undefined) ?? [];
          const rowHost = params.row as Host;
          if (tags.length === 0)
            return (
              <Typography variant="caption" color="text.disabled">
                —
              </Typography>
            );
          return (
            <Box sx={{ display: "flex", flexWrap: "nowrap", gap: 0.4, overflow: "hidden" }}>
              {tags.slice(0, 3).map((t) => (
                <Chip
                  key={`${t.tag}:${t.value}`}
                  label={t.value ? `${t.tag}: ${t.value}` : t.tag}
                  size="small"
                  onDelete={
                    t.tag !== "team"
                      ? () => {
                          void deleteTagInline(rowHost, t);
                        }
                      : undefined
                  }
                  sx={{
                    fontSize: "0.62rem",
                    height: 20,
                    bgcolor: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)",
                    color: isDark ? "#93C5FD" : "#2563EB",
                    border: "none",
                    flexShrink: 0,
                    "& .MuiChip-deleteIcon": {
                      fontSize: "0.7rem",
                      color: isDark ? "#93C5FD" : "#2563EB",
                      opacity: 0.6,
                      "&:hover": { opacity: 1 },
                    },
                  }}
                />
              ))}
              {tags.length > 3 && (
                <Tooltip
                  title={tags
                    .slice(3)
                    .map((t) => `${t.tag}: ${t.value}`)
                    .join(", ")}
                >
                  <Typography variant="caption" color="text.disabled" sx={{ alignSelf: "center" }}>
                    +{tags.length - 3}
                  </Typography>
                </Tooltip>
              )}
            </Box>
          );
        },
      },
      {
        field: "problem_count",
        headerName: "Problems",
        width: 130,
        renderHeader: () => <Typography sx={headerSx}>Problems</Typography>,
        renderCell: (params) => <ProblemsCell count={params.value as number} />,
      },
      {
        field: "actions",
        headerName: "",
        width: 145,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Box sx={{ display: "flex", gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
            <Tooltip title="Edit host" placement="left">
              <IconButton
                size="small"
                onClick={() => openEditHost(params.row as Host)}
                sx={{ color: "text.disabled", "&:hover": { color: "primary.main" } }}
              >
                <EditOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit tags" placement="left">
              <IconButton
                size="small"
                onClick={() => openTagEditor(params.row as Host)}
                sx={{ color: "text.disabled", "&:hover": { color: "primary.main" } }}
              >
                <LocalOfferOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Manage templates" placement="left">
              <IconButton
                size="small"
                onClick={() => void openTplDialog(params.row as Host)}
                sx={{ color: "text.disabled", "&:hover": { color: "primary.main" } }}
              >
                <LayersOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete host" placement="left">
              <IconButton
                size="small"
                onClick={() => setConfirmDelete(params.row as Host)}
                sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}
              >
                <DeleteOutlineOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [headerSx, isDark, deleteTagInline, proxies, openEditHost, openTagEditor, openTplDialog],
  );

  const totalProblems = hosts.reduce((sum, h) => sum + (h.problem_count ?? 0), 0);

  return (
    <Stack spacing={3}>
      {/* ── Header ── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t("hosts.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Manage hosts, interfaces, and monitor availability
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadOutlinedIcon />}
          endIcon={<ArrowDropDownIcon />}
          onClick={(e) => setExportAnchor(e.currentTarget)}
          sx={{ flexShrink: 0 }}
        >
          Export
        </Button>
        <Menu
          anchorEl={exportAnchor}
          open={Boolean(exportAnchor)}
          onClose={() => setExportAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem
            dense
            onClick={() => {
              window.location.href = "/api/hosts/download?format=xlsx";
              setExportAnchor(null);
            }}
          >
            <DownloadOutlinedIcon sx={{ fontSize: 16, mr: 1, color: "text.secondary" }} />
            Excel (.xlsx)
          </MenuItem>
          <MenuItem
            dense
            onClick={() => {
              window.location.href = "/api/hosts/download?format=csv";
              setExportAnchor(null);
            }}
          >
            <DownloadOutlinedIcon sx={{ fontSize: 16, mr: 1, color: "text.secondary" }} />
            CSV (.csv)
          </MenuItem>
        </Menu>
      </Box>

      {/* ── Stats strip ── */}
      <Box sx={{ display: "flex", gap: 2 }}>
        {[
          { label: "Total hosts", value: hosts.length },
          {
            label: "Available",
            value: hosts.filter((h) => h.interfaces?.some((i) => i.available === "1")).length,
            color: "#16a34a",
          },
          {
            label: "Unavailable",
            value: hosts.filter((h) => h.interfaces?.some((i) => i.available === "2")).length,
            color: "#dc2626",
          },
          {
            label: "Active problems",
            value: totalProblems,
            color: totalProblems > 0 ? "#ea580c" : undefined,
          },
        ].map((s) => (
          <Box
            key={s.label}
            sx={{
              flex: 1,
              p: 1.5,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.68rem",
                color: "text.disabled",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {s.label}
            </Typography>
            <Typography
              sx={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: s.color ?? "text.primary",
                lineHeight: 1.3,
              }}
            >
              {loading ? "—" : s.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Inventory table ── */}
      <Card sx={{ overflow: "hidden" }}>
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
            Host inventory
          </Typography>
          <TextField
            size="small"
            placeholder="Search by name or IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                </InputAdornment>
              ),
            }}
          />
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => void reload()}>
              <RefreshIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Box>
        {loading && <LinearProgress sx={{ height: 2 }} />}
        <Box sx={{ height: 560 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={false}
            rowHeight={58}
            columnHeaderHeight={46}
            disableRowSelectionOnClick={false}
            onRowClick={(params) => {
              void openDrawer(params.row as Host);
            }}
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
            sx={{
              border: "none",
              "& .MuiDataGrid-columnHeaders": {
                bgcolor: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)",
                borderBottom: "1px solid",
                borderColor: "divider",
              },
              "& .MuiDataGrid-columnHeader": {
                px: 2.5,
              },
              "& .MuiDataGrid-cell": {
                px: 2.5,
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)",
                display: "flex",
                alignItems: "center",
              },
              "& .MuiDataGrid-row": {
                cursor: "pointer",
              },
              "& .MuiDataGrid-row:hover": {
                bgcolor: isDark ? "rgba(59,130,246,0.05)" : "rgba(59,130,246,0.03)",
              },
              "& .MuiDataGrid-row.Mui-selected": {
                bgcolor: isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.06)",
              },
              "& .MuiDataGrid-footerContainer": {
                borderTop: "1px solid",
                borderColor: "divider",
                minHeight: 48,
              },
              "& .MuiDataGrid-overlay": { bgcolor: "transparent" },
            }}
          />
        </Box>
      </Card>

      {/* ── Management accordions ── */}
      <AddHostAccordion
        hostname={hostname}
        setHostname={setHostname}
        ip={ip}
        setIp={setIp}
        template={template}
        setTemplate={setTemplate}
        templates={templates}
        proxyid={proxyid}
        setProxyid={setProxyid}
        proxies={proxies}
        groupIds={groupIds}
        setGroupIds={setGroupIds}
        hostGroups={hostGroups}
        applyTeamTag={applyTeamTag}
        setApplyTeamTag={setApplyTeamTag}
        onCreate={onCreate}
      />

      <BulkImportAccordion
        uploadFile={uploadFile}
        uploading={uploading}
        dragActive={dragActive}
        setDragActive={setDragActive}
        pickUploadFile={pickUploadFile}
        applyTeamTag={bulkApplyTeamTag}
        setApplyTeamTag={setBulkApplyTeamTag}
        onBulkUpload={onBulkUpload}
      />

      <TagEditorDialog
        tagHost={tagHost}
        onClose={() => setTagHost(null)}
        isDark={isDark}
        onSave={onSaveTags}
      />

      <EditHostDialog
        editHost={editHost}
        onClose={() => setEditHost(null)}
        editForm={editForm}
        setEditForm={setEditForm}
        proxies={proxies}
        hostGroups={hostGroups}
        editSaving={editSaving}
        onSave={onEditSave}
      />

      <ConfirmDelete
        open={!!confirmDelete}
        name={confirmDelete?.host ?? ""}
        onConfirm={() => confirmDelete && onDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />

      {/* ── Manage Templates dialog ── */}
      <Dialog open={!!tplHost} onClose={() => setTplHost(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Manage Templates — {tplHost?.host}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {tplLoading && <CircularProgress size={20} />}
            {!tplLoading && hostTemplates.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No templates linked to this host.
              </Typography>
            )}
            {hostTemplates.map((t) => (
              <Box
                key={t.templateid}
                sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <Typography variant="body2">{t.name}</Typography>
                <Tooltip title="Unlink template (removes inherited items)">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => void onUnlinkTemplate(t.templateid)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}

            <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                Link a new template
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Template</InputLabel>
                  <Select
                    label="Template"
                    value={tplLinkId}
                    onChange={(e) => setTplLinkId(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>Select…</em>
                    </MenuItem>
                    {templates
                      .filter((t) => !hostTemplates.some((ht) => ht.templateid === t.templateid))
                      .map((t) => (
                        <MenuItem key={t.templateid} value={t.templateid}>
                          {t.name}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={tplLinking ? <CircularProgress size={12} /> : <AddIcon />}
                  disabled={!tplLinkId || tplLinking}
                  onClick={() => void onLinkTemplate()}
                >
                  Link
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTplHost(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <HostDetailDrawer
        selectedHost={selectedHost}
        onClose={closeDrawer}
        isDark={isDark}
        drawerLoading={drawerLoading}
        drawerItems={drawerItems}
        drawerTriggers={drawerTriggers}
        isFavItem={isFavItem}
        isFavTrigger={isFavTrigger}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};
