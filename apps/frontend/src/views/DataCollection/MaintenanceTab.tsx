"use client";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Box,
  Button,
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
import { api } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ConfirmDelete, type HostGroup, type Maintenance, SectionHeader, fmtTs } from "./shared";

export const MaintenanceTab = ({
  showToast,
}: { showToast: (m: string, s: "success" | "error") => void }) => {
  const [items, setItems] = useState<Maintenance[]>([]);
  const [hostGroups, setHostGroups] = useState<HostGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Maintenance | null>(null);
  const tick = useRefreshTick();

  const nowIso = () => new Date(Date.now() + 60000).toISOString().slice(0, 16);
  const laterIso = () => new Date(Date.now() + 3600000).toISOString().slice(0, 16);

  const [form, setForm] = useState({
    name: "",
    maintenance_type: 0,
    active_since_str: nowIso(),
    active_till_str: laterIso(),
    groupids: [] as string[],
    description: "",
  });

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const [mr, gr] = await Promise.all([api.listMaintenances(), api.listHostGroups()]);
        setItems(mr.maintenances);
        setHostGroups(gr.groups);
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
      const since = Math.floor(new Date(form.active_since_str).getTime() / 1000);
      const till = Math.floor(new Date(form.active_till_str).getTime() / 1000);
      await api.createMaintenance({
        name: form.name,
        maintenance_type: form.maintenance_type,
        active_since: since,
        active_till: till,
        groupids: form.groupids,
        description: form.description,
      });
      showToast("Maintenance created.", "success");
      setAddOpen(false);
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
      await api.deleteMaintenance(deleteTarget.maintenanceid);
      showToast("Maintenance deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  return (
    <>
      <TabHeader
        title="Maintenance Windows"
        description="Schedule maintenance periods to suppress alerts during planned downtime."
      />
      <SectionHeader
        title="Maintenance"
        count={items.length}
        loading={loading}
        onRefresh={load}
        onAdd={() => {
          setForm({
            name: "",
            maintenance_type: 0,
            active_since_str: nowIso(),
            active_till_str: laterIso(),
            groupids: [],
            description: "",
          });
          setAddOpen(true);
        }}
      />
      <TableContainer
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1.5,
          maxHeight: 480,
          overflow: "auto",
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Active from</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Active till</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Scope</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 60 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No maintenances found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((m) => (
                <TableRow key={m.maintenanceid} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {m.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={m.maintenance_type === "0" ? "With data" : "No data"}
                      size="small"
                      variant="outlined"
                      color={m.maintenance_type === "0" ? "info" : "warning"}
                      sx={{ height: 18, fontSize: "0.62rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                      {fmtTs(m.active_since)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                      {fmtTs(m.active_till)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {[...m.hosts.map((h) => h.name), ...m.groups.map((g) => g.name)].join(", ") ||
                        "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(m)}>
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
        <DialogTitle sx={{ fontWeight: 700 }}>Create maintenance</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={form.maintenance_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maintenance_type: Number(e.target.value) }))
                }
              >
                <MenuItem value={0}>With data collection</MenuItem>
                <MenuItem value={1}>No data collection</MenuItem>
              </Select>
            </FormControl>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                size="small"
                label="Active from"
                type="datetime-local"
                value={form.active_since_str}
                onChange={(e) => setForm((f) => ({ ...f, active_since_str: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                size="small"
                label="Active till"
                type="datetime-local"
                value={form.active_till_str}
                onChange={(e) => setForm((f) => ({ ...f, active_till_str: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <FormControl size="small" fullWidth>
              <InputLabel>Host groups</InputLabel>
              <SearchableSelect
                multiple
                label="Host groups"
                value={form.groupids}
                onChange={(e) => setForm((f) => ({ ...f, groupids: e.target.value as string[] }))}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(selected as string[]).map((id) => {
                      const g = hostGroups.find((g) => g.groupid === id);
                      return (
                        <Chip key={id} label={g?.name ?? id} size="small" sx={{ height: 20 }} />
                      );
                    })}
                  </Box>
                )}
              >
                {hostGroups.map((g) => (
                  <MenuItem key={g.groupid} value={g.groupid}>
                    {g.name}
                  </MenuItem>
                ))}
              </SearchableSelect>
            </FormControl>
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
