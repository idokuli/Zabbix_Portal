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
import { type AlertRule, type Host, api } from "../../app/api";
import { SearchableSelect } from "../../components/SearchableSelect";
import { type CustomSound, isCustomId, listSounds, playSoundById } from "../../lib/soundLibrary";
import { getRuleSounds } from "./shared";

export const SEV_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: "Critical", color: "#B71C1C" },
  4: { label: "High", color: "#F44336" },
  3: { label: "Medium", color: "#FF5722" },
  2: { label: "Low", color: "#FFC107" },
  1: { label: "Info", color: "#2196F3" },
  0: { label: "None", color: "#9E9E9E" },
};

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

const useSoundPreview = () => {
  const [previewingKey, setPreviewingKey] = useState<string | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleSoundPreview = (previewKey: string, soundKey: string) => {
    if (soundKey === "none") return;
    const effectiveKey =
      soundKey === "default" ? (localStorage.getItem("alertSoundPreset") ?? "beep") : soundKey;
    if (effectiveKey === "none") return;
    const stopCurrent = () => {
      if (previewCtxRef.current) {
        void previewCtxRef.current.close();
        previewCtxRef.current = null;
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
    if (previewingKey === previewKey) {
      stopCurrent();
      setPreviewingKey(null);
      return;
    }
    stopCurrent();
    setPreviewingKey(previewKey);
    if (isCustomId(effectiveKey)) {
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
    } else {
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
    if (!open) return;
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
    if (ruleType !== "service") return;
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

  const handleAdd = async () => {
    setCreating(true);
    try {
      if (ruleType === "service") {
        if (!selectedMonitor) return;
        const result = await api.createAlertRule({
          rule_type: "service",
          item_id: selectedMonitor.itemid,
          item_name: selectedMonitor.name,
          hostname: selectedMonitor.host,
          severity,
          expected_contains: expectedContains,
        });
        if (addSound !== "default") {
          const updated = getRuleSounds();
          updated[result.id] = addSound;
          localStorage.setItem("alertRuleSounds", JSON.stringify(updated));
        }
      } else {
        if (selectedItemIds.size === 0 || !selectedHost) return;
        const selectedItems = items.filter((i) => selectedItemIds.has(i.itemid));
        const allText = selectedItems.every((i) => isTextType(i.value_type));
        if (!allText && (!threshold || Number.isNaN(Number.parseFloat(threshold)))) return;
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
        if (addSound !== "default") {
          const updated = getRuleSounds();
          for (const r of results) updated[r.id] = addSound;
          localStorage.setItem("alertRuleSounds", JSON.stringify(updated));
        }
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
    if (creating) return true;
    if (ruleType === "service") return !selectedMonitor;
    if (selectedItemIds.size === 0) return true;
    const selectedItems = items.filter((i) => selectedItemIds.has(i.itemid));
    const allText =
      selectedItems.length > 0 && selectedItems.every((i) => isTextType(i.value_type));
    if (allText) return !expectedContains.trim();
    return !threshold || Number.isNaN(Number.parseFloat(threshold));
  })();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography fontWeight={700}>New Alert Rule</Typography>
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
            <FormControl size="small" fullWidth>
              <InputLabel>Host</InputLabel>
              <SearchableSelect
                label="Host"
                value={selectedHost}
                onChange={(e) => setSelectedHost(e.target.value)}
              >
                {hosts.map((h) => (
                  <MenuItem key={h.hostid} value={h.host}>
                    {h.host}
                  </MenuItem>
                ))}
              </SearchableSelect>
            </FormControl>
          )}

          {ruleType === "item" &&
            (() => {
              const selectedItems = items.filter((i) => selectedItemIds.has(i.itemid));
              const allText =
                selectedItems.length > 0 && selectedItems.every((i) => isTextType(i.value_type));
              return allText ? (
                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <FormControl size="small" sx={{ width: 160 }}>
                    <InputLabel>Match</InputLabel>
                    <Select
                      label="Match"
                      value={operator === "!contains" ? "!contains" : "contains"}
                      onChange={(e) => setOperator(e.target.value)}
                    >
                      <MenuItem value="contains">contains</MenuItem>
                      <MenuItem value="!contains">does not contain</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Text to match"
                    value={expectedContains}
                    onChange={(e) => setExpectedContains(e.target.value)}
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
                      onChange={(e) => setSeverity(Number(e.target.value))}
                    >
                      {Object.entries(SEV_LABELS)
                        .sort((a, b) => Number(b[0]) - Number(a[0]))
                        .map(([k, v]) => (
                          <MenuItem key={k} value={Number(k)}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Box
                                sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: v.color }}
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
                  operator={operator}
                  onOperatorChange={setOperator}
                  threshold={threshold}
                  onThresholdChange={setThreshold}
                  severity={severity}
                  onSeverityChange={setSeverity}
                />
              );
            })()}

          {ruleType === "service" && (
            <FormControl size="small" fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                label="Severity"
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
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
          )}

          {ruleType === "service" && (
            <TextField
              size="small"
              label="Expected response contains"
              value={expectedContains}
              onChange={(e) => setExpectedContains(e.target.value)}
              helperText="Rule fires when the response body does NOT contain this string"
              fullWidth
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

        {/* Item rule — item list */}
        {ruleType === "item" && selectedHost && (
          <>
            <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {itemsLoading
                    ? "Loading items…"
                    : `${filteredItems.length} items — ${selectedItemIds.size} selected`}
                </Typography>
                {selectedItemIds.size > 0 && (
                  <Typography
                    variant="caption"
                    sx={{ color: "primary.main", cursor: "pointer", fontSize: "0.72rem" }}
                    onClick={() => setSelectedItemIds(new Set())}
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
                onChange={(e) => setItemSearch(e.target.value)}
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
                filteredItems.map((item) => {
                  const checked = selectedItemIds.has(item.itemid);
                  return (
                    <ListItem
                      key={item.itemid}
                      onClick={() => toggleItem(item.itemid)}
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
                        onChange={() => toggleItem(item.itemid)}
                        sx={{ p: 0, mr: 1.5 }}
                      />
                      <ListItemText
                        primary={item.name}
                        secondary={item.key_}
                        primaryTypographyProps={{
                          fontSize: "0.82rem",
                          fontWeight: checked ? 600 : 400,
                        }}
                        secondaryTypographyProps={{ fontSize: "0.7rem", fontFamily: "monospace" }}
                      />
                    </ListItem>
                  );
                })
              )}
            </List>
          </>
        )}
        {ruleType === "item" && !selectedHost && (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="caption" color="text.disabled">
              Select a host to see its items
            </Typography>
          </Box>
        )}

        {/* Service rule — health monitor list */}
        {ruleType === "service" && (
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
                onChange={(e) => setMonitorSearch(e.target.value)}
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
                filteredMonitors.map((m) => {
                  const selected = selectedMonitor?.itemid === m.itemid;
                  return (
                    <ListItem
                      key={m.itemid}
                      onClick={() => {
                        setSelectedMonitor(m);
                        setExpectedContains(m.expected || "ok");
                      }}
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
                        onChange={() => {
                          setSelectedMonitor(m);
                          setExpectedContains(m.expected || "ok");
                        }}
                        sx={{ p: 0, mr: 1.5 }}
                      />
                      <ListItemText
                        primary={m.name}
                        secondary={m.host}
                        primaryTypographyProps={{
                          fontSize: "0.82rem",
                          fontWeight: selected ? 600 : 400,
                        }}
                        secondaryTypographyProps={{ fontSize: "0.7rem" }}
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
                })
              )}
            </List>
          </>
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
    if (!rule) return;
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

  const handleSave = async () => {
    if (!rule) return;
    const isTextOp = editOperator === "contains" || editOperator === "!contains";
    if (
      rule.rule_type !== "service" &&
      !isTextOp &&
      (!editThreshold || Number.isNaN(Number.parseFloat(editThreshold)))
    )
      return;
    setSaving(true);
    try {
      if (rule.rule_type === "service") {
        await api.updateAlertRule(rule.id, {
          severity: editSeverity,
          expected_contains: editExpectedContains,
        });
      } else {
        const isTextOp = editOperator === "contains" || editOperator === "!contains";
        await api.updateAlertRule(rule.id, {
          operator: editOperator,
          threshold: isTextOp ? 0 : Number.parseFloat(editThreshold),
          severity: editSeverity,
          item_id: editItemId,
          item_name: editItemName,
          hostname: editHost,
          expected_contains: isTextOp ? editExpectedContains : undefined,
        });
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
        <Typography fontWeight={700}>Edit Alert Rule</Typography>
        <IconButton size="small" aria-label="Close dialog" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {rule?.rule_type === "service" ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
                <strong>Service:</strong> {rule.item_name} ({rule.hostname})
              </Typography>
              <TextField
                size="small"
                label="Expected response contains"
                value={editExpectedContains}
                onChange={(e) => setEditExpectedContains(e.target.value)}
                helperText="Rule fires when the response body does NOT contain this string"
                fullWidth
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  label="Severity"
                  value={editSeverity}
                  onChange={(e) => setEditSeverity(Number(e.target.value))}
                >
                  {Object.entries(SEV_LABELS)
                    .sort((a, b) => Number(b[0]) - Number(a[0]))
                    .map(([k, v]) => (
                      <MenuItem key={k} value={Number(k)}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box
                            sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: v.color }}
                          />
                          {v.label}
                        </Box>
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </>
          ) : (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Host</InputLabel>
                <SearchableSelect
                  label="Host"
                  value={editHost}
                  onChange={(e) => {
                    setEditHost(e.target.value);
                    setEditItemId("");
                    setEditItemName("");
                  }}
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
                      setEditItemId(selected.itemid);
                      setEditItemName(selected.name);
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
              {(() => {
                const selItem = editItems.find((i) => i.itemid === editItemId);
                const isText = selItem
                  ? isTextType(selItem.value_type)
                  : editOperator === "contains" || editOperator === "!contains";
                return isText ? (
                  <Box sx={{ display: "flex", gap: 1.5 }}>
                    <FormControl size="small" sx={{ width: 160 }}>
                      <InputLabel>Match</InputLabel>
                      <Select
                        label="Match"
                        value={editOperator === "!contains" ? "!contains" : "contains"}
                        onChange={(e) => setEditOperator(e.target.value)}
                      >
                        <MenuItem value="contains">contains</MenuItem>
                        <MenuItem value="!contains">does not contain</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      label="Text to match"
                      value={editExpectedContains}
                      onChange={(e) => setEditExpectedContains(e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 130 }}>
                      <InputLabel>Severity</InputLabel>
                      <Select
                        label="Severity"
                        value={editSeverity}
                        onChange={(e) => setEditSeverity(Number(e.target.value))}
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
                    onOperatorChange={setEditOperator}
                    threshold={editThreshold}
                    onThresholdChange={setEditThreshold}
                    severity={editSeverity}
                    onSeverityChange={setEditSeverity}
                  />
                );
              })()}
            </>
          )}
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
