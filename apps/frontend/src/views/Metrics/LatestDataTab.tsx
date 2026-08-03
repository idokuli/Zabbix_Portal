"use client";

import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
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
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Host } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { formatDateTime, formatTime } from "../../app/datetime";
import { SearchableSelect } from "../../components/SearchableSelect";
import { parseDelaySecs } from "../Items/shared";

// ── Latest Data tab ───────────────────────────────────────────────────

type LatestItem = {
  itemid: string;
  name: string;
  key_: string;
  value_type: string;
  delay: string;
  status: string;
  hostname: string;
  tags: Array<{ tag: string; value: string }>;
  lastvalue: string;
  lastclock: number | null;
  templateid: string;
};

const VALUE_TYPE_LABELS: Record<string, string> = {
  "0": "Float",
  "1": "String",
  "2": "Log",
  "3": "Integer",
  "4": "Text",
};

const isLatestItemStale = (item: LatestItem): boolean => {
  const delaySecs = parseDelaySecs(item.delay);
  if (delaySecs === 0) {
    return false;
  }
  if (!item.lastclock) {
    return true;
  }
  return Math.floor(Date.now() / 1000) - item.lastclock > delaySecs * 3;
};

const formatLastCheck = (clock: number | null): string => {
  if (!clock) {
    return "—";
  }
  const diff = Math.floor(Date.now() / 1000) - clock;
  if (diff < 60) {
    return `${diff}s ago`;
  }
  if (diff < 3600) {
    return `${Math.floor(diff / 60)}m ago`;
  }
  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h ago`;
  }
  return `${Math.floor(diff / 86400)}d ago`;
};

const LastValueCell = ({
  item,
  hasValue,
  isStale,
}: {
  item: LatestItem;
  hasValue: boolean;
  isStale: boolean;
}) => (
  <TableCell sx={{ maxWidth: 260 }}>
    <Tooltip
      title={
        hasValue && !isStale
          ? item.lastvalue
          : isStale
            ? "Value is stale — host may be unreachable"
            : "No data collected yet"
      }
      placement="top"
    >
      <Typography
        variant="body2"
        sx={{
          fontFamily: "monospace",
          fontSize: "0.8rem",
          color: isStale ? "text.disabled" : hasValue ? "text.primary" : "text.disabled",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 240,
        }}
      >
        {isStale ? "—" : item.lastvalue || "—"}
      </Typography>
    </Tooltip>
  </TableCell>
);

const ItemStatusCell = ({ isStale, isEnabled }: { isStale: boolean; isEnabled: boolean }) => (
  <TableCell>
    {isStale ? (
      <Chip
        label="No data"
        size="small"
        color="error"
        variant="outlined"
        sx={{ height: 18, fontSize: "0.65rem" }}
      />
    ) : (
      <Chip
        label={isEnabled ? "Enabled" : "Disabled"}
        size="small"
        variant="outlined"
        color={isEnabled ? "success" : "default"}
        sx={{ height: 18, fontSize: "0.65rem" }}
      />
    )}
  </TableCell>
);

const LatestItemRow = ({ item }: { item: LatestItem }) => {
  const isEnabled = item.status === "0";
  const hasValue = !!item.lastvalue;
  const isStale = isLatestItemStale(item);
  return (
    <TableRow hover sx={{ opacity: isEnabled ? 1 : 0.55 }}>
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {item.name}
          </Typography>
          {item.templateid === "0" && (
            <Chip
              label="custom"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ height: 14, fontSize: "0.55rem", fontWeight: 700, px: 0.25 }}
            />
          )}
        </Box>
      </TableCell>
      <TableCell sx={{ maxWidth: 220 }}>
        <Tooltip title={item.key_} placement="top">
          <Typography
            variant="body2"
            sx={{
              fontFamily: "monospace",
              fontSize: "0.72rem",
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
        <Typography
          variant="body2"
          sx={{ whiteSpace: "nowrap", color: "text.secondary", fontSize: "0.75rem" }}
        >
          {VALUE_TYPE_LABELS[item.value_type] ?? item.value_type}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography
          variant="body2"
          sx={{ whiteSpace: "nowrap", color: "text.secondary", fontSize: "0.75rem" }}
        >
          {item.delay || "—"}
        </Typography>
      </TableCell>
      <LastValueCell item={item} hasValue={hasValue} isStale={isStale} />
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        <Tooltip title={formatDateTime(item.lastclock, "Never collected")} placement="top">
          <Typography
            variant="body2"
            sx={{ fontSize: "0.75rem", color: isStale ? "warning.main" : "text.secondary" }}
          >
            {formatLastCheck(item.lastclock)}
          </Typography>
        </Tooltip>
      </TableCell>
      <ItemStatusCell isStale={isStale} isEnabled={isEnabled} />
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
    </TableRow>
  );
};

const LatestDataSkeletonRows = () => (
  <>
    {Array.from({ length: 8 }).map((_, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
      <TableRow key={i}>
        {Array.from({ length: 8 }).map((__, j) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          <TableCell key={j}>
            <Skeleton variant="text" />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

const SummaryChips = ({
  items,
  filtered,
  enabledCount,
}: {
  items: LatestItem[];
  filtered: LatestItem[];
  enabledCount: number;
}) => (
  <Stack sx={{ flexWrap: "wrap" }} direction="row" spacing={1}>
    <Chip label={`${items.length} total items`} size="small" variant="outlined" />
    <Chip label={`${enabledCount} enabled`} size="small" color="success" variant="outlined" />
    {items.length - enabledCount > 0 && (
      <Chip label={`${items.length - enabledCount} disabled`} size="small" variant="outlined" />
    )}
    {filtered.length !== items.length && (
      <Chip label={`${filtered.length} shown`} size="small" color="primary" variant="outlined" />
    )}
  </Stack>
);

const HostUnreachableBanner = ({ host }: { host: Host | undefined }) => {
  // biome-ignore lint/style/useExplicitLengthCheck: `=== 0` breaks TS's narrowing of host/host.interfaces below
  if (!host?.interfaces?.length) {
    return null;
  }
  const primary = host.interfaces.find((i) => i.type === "1") ?? host.interfaces[0];
  if (primary?.available !== "2") {
    return null;
  }
  return (
    <Alert
      severity="warning"
      icon={<WifiOffIcon fontSize="inherit" />}
      sx={{ py: 0.5, fontSize: "0.82rem" }}
    >
      <strong>Host agent unreachable.</strong> Zabbix cannot collect data from this host. Items
      showing a <strong>No data</strong> chip have not reported within their expected polling
      interval — values below are stale.
    </Alert>
  );
};

const matchesLatestItemFilters = (
  item: LatestItem,
  search: string,
  statusFilter: "all" | "enabled" | "disabled",
): boolean => {
  const q = search.toLowerCase();
  const matchSearch =
    !q ||
    item.name.toLowerCase().includes(q) ||
    item.key_.toLowerCase().includes(q) ||
    item.lastvalue.toLowerCase().includes(q);
  const matchStatus =
    statusFilter === "all" ||
    (statusFilter === "enabled" ? item.status === "0" : item.status !== "0");
  return matchSearch && matchStatus;
};

type StatusFilterValue = "all" | "enabled" | "disabled";

const LatestDataControls = ({
  search,
  setSearch,
  hosts,
  selectedHost,
  setSelectedHost,
  hostsLoading,
  statusFilter,
  setStatusFilter,
  autoRefresh,
  setAutoRefresh,
  loading,
  onRefresh,
  lastRefreshed,
}: {
  search: string;
  setSearch: (v: string) => void;
  hosts: Host[];
  selectedHost: string;
  setSelectedHost: (v: string) => void;
  hostsLoading: boolean;
  statusFilter: StatusFilterValue;
  setStatusFilter: (v: StatusFilterValue) => void;
  autoRefresh: boolean;
  setAutoRefresh: (fn: (v: boolean) => boolean) => void;
  loading: boolean;
  onRefresh: () => void;
  lastRefreshed: Date | null;
}) => (
  <Stack sx={{ alignItems: "center" }} direction={{ xs: "column", sm: "row" }} spacing={1.5}>
    <TextField
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <ShowChartOutlinedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
            </InputAdornment>
          ),
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch("")}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
      size="small"
      placeholder="Search name, key, or value…"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      sx={{ flex: 1, minWidth: 200 }}
    />

    <FormControl size="small" sx={{ minWidth: 240 }}>
      <InputLabel>Host</InputLabel>
      <SearchableSelect
        label="Host"
        value={selectedHost}
        onChange={(e) => setSelectedHost(e.target.value)}
        disabled={hostsLoading}
      >
        {hosts.map((h) => (
          <MenuItem key={h.hostid} value={h.host}>
            {h.host}
          </MenuItem>
        ))}
      </SearchableSelect>
    </FormControl>

    <FormControl size="small" sx={{ minWidth: 130 }}>
      <InputLabel>Status</InputLabel>
      <Select
        label="Status"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as StatusFilterValue)}
      >
        <MenuItem value="all">All</MenuItem>
        <MenuItem value="enabled">Enabled</MenuItem>
        <MenuItem value="disabled">Disabled</MenuItem>
      </Select>
    </FormControl>

    <Tooltip title={autoRefresh ? "Auto-refresh on (10s)" : "Auto-refresh off"}>
      <IconButton
        size="small"
        color={autoRefresh ? "primary" : "default"}
        onClick={() => setAutoRefresh((v) => !v)}
      >
        <RefreshIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>

    <Button
      size="small"
      variant="outlined"
      startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
      onClick={onRefresh}
      disabled={loading || !selectedHost}
    >
      Refresh
    </Button>

    {lastRefreshed && (
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
        Updated {formatTime(lastRefreshed)}
      </Typography>
    )}
  </Stack>
);

export const LatestDataTab = () => {
  const tick = useRefreshTick();
  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostsLoading, setHostsLoading] = useState(true);
  const [selectedHost, setSelectedHost] = useState("");
  const [items, setItems] = useState<LatestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("enabled");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHosts = useCallback((silent = false) => {
    if (!silent) {
      setHostsLoading(true);
    }
    api
      .listHosts()
      .then((r) => setHosts(r.hosts))
      .catch(() => {})
      .finally(() => setHostsLoading(false));
  }, []);

  useEffect(() => {
    fetchHosts();
  }, [fetchHosts]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      fetchHosts(true);
    }
  }, [tick]);

  const loadItems = useCallback(async (host: string, silent = false) => {
    if (!host) {
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    try {
      const res = await api.listAllItems({ hostname: host, limit: 5000 });
      setItems(res.items);
      setLastRefreshed(new Date());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedHost) {
      void loadItems(selectedHost);
    } else {
      setItems([]);
    }
  }, [selectedHost, loadItems]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (autoRefresh && selectedHost) {
      intervalRef.current = setInterval(() => void loadItems(selectedHost, true), 10000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, selectedHost, loadItems]);

  const filtered = items.filter((item) => matchesLatestItemFilters(item, search, statusFilter));

  const enabledCount = items.filter((i) => i.status === "0").length;

  return (
    <Stack spacing={2}>
      <TabHeader
        title="Latest Data"
        description="See the most recent collected value for every item on monitored hosts."
      />
      {/* ── Controls ── */}
      <LatestDataControls
        search={search}
        setSearch={setSearch}
        hosts={hosts}
        selectedHost={selectedHost}
        setSelectedHost={setSelectedHost}
        hostsLoading={hostsLoading}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        loading={loading}
        onRefresh={() => {
          if (selectedHost) {
            void loadItems(selectedHost);
          }
        }}
        lastRefreshed={lastRefreshed}
      />

      {/* ── Summary chips ── */}
      {selectedHost && !loading && items.length > 0 && (
        <SummaryChips items={items} filtered={filtered} enabledCount={enabledCount} />
      )}

      {/* ── Empty states ── */}
      {!selectedHost && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          Select a host above to see its monitoring items and their latest collected values.
        </Alert>
      )}

      {/* Host unreachable banner */}
      {selectedHost && (
        <HostUnreachableBanner host={hosts.find((hh) => hh.host === selectedHost)} />
      )}

      {/* ── Table ── */}
      {selectedHost && (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ maxHeight: 600, overflow: "auto" }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{ fontWeight: 700, bgcolor: "background.paper", whiteSpace: "nowrap" }}
                >
                  Name
                </TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", maxWidth: 220 }}>
                  Key
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 700, bgcolor: "background.paper", whiteSpace: "nowrap" }}
                >
                  Type
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 700, bgcolor: "background.paper", whiteSpace: "nowrap" }}
                >
                  Interval
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 700, bgcolor: "background.paper", whiteSpace: "nowrap" }}
                >
                  Last value
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 700, bgcolor: "background.paper", whiteSpace: "nowrap" }}
                >
                  Last check
                </TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Tags</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LatestDataSkeletonRows />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    {items.length === 0
                      ? "No items found on this host."
                      : "No items match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => <LatestItemRow key={item.itemid} item={item} />)
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
};
