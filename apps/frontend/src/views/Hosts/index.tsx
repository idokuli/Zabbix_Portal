"use client";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
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
  InputLabel,
  LinearProgress,
  Menu,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Host, type HostInterface, type HostTag } from "../../app/api";
import { hostsApi } from "../../app/api/hosts";
import { ConfirmDelete } from "../../app/components/ConfirmDelete";
import { StatTicker } from "../../app/components/StatTicker";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { useSync } from "../../app/context/SyncContext";
import { monoFontFamily } from "../../app/theme";
import { FilterSearchField, filterLabelSx } from "../../components/FilterBar";
import { useFavorites } from "../../lib/favorites";
import { AddHostAccordion } from "./AddHostAccordion";
import { BulkImportAccordion } from "./BulkImportAccordion";
import { EditHostDialog } from "./EditHostDialog";
import { HostDetailDrawer } from "./HostDetailDrawer";
import { AVAIL_CONFIG, AvailabilityCell, ProblemsCell } from "./shared";
import { TagEditorDialog } from "./TagEditorDialog";

// Metadata chip language (proxy, tags) — outlined and neutral, visually
// distinct from the solid state badges (Availability, Status) above.
const METADATA_CHIP_SX = {
  height: 20,
  fontSize: "0.68rem",
  fontWeight: 500,
  borderColor: "#8C939E",
  color: "text.primary",
} as const;

type HostEditForm = {
  name: string;
  ip: string;
  proxyid: string;
  status: string;
  group_ids: string[];
};

type HostUpdatePayload = {
  name?: string;
  ip?: string;
  proxyid?: string;
  status?: number;
  group_ids?: string[];
};

const buildHostUpdatePayload = (editForm: HostEditForm, editHost: Host): HostUpdatePayload => {
  const payload: HostUpdatePayload = {};
  if (editForm.name !== (editHost.name ?? editHost.host)) {
    payload.name = editForm.name;
  }
  const origIp = editHost.interfaces?.find((i) => i.type === "1")?.ip ?? "";
  if (editForm.ip !== origIp) {
    payload.ip = editForm.ip;
  }
  if (editForm.proxyid !== (editHost.proxyid ?? "")) {
    payload.proxyid = editForm.proxyid;
  }
  if (editForm.status !== editHost.status) {
    payload.status = Number(editForm.status);
  }
  const origGroupIds = (editHost.groups ?? [])
    .map((g) => g.groupid)
    .sort()
    .join(",");
  const newGroupIds = [...editForm.group_ids].sort().join(",");
  if (origGroupIds !== newGroupIds) {
    payload.group_ids = editForm.group_ids;
  }
  return payload;
};

const HostTagsCell = ({
  tags,
  rowHost,
  deleteTagInline,
}: {
  tags: HostTag[];
  rowHost: Host;
  deleteTagInline: (host: Host, tag: HostTag) => void;
}) => {
  if (tags.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", flexWrap: "nowrap", gap: 0.4, overflow: "hidden" }}>
      {tags.slice(0, 3).map((t) => (
        <Chip
          key={`${t.tag}:${t.value}`}
          label={t.value ? `${t.tag}: ${t.value}` : t.tag}
          size="small"
          variant="outlined"
          onDelete={t.tag !== "team" ? () => deleteTagInline(rowHost, t) : undefined}
          sx={{
            ...METADATA_CHIP_SX,
            flexShrink: 0,
            "& .MuiChip-deleteIcon": {
              fontSize: "0.7rem",
              color: "text.secondary",
              opacity: 0.7,
              "&:hover": { color: "error.main", opacity: 1 },
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
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
            +{tags.length - 3}
          </Typography>
        </Tooltip>
      )}
    </Box>
  );
};

// Row actions consolidate into a single kebab, dimmed until the row is
// hovered or the menu is open — keeps the ledger quiet at rest.
const HostRowActionsMenu = ({
  onEdit,
  onEditTags,
  onManageTemplates,
  onDelete,
}: {
  onEdit: () => void;
  onEditTags: () => void;
  onManageTemplates: () => void;
  onDelete: () => void;
}) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          setAnchor(e.currentTarget);
        }}
        sx={{
          opacity: anchor ? 1 : 0,
          transition: "opacity 0.1s ease",
          ".MuiDataGrid-row:hover &, &:focus-visible": { opacity: 1 },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onEdit();
          }}
          sx={{ fontSize: "0.8125rem", gap: 1.25 }}
        >
          <EditOutlinedIcon sx={{ fontSize: 16 }} />
          Edit host
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onEditTags();
          }}
          sx={{ fontSize: "0.8125rem", gap: 1.25 }}
        >
          <LocalOfferOutlinedIcon sx={{ fontSize: 16 }} />
          Edit tags
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onManageTemplates();
          }}
          sx={{ fontSize: "0.8125rem", gap: 1.25 }}
        >
          <LayersOutlinedIcon sx={{ fontSize: 16 }} />
          Manage templates
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onDelete();
          }}
          sx={{ fontSize: "0.8125rem", gap: 1.25, color: "error.main" }}
        >
          <DeleteOutlineOutlinedIcon sx={{ fontSize: 16 }} />
          Delete host
        </MenuItem>
      </Menu>
    </>
  );
};

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
  const [groupFilter, setGroupFilter] = useState("");
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
      if (!silent) {
        setLoading(true);
      }
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

  useEffect(() => {
    void reload(lastSync > 0);
  }, [reload, lastSync]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      void reload(true);
    }
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
      .listHostGroups({ mine: true })
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
        group_ids: groupIds.length > 0 ? groupIds : undefined,
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
    if (!editHost) {
      return;
    }
    setEditSaving(true);
    try {
      const payload = buildHostUpdatePayload(editForm, editHost);
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
    if (!(tplHost && tplLinkId)) {
      return;
    }
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
    if (!tplHost) {
      return;
    }
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
    if (!tagHost) {
      return;
    }
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
    if (!uploadFile) {
      return;
    }
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
    if (!file) {
      return;
    }
    const name = file.name.toLowerCase();
    if (!(name.endsWith(".csv") || name.endsWith(".xlsx"))) {
      showToast("Only .csv and .xlsx files are supported.", "error");
      return;
    }
    setUploadFile(file);
  };

  const filteredHosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hosts.filter((h) => {
      if (groupFilter && !(h.groups ?? []).some((g) => g.groupid === groupFilter)) {
        return false;
      }
      if (!q) {
        return true;
      }
      if (h.host.toLowerCase().includes(q)) {
        return true;
      }
      if ((h.name ?? "").toLowerCase().includes(q)) {
        return true;
      }
      return (h.interfaces ?? []).some((i) => i.ip.toLowerCase().includes(q));
    });
  }, [hosts, search, groupFilter]);

  const totalProblems = hosts.reduce((sum, h) => sum + (h.problem_count ?? 0), 0);

  const rows = useMemo(() => filteredHosts.map((h) => ({ id: h.hostid, ...h })), [filteredHosts]);

  const headerSx = useMemo(
    () => ({
      fontSize: "0.6875rem",
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
      color: "text.secondary",
    }),
    [],
  );

  // Clean labeled columns with native click-to-sort headers (asc → desc →
  // unsorted) — a dedicated Sort control can't be cleared; a column header
  // click cycle can. Actions live in a single hover-revealed kebab, moved to
  // the leading column instead of a persistent icon cluster on the right.
  const columns = useMemo<GridColDef[]>(
    () => [
      {
        field: "actions",
        headerName: "",
        width: 40,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Box onClick={(e) => e.stopPropagation()}>
            <HostRowActionsMenu
              onEdit={() => openEditHost(params.row as Host)}
              onEditTags={() => openTagEditor(params.row as Host)}
              onManageTemplates={() => void openTplDialog(params.row as Host)}
              onDelete={() => setConfirmDelete(params.row as Host)}
            />
          </Box>
        ),
      },
      {
        field: "host",
        headerName: "Name",
        flex: 1.2,
        minWidth: 180,
        renderHeader: () => <Typography sx={headerSx}>Name</Typography>,
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <RouterOutlinedIcon sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }} />
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700 }}>{params.value}</Typography>
          </Box>
        ),
      },
      {
        field: "ip",
        headerName: "IP",
        width: 220,
        filterable: false,
        // v7+ signature: (value, row, column, apiRef) — the old single `params` object is gone.
        valueGetter: (_value, row: Host) => {
          const ifaces = row.interfaces as HostInterface[] | undefined;
          const iface = ifaces?.find((i) => i.type === "1") ?? ifaces?.[0];
          return iface?.ip ?? "";
        },
        renderHeader: () => <Typography sx={headerSx}>IP Address</Typography>,
        renderCell: (params) => {
          const ifaces = params.row.interfaces as HostInterface[] | undefined;
          const iface = ifaces?.find((i) => i.type === "1") ?? ifaces?.[0];
          if (!iface) {
            return (
              <Typography variant="caption" color="text.secondary">
                —
              </Typography>
            );
          }
          return (
            <Tooltip title={`${iface.ip}:${iface.port}`} placement="top">
              <Typography
                noWrap
                sx={{ fontSize: "0.8rem", fontFamily: monoFontFamily, color: "text.primary" }}
              >
                {iface.ip}
                <Typography
                  component="span"
                  sx={{ opacity: 0.6, fontSize: "inherit", fontFamily: "inherit" }}
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
        filterable: false,
        valueGetter: (value) => {
          const pid = value as string | undefined;
          if (!pid || pid === "0") {
            return "";
          }
          return proxies.find((p) => p.proxyid === pid)?.name ?? pid;
        },
        renderHeader: () => <Typography sx={headerSx}>Proxy</Typography>,
        renderCell: (params) => {
          const name = params.value as string;
          if (!name) {
            return (
              <Typography variant="caption" color="text.secondary">
                Direct
              </Typography>
            );
          }
          return <Chip label={name} size="small" variant="outlined" sx={METADATA_CHIP_SX} />;
        },
      },
      {
        field: "availability",
        headerName: "Availability",
        width: 140,
        filterable: false,
        valueGetter: (_value, row: Host) => {
          const ifaces = row.interfaces as HostInterface[] | undefined;
          const iface = ifaces?.find((i) => i.type === "1") ?? ifaces?.[0];
          return AVAIL_CONFIG[iface?.available ?? "0"]?.label ?? "Unknown";
        },
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
        renderCell: (params) => {
          const on = params.value === "0";
          return (
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                px: 1,
                py: 0.3,
                border: "1px solid",
                borderColor: on ? "#2EA043" : "#6E7681",
                bgcolor: on ? "#1A7F37" : "#3A414D",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  color: on ? "#fff" : "#E2E4E8",
                  letterSpacing: "0.06em",
                }}
              >
                {on ? "Enabled" : "Disabled"}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: "tags",
        headerName: "Tags",
        flex: 1.4,
        minWidth: 140,
        filterable: false,
        valueGetter: (value) =>
          ((value as HostTag[] | undefined) ?? [])
            .map((t) => (t.value ? `${t.tag}:${t.value}` : t.tag))
            .join(", "),
        renderCell: (params) => (
          <HostTagsCell
            tags={(params.row.tags as HostTag[] | undefined) ?? []}
            rowHost={params.row as Host}
            deleteTagInline={(host, tag) => {
              void deleteTagInline(host, tag);
            }}
          />
        ),
        renderHeader: () => <Typography sx={headerSx}>Tags</Typography>,
      },
      {
        field: "problem_count",
        headerName: "Problems",
        width: 130,
        renderHeader: () => <Typography sx={headerSx}>Problems</Typography>,
        renderCell: (params) => <ProblemsCell count={params.value as number} />,
      },
    ],
    [headerSx, deleteTagInline, proxies, openEditHost, openTagEditor, openTplDialog],
  );

  return (
    <Stack spacing={2}>
      {/* ── Header ── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="subtitle1">{t("hosts.title")}</Typography>
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

      {/* ── Stats ticker ── */}
      <StatTicker
        stats={[
          { label: "Total hosts", value: loading ? "–" : hosts.length },
          {
            label: "Available",
            value: loading
              ? "–"
              : hosts.filter((h) => h.interfaces?.some((i) => i.available === "1")).length,
          },
          {
            label: "Unavailable",
            value: loading
              ? "–"
              : hosts.filter((h) => h.interfaces?.some((i) => i.available === "2")).length,
            tone: "error.main",
          },
          {
            label: "Active problems",
            value: loading ? "–" : totalProblems,
            tone: !loading && totalProblems > 0 ? "warning.main" : undefined,
          },
        ]}
        sx={{ mb: 2 }}
      />

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
          <FilterSearchField
            placeholder="Search by name or IP…"
            value={search}
            onChange={setSearch}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel sx={filterLabelSx}>Host group</InputLabel>
            <Select
              label="Host group"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              sx={filterLabelSx}
            >
              <MenuItem value="" sx={filterLabelSx}>
                All groups
              </MenuItem>
              {hostGroups.map((g) => (
                <MenuItem key={g.groupid} value={g.groupid} sx={filterLabelSx}>
                  {g.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => void reload()}>
              <RefreshIcon sx={{ fontSize: 18 }} />
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
                bgcolor: "action.hover",
                borderBottom: "1px solid",
                borderColor: "divider",
              },
              "& .MuiDataGrid-columnHeader": {
                px: 2.5,
              },
              "& .MuiDataGrid-cell": {
                px: 2.5,
                borderBottom: "1px solid",
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
              },
              "& .MuiDataGrid-row": {
                cursor: "pointer",
              },
              // Subtle zebra — a structural cue against "flat", not a loud stripe.
              "& .MuiDataGrid-row:nth-of-type(even)": {
                bgcolor: "action.hover",
              },
              "& .MuiDataGrid-row:hover": {
                bgcolor: "action.selected",
              },
              "& .MuiDataGrid-row.Mui-selected": {
                bgcolor: "action.selected",
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

      <TagEditorDialog tagHost={tagHost} onClose={() => setTagHost(null)} onSave={onSaveTags} />

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
              <Stack sx={{ alignItems: "center" }} direction="row" spacing={1}>
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
