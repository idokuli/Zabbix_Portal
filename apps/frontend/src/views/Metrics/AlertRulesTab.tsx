"use client";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import SearchIcon from "@mui/icons-material/Search";
import StopOutlinedIcon from "@mui/icons-material/StopOutlined";
import VolumeOffOutlinedIcon from "@mui/icons-material/VolumeOffOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { type AlertEvent, type AlertRule, api, type Host } from "../../app/api";
import { ConfirmDelete } from "../../app/components/ConfirmDelete";
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { type CustomSound, listSounds } from "../../lib/soundLibrary";
import {
  AddRuleDialog,
  BUILTIN_SOUND_OPTIONS,
  EditRuleDialog,
  SEV_LABELS,
  useSoundPreview,
} from "./AlertRuleDialog";
import { getRuleSounds } from "./shared";

const LS_SOUND_PRESET = "alertSoundPreset";
const LS_RULE_SOUNDS = "alertRuleSounds";
const DEFAULT_PRESET = "beep";

const eventAgoLabel = (firedAt: number) => {
  const ago = Math.floor(Date.now() / 1000) - firedAt;
  if (ago < 60) {
    return `${ago}s ago`;
  }
  if (ago < 3600) {
    return `${Math.floor(ago / 60)}m ago`;
  }
  return `${Math.floor(ago / 3600)}h ago`;
};

const EventRow = ({ e }: { e: AlertEvent }) => {
  const sev = SEV_LABELS[e.severity] ?? { label: "Unknown", color: "#888" };
  return (
    <TableRow>
      <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>
        {eventAgoLabel(e.fired_at)}
      </TableCell>
      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{e.hostname}</TableCell>
      <TableCell sx={{ fontSize: "0.8rem" }}>{e.item_name}</TableCell>
      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
        {e.operator} {e.threshold}
      </TableCell>
      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.78rem", color: "error.main" }}>
        {e.actual_value}
      </TableCell>
      <TableCell>
        <Chip
          label={sev.label}
          size="small"
          sx={{
            height: 20,
            fontSize: "0.68rem",
            fontWeight: 700,
            color: sev.color,
            bgcolor: `${sev.color}18`,
            border: `1px solid ${sev.color}40`,
          }}
        />
      </TableCell>
    </TableRow>
  );
};

const makeStorageHandler =
  (setRuleSoundsState: (v: Record<string, string>) => void, setGlobalPreset: (v: string) => void) =>
  (e: StorageEvent) => {
    if (e.key === LS_RULE_SOUNDS) {
      setRuleSoundsState(getRuleSounds());
    }
    if (e.key === LS_SOUND_PRESET) {
      setGlobalPreset(localStorage.getItem(LS_SOUND_PRESET) ?? DEFAULT_PRESET);
    }
  };

const applyRuleFilters = <T extends { hostname: string; item_name: string }>(
  items: T[],
  {
    search,
    groupFilter,
    hostFilter,
    hostToGroups,
  }: {
    search: string;
    groupFilter: string;
    hostFilter: string;
    hostToGroups: Map<string, string[]>;
  },
): T[] => {
  const q = search.toLowerCase();
  return items.filter((r) => {
    if (groupFilter && !(hostToGroups.get(r.hostname) ?? []).includes(groupFilter)) {
      return false;
    }
    if (hostFilter && r.hostname !== hostFilter) {
      return false;
    }
    if (q && !r.hostname.toLowerCase().includes(q) && !r.item_name.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
};

const RuleSoundCell = ({
  ruleId,
  ruleSounds,
  globalPreset,
  soundOptions,
  previewingKey,
  onPreview,
}: {
  ruleId: number;
  ruleSounds: Record<string, string>;
  globalPreset: string;
  soundOptions: { key: string; label: string }[];
  previewingKey: string | null;
  onPreview: (previewKey: string, soundKey: string) => void;
}) => {
  const sk = ruleSounds[ruleId] ?? "default";
  const globalLabel =
    soundOptions.find((s) => s.key === globalPreset)?.label ??
    globalPreset.charAt(0).toUpperCase() + globalPreset.slice(1);
  const label =
    sk === "default"
      ? `Default (${globalLabel})`
      : (soundOptions.find((s) => s.key === sk)?.label ?? sk);
  const canPreview = sk !== "none";
  const isPreviewing = previewingKey === `row-${ruleId}`;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
      <Tooltip title={isPreviewing ? "Stop preview" : canPreview ? `Preview: ${label}` : label}>
        <span>
          <IconButton
            size="small"
            disabled={!canPreview}
            onClick={() => onPreview(`row-${ruleId}`, sk)}
            sx={{
              color: isPreviewing
                ? "primary.main"
                : sk === "none"
                  ? "text.disabled"
                  : "text.secondary",
            }}
          >
            {isPreviewing ? (
              <StopOutlinedIcon sx={{ fontSize: 15 }} />
            ) : sk === "none" ? (
              <VolumeOffOutlinedIcon sx={{ fontSize: 15 }} />
            ) : (
              <PlayArrowOutlinedIcon sx={{ fontSize: 15 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>
      <Typography variant="caption" sx={{ fontSize: "0.68rem", color: "text.secondary" }}>
        {label}
      </Typography>
    </Box>
  );
};

const RuleRow = ({
  r,
  ruleSounds,
  globalPreset,
  soundOptions,
  previewingKey,
  onPreview,
  onToggle,
  onEdit,
  onDeleteRequest,
}: {
  r: AlertRule;
  ruleSounds: Record<string, string>;
  globalPreset: string;
  soundOptions: { key: string; label: string }[];
  previewingKey: string | null;
  onPreview: (previewKey: string, soundKey: string) => void;
  onToggle: (id: number) => void;
  onEdit: (r: AlertRule) => void;
  onDeleteRequest: (r: AlertRule) => void;
}) => {
  const sev = SEV_LABELS[r.severity] ?? SEV_LABELS[0];
  return (
    <TableRow sx={{ opacity: r.enabled ? 1 : 0.5, "&:hover": { bgcolor: "action.hover" } }}>
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography variant="body2" sx={{ fontSize: "0.8rem", fontWeight: 500 }}>
            {r.item_name}
          </Typography>
          {r.rule_type === "service" && (
            <Chip
              label="Service"
              size="small"
              color="info"
              sx={{ height: 16, fontSize: "0.62rem" }}
            />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
          {r.hostname}
        </Typography>
      </TableCell>
      <TableCell>
        {r.rule_type === "service" || r.operator === "contains" || r.operator === "!contains" ? (
          <Typography variant="body2" sx={{ fontSize: "0.78rem", color: "text.secondary" }}>
            {r.operator === "!contains" ? "not " : ""}contains "{r.expected_contains}"
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
            {r.operator} {r.threshold}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Chip
          label={sev.label}
          size="small"
          sx={{
            height: 20,
            fontSize: "0.68rem",
            fontWeight: 700,
            color: sev.color,
            bgcolor: `${sev.color}18`,
            border: `1px solid ${sev.color}40`,
          }}
        />
      </TableCell>
      <TableCell>
        {r.is_firing ? (
          <Chip
            label="Firing"
            size="small"
            color="error"
            sx={{ height: 20, fontSize: "0.68rem" }}
          />
        ) : (
          <Chip
            label="OK"
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 20, fontSize: "0.68rem" }}
          />
        )}
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        <RuleSoundCell
          ruleId={r.id}
          ruleSounds={ruleSounds}
          globalPreset={globalPreset}
          soundOptions={soundOptions}
          previewingKey={previewingKey}
          onPreview={onPreview}
        />
      </TableCell>
      <TableCell>
        <Switch size="small" checked={r.enabled} onChange={() => onToggle(r.id)} />
      </TableCell>
      <TableCell sx={{ px: 0.5, whiteSpace: "nowrap" }}>
        <Tooltip title="Edit rule">
          <IconButton
            size="small"
            onClick={() => onEdit(r)}
            sx={{ color: "action.active", "&:hover": { color: "primary.main" } }}
          >
            <EditOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete rule">
          <IconButton
            size="small"
            onClick={() => onDeleteRequest(r)}
            sx={{ color: "action.active", "&:hover": { color: "error.main" } }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

const RulesTable = ({
  loading,
  rules,
  filteredRules,
  ruleSounds,
  globalPreset,
  soundOptions,
  previewingKey,
  onPreview,
  onToggle,
  onEdit,
  onDeleteRequest,
  onAddClick,
}: {
  loading: boolean;
  rules: AlertRule[];
  filteredRules: AlertRule[];
  ruleSounds: Record<string, string>;
  globalPreset: string;
  soundOptions: { key: string; label: string }[];
  previewingKey: string | null;
  onPreview: (previewKey: string, soundKey: string) => void;
  onToggle: (id: number) => void;
  onEdit: (r: AlertRule) => void;
  onDeleteRequest: (r: AlertRule) => void;
  onAddClick: () => void;
}) => {
  if (loading) {
    return (
      <Box>
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length anonymous skeleton placeholders, never reordered
          <Skeleton key={i} variant="text" height={48} sx={{ mb: 0.5 }} />
        ))}
      </Box>
    );
  }
  if (rules.length === 0) {
    return (
      <Box
        sx={{
          py: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
          border: "1px dashed",
          borderColor: "divider",
        }}
      >
        <NotificationsActiveOutlinedIcon sx={{ fontSize: 40, color: "text.disabled" }} />
        <Typography color="text.secondary" variant="body2">
          No alert rules yet
        </Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAddClick}>
          Add your first rule
        </Button>
      </Box>
    );
  }
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Item</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 80 }}>
              Condition
            </TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 100 }}>
              Severity
            </TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 80 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 110 }}>Sound</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 70 }}>Active</TableCell>
            <TableCell sx={{ width: 72 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredRules.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                No rules match the current filters
              </TableCell>
            </TableRow>
          ) : (
            filteredRules.map((r) => (
              <RuleRow
                key={r.id}
                r={r}
                ruleSounds={ruleSounds}
                globalPreset={globalPreset}
                soundOptions={soundOptions}
                previewingKey={previewingKey}
                onPreview={onPreview}
                onToggle={onToggle}
                onEdit={onEdit}
                onDeleteRequest={onDeleteRequest}
              />
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const RecentFiringsSection = ({
  eventsLoading,
  events,
  filteredEvents,
}: {
  eventsLoading: boolean;
  events: AlertEvent[];
  filteredEvents: AlertEvent[];
}) => (
  <>
    <Divider sx={{ my: 3 }} />
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
      <NotificationsActiveOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
        Recent Firings
      </Typography>
      {!eventsLoading && events.length > 0 && (
        <Chip
          label={`${filteredEvents.length}${filteredEvents.length !== events.length ? ` / ${events.length}` : ""}`}
          size="small"
          sx={{ height: 18, fontSize: "0.68rem" }}
        />
      )}
    </Box>
    {eventsLoading ? (
      <Box>
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
          <Skeleton key={i} variant="text" height={40} sx={{ mb: 0.5 }} />
        ))}
      </Box>
    ) : events.length === 0 ? (
      <Box
        sx={{
          py: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed",
          borderColor: "divider",
        }}
      >
        <Typography color="text.secondary" variant="body2">
          No alert firings yet — events will appear here when rules trigger
        </Typography>
      </Box>
    ) : (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Host</TableCell>
              <TableCell>Item</TableCell>
              <TableCell>Condition</TableCell>
              <TableCell>Actual</TableCell>
              <TableCell>Severity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
                  No firings match the current filters
                </TableCell>
              </TableRow>
            ) : (
              filteredEvents.map((e) => <EventRow key={e.id} e={e} />)
            )}
          </TableBody>
        </Table>
      </TableContainer>
    )}
  </>
);

export const AlertRulesTab = () => {
  const tick = useRefreshTick();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editRule, setEditRule] = useState<AlertRule | null>(null);
  const [ruleSounds, setRuleSoundsState] = useState<Record<string, string>>(getRuleSounds);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState<AlertRule | null>(null);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "error" });
  const showToast = (message: string, sev: "success" | "error") =>
    setToast({ open: true, message, severity: sev });

  const [customSounds, setCustomSounds] = useState<CustomSound[]>([]);
  useEffect(() => {
    listSounds()
      .then(setCustomSounds)
      .catch(() => {});
  }, []);

  const [globalPreset, setGlobalPreset] = useState(
    () => localStorage.getItem(LS_SOUND_PRESET) ?? DEFAULT_PRESET,
  );
  useEffect(() => {
    const onPresetChange = () =>
      setGlobalPreset(localStorage.getItem(LS_SOUND_PRESET) ?? DEFAULT_PRESET);
    window.addEventListener(`${LS_SOUND_PRESET}Changed`, onPresetChange);
    return () => window.removeEventListener(`${LS_SOUND_PRESET}Changed`, onPresetChange);
  }, []);
  useEffect(() => {
    const onStorage = makeStorageHandler(setRuleSoundsState, setGlobalPreset);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const soundOptions = useMemo(
    () => [...BUILTIN_SOUND_OPTIONS, ...customSounds.map((s) => ({ key: s.id, label: s.name }))],
    [customSounds],
  );

  const { previewingKey, handleSoundPreview } = useSoundPreview();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [hostFilter, setHostFilter] = useState("");
  const [hosts, setHosts] = useState<Host[]>([]);

  useEffect(() => {
    api
      .listHosts()
      .then((r) => setHosts(r.hosts))
      .catch(() => {});
  }, []);

  const loadRules = useCallback(() => {
    setLoading(true);
    api
      .listAlertRules()
      .then((r) => setRules(r.rules))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleDelete = async (id: number) => {
    try {
      await api.deleteAlertRule(id);
      const updated = getRuleSounds();
      delete updated[id];
      localStorage.setItem(LS_RULE_SOUNDS, JSON.stringify(updated));
      setRuleSoundsState({ ...updated });
      loadRules();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to delete alert rule.", "error");
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.toggleAlertRule(id);
      loadRules();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to toggle alert rule.", "error");
    }
  };

  // ── Derived filter options ───────────────────────────────────────────────
  const ruleHostnames = useMemo(() => [...new Set(rules.map((r) => r.hostname))].sort(), [rules]);

  const hostToGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const h of hosts) {
      map.set(
        h.host,
        (h.groups ?? []).map((g) => g.name),
      );
    }
    return map;
  }, [hosts]);

  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const hostname of ruleHostnames) {
      for (const g of hostToGroups.get(hostname) ?? []) {
        groups.add(g);
      }
    }
    return [...groups].sort();
  }, [ruleHostnames, hostToGroups]);

  const visibleHosts = useMemo(
    () =>
      groupFilter
        ? ruleHostnames.filter((h) => (hostToGroups.get(h) ?? []).includes(groupFilter))
        : ruleHostnames,
    [groupFilter, ruleHostnames, hostToGroups],
  );

  const applyFilters = <T extends { hostname: string; item_name: string }>(items: T[]): T[] =>
    applyRuleFilters(items, { search, groupFilter, hostFilter, hostToGroups });

  // ── Fired events feed ────────────────────────────────────────────────────
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.getAlertEvents(50);
      setEvents(res.events);
    } catch {
      // silently ignore — rules table is the primary content
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      void loadEvents();
    }
  }, [tick]);

  const filteredRules = applyFilters(rules);
  const filteredEvents = applyFilters(events);

  return (
    <Box>
      <TabHeader
        title="Alert Rules"
        description="Define custom threshold rules that trigger notifications based on item values."
      />
      {/* Toolbar */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
        <TextField
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                </InputAdornment>
              ),
            },
          }}
          placeholder="Search host or item…"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel sx={{ fontSize: "0.82rem" }}>Host group</InputLabel>
          <Select
            label="Host group"
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value);
              setHostFilter("");
            }}
            sx={{ fontSize: "0.82rem" }}
          >
            <MenuItem value="">All groups</MenuItem>
            {availableGroups.map((g) => (
              <MenuItem key={g} value={g} sx={{ fontSize: "0.82rem" }}>
                {g}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel sx={{ fontSize: "0.82rem" }}>Host</InputLabel>
          <Select
            label="Host"
            value={hostFilter}
            onChange={(e) => setHostFilter(e.target.value)}
            sx={{ fontSize: "0.82rem" }}
          >
            <MenuItem value="">All hosts</MenuItem>
            {visibleHosts.map((h) => (
              <MenuItem key={h} value={h} sx={{ fontSize: "0.82rem" }}>
                {h}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {!loading && (
          <Chip
            label={`${filteredRules.length}${filteredRules.length !== rules.length ? ` / ${rules.length}` : ""}`}
            size="small"
            sx={{ height: 20, fontSize: "0.68rem", flexShrink: 0 }}
          />
        )}
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          Add rule
        </Button>
      </Stack>

      <RulesTable
        loading={loading}
        rules={rules}
        filteredRules={filteredRules}
        ruleSounds={ruleSounds}
        globalPreset={globalPreset}
        soundOptions={soundOptions}
        previewingKey={previewingKey}
        onPreview={handleSoundPreview}
        onToggle={handleToggle}
        onEdit={setEditRule}
        onDeleteRequest={setConfirmDeleteRule}
        onAddClick={() => setAddOpen(true)}
      />

      <AddRuleDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setRuleSoundsState(getRuleSounds());
          loadRules();
        }}
        showToast={showToast}
      />

      <EditRuleDialog
        rule={editRule}
        onClose={() => setEditRule(null)}
        onSaved={() => {
          setRuleSoundsState(getRuleSounds());
          loadRules();
        }}
        showToast={showToast}
        soundOptions={soundOptions}
        ruleSounds={ruleSounds}
      />

      <ConfirmDelete
        open={confirmDeleteRule !== null}
        name={confirmDeleteRule?.item_name ?? ""}
        description={
          <>
            Permanently delete alert rule for <strong>{confirmDeleteRule?.item_name}</strong> on{" "}
            <strong>{confirmDeleteRule?.hostname}</strong>? This cannot be undone.
          </>
        }
        onConfirm={async () => {
          if (confirmDeleteRule === null) {
            return;
          }
          await handleDelete(confirmDeleteRule.id);
          setConfirmDeleteRule(null);
        }}
        onClose={() => setConfirmDeleteRule(null)}
      />

      <RecentFiringsSection
        eventsLoading={eventsLoading}
        events={events}
        filteredEvents={filteredEvents}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
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
    </Box>
  );
};
