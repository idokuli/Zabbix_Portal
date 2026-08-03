"use client";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
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
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { generateId } from "../../app/utils";
import { ConfirmDelete, type Correlation, SectionHeader, StatusChip } from "./shared";

type CorrCondition = { _key: string; type: number; operator: number; tag: string; value: string };
const COND_TYPE_LABELS: Record<number, string> = {
  0: "Old event tag",
  1: "New event tag",
  2: "New event tag value",
  3: "Old event tag value",
};
const COND_OP_LABELS: Record<number, string> = {
  0: "equals",
  1: "does not equal",
  2: "contains",
  3: "does not contain",
};
const EMPTY_CONDITION: Omit<CorrCondition, "_key"> = { type: 1, operator: 0, tag: "", value: "" };
const newCondition = (): CorrCondition => ({ _key: generateId(), ...EMPTY_CONDITION });

export const CorrelationTab = ({
  showToast,
}: {
  showToast: (m: string, s: "success" | "error") => void;
}) => {
  const [items, setItems] = useState<Correlation[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Correlation | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: 0,
    evaltype: 0,
    operation_type: 0,
  });
  const [conditions, setConditions] = useState<CorrCondition[]>([newCondition()]);
  const tick = useRefreshTick();

  const resetForm = () => {
    setForm({ name: "", description: "", status: 0, evaltype: 0, operation_type: 0 });
    setConditions([newCondition()]);
  };

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const r = await api.listCorrelations();
        setItems(r.correlations);
      } catch (e) {
        showToast(e instanceof Error ? e.message : String(e), "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      void load(true);
    }
  }, [tick]);

  const onSave = async () => {
    setSaving(true);
    try {
      await api.createCorrelation({
        ...form,
        conditions: conditions.map(({ type, operator, tag, value }) => ({
          type,
          operator,
          tag,
          value,
        })),
      });
      showToast("Correlation created.", "success");
      setAddOpen(false);
      resetForm();
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await api.deleteCorrelation(deleteTarget.correlationid);
      showToast("Correlation deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const updateCond = (i: number, patch: Partial<CorrCondition>) =>
    setConditions((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  return (
    <>
      <SectionHeader
        title="Event Correlation"
        description="Define conditions under which Zabbix correlates and closes related events."
        count={items.length}
        loading={loading}
        onRefresh={load}
        onAdd={() => {
          resetForm();
          setAddOpen(true);
        }}
      />
      <TableContainer sx={{ border: "1px solid", borderColor: "divider" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Conditions</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Operations</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 60 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No correlations found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                <TableRow key={c.correlationid} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {c.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={c.status} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {c.condition_count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {c.operation_count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ maxWidth: 200, display: "block" }}
                    >
                      {c.description || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(c)}>
                        <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create correlation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.status === 0}
                    onChange={(_, v) => setForm((f) => ({ ...f, status: v ? 0 : 1 }))}
                    size="small"
                  />
                }
                label={<Typography variant="body2">Enabled</Typography>}
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Operation</InputLabel>
                <Select
                  label="Operation"
                  value={form.operation_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, operation_type: Number(e.target.value) }))
                  }
                >
                  <MenuItem value={0}>Close new event</MenuItem>
                  <MenuItem value={1}>Close old events</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <Divider />
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                Conditions
              </Typography>
              <Stack sx={{ alignItems: "center" }} direction="row" spacing={1}>
                {conditions.length > 1 && (
                  <FormControl size="small" sx={{ minWidth: 80 }}>
                    <InputLabel sx={{ fontSize: "0.75rem" }}>Match</InputLabel>
                    <Select
                      label="Match"
                      value={form.evaltype}
                      onChange={(e) => setForm((f) => ({ ...f, evaltype: Number(e.target.value) }))}
                      sx={{ fontSize: "0.78rem" }}
                    >
                      <MenuItem value={0}>AND / OR</MenuItem>
                      <MenuItem value={1}>AND</MenuItem>
                      <MenuItem value={2}>OR</MenuItem>
                    </Select>
                  </FormControl>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setConditions((cs) => [...cs, newCondition()])}
                >
                  + Add
                </Button>
              </Stack>
            </Box>
            {conditions.map((cond, i) => (
              <Box key={cond._key} sx={{ border: "1px solid", borderColor: "divider", p: 1.5 }}>
                <Stack spacing={1.5}>
                  <Stack sx={{ alignItems: "center" }} direction="row" spacing={1}>
                    <FormControl size="small" sx={{ minWidth: 170 }}>
                      <InputLabel>Type</InputLabel>
                      <Select
                        label="Type"
                        value={cond.type}
                        onChange={(e) => updateCond(i, { type: Number(e.target.value) })}
                      >
                        {Object.entries(COND_TYPE_LABELS).map(([k, v]) => (
                          <MenuItem key={k} value={Number(k)}>
                            {v}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel>Operator</InputLabel>
                      <Select
                        label="Operator"
                        value={cond.operator}
                        onChange={(e) => updateCond(i, { operator: Number(e.target.value) })}
                      >
                        {Object.entries(COND_OP_LABELS).map(([k, v]) => (
                          <MenuItem key={k} value={Number(k)}>
                            {v}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {conditions.length > 1 && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setConditions((cs) => cs.filter((_, idx) => idx !== i))}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      label="Tag name"
                      value={cond.tag}
                      onChange={(e) => updateCond(i, { tag: e.target.value })}
                      fullWidth
                      placeholder="e.g. service"
                    />
                    <TextField
                      size="small"
                      label="Tag value"
                      value={cond.value}
                      onChange={(e) => updateCond(i, { value: e.target.value })}
                      fullWidth
                      placeholder="e.g. nginx"
                    />
                  </Stack>
                </Stack>
              </Box>
            ))}
            <TextField
              size="small"
              label="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={onSave} disabled={saving || !form.name.trim()}>
            {saving ? <CircularProgress size={14} /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onConfirm={onDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
};
