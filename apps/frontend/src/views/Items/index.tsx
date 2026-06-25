"use client";
import ClearIcon from "@mui/icons-material/Clear";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import HttpIcon from "@mui/icons-material/Http";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import NetworkCheckIcon from "@mui/icons-material/NetworkCheck";
import PlaylistAddOutlinedIcon from "@mui/icons-material/PlaylistAddOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import RouterIcon from "@mui/icons-material/Router";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TerminalIcon from "@mui/icons-material/Terminal";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { type Host, api } from "../../app/api";
import { SearchableSelect } from "../../components/SearchableSelect";
import { useFavorites } from "../../lib/favorites";
import { AgentItemPanel } from "./panels/AgentItemPanel";
import { DatabasePanel } from "./panels/DatabasePanel";
import {
  BrowserItemPanel,
  CalculatedItemPanel,
  DependentItemPanel,
  ExternalItemPanel,
  InternalItemPanel,
  IpmiItemPanel,
  JmxItemPanel,
  SshItemPanel,
  TelnetItemPanel,
  TrapperItemPanel,
  ZabbixScriptItemPanel,
} from "./panels/GenericItemPanels";
import { HttpItemPanel } from "./panels/HttpItemPanel";
import { ScriptPanel } from "./panels/ScriptPanel";
import { FileWatchPanel, ServicePanel } from "./panels/ServiceFilePanel";
import { SnmpPanel, SnmpTrapPanel } from "./panels/SnmpPanel";
import type { PanelProps } from "./panels/shared";
import { type AllItem, type ServerItemKey, isItemStale, timeAgo, valueTypes } from "./shared";

type ItemType =
  | "agent"
  | "http"
  | "service"
  | "script"
  | "filewatch"
  | "database"
  | "snmp"
  | "snmptrap"
  | "internal"
  | "trapper"
  | "external"
  | "ipmi"
  | "ssh"
  | "telnet"
  | "jmx"
  | "calculated"
  | "dependent"
  | "scriptitem"
  | "browser";

const ITEM_TYPE_META: {
  value: ItemType;
  label: string;
  icon: React.ReactNode;
  alert?: React.ReactNode;
}[] = [
  { value: "agent", label: "Zabbix Agent", icon: <RouterIcon sx={{ fontSize: 18 }} /> },
  {
    value: "http",
    label: "HTTP Agent",
    icon: <HttpIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<HttpIcon fontSize="small" />} sx={{ py: 0.5 }}>
        The <strong>Zabbix server</strong> makes the HTTP request. The host does not need a Zabbix
        agent.
      </Alert>
    ),
  },
  {
    value: "service",
    label: "Service Check",
    icon: <NetworkCheckIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<NetworkCheckIcon fontSize="small" />} sx={{ py: 0.5 }}>
        The Zabbix server tests reachability (ICMP / TCP). The host needs an{" "}
        <strong>agent interface</strong> but not necessarily a running agent.
      </Alert>
    ),
  },
  {
    value: "script",
    label: "Script Check",
    icon: <TerminalIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="warning" icon={<TerminalIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Runs a command via the Zabbix agent (<code>system.run</code>). Requires{" "}
        <strong>EnableRemoteCommands=1</strong> in the agent config.
      </Alert>
    ),
  },
  {
    value: "filewatch",
    label: "File Watch",
    icon: <FolderOpenIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<FolderOpenIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Monitors a file using standard agent keys — no remote commands needed. Optionally
        auto-creates a trigger.
      </Alert>
    ),
  },
  {
    value: "database",
    label: "Database Monitor",
    icon: <StorageOutlinedIcon sx={{ fontSize: 18 }} />,
  },
  {
    value: "snmp",
    label: "SNMP Agent",
    icon: <RouterIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<RouterIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Polls the host via <strong>SNMP</strong>. The host must have an SNMP interface configured in
        Zabbix.
      </Alert>
    ),
  },
  {
    value: "snmptrap",
    label: "SNMP Trap",
    icon: <RouterIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<RouterIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Receives <strong>SNMP traps</strong> sent to the Zabbix server. The server must have its
        SNMP trap receiver configured.
      </Alert>
    ),
  },
  {
    value: "internal",
    label: "Zabbix Internal",
    icon: <RouterIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<RouterIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Monitors the <strong>Zabbix server/proxy itself</strong>. No agent or host interface needed.
      </Alert>
    ),
  },
  {
    value: "trapper",
    label: "Zabbix Trapper",
    icon: <RouterIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<RouterIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Accepts values <strong>pushed by zabbix_sender</strong>. The host sends data on its own
        schedule.
      </Alert>
    ),
  },
  {
    value: "external",
    label: "External Check",
    icon: <RouterIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="warning" icon={<RouterIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Runs an <strong>external script</strong> on the Zabbix server (in{" "}
        <code>ExternalScripts</code> dir).
      </Alert>
    ),
  },
  {
    value: "ipmi",
    label: "IPMI Agent",
    icon: <RouterIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<RouterIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Polls hardware sensors via <strong>IPMI/BMC</strong>. The host must have an IPMI interface
        configured.
      </Alert>
    ),
  },
  {
    value: "ssh",
    label: "SSH Agent",
    icon: <TerminalIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="warning" icon={<TerminalIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Connects via <strong>SSH</strong> and runs a shell command. Credentials are stored in the
        item config.
      </Alert>
    ),
  },
  {
    value: "telnet",
    label: "Telnet Agent",
    icon: <TerminalIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="warning" icon={<TerminalIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Connects via <strong>Telnet</strong> and runs a command. Not recommended — no encryption.
        Use SSH when possible.
      </Alert>
    ),
  },
  {
    value: "jmx",
    label: "JMX Agent",
    icon: <RouterIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<RouterIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Polls a Java application via <strong>JMX</strong>. Requires the Zabbix Java Gateway and a
        JMX interface on the host.
      </Alert>
    ),
  },
  {
    value: "calculated",
    label: "Calculated",
    icon: <RouterIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<RouterIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Computes a value from other Zabbix items using a <strong>mathematical formula</strong>.
      </Alert>
    ),
  },
  {
    value: "dependent",
    label: "Dependent Item",
    icon: <RouterIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<RouterIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Derives its value from a <strong>master item</strong> via preprocessing.
      </Alert>
    ),
  },
  {
    value: "scriptitem",
    label: "Zabbix Script (JS)",
    icon: <TerminalIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<TerminalIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Executes a <strong>JavaScript snippet</strong> inside Zabbix (Duktape engine).
      </Alert>
    ),
  },
  {
    value: "browser",
    label: "Browser (JS)",
    icon: <HttpIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<HttpIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Runs a <strong>browser automation script</strong> (JS / WebDriver BiDi). Requires Zabbix
        7.0+ with a browser monitoring proxy.
      </Alert>
    ),
  },
];

const ItemPanel = ({
  itemType,
  panelProps,
  serverItemKeys,
  itemKeysLoading,
}: {
  itemType: ItemType;
  panelProps: PanelProps;
  serverItemKeys: ServerItemKey[];
  itemKeysLoading: boolean;
}) => {
  switch (itemType) {
    case "agent":
      return (
        <AgentItemPanel
          {...panelProps}
          serverItemKeys={serverItemKeys}
          itemKeysLoading={itemKeysLoading}
        />
      );
    case "http":
      return <HttpItemPanel {...panelProps} />;
    case "service":
      return <ServicePanel {...panelProps} />;
    case "filewatch":
      return <FileWatchPanel {...panelProps} />;
    case "script":
      return <ScriptPanel {...panelProps} />;
    case "database":
      return <DatabasePanel {...panelProps} />;
    case "snmp":
      return <SnmpPanel {...panelProps} />;
    case "snmptrap":
      return <SnmpTrapPanel {...panelProps} />;
    case "internal":
      return <InternalItemPanel {...panelProps} />;
    case "trapper":
      return <TrapperItemPanel {...panelProps} />;
    case "external":
      return <ExternalItemPanel {...panelProps} />;
    case "ipmi":
      return <IpmiItemPanel {...panelProps} />;
    case "ssh":
      return <SshItemPanel {...panelProps} />;
    case "telnet":
      return <TelnetItemPanel {...panelProps} />;
    case "jmx":
      return <JmxItemPanel {...panelProps} />;
    case "calculated":
      return <CalculatedItemPanel {...panelProps} />;
    case "dependent":
      return <DependentItemPanel {...panelProps} />;
    case "scriptitem":
      return <ZabbixScriptItemPanel {...panelProps} />;
    case "browser":
      return <BrowserItemPanel {...panelProps} />;
  }
};

export const Items = () => {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostsLoading, setHostsLoading] = useState(true);
  const [serverItemKeys, setServerItemKeys] = useState<ServerItemKey[]>([]);
  const [itemKeysLoading, setItemKeysLoading] = useState(true);

  useEffect(() => {
    api
      .listHosts()
      .then((r) => setHosts(r.hosts))
      .catch(() => {})
      .finally(() => setHostsLoading(false));
  }, []);

  // ── Browse state ──────────────────────────────────────────────────────
  const [browseItems, setBrowseItems] = useState<AllItem[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseHostFilter, setBrowseHostFilter] = useState("");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);

  const openAddDialog = useCallback(() => {
    setAddItemOpen(true);
    if (serverItemKeys.length === 0) {
      api
        .listItemKeys()
        .then((r) =>
          setServerItemKeys(
            r.items.map((i) => ({
              key: i.key_,
              name: i.name,
              valueType: Number.parseInt(i.value_type, 10),
              group: i.group,
              delay: i.delay,
              units: i.units,
              history: i.history,
              trends: i.trends,
              description: i.description,
            })),
          ),
        )
        .catch(() => {})
        .finally(() => setItemKeysLoading(false));
    }
  }, [serverItemKeys.length]);

  // ── Edit / delete state ───────────────────────────────────────────────
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<AllItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", delay: "", status: "0", key_: "" });
  const [editSaving, setEditSaving] = useState(false);

  // ── Add item dialog ───────────────────────────────────────────────────
  const [itemType, setItemType] = useState<ItemType>("agent");

  // ── Toast ─────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const showToast = useCallback(
    (message: string, sev: "success" | "error") => setToast({ open: true, message, severity: sev }),
    [],
  );

  const onLoadAllItems = useCallback(
    async (hostFilter?: string) => {
      const host = hostFilter ?? browseHostFilter;
      if (!host) {
        setBrowseItems([]);
        return;
      }
      setBrowseLoading(true);
      try {
        const res = await api.listAllItems({ limit: 2000, hostname: host });
        setBrowseItems(res.items);
      } catch (e) {
        showToast(e instanceof Error ? e.message : String(e), "error");
      } finally {
        setBrowseLoading(false);
      }
    },
    [browseHostFilter, showToast],
  );

  useEffect(() => {
    void onLoadAllItems(browseHostFilter);
  }, [browseHostFilter, onLoadAllItems]);

  const { toggle: toggleFavItem, isFav: isFavItem } = useFavorites("favorite_items");

  const browseFiltered = browseItems
    .filter((item) => {
      const words = browseSearch.toLowerCase().split(/\s+/).filter(Boolean);
      const name = item.name.toLowerCase();
      const key = item.key_.toLowerCase();
      const matchesSearch =
        words.length === 0 || words.every((w) => name.includes(w) || key.includes(w));
      const matchesHost = !browseHostFilter || item.hostname === browseHostFilter;
      return matchesSearch && matchesHost;
    })
    .sort((a, b) => (isFavItem(a.itemid) ? 0 : 1) - (isFavItem(b.itemid) ? 0 : 1));

  const onDeleteItem = async (itemid: string) => {
    try {
      await api.deleteItem(itemid);
      setBrowseItems((prev) => prev.filter((i) => i.itemid !== itemid));
      showToast("Item deleted.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const panelProps: PanelProps = {
    hosts,
    hostsLoading,
    showToast,
    onSuccess: () => {
      void onLoadAllItems();
    },
  };

  const activeTypeMeta = ITEM_TYPE_META.find((t) => t.value === itemType);

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <PlaylistAddOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Items
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage monitoring items and service health monitors.
            </Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<PlaylistAddOutlinedIcon />} onClick={openAddDialog}>
          Add Item
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
              <TextField
                size="small"
                placeholder="Search by name or key…"
                value={browseSearch}
                onChange={(e) => setBrowseSearch(e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                  endAdornment: browseSearch ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setBrowseSearch("")}>
                        <ClearIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
                }}
              />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Filter by host</InputLabel>
                <SearchableSelect
                  label="Filter by host"
                  value={browseHostFilter}
                  onChange={(e) => setBrowseHostFilter(e.target.value)}
                >
                  <MenuItem value="">
                    <em>All hosts</em>
                  </MenuItem>
                  {hosts.map((h) => (
                    <MenuItem key={h.hostid} value={h.host}>
                      {h.host}
                    </MenuItem>
                  ))}
                </SearchableSelect>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                {browseLoading
                  ? "Loading…"
                  : `${browseFiltered.length} of ${browseItems.length} items${browseItems.length === 2000 ? " (limit)" : ""}`}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={browseLoading ? <CircularProgress size={14} /> : <RefreshIcon />}
                onClick={() => void onLoadAllItems()}
                disabled={browseLoading}
              >
                Refresh
              </Button>
            </Stack>

            {(() => {
              if (!browseHostFilter) return null;
              const h = hosts.find((hh) => hh.host === browseHostFilter);
              if (!h?.interfaces?.length) return null;
              const primary = h.interfaces.find((i) => i.type === "1") ?? h.interfaces[0];
              if (primary?.available !== "2") return null;
              return (
                <Alert
                  severity="warning"
                  icon={<WifiOffIcon fontSize="inherit" />}
                  sx={{ py: 0.5, fontSize: "0.82rem" }}
                >
                  <strong>Host agent unreachable.</strong> Zabbix cannot collect data from this
                  host. Items showing a <strong>No data</strong> chip have not reported within their
                  expected polling interval — values below are stale.
                </Alert>
              );
            })()}

            <TableContainer
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1.5,
                maxHeight: 520,
                overflow: "auto",
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 28, pr: 0, bgcolor: "background.paper" }} />
                    <TableCell sx={{ width: 36, bgcolor: "background.paper" }} />
                    <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>
                      Name
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 700, whiteSpace: "nowrap", bgcolor: "background.paper" }}
                    >
                      Host
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 700, whiteSpace: "nowrap", bgcolor: "background.paper" }}
                    >
                      Status
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 700, whiteSpace: "nowrap", bgcolor: "background.paper" }}
                    >
                      Last Value
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Key</TableCell>
                    <TableCell
                      sx={{ fontWeight: 700, whiteSpace: "nowrap", bgcolor: "background.paper" }}
                    >
                      Interval
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>
                      Tags
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 50, bgcolor: "background.paper" }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {browseLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
                      <TableRow key={i}>
                        {Array.from({ length: 9 }).map((__, j) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cells
                          <TableCell key={j}>
                            <Skeleton variant="text" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : browseFiltered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        {!browseHostFilter
                          ? "Select a host above to view its items."
                          : browseSearch
                            ? "No items match the search."
                            : "No items found on this host."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    browseFiltered.map((item) => {
                      const isExpanded = expandedItemId === item.itemid;
                      return (
                        <>
                          <TableRow
                            key={item.itemid}
                            hover
                            onClick={() => setExpandedItemId(isExpanded ? null : item.itemid)}
                            sx={{
                              cursor: "pointer",
                              ...(isItemStale(item) ? { bgcolor: "rgba(239,68,68,0.04)" } : {}),
                            }}
                          >
                            <TableCell sx={{ width: 28, pr: 0 }}>
                              <IconButton size="small" sx={{ p: 0.25 }}>
                                {isExpanded ? (
                                  <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                                ) : (
                                  <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
                                )}
                              </IconButton>
                            </TableCell>
                            <TableCell padding="checkbox">
                              <Tooltip
                                title={
                                  isFavItem(item.itemid)
                                    ? "Remove from favourites"
                                    : "Add to favourites"
                                }
                              >
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavItem(item.itemid);
                                  }}
                                  sx={{
                                    color: isFavItem(item.itemid)
                                      ? "warning.main"
                                      : "action.disabled",
                                  }}
                                >
                                  {isFavItem(item.itemid) ? (
                                    <StarIcon sx={{ fontSize: 16 }} />
                                  ) : (
                                    <StarBorderIcon sx={{ fontSize: 16 }} />
                                  )}
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                <Typography variant="body2">{item.name}</Typography>
                                {item.templateid === "0" && (
                                  <Chip
                                    label="custom"
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    sx={{
                                      height: 14,
                                      fontSize: "0.55rem",
                                      fontWeight: 700,
                                      px: 0.25,
                                    }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 500, whiteSpace: "nowrap" }}
                              >
                                {item.hostname}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                                <Chip
                                  label={item.status === "0" ? "Enabled" : "Disabled"}
                                  size="small"
                                  color={item.status === "0" ? "success" : "default"}
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: "0.65rem" }}
                                />
                                {item.state === "1" && (
                                  <Chip
                                    label="Not Supported"
                                    size="small"
                                    color="error"
                                    variant="filled"
                                    sx={{ height: 16, fontSize: "0.6rem" }}
                                  />
                                )}
                                {item.state !== "1" && isItemStale(item) && (
                                  <Tooltip
                                    title={
                                      item.lastclock
                                        ? `Last data ${timeAgo(item.lastclock)} — host may be unreachable`
                                        : "Never collected — host may be unreachable"
                                    }
                                    placement="top"
                                  >
                                    <Chip
                                      label="No data"
                                      size="small"
                                      variant="filled"
                                      sx={{
                                        height: 16,
                                        fontSize: "0.6rem",
                                        bgcolor: "#EF4444",
                                        color: "#fff",
                                      }}
                                    />
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Tooltip
                                title={
                                  item.lastclock
                                    ? `Last collected ${timeAgo(item.lastclock)}`
                                    : "No data collected yet"
                                }
                                placement="top"
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontFamily: "monospace",
                                    fontSize: "0.75rem",
                                    color:
                                      item.lastvalue && !isItemStale(item)
                                        ? "text.primary"
                                        : "text.disabled",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {isItemStale(item) ? "—" : item.lastvalue || "—"}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell sx={{ maxWidth: 220 }}>
                              <Tooltip title={item.key_} placement="top">
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontFamily: "monospace",
                                    fontSize: "0.75rem",
                                    color: "text.secondary",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {item.key_}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                                {item.delay}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4 }}>
                                {(item.tags ?? []).map((t: { tag: string; value: string }) => (
                                  <Chip
                                    key={`${t.tag}:${t.value}`}
                                    label={t.value ? `${t.tag}: ${t.value}` : t.tag}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 16, fontSize: "0.6rem" }}
                                  />
                                ))}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.5}>
                                <Tooltip title="Edit item">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditItem(item);
                                      setEditForm({
                                        name: item.name,
                                        delay: item.delay,
                                        status: item.status,
                                        key_: item.key_,
                                      });
                                    }}
                                  >
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete item">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteItemId(item.itemid);
                                    }}
                                  >
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                          <TableRow key={`${item.itemid}-detail`}>
                            <TableCell
                              colSpan={10}
                              sx={{ py: 0, border: isExpanded ? undefined : "none" }}
                            >
                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                <Box
                                  sx={{
                                    px: 3,
                                    py: 1.5,
                                    bgcolor: "action.hover",
                                    borderRadius: 1,
                                    my: 0.5,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 700,
                                      color: "text.secondary",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.07em",
                                      fontSize: "0.6rem",
                                    }}
                                  >
                                    Item details
                                  </Typography>
                                  <Box sx={{ display: "flex", gap: 4, mt: 0.75, flexWrap: "wrap" }}>
                                    <Box>
                                      <Typography variant="caption" color="text.disabled">
                                        Type
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                                        {valueTypes.find(
                                          (vt) => vt.value === Number(item.value_type),
                                        )?.label ?? `Type ${item.value_type}`}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" color="text.disabled">
                                        Interval
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                                        {item.delay || "—"}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" color="text.disabled">
                                        Source
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                                        {item.templateid === "0" ? "Custom item" : "From template"}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" color="text.disabled">
                                        Last collected
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                                        {item.lastclock
                                          ? new Date(item.lastclock * 1000).toLocaleString()
                                          : "Never"}
                                      </Typography>
                                    </Box>
                                  </Box>
                                  <Box
                                    sx={{
                                      mt: 1,
                                      px: 1.5,
                                      py: 0.75,
                                      bgcolor: "background.paper",
                                      borderRadius: 1,
                                      borderLeft: "3px solid",
                                      borderColor: "divider",
                                    }}
                                  >
                                    <Typography variant="caption" color="text.disabled">
                                      Key
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontFamily: "monospace",
                                        fontSize: "0.78rem",
                                        wordBreak: "break-all",
                                        mt: 0.25,
                                      }}
                                    >
                                      {item.key_}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Add item dialog ── */}
      <Dialog open={addItemOpen} onClose={() => setAddItemOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Item</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Item type</InputLabel>
              <Select
                label="Item type"
                value={itemType}
                onChange={(e) => setItemType(e.target.value as ItemType)}
              >
                {ITEM_TYPE_META.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {t.icon}
                      <Typography variant="body2">{t.label}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {activeTypeMeta?.alert}

            <ItemPanel
              itemType={itemType}
              panelProps={panelProps}
              serverItemKeys={serverItemKeys}
              itemKeysLoading={itemKeysLoading}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddItemOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit item dialog ── */}
      <Dialog open={!!editItem} onClose={() => setEditItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Name *"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              size="small"
              label="Item key (condition)"
              value={editForm.key_}
              onChange={(e) => setEditForm((f) => ({ ...f, key_: e.target.value }))}
              InputProps={{ sx: { fontFamily: "monospace", fontSize: "0.8rem" } }}
              helperText="The Zabbix item key that defines what data is collected. Changing this may clear existing history."
            />
            <TextField
              size="small"
              label="Update interval"
              value={editForm.delay}
              onChange={(e) => setEditForm((f) => ({ ...f, delay: e.target.value }))}
              helperText="e.g. 1m, 30s, 5m"
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as string }))}
              >
                <MenuItem value="0">Enabled</MenuItem>
                <MenuItem value="1">Disabled</MenuItem>
              </Select>
            </FormControl>
            {editItem?.state === "1" && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                This item is <strong>Not Supported</strong> — the agent returned an error for the
                current key. Fix the key above to resolve it.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditItem(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={editSaving || !editForm.name.trim() || !editForm.key_.trim()}
            onClick={async () => {
              if (!editItem) return;
              setEditSaving(true);
              try {
                const keyChanged = editForm.key_ !== editItem.key_;
                await api.updateItem(editItem.itemid, {
                  name: editForm.name,
                  delay: editForm.delay || undefined,
                  status: editForm.status,
                  key_: keyChanged ? editForm.key_ : undefined,
                });
                showToast("Item updated.", "success");
                setEditItem(null);
                void onLoadAllItems(browseHostFilter || undefined);
              } catch (e) {
                showToast(e instanceof Error ? e.message : String(e), "error");
              } finally {
                setEditSaving(false);
              }
            }}
          >
            {editSaving ? <CircularProgress size={14} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Confirm delete ── */}
      <Dialog
        open={confirmDeleteItemId !== null}
        onClose={() => setConfirmDeleteItemId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete item?</DialogTitle>
        <DialogContent>
          <Typography>
            This will permanently remove the item from Zabbix. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteItemId(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (!confirmDeleteItemId) return;
              await onDeleteItem(confirmDeleteItemId);
              setConfirmDeleteItemId(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
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
