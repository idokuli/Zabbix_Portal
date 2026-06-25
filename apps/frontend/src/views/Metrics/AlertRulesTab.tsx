"use client";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import StopOutlinedIcon from "@mui/icons-material/StopOutlined";
import VolumeOffOutlinedIcon from "@mui/icons-material/VolumeOffOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Snackbar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type AlertEvent, type AlertRule, api } from "../../app/api";
import { type CustomSound, isCustomId, listSounds, playSoundById } from "../../lib/soundLibrary";
import {
  AddRuleDialog,
  BUILTIN_SOUND_OPTIONS,
  EditRuleDialog,
  SEV_LABELS,
} from "./AlertRuleDialog";
import { getRuleSounds } from "./shared";

export const AlertRulesTab = () => {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editRule, setEditRule] = useState<AlertRule | null>(null);
  const [ruleSounds, setRuleSoundsState] = useState<Record<string, string>>(getRuleSounds);
  const [confirmDeleteRuleId, setConfirmDeleteRuleId] = useState<number | null>(null);
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
    () => localStorage.getItem("alertSoundPreset") ?? "beep",
  );
  useEffect(() => {
    const onPresetChange = () =>
      setGlobalPreset(localStorage.getItem("alertSoundPreset") ?? "beep");
    window.addEventListener("alertSoundPresetChanged", onPresetChange);
    return () => window.removeEventListener("alertSoundPresetChanged", onPresetChange);
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "alertRuleSounds") setRuleSoundsState(getRuleSounds());
      if (e.key === "alertSoundPreset")
        setGlobalPreset(localStorage.getItem("alertSoundPreset") ?? "beep");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const soundOptions = useMemo(
    () => [...BUILTIN_SOUND_OPTIONS, ...customSounds.map((s) => ({ key: s.id, label: s.name }))],
    [customSounds],
  );

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
        const BEEP = (c: AudioContext) => {
          const g = c.createGain();
          g.connect(c.destination);
          const t0 = c.currentTime;
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.35, t0 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
          const osc = c.createOscillator();
          osc.frequency.value = 740;
          osc.connect(g);
          osc.start(t0);
          osc.stop(t0 + 0.27);
        };
        const PREVIEW: Record<string, (c: AudioContext) => void> = {
          beep: (c) => BEEP(c),
          chime: (c) => {
            for (const [i, f] of [523, 659, 784].entries()) {
              const g2 = c.createGain();
              g2.connect(c.destination);
              const t = c.currentTime + i * 0.13;
              g2.gain.setValueAtTime(0, t);
              g2.gain.linearRampToValueAtTime(0.3, t + 0.01);
              g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
              const o2 = c.createOscillator();
              o2.type = "triangle";
              o2.frequency.value = f;
              o2.connect(g2);
              o2.start(t);
              o2.stop(t + 0.4);
            }
          },
          ping: (c) => {
            const g3 = c.createGain();
            g3.connect(c.destination);
            const t = c.currentTime;
            g3.gain.setValueAtTime(0, t);
            g3.gain.linearRampToValueAtTime(0.32, t + 0.01);
            g3.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
            const o3 = c.createOscillator();
            o3.type = "triangle";
            o3.frequency.value = 880;
            o3.connect(g3);
            o3.start(t);
            o3.stop(t + 0.55);
          },
          alarm: (c) => {
            for (const i of [0, 1, 2, 3]) {
              const g4 = c.createGain();
              g4.connect(c.destination);
              const t = c.currentTime + i * 0.16;
              g4.gain.setValueAtTime(0, t);
              g4.gain.linearRampToValueAtTime(0.28, t + 0.01);
              g4.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
              const o4 = c.createOscillator();
              o4.type = "square";
              o4.frequency.value = i % 2 ? 660 : 880;
              o4.connect(g4);
              o4.start(t);
              o4.stop(t + 0.18);
            }
          },
        };
        (PREVIEW[effectiveKey] ?? PREVIEW.beep)(ctx);
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
      localStorage.setItem("alertRuleSounds", JSON.stringify(updated));
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
    const t = window.setInterval(loadEvents, 30_000);
    return () => window.clearInterval(t);
  }, [loadEvents]);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <NotificationsActiveOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
          Alert Rules
        </Typography>
        {!loading && rules.length > 0 && (
          <Chip label={rules.length} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
        >
          Add rule
        </Button>
      </Box>

      {loading ? (
        <Box>
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length anonymous skeleton placeholders, never reordered
            <Skeleton key={i} variant="text" height={48} sx={{ mb: 0.5 }} />
          ))}
        </Box>
      ) : rules.length === 0 ? (
        <Box
          sx={{
            py: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <NotificationsActiveOutlinedIcon sx={{ fontSize: 40, color: "text.disabled" }} />
          <Typography color="text.secondary" variant="body2">
            No alert rules yet
          </Typography>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
          >
            Add your first rule
          </Button>
        </Box>
      ) : (
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
                <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 80 }}>
                  Status
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 110 }}>
                  Sound
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 70 }}>
                  Active
                </TableCell>
                <TableCell sx={{ width: 72 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((r) => {
                const sev = SEV_LABELS[r.severity] ?? SEV_LABELS[0];
                return (
                  <TableRow
                    key={r.id}
                    sx={{ opacity: r.enabled ? 1 : 0.5, "&:hover": { bgcolor: "action.hover" } }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: "0.8rem", fontWeight: 500 }}>
                        {r.item_name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: "0.7rem" }}
                      >
                        {r.hostname}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: "0.8rem", fontFamily: "monospace" }}
                      >
                        {r.operator} {r.threshold}
                      </Typography>
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
                      {(() => {
                        const sk = ruleSounds[r.id] ?? "default";
                        const globalLabel =
                          soundOptions.find((s) => s.key === globalPreset)?.label ??
                          globalPreset.charAt(0).toUpperCase() + globalPreset.slice(1);
                        const label =
                          sk === "default"
                            ? `Default (${globalLabel})`
                            : (soundOptions.find((s) => s.key === sk)?.label ?? sk);
                        const canPreview = sk !== "none";
                        const isPreviewing = previewingKey === `row-${r.id}`;
                        return (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                            <Tooltip
                              title={
                                isPreviewing
                                  ? "Stop preview"
                                  : canPreview
                                    ? `Preview: ${label}`
                                    : label
                              }
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={!canPreview}
                                  onClick={() => handleSoundPreview(`row-${r.id}`, sk)}
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
                            <Typography
                              variant="caption"
                              sx={{ fontSize: "0.68rem", color: "text.secondary" }}
                            >
                              {label}
                            </Typography>
                          </Box>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Switch
                        size="small"
                        checked={r.enabled}
                        onChange={() => handleToggle(r.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ px: 0.5, whiteSpace: "nowrap" }}>
                      <Tooltip title="Edit rule">
                        <IconButton
                          size="small"
                          onClick={() => setEditRule(r)}
                          sx={{ color: "action.active", "&:hover": { color: "primary.main" } }}
                        >
                          <EditOutlinedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete rule">
                        <IconButton
                          size="small"
                          onClick={() => setConfirmDeleteRuleId(r.id)}
                          sx={{ color: "action.active", "&:hover": { color: "error.main" } }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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

      <Dialog
        open={confirmDeleteRuleId !== null}
        onClose={() => setConfirmDeleteRuleId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete alert rule?</DialogTitle>
        <DialogContent>
          <Typography>
            This will permanently remove the alert rule and its sound assignment. This cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteRuleId(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (confirmDeleteRuleId === null) return;
              await handleDelete(confirmDeleteRuleId);
              setConfirmDeleteRuleId(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Recent fired events ─────────────────────────────────────────── */}
      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <NotificationsActiveOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
          Recent Firings
        </Typography>
        {!eventsLoading && events.length > 0 && (
          <Chip label={events.length} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
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
            borderRadius: 2,
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
              {events.map((e) => {
                const sev = SEV_LABELS[e.severity] ?? { label: "Unknown", color: "#888" };
                const ago = Math.floor(Date.now() / 1000) - e.fired_at;
                const agoStr =
                  ago < 60
                    ? `${ago}s ago`
                    : ago < 3600
                      ? `${Math.floor(ago / 60)}m ago`
                      : `${Math.floor(ago / 3600)}h ago`;
                return (
                  <TableRow key={e.id}>
                    <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>
                      {agoStr}
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
                      {e.hostname}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{e.item_name}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
                      {e.operator} {e.threshold}
                    </TableCell>
                    <TableCell
                      sx={{ fontFamily: "monospace", fontSize: "0.78rem", color: "error.main" }}
                    >
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
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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
