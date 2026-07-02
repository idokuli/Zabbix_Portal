"use client";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import HttpIcon from "@mui/icons-material/Http";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import NetworkCheckIcon from "@mui/icons-material/NetworkCheck";
import PlaylistAddOutlinedIcon from "@mui/icons-material/PlaylistAddOutlined";
import RouterIcon from "@mui/icons-material/Router";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TerminalIcon from "@mui/icons-material/Terminal";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { type Host, api } from "../../app/api";
import { hostsApi } from "../../app/api/hosts";
import type { TemplateItem } from "../../app/api/types";
import { ConfirmDelete } from "../../app/components/ConfirmDelete";
import { useFavorites } from "../../lib/favorites";
import { ItemsBrowseTable } from "./ItemsBrowseTable";
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
import {
  FileWatchPanel,
  ProcessPanel,
  ServicePanel,
  WindowsServicePanel,
} from "./panels/ServiceFilePanel";
import { SnmpPanel, SnmpTrapPanel } from "./panels/SnmpPanel";
import type { PanelProps } from "./panels/shared";
import type { AllItem, ServerItemKey } from "./shared";

type ItemType =
  | "agent"
  | "http"
  | "service"
  | "winsvc"
  | "process"
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
    value: "winsvc",
    label: "Windows Service",
    icon: <MonitorHeartOutlinedIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<MonitorHeartOutlinedIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Uses <strong>service.info[name,state]</strong> — Windows-only. The Zabbix agent must be
        installed on the host. Use the internal service name, not the display name.
      </Alert>
    ),
  },
  {
    value: "process",
    label: "Process Monitor",
    icon: <MonitorHeartOutlinedIcon sx={{ fontSize: 18 }} />,
    alert: (
      <Alert severity="info" icon={<MonitorHeartOutlinedIcon fontSize="small" />} sx={{ py: 0.5 }}>
        Uses <strong>proc.num[]</strong> to count matching processes. Filter by name, OS user, or
        command line. A trigger fires when the count drops to 0.
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
    case "winsvc":
      return <WindowsServicePanel {...panelProps} />;
    case "process":
      return <ProcessPanel {...panelProps} />;
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
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<AllItem | null>(null);
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

  // ── Main tab (Host Items / Template Items) ────────────────────────────
  const [mainTab, setMainTab] = useState<0 | 1>(0);

  // ── Template Items tab state ──────────────────────────────────────────
  const [allTemplates, setAllTemplates] = useState<Array<{ templateid: string; name: string }>>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [templateItemsLoading, setTemplateItemsLoading] = useState(false);
  const [templateItemSearch, setTemplateItemSearch] = useState("");

  const [addTplItemOpen, setAddTplItemOpen] = useState(false);
  const [addTplItemForm, setAddTplItemForm] = useState({
    name: "",
    key_: "",
    type_: "0",
    value_type: "3",
    delay: "1m",
    history: "31d",
    trends: "365d",
    units: "",
    description: "",
  });
  const [addTplItemSaving, setAddTplItemSaving] = useState(false);

  const [editTplItem, setEditTplItem] = useState<TemplateItem | null>(null);
  const [editTplForm, setEditTplForm] = useState({ name: "", delay: "", key_: "" });
  const [editTplSaving, setEditTplSaving] = useState(false);
  const [confirmDeleteTplItem, setConfirmDeleteTplItem] = useState<TemplateItem | null>(null);

  const loadAllTemplates = useCallback(() => {
    if (allTemplates.length > 0) return;
    setTemplatesLoading(true);
    hostsApi
      .listTemplates()
      .then((r) => setAllTemplates(r.templates.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, [allTemplates.length]);

  const loadTemplateItems = useCallback((tid: string) => {
    if (!tid) return;
    setTemplateItemsLoading(true);
    hostsApi
      .getTemplateItems(tid)
      .then((r) => setTemplateItems(r.items))
      .catch(() => {})
      .finally(() => setTemplateItemsLoading(false));
  }, []);

  useEffect(() => {
    if (mainTab === 1) loadAllTemplates();
  }, [mainTab, loadAllTemplates]);

  useEffect(() => {
    if (selectedTemplateId) loadTemplateItems(selectedTemplateId);
    else setTemplateItems([]);
  }, [selectedTemplateId, loadTemplateItems]);

  const ITEM_TYPE_NAMES: Record<string, string> = {
    "0": "Agent",
    "1": "SNMPv1",
    "2": "Trapper",
    "3": "Simple check",
    "4": "SNMPv2c",
    "5": "Internal",
    "6": "SNMPv3",
    "7": "Agent (active)",
    "10": "External check",
    "11": "DB monitor",
    "13": "SNMP trap",
    "14": "JMX agent",
    "15": "Calculated",
    "16": "Dependent",
    "17": "HTTP agent",
    "18": "SNMP agent",
    "19": "Script",
    "20": "Browser",
  };

  const VALUE_TYPE_NAMES: Record<string, string> = {
    "0": "Numeric (float)",
    "1": "Character",
    "2": "Log",
    "3": "Numeric (uint)",
    "4": "Text",
  };

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

  const tplFiltered = templateItems.filter((i) => {
    const q = templateItemSearch.toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || i.key_.toLowerCase().includes(q);
  });

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Items
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Manage monitoring items and service health monitors.
          </Typography>
        </Box>
        {mainTab === 0 ? (
          <Button
            variant="contained"
            startIcon={<PlaylistAddOutlinedIcon />}
            onClick={openAddDialog}
          >
            Add Item
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={!selectedTemplateId}
            onClick={() => setAddTplItemOpen(true)}
          >
            Add Item to Template
          </Button>
        )}
      </Box>

      <Tabs
        value={mainTab}
        onChange={(_, v) => setMainTab(v as 0 | 1)}
        sx={{ borderBottom: 1, borderColor: "divider", mb: -1 }}
      >
        <Tab label="Host Items" />
        <Tab label="Template Items" />
      </Tabs>

      {mainTab === 0 && (
        <Card>
          <CardContent>
            <ItemsBrowseTable
              items={browseFiltered}
              allCount={browseItems.length}
              loading={browseLoading}
              browseSearch={browseSearch}
              onSearchChange={setBrowseSearch}
              browseHostFilter={browseHostFilter}
              onHostFilterChange={setBrowseHostFilter}
              hosts={hosts}
              expandedItemId={expandedItemId}
              onExpand={setExpandedItemId}
              onEdit={(item) => {
                setEditItem(item);
                setEditForm({
                  name: item.name,
                  delay: item.delay,
                  status: item.status,
                  key_: item.key_,
                });
              }}
              onDelete={setConfirmDeleteItem}
              isFav={isFavItem}
              toggleFav={toggleFavItem}
              onRefresh={() => void onLoadAllItems()}
            />
          </CardContent>
        </Card>
      )}

      {mainTab === 1 && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Search items…"
                  value={templateItemSearch}
                  onChange={(e) => setTemplateItemSearch(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <FormControl size="small" sx={{ minWidth: 300 }}>
                  <InputLabel id="tpl-select-label">
                    {templatesLoading ? "Loading templates…" : "Template"}
                  </InputLabel>
                  <Select
                    labelId="tpl-select-label"
                    label={templatesLoading ? "Loading templates…" : "Template"}
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    {allTemplates.map((t) => (
                      <MenuItem key={t.templateid} value={t.templateid}>
                        {t.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Tooltip title="Reload">
                  <IconButton
                    onClick={() => selectedTemplateId && loadTemplateItems(selectedTemplateId)}
                    disabled={!selectedTemplateId}
                  >
                    <RouterIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              {!selectedTemplateId && (
                <Typography color="text.secondary" variant="body2">
                  Select a template to view its items.
                </Typography>
              )}

              {templateItemsLoading && <CircularProgress size={24} />}

              {!templateItemsLoading && selectedTemplateId && tplFiltered.length === 0 && (
                <Typography color="text.secondary" variant="body2">
                  No items found on this template.
                </Typography>
              )}

              {!templateItemsLoading && tplFiltered.length > 0 && (
                <Box sx={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Name", "Key", "Type", "Value type", "Interval", "Status", "Actions"].map(
                          (h) => (
                            <th
                              key={h}
                              style={{
                                textAlign: "left",
                                padding: "6px 10px",
                                borderBottom: "1px solid rgba(128,128,128,0.2)",
                                fontSize: 12,
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {tplFiltered.map((item) => (
                        <tr key={item.itemid}>
                          <td style={{ padding: "6px 10px", fontSize: 13 }}>{item.name}</td>
                          <td
                            style={{
                              padding: "6px 10px",
                              fontSize: 12,
                              fontFamily: "monospace",
                              color: "rgba(128,128,128,0.9)",
                            }}
                          >
                            {item.key_}
                          </td>
                          <td style={{ padding: "6px 10px", fontSize: 12 }}>
                            {ITEM_TYPE_NAMES[item.type] ?? item.type}
                          </td>
                          <td style={{ padding: "6px 10px", fontSize: 12 }}>
                            {VALUE_TYPE_NAMES[item.value_type] ?? item.value_type}
                          </td>
                          <td style={{ padding: "6px 10px", fontSize: 12 }}>{item.delay}</td>
                          <td style={{ padding: "6px 10px" }}>
                            <Chip
                              label={item.status === "0" ? "Enabled" : "Disabled"}
                              size="small"
                              color={item.status === "0" ? "success" : "default"}
                            />
                          </td>
                          <td style={{ padding: "6px 4px", whiteSpace: "nowrap" }}>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditTplItem(item);
                                  setEditTplForm({
                                    name: item.name,
                                    delay: item.delay,
                                    key_: item.key_,
                                  });
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setConfirmDeleteTplItem(item)}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* ── Add item to template dialog ── */}
      <Dialog
        open={addTplItemOpen}
        onClose={() => setAddTplItemOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Add Item to Template</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Item name"
              size="small"
              fullWidth
              value={addTplItemForm.name}
              onChange={(e) => setAddTplItemForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label="Item key"
              size="small"
              fullWidth
              placeholder="e.g. agent.version"
              value={addTplItemForm.key_}
              onChange={(e) => setAddTplItemForm((f) => ({ ...f, key_: e.target.value }))}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Item type</InputLabel>
              <Select
                label="Item type"
                value={addTplItemForm.type_}
                onChange={(e) => setAddTplItemForm((f) => ({ ...f, type_: e.target.value }))}
              >
                {Object.entries(ITEM_TYPE_NAMES).map(([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {v}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Value type</InputLabel>
              <Select
                label="Value type"
                value={addTplItemForm.value_type}
                onChange={(e) => setAddTplItemForm((f) => ({ ...f, value_type: e.target.value }))}
              >
                {Object.entries(VALUE_TYPE_NAMES).map(([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {v}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Interval"
                size="small"
                value={addTplItemForm.delay}
                onChange={(e) => setAddTplItemForm((f) => ({ ...f, delay: e.target.value }))}
                sx={{ width: 120 }}
              />
              <TextField
                label="History"
                size="small"
                value={addTplItemForm.history}
                onChange={(e) => setAddTplItemForm((f) => ({ ...f, history: e.target.value }))}
                sx={{ width: 120 }}
              />
              <TextField
                label="Trends"
                size="small"
                value={addTplItemForm.trends}
                onChange={(e) => setAddTplItemForm((f) => ({ ...f, trends: e.target.value }))}
                sx={{ width: 120 }}
              />
            </Stack>
            <TextField
              label="Units (optional)"
              size="small"
              fullWidth
              value={addTplItemForm.units}
              onChange={(e) => setAddTplItemForm((f) => ({ ...f, units: e.target.value }))}
            />
            <TextField
              label="Description (optional)"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={addTplItemForm.description}
              onChange={(e) => setAddTplItemForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddTplItemOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={addTplItemSaving || !addTplItemForm.name || !addTplItemForm.key_}
            onClick={async () => {
              setAddTplItemSaving(true);
              try {
                await hostsApi.addTemplateItem(selectedTemplateId, {
                  name: addTplItemForm.name,
                  key_: addTplItemForm.key_,
                  type_: Number.parseInt(addTplItemForm.type_, 10),
                  value_type: Number.parseInt(addTplItemForm.value_type, 10),
                  delay: addTplItemForm.delay,
                  history: addTplItemForm.history,
                  trends: addTplItemForm.trends,
                  units: addTplItemForm.units || undefined,
                  description: addTplItemForm.description || undefined,
                });
                showToast("Item added to template.", "success");
                setAddTplItemOpen(false);
                setAddTplItemForm({
                  name: "",
                  key_: "",
                  type_: "0",
                  value_type: "3",
                  delay: "1m",
                  history: "31d",
                  trends: "365d",
                  units: "",
                  description: "",
                });
                loadTemplateItems(selectedTemplateId);
              } catch (e) {
                showToast(e instanceof Error ? e.message : String(e), "error");
              } finally {
                setAddTplItemSaving(false);
              }
            }}
          >
            {addTplItemSaving ? <CircularProgress size={14} /> : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit template item dialog ── */}
      <Dialog open={!!editTplItem} onClose={() => setEditTplItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Template Item</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Item name"
              size="small"
              fullWidth
              value={editTplForm.name}
              onChange={(e) => setEditTplForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label="Item key"
              size="small"
              fullWidth
              value={editTplForm.key_}
              onChange={(e) => setEditTplForm((f) => ({ ...f, key_: e.target.value }))}
            />
            <TextField
              label="Interval"
              size="small"
              value={editTplForm.delay}
              onChange={(e) => setEditTplForm((f) => ({ ...f, delay: e.target.value }))}
              sx={{ width: 140 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTplItem(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={editTplSaving || !editTplForm.name}
            onClick={async () => {
              if (!editTplItem) return;
              setEditTplSaving(true);
              try {
                const keyChanged = editTplForm.key_ !== editTplItem.key_;
                await hostsApi.updateTemplateItem(selectedTemplateId, editTplItem.itemid, {
                  name: editTplForm.name,
                  delay: editTplForm.delay || undefined,
                  key_: keyChanged ? editTplForm.key_ : undefined,
                });
                showToast("Template item updated.", "success");
                setEditTplItem(null);
                loadTemplateItems(selectedTemplateId);
              } catch (e) {
                showToast(e instanceof Error ? e.message : String(e), "error");
              } finally {
                setEditTplSaving(false);
              }
            }}
          >
            {editTplSaving ? <CircularProgress size={14} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDelete
        open={confirmDeleteTplItem !== null}
        name={confirmDeleteTplItem?.name ?? ""}
        onConfirm={async () => {
          if (!confirmDeleteTplItem) return;
          try {
            await hostsApi.deleteTemplateItem(selectedTemplateId, confirmDeleteTplItem.itemid);
            showToast("Template item deleted.", "success");
            setTemplateItems((prev) =>
              prev.filter((i) => i.itemid !== confirmDeleteTplItem.itemid),
            );
          } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), "error");
          } finally {
            setConfirmDeleteTplItem(null);
          }
        }}
        onClose={() => setConfirmDeleteTplItem(null)}
      />

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

      <ConfirmDelete
        open={confirmDeleteItem !== null}
        name={confirmDeleteItem?.name ?? ""}
        onConfirm={async () => {
          if (!confirmDeleteItem) return;
          await onDeleteItem(confirmDeleteItem.itemid);
          setConfirmDeleteItem(null);
        }}
        onClose={() => setConfirmDeleteItem(null)}
      />

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
