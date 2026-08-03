"use client";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import StopOutlinedIcon from "@mui/icons-material/StopOutlined";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { type AlertRule, api, type Host } from "../../app/api";
import { SEVERITIES } from "../../app/severity";
import { SearchableSelect } from "../../components/SearchableSelect";
import { type CustomSound, isCustomId, listSounds, playSoundById } from "../../lib/soundLibrary";
import { getRuleSounds } from "./shared";

export const SEV_LABELS: Record<number, { label: string; color: string }> = Object.fromEntries(
  SEVERITIES.map((s) => [s.value, { label: s.label, color: s.color }]),
);

type ItemDef2 = { itemid: string; name: string; key_: string; value_type: string };

const isTextType = (vt: string) => vt === "1" || vt === "2" || vt === "4";

type OscType = "sine" | "square" | "triangle" | "sawtooth";
const _tone = (
  ctx: AudioContext,
  opts: { freq: number; start: number; dur: number; type?: OscType; peak?: number },
) => {
  const g = ctx.createGain();
  g.connect(ctx.destination);
  const t0 = ctx.currentTime + opts.start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(opts.peak ?? 0.35, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + opts.dur);
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.value = opts.freq;
  osc.connect(g);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.05);
};

const PREVIEW_SOUNDS: Record<string, (ctx: AudioContext) => void> = {
  beep: (ctx) => {
    _tone(ctx, { freq: 740, start: 0, dur: 0.22 });
    _tone(ctx, { freq: 740, start: 0.28, dur: 0.22 });
  },
  chime: (ctx) => {
    for (const [i, f] of [523, 659, 784].entries()) {
      _tone(ctx, { freq: f, start: i * 0.13, dur: 0.35, type: "triangle", peak: 0.3 });
    }
  },
  ping: (ctx) => _tone(ctx, { freq: 880, start: 0, dur: 0.5, type: "triangle", peak: 0.32 }),
  alarm: (ctx) => {
    for (const i of [0, 1, 2, 3]) {
      _tone(ctx, {
        freq: i % 2 ? 660 : 880,
        start: i * 0.16,
        dur: 0.13,
        type: "square",
        peak: 0.28,
      });
    }
  },
};

export const BUILTIN_SOUND_OPTIONS: { key: string; label: string }[] = [
  { key: "default", label: "Default (global)" },
  { key: "none", label: "No sound" },
  { key: "beep", label: "Beep" },
  { key: "chime", label: "Chime" },
  { key: "ping", label: "Ping" },
  { key: "alarm", label: "Alarm" },
];

export const useSoundPreview = () => {
  const [previewingKey, setPreviewingKey] = useState<string | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopCurrentPreview = () => {
    if (previewCtxRef.current) {
      void previewCtxRef.current.close();
      previewCtxRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
  };

  const playCustomSound = (effectiveKey: string) => {
    playSoundById(effectiveKey)
      .then((audio) => {
        if (!audio) {
          setPreviewingKey(null);
          return;
        }
        previewAudioRef.current = audio;
        audio.onended = () => {
          previewAudioRef.current = null;
          setPreviewingKey(null);
        };
      })
      .catch(() => setPreviewingKey(null));
  };

  const playBuiltinSound = (effectiveKey: string) => {
    try {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        setPreviewingKey(null);
        return;
      }
      const ctx = new AudioCtx();
      previewCtxRef.current = ctx;
      (PREVIEW_SOUNDS[effectiveKey] ?? PREVIEW_SOUNDS.beep)(ctx);
      setTimeout(() => {
        if (previewCtxRef.current === ctx) {
          void ctx.close();
          previewCtxRef.current = null;
          setPreviewingKey(null);
        }
      }, 2000);
    } catch {
      setPreviewingKey(null);
    }
  };

  const handleSoundPreview = (previewKey: string, soundKey: string) => {
    if (soundKey === "none") {
      return;
    }
    const effectiveKey =
      soundKey === "default" ? (localStorage.getItem("alertSoundPreset") ?? "beep") : soundKey;
    if (effectiveKey === "none") {
      return;
    }
    if (previewingKey === previewKey) {
      stopCurrentPreview();
      setPreviewingKey(null);
      return;
    }
    stopCurrentPreview();
    setPreviewingKey(previewKey);
    if (isCustomId(effectiveKey)) {
      playCustomSound(effectiveKey);
    } else {
      playBuiltinSound(effectiveKey);
    }
  };

  return { previewingKey, handleSoundPreview };
};

const SoundRow = ({
  value,
  onChange,
  soundOptions,
  previewingKey,
  previewKey,
  onPreview,
}: {
  value: string;
  onChange: (v: string) => void;
  soundOptions: { key: string; label: string }[];
  previewingKey: string | null;
  previewKey: string;
  onPreview: (previewKey: string, soundKey: string) => void;
}) => (
  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
    <FormControl size="small" sx={{ flex: 1 }}>
      <InputLabel>Alert sound</InputLabel>
      <Select label="Alert sound" value={value} onChange={(e) => onChange(e.target.value)}>
        {soundOptions.map((s) => (
          <MenuItem key={s.key} value={s.key}>
            {s.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
    <Tooltip title={previewingKey === previewKey ? "Stop preview" : "Preview sound"}>
      <span>
        <IconButton
          size="small"
          disabled={value === "none"}
          onClick={() => onPreview(previewKey, value)}
          sx={{ color: previewingKey === previewKey ? "primary.main" : "text.secondary" }}
        >
          {previewingKey === previewKey ? (
            <StopOutlinedIcon sx={{ fontSize: 18 }} />
          ) : (
            <PlayArrowOutlinedIcon sx={{ fontSize: 18 }} />
          )}
        </IconButton>
      </span>
    </Tooltip>
  </Box>
);

const ConditionRow = ({
  operator,
  onOperatorChange,
  threshold,
  onThresholdChange,
  severity,
  onSeverityChange,
}: {
  operator: string;
  onOperatorChange: (v: string) => void;
  threshold: string;
  onThresholdChange: (v: string) => void;
  severity: number;
  onSeverityChange: (v: number) => void;
}) => (
  <Box sx={{ display: "flex", gap: 1.5 }}>
    <FormControl size="small" sx={{ width: 110 }}>
      <InputLabel>Operator</InputLabel>
      <Select label="Operator" value={operator} onChange={(e) => onOperatorChange(e.target.value)}>
        {([">", ">=", "<", "<="] as const).map((op) => (
          <MenuItem key={op} value={op} sx={{ fontFamily: "monospace" }}>
            {op}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
    <TextField
      size="small"
      label="Threshold"
      type="number"
      value={threshold}
      onChange={(e) => onThresholdChange(e.target.value)}
      sx={{ flex: 1 }}
      placeholder="e.g. 90"
    />
    <FormControl size="small" sx={{ minWidth: 130 }}>
      <InputLabel>Severity</InputLabel>
      <Select
        label="Severity"
        value={severity}
        onChange={(e) => onSeverityChange(Number(e.target.value))}
      >
        {Object.entries(SEV_LABELS)
          .sort((a, b) => Number(b[0]) - Number(a[0]))
          .map(([k, v]) => (
            <MenuItem key={k} value={Number(k)}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: v.color }} />
                {v.label}
              </Box>
            </MenuItem>
          ))}
      </Select>
    </FormControl>
  </Box>
);

type HealthMonitor = {
  itemid: string;
  name: string;
  host: string;
  hostid: string;
  expected: string;
  working: boolean;
};

const ItemRuleFields = ({
  items,
  selectedItemIds,
  operator,
  onOperatorChange,
  expectedContains,
  onExpectedContainsChange,
  threshold,
  onThresholdChange,
  severity,
  onSeverityChange,
}: {
  items: ItemDef2[];
  selectedItemIds: Set<string>;
  operator: string;
  onOperatorChange: (v: string) => void;
  expectedContains: string;
  onExpectedContainsChange: (v: string) => void;
  threshold: string;
  onThresholdChange: (v: string) => void;
  severity: number;
  onSeverityChange: (v: number) => void;
}) => {
  const selectedItems = items.filter((i) => selectedItemIds.has(i.itemid));
  const allText = selectedItems.length > 0 && selectedItems.every((i) => isTextType(i.value_type));

  if (!allText) {
    return (
      <ConditionRow
        operator={operator}
        onOperatorChange={onOperatorChange}
        threshold={threshold}
        onThresholdChange={onThresholdChange}
        severity={severity}
        onSeverityChange={onSeverityChange}
      />
    );
  }

  return (
    <Box sx={{ display: "flex", gap: 1.5 }}>
      <FormControl size="small" sx={{ width: 160 }}>
        <InputLabel>Match</InputLabel>
        <Select
          label="Match"
          value={operator === "!contains" ? "!contains" : "contains"}
          onChange={(e) => onOperatorChange(e.target.value)}
        >
          <MenuItem value="contains">contains</MenuItem>
          <MenuItem value="!contains">does not contain</MenuItem>
        </Select>
      </FormControl>
      <TextField
        size="small"
        label="Text to match"
        value={expectedContains}
        onChange={(e) => onExpectedContainsChange(e.target.value)}
        sx={{ flex: 1 }}
        placeholder="e.g. ERROR"
        helperText={
          operator === "contains"
            ? "Fires when value contains this text"
            : "Fires when value does not contain this text"
        }
      />
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>Severity</InputLabel>
        <Select
          label="Severity"
          value={severity}
          onChange={(e) => onSeverityChange(Number(e.target.value))}
        >
          {Object.entries(SEV_LABELS)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([k, v]) => (
              <MenuItem key={k} value={Number(k)}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: v.color }} />
                  {v.label}
                </Box>
              </MenuItem>
            ))}
        </Select>
      </FormControl>
    </Box>
  );
};

const ItemListItem = ({
  item,
  checked,
  onToggle,
}: {
  item: ItemDef2;
  checked: boolean;
  onToggle: (itemid: string) => void;
}) => (
  <ListItem
    onClick={() => onToggle(item.itemid)}
    sx={{
      cursor: "pointer",
      px: 2,
      bgcolor: checked ? "rgba(59,130,246,0.07)" : "transparent",
      "&:hover": { bgcolor: checked ? "rgba(59,130,246,0.1)" : "action.hover" },
    }}
  >
    <Checkbox
      edge="start"
      size="small"
      checked={checked}
      disableRipple
      onChange={() => onToggle(item.itemid)}
      sx={{ p: 0, mr: 1.5 }}
    />
    <ListItemText
      slotProps={{
        primary: {
          sx: { fontSize: "0.82rem", fontWeight: checked ? 600 : 400 },
        },
        secondary: { sx: { fontSize: "0.7rem", fontFamily: "monospace" } },
      }}
      primary={item.name}
      secondary={item.key_}
    />
  </ListItem>
);

const MonitorListItem = ({
  m,
  selected,
  onSelect,
}: {
  m: HealthMonitor;
  selected: boolean;
  onSelect: (m: HealthMonitor) => void;
}) => (
  <ListItem
    onClick={() => onSelect(m)}
    sx={{
      cursor: "pointer",
      px: 2,
      bgcolor: selected ? "rgba(59,130,246,0.07)" : "transparent",
      "&:hover": { bgcolor: selected ? "rgba(59,130,246,0.1)" : "action.hover" },
    }}
  >
    <Checkbox
      edge="start"
      size="small"
      checked={selected}
      disableRipple
      onChange={() => onSelect(m)}
      sx={{ p: 0, mr: 1.5 }}
    />
    <ListItemText
      slotProps={{
        primary: {
          sx: { fontSize: "0.82rem", fontWeight: selected ? 600 : 400 },
        },
        secondary: { sx: { fontSize: "0.7rem" } },
      }}
      primary={m.name}
      secondary={m.host}
    />
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        bgcolor: m.working ? "success.main" : "error.main",
        flexShrink: 0,
      }}
    />
  </ListItem>
);

const ItemRuleTopFields = ({
  hosts,
  selectedHost,
  onHostChange,
  items,
  selectedItemIds,
  operator,
  onOperatorChange,
  expectedContains,
  onExpectedContainsChange,
  threshold,
  onThresholdChange,
  severity,
  onSeverityChange,
}: {
  hosts: Host[];
  selectedHost: string;
  onHostChange: (v: string) => void;
  items: ItemDef2[];
  selectedItemIds: Set<string>;
  operator: string;
  onOperatorChange: (v: string) => void;
  expectedContains: string;
  onExpectedContainsChange: (v: string) => void;
  threshold: string;
  onThresholdChange: (v: string) => void;
  severity: number;
  onSeverityChange: (v: number) => void;
}) => (
  <>
    <FormControl size="small" fullWidth>
      <InputLabel>Host</InputLabel>
      <SearchableSelect
        label="Host"
        value={selectedHost}
        onChange={(e) => onHostChange(e.target.value)}
      >
        {hosts.map((h) => (
          <MenuItem key={h.hostid} value={h.host}>
            {h.host}
          </MenuItem>
        ))}
      </SearchableSelect>
    </FormControl>
    <ItemRuleFields
      items={items}
      selectedItemIds={selectedItemIds}
      operator={operator}
      onOperatorChange={onOperatorChange}
      expectedContains={expectedContains}
      onExpectedContainsChange={onExpectedContainsChange}
      threshold={threshold}
      onThresholdChange={onThresholdChange}
      severity={severity}
      onSeverityChange={onSeverityChange}
    />
  </>
);

const ServiceRuleTopFields = ({
  severity,
  onSeverityChange,
  expectedContains,
  onExpectedContainsChange,
}: {
  severity: number;
  onSeverityChange: (v: number) => void;
  expectedContains: string;
  onExpectedContainsChange: (v: string) => void;
}) => (
  <>
    <FormControl size="small" fullWidth>
      <InputLabel>Severity</InputLabel>
      <Select
        label="Severity"
        value={severity}
        onChange={(e) => onSeverityChange(Number(e.target.value))}
      >
        {Object.entries(SEV_LABELS)
          .sort((a, b) => Number(b[0]) - Number(a[0]))
          .map(([k, v]) => (
            <MenuItem key={k} value={Number(k)}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: v.color }} />
                {v.label}
              </Box>
            </MenuItem>
          ))}
      </Select>
    </FormControl>
    <TextField
      size="small"
      label="Expected response contains"
      value={expectedContains}
      onChange={(e) => onExpectedContainsChange(e.target.value)}
      helperText="Rule fires when the response body does NOT contain this string"
      fullWidth
    />
  </>
);

const ItemRuleListSection = ({
  selectedHost,
  itemsLoading,
  filteredItems,
  selectedItemIds,
  onClearSelection,
  itemSearch,
  onItemSearchChange,
  onToggleItem,
}: {
  selectedHost: string;
  itemsLoading: boolean;
  filteredItems: ItemDef2[];
  selectedItemIds: Set<string>;
  onClearSelection: () => void;
  itemSearch: string;
  onItemSearchChange: (v: string) => void;
  onToggleItem: (itemid: string) => void;
}) => {
  if (!selectedHost) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography variant="caption" color="text.disabled">
          Select a host to see its items
        </Typography>
      </Box>
    );
  }
  return (
    <>
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {itemsLoading
              ? "Loading items…"
              : `${filteredItems.length} items — ${selectedItemIds.size} selected`}
          </Typography>
          {selectedItemIds.size > 0 && (
            <Typography
              variant="caption"
              sx={{ color: "primary.main", cursor: "pointer", fontSize: "0.72rem" }}
              onClick={onClearSelection}
            >
              Clear selection
            </Typography>
          )}
        </Box>
        <TextField
          size="small"
          fullWidth
          placeholder="Search items…"
          value={itemSearch}
          onChange={(e) => onItemSearchChange(e.target.value)}
          disabled={itemsLoading}
        />
      </Box>
      <List dense disablePadding sx={{ maxHeight: 280, overflowY: "auto", pb: 1 }}>
        {itemsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <Box key={i} sx={{ px: 2, py: 0.5 }}>
              <Skeleton variant="text" height={36} />
            </Box>
          ))
        ) : filteredItems.length === 0 ? (
          <Box sx={{ py: 3, textAlign: "center" }}>
            <Typography variant="caption" color="text.disabled">
              No numeric items found
            </Typography>
          </Box>
        ) : (
          filteredItems.map((item) => (
            <ItemListItem
              key={item.itemid}
              item={item}
              checked={selectedItemIds.has(item.itemid)}
              onToggle={onToggleItem}
            />
          ))
        )}
      </List>
    </>
  );
};

const ServiceRuleListSection = ({
  monitorsLoading,
  filteredMonitors,
  selectedMonitor,
  monitorSearch,
  onMonitorSearchChange,
  onSelectMonitor,
}: {
  monitorsLoading: boolean;
  filteredMonitors: HealthMonitor[];
  selectedMonitor: HealthMonitor | null;
  monitorSearch: string;
  onMonitorSearchChange: (v: string) => void;
  onSelectMonitor: (m: HealthMonitor) => void;
}) => (
  <>
    <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600, display: "block", mb: 1 }}
      >
        {monitorsLoading
          ? "Loading health monitors…"
          : `${filteredMonitors.length} health monitors`}
      </Typography>
      <TextField
        size="small"
        fullWidth
        placeholder="Search monitors…"
        value={monitorSearch}
        onChange={(e) => onMonitorSearchChange(e.target.value)}
        disabled={monitorsLoading}
      />
    </Box>
    <List dense disablePadding sx={{ maxHeight: 280, overflowY: "auto", pb: 1 }}>
      {monitorsLoading ? (
        Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          <Box key={i} sx={{ px: 2, py: 0.5 }}>
            <Skeleton variant="text" height={36} />
          </Box>
        ))
      ) : filteredMonitors.length === 0 ? (
        <Box sx={{ py: 3, textAlign: "center" }}>
          <Typography variant="caption" color="text.disabled">
            No health monitors found
          </Typography>
        </Box>
      ) : (
        filteredMonitors.map((m) => (
          <MonitorListItem
            key={m.itemid}
            m={m}
            selected={selectedMonitor?.itemid === m.itemid}
            onSelect={onSelectMonitor}
          />
        ))
      )}
    </List>
  </>
);

export const AddRuleDialog = ({
  open,
  onClose,
  onCreated,
  showToast,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  showToast: (msg: string, sev: "success" | "error") => void;
}) => {
  const [ruleType, setRuleType] = useState<"item" | "service">("item");

  // item rule state
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedHost, setSelectedHost] = useState("");
  const [items, setItems] = useState<ItemDef2[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [itemSearch, setItemSearch] = useState("");
  const [operator, setOperator] = useState(">");
  const [threshold, setThreshold] = useState("");

  // service rule state
  const [monitors, setMonitors] = useState<HealthMonitor[]>([]);
  const [monitorsLoading, setMonitorsLoading] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<HealthMonitor | null>(null);
  const [expectedContains, setExpectedContains] = useState("ok");
  const [monitorSearch, setMonitorSearch] = useState("");

  const [severity, setSeverity] = useState(2);
  const [addSound, setAddSound] = useState("default");
  const [creating, setCreating] = useState(false);
  const [customSounds, setCustomSounds] = useState<CustomSound[]>([]);
  const { previewingKey, handleSoundPreview } = useSoundPreview();

  const soundOptions = useMemo(
    () => [...BUILTIN_SOUND_OPTIONS, ...customSounds.map((s) => ({ key: s.id, label: s.name }))],
    [customSounds],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    listSounds()
      .then(setCustomSounds)
      .catch(() => {});
    setRuleType("item");
    setSelectedHost("");
    setItems([]);
    setSelectedItemIds(new Set());
    setItemSearch("");
    setOperator(">");
    setThreshold("");
    setSelectedMonitor(null);
    setMonitorSearch("");
    setExpectedContains("ok");
    setSeverity(2);
    setAddSound("default");
    api
      .listHosts()
      .then((r) => setHosts(r.hosts))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (ruleType !== "service") {
      return;
    }
    setMonitorsLoading(true);
    api
      .listHealthMonitors()
      .then((r) => setMonitors(r.monitors as HealthMonitor[]))
      .catch(() => setMonitors([]))
      .finally(() => setMonitorsLoading(false));
  }, [ruleType]);

  useEffect(() => {
    if (!selectedHost) {
      setItems([]);
      setSelectedItemIds(new Set());
      return;
    }
    setItemsLoading(true);
    api
      .listItems(selectedHost, true)
      .then((r) => {
        setItems(r.items as ItemDef2[]);
        setSelectedItemIds(new Set());
      })
      .catch(() => setItems([]))
      .finally(() => setItemsLoading(false));
  }, [selectedHost]);

  const toggleItem = (itemid: string) =>
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.has(itemid) ? next.delete(itemid) : next.add(itemid);
      return next;
    });

  const filteredItems = items.filter(
    (i) =>
      i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      i.key_.toLowerCase().includes(itemSearch.toLowerCase()),
  );

  const filteredMonitors = monitors.filter(
    (m) =>
      m.name.toLowerCase().includes(monitorSearch.toLowerCase()) ||
      m.host.toLowerCase().includes(monitorSearch.toLowerCase()),
  );

  const persistRuleSound = (ruleId: number, soundKey: string) => {
    if (soundKey === "default") {
      return;
    }
    const updated = getRuleSounds();
    updated[ruleId] = soundKey;
    localStorage.setItem("alertRuleSounds", JSON.stringify(updated));
  };

  const persistRuleSounds = (ruleIds: number[], soundKey: string) => {
    if (soundKey === "default") {
      return;
    }
    const updated = getRuleSounds();
    for (const id of ruleIds) {
      updated[id] = soundKey;
    }
    localStorage.setItem("alertRuleSounds", JSON.stringify(updated));
  };

  const addServiceRule = async () => {
    if (!selectedMonitor) {
      return false;
    }
    const result = await api.createAlertRule({
      rule_type: "service",
      item_id: selectedMonitor.itemid,
      item_name: selectedMonitor.name,
      hostname: selectedMonitor.host,
      severity,
      expected_contains: expectedContains,
    });
    persistRuleSound(result.id, addSound);
    return true;
  };

  const addItemRule = async () => {
    if (selectedItemIds.size === 0 || !selectedHost) {
      return false;
    }
    const selectedItems = items.filter((i) => selectedItemIds.has(i.itemid));
    const allText = selectedItems.every((i) => isTextType(i.value_type));
    if (!allText && (!threshold || Number.isNaN(Number.parseFloat(threshold)))) {
      return false;
    }
    const results = await Promise.all(
      selectedItems.map((i) =>
        api.createAlertRule(
          isTextType(i.value_type)
            ? {
                rule_type: "item",
                item_id: i.itemid,
                item_name: i.name,
                hostname: selectedHost,
                operator: operator === "!contains" ? "!contains" : "contains",
                severity,
                expected_contains: expectedContains,
              }
            : {
                rule_type: "item",
                item_id: i.itemid,
                item_name: i.name,
                hostname: selectedHost,
                operator,
                threshold: Number.parseFloat(threshold),
                severity,
              },
        ),
      ),
    );
    persistRuleSounds(
      results.map((r) => r.id),
      addSound,
    );
    return true;
  };

  const handleAdd = async () => {
    setCreating(true);
    try {
      const created = ruleType === "service" ? await addServiceRule() : await addItemRule();
      if (!created) {
        return;
      }
      onCreated();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to create alert rule.", "error");
    } finally {
      setCreating(false);
    }
  };

  const addDisabled = (() => {
    if (creating) {
      return true;
    }
    if (ruleType === "service") {
      return !selectedMonitor;
    }
    if (selectedItemIds.size === 0) {
      return true;
    }
    const selectedItems = items.filter((i) => selectedItemIds.has(i.itemid));
    const allText =
      selectedItems.length > 0 && selectedItems.every((i) => isTextType(i.value_type));
    if (allText) {
      return !expectedContains.trim();
    }
    return !threshold || Number.isNaN(Number.parseFloat(threshold));
  })();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 700 }}>New Alert Rule</Typography>
        <IconButton size="small" aria-label="Close dialog" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2 }}>
          {/* Rule type toggle */}
          <Box sx={{ display: "flex", gap: 1 }}>
            {(["item", "service"] as const).map((t) => (
              <Button
                key={t}
                size="small"
                variant={ruleType === t ? "contained" : "outlined"}
                onClick={() => setRuleType(t)}
                sx={{ textTransform: "none", minWidth: 120 }}
              >
                {t === "item" ? "Item threshold" : "Service health"}
              </Button>
            ))}
          </Box>

          {ruleType === "item" && (
            <ItemRuleTopFields
              hosts={hosts}
              selectedHost={selectedHost}
              onHostChange={setSelectedHost}
              items={items}
              selectedItemIds={selectedItemIds}
              operator={operator}
              onOperatorChange={setOperator}
              expectedContains={expectedContains}
              onExpectedContainsChange={setExpectedContains}
              threshold={threshold}
              onThresholdChange={setThreshold}
              severity={severity}
              onSeverityChange={setSeverity}
            />
          )}

          {ruleType === "service" && (
            <ServiceRuleTopFields
              severity={severity}
              onSeverityChange={setSeverity}
              expectedContains={expectedContains}
              onExpectedContainsChange={setExpectedContains}
            />
          )}

          <SoundRow
            value={addSound}
            onChange={setAddSound}
            soundOptions={soundOptions}
            previewingKey={previewingKey}
            previewKey="add"
            onPreview={handleSoundPreview}
          />
        </Box>
        <Divider />

        {ruleType === "item" && (
          <ItemRuleListSection
            selectedHost={selectedHost}
            itemsLoading={itemsLoading}
            filteredItems={filteredItems}
            selectedItemIds={selectedItemIds}
            onClearSelection={() => setSelectedItemIds(new Set())}
            itemSearch={itemSearch}
            onItemSearchChange={setItemSearch}
            onToggleItem={toggleItem}
          />
        )}

        {ruleType === "service" && (
          <ServiceRuleListSection
            monitorsLoading={monitorsLoading}
            filteredMonitors={filteredMonitors}
            selectedMonitor={selectedMonitor}
            monitorSearch={monitorSearch}
            onMonitorSearchChange={setMonitorSearch}
            onSelectMonitor={(monitor) => {
              setSelectedMonitor(monitor);
              setExpectedContains(monitor.expected || "ok");
            }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={addDisabled}>
          {creating ? "Creating…" : "Create rule"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const EditRuleFields = ({
  rule,
  hosts,
  editHost,
  onHostChange,
  editItemId,
  onItemChange,
  editItems,
  editItemsLoading,
  editOperator,
  onOperatorChange,
  editThreshold,
  onThresholdChange,
  editSeverity,
  onSeverityChange,
  editExpectedContains,
  onExpectedContainsChange,
}: {
  rule: AlertRule | null;
  hosts: Host[];
  editHost: string;
  onHostChange: (v: string) => void;
  editItemId: string;
  onItemChange: (itemid: string, name: string) => void;
  editItems: ItemDef2[];
  editItemsLoading: boolean;
  editOperator: string;
  onOperatorChange: (v: string) => void;
  editThreshold: string;
  onThresholdChange: (v: string) => void;
  editSeverity: number;
  onSeverityChange: (v: number) => void;
  editExpectedContains: string;
  onExpectedContainsChange: (v: string) => void;
}) => {
  if (rule?.rule_type === "service") {
    return (
      <>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
          <strong>Service:</strong> {rule.item_name} ({rule.hostname})
        </Typography>
        <TextField
          size="small"
          label="Expected response contains"
          value={editExpectedContains}
          onChange={(e) => onExpectedContainsChange(e.target.value)}
          helperText="Rule fires when the response body does NOT contain this string"
          fullWidth
        />
        <FormControl size="small" fullWidth>
          <InputLabel>Severity</InputLabel>
          <Select
            label="Severity"
            value={editSeverity}
            onChange={(e) => onSeverityChange(Number(e.target.value))}
          >
            {Object.entries(SEV_LABELS)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([k, v]) => (
                <MenuItem key={k} value={Number(k)}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: v.color }} />
                    {v.label}
                  </Box>
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </>
    );
  }

  const selItem = editItems.find((i) => i.itemid === editItemId);
  const isText = selItem
    ? isTextType(selItem.value_type)
    : editOperator === "contains" || editOperator === "!contains";

  return (
    <>
      <FormControl size="small" fullWidth>
        <InputLabel>Host</InputLabel>
        <SearchableSelect
          label="Host"
          value={editHost}
          onChange={(e) => onHostChange(e.target.value)}
        >
          {hosts.map((h) => (
            <MenuItem key={h.hostid} value={h.host}>
              {h.host}
            </MenuItem>
          ))}
        </SearchableSelect>
      </FormControl>
      <FormControl size="small" fullWidth disabled={!editHost || editItemsLoading}>
        <InputLabel>{editItemsLoading ? "Loading…" : "Item"}</InputLabel>
        <SearchableSelect
          label={editItemsLoading ? "Loading…" : "Item"}
          value={editItemId}
          onChange={(e) => {
            const selected = editItems.find((i) => i.itemid === e.target.value);
            if (selected) {
              onItemChange(selected.itemid, selected.name);
            }
          }}
        >
          {editItems.map((i) => (
            <MenuItem key={i.itemid} value={i.itemid}>
              <Box>
                <Typography sx={{ fontSize: "0.82rem" }}>{i.name}</Typography>
                <Typography
                  sx={{
                    fontSize: "0.7rem",
                    color: "text.secondary",
                    fontFamily: "monospace",
                  }}
                >
                  {i.key_}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </SearchableSelect>
      </FormControl>
      {isText ? (
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <FormControl size="small" sx={{ width: 160 }}>
            <InputLabel>Match</InputLabel>
            <Select
              label="Match"
              value={editOperator === "!contains" ? "!contains" : "contains"}
              onChange={(e) => onOperatorChange(e.target.value)}
            >
              <MenuItem value="contains">contains</MenuItem>
              <MenuItem value="!contains">does not contain</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Text to match"
            value={editExpectedContains}
            onChange={(e) => onExpectedContainsChange(e.target.value)}
            sx={{ flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Severity</InputLabel>
            <Select
              label="Severity"
              value={editSeverity}
              onChange={(e) => onSeverityChange(Number(e.target.value))}
            >
              {Object.entries(SEV_LABELS)
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([k, v]) => (
                  <MenuItem key={k} value={Number(k)}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          bgcolor: v.color,
                        }}
                      />
                      {v.label}
                    </Box>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </Box>
      ) : (
        <ConditionRow
          operator={editOperator}
          onOperatorChange={onOperatorChange}
          threshold={editThreshold}
          onThresholdChange={onThresholdChange}
          severity={editSeverity}
          onSeverityChange={onSeverityChange}
        />
      )}
    </>
  );
};

export const EditRuleDialog = ({
  rule,
  onClose,
  onSaved,
  showToast,
  soundOptions,
  ruleSounds,
}: {
  rule: AlertRule | null;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, sev: "success" | "error") => void;
  soundOptions: { key: string; label: string }[];
  ruleSounds: Record<string, string>;
}) => {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [editHost, setEditHost] = useState("");
  const [editItemId, setEditItemId] = useState("");
  const [editItemName, setEditItemName] = useState("");
  const [editItems, setEditItems] = useState<ItemDef2[]>([]);
  const [editItemsLoading, setEditItemsLoading] = useState(false);
  const [editOperator, setEditOperator] = useState(">");
  const [editThreshold, setEditThreshold] = useState("");
  const [editSeverity, setEditSeverity] = useState(2);
  const [editSound, setEditSound] = useState("default");
  const [saving, setSaving] = useState(false);
  const { previewingKey, handleSoundPreview } = useSoundPreview();

  const [editExpectedContains, setEditExpectedContains] = useState("ok");

  useEffect(() => {
    if (!rule) {
      return;
    }
    if (rule.rule_type !== "service") {
      api
        .listHosts()
        .then((r) => setHosts(r.hosts))
        .catch(() => {});
    }
    setEditOperator(rule.operator);
    setEditThreshold(String(rule.threshold));
    setEditSeverity(rule.severity);
    setEditSound(ruleSounds[rule.id] ?? "default");
    setEditHost(rule.hostname);
    setEditItemId(rule.item_id);
    setEditItemName(rule.item_name);
    setEditExpectedContains(rule.expected_contains ?? "ok");
  }, [rule, ruleSounds]);

  useEffect(() => {
    if (!editHost) {
      setEditItems([]);
      return;
    }
    setEditItemsLoading(true);
    api
      .listItems(editHost, true)
      .then((r) => setEditItems(r.items as ItemDef2[]))
      .catch(() => {})
      .finally(() => setEditItemsLoading(false));
  }, [editHost]);

  const setRuleSound = (ruleId: number, soundKey: string) => {
    const sounds = getRuleSounds();
    if (soundKey === "default") {
      delete sounds[ruleId];
    } else {
      sounds[ruleId] = soundKey;
    }
    localStorage.setItem("alertRuleSounds", JSON.stringify(sounds));
  };

  const canSaveEdit = (r: AlertRule) => {
    const isTextOp = editOperator === "contains" || editOperator === "!contains";
    return (
      r.rule_type === "service" ||
      isTextOp ||
      (!!editThreshold && !Number.isNaN(Number.parseFloat(editThreshold)))
    );
  };

  const updateServiceRule = (r: AlertRule) =>
    api.updateAlertRule(r.id, {
      severity: editSeverity,
      expected_contains: editExpectedContains,
    });

  const updateItemRule = (r: AlertRule) => {
    const isTextOp = editOperator === "contains" || editOperator === "!contains";
    return api.updateAlertRule(r.id, {
      operator: editOperator,
      threshold: isTextOp ? 0 : Number.parseFloat(editThreshold),
      severity: editSeverity,
      item_id: editItemId,
      item_name: editItemName,
      hostname: editHost,
      expected_contains: isTextOp ? editExpectedContains : undefined,
    });
  };

  const handleSave = async () => {
    if (!(rule && canSaveEdit(rule))) {
      return;
    }
    setSaving(true);
    try {
      if (rule.rule_type === "service") {
        await updateServiceRule(rule);
      } else {
        await updateItemRule(rule);
      }
      setRuleSound(rule.id, editSound);
      onSaved();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save alert rule.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!rule} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 700 }}>Edit Alert Rule</Typography>
        <IconButton size="small" aria-label="Close dialog" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <EditRuleFields
            rule={rule}
            hosts={hosts}
            editHost={editHost}
            onHostChange={(v) => {
              setEditHost(v);
              setEditItemId("");
              setEditItemName("");
            }}
            editItemId={editItemId}
            onItemChange={(itemid, name) => {
              setEditItemId(itemid);
              setEditItemName(name);
            }}
            editItems={editItems}
            editItemsLoading={editItemsLoading}
            editOperator={editOperator}
            onOperatorChange={setEditOperator}
            editThreshold={editThreshold}
            onThresholdChange={setEditThreshold}
            editSeverity={editSeverity}
            onSeverityChange={setEditSeverity}
            editExpectedContains={editExpectedContains}
            onExpectedContainsChange={setEditExpectedContains}
          />
          <SoundRow
            value={editSound}
            onChange={setEditSound}
            soundOptions={soundOptions}
            previewingKey={previewingKey}
            previewKey="edit"
            onPreview={handleSoundPreview}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={
            saving ||
            (rule?.rule_type !== "service" &&
              editOperator !== "contains" &&
              editOperator !== "!contains" &&
              (!editThreshold || Number.isNaN(Number.parseFloat(editThreshold))))
          }
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
