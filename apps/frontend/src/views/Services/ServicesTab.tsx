"use client";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
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
import { SEVERITIES } from "../../app/severity";
import { ConfirmDelete } from "./shared";

const STATUS_COLOR: Record<number, string> = {
  0: "#2EA043",
  1: SEVERITIES[1].color,
  2: SEVERITIES[2].color,
  3: SEVERITIES[3].color,
  4: SEVERITIES[4].color,
  5: SEVERITIES[5].color,
  6: SEVERITIES[0].color,
};
const STATUS_LABEL: Record<number, string> = {
  0: "OK",
  1: "Info",
  2: "Warning",
  3: "Average",
  4: "High",
  5: "Disaster",
  6: "Not classified",
  [-1]: "—",
};

type Service = {
  serviceid: string;
  name: string;
  algorithm: number;
  algorithm_label: string;
  sortorder: number;
  weight: number;
  status: number;
  description: string;
  children: Array<{ serviceid: string; name: string }>;
  parents: Array<{ serviceid: string; name: string }>;
};

export const ServicesTab = ({
  showToast,
}: { showToast: (m: string, s: "success" | "error") => void }) => {
  const tick = useRefreshTick();
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [form, setForm] = useState({
    name: "",
    algorithm: 0,
    sortorder: 0,
    weight: 0,
    description: "",
  });

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const r = await api.listServices();
        setItems(r.services);
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
      if (editTarget) {
        await api.updateService(editTarget.serviceid, {
          name: form.name,
          algorithm: form.algorithm,
          description: form.description,
        });
        showToast("Service updated.", "success");
        setEditTarget(null);
      } else {
        await api.createService(form);
        showToast("Service created.", "success");
        setAddOpen(false);
        setForm({ name: "", algorithm: 0, sortorder: 0, weight: 0, description: "" });
      }
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
      await api.deleteService(deleteTarget.serviceid);
      showToast("Service deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  return (
    <>
      <TabHeader
        title="Business Services"
        description="Model and monitor high-level IT services with hierarchical health status."
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Services
          </Typography>
          {loading ? (
            <CircularProgress size={14} />
          ) : (
            <Chip label={items.length} size="small" sx={{ height: 18, fontSize: "0.62rem" }} />
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => void load()} disabled={loading}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            startIcon={<AddOutlinedIcon />}
            onClick={() => {
              setForm({ name: "", algorithm: 0, sortorder: 0, weight: 0, description: "" });
              setAddOpen(true);
            }}
          >
            Add
          </Button>
        </Stack>
      </Box>
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
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 160 }}>Algorithm</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>Children</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No services configured. Services allow you to group hosts and triggers into a
                    hierarchy with calculated status.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((s) => {
                const sColor = STATUS_COLOR[s.status] ?? "#97AAB3";
                return (
                  <TableRow key={s.serviceid} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {s.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: sColor,
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 500, whiteSpace: "nowrap" }}
                        >
                          {STATUS_LABEL[s.status] ?? "—"}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {s.algorithm_label}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {s.children.length}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ maxWidth: 200, display: "block" }}
                      >
                        {s.description || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditTarget(s);
                              setForm({
                                name: s.name,
                                algorithm: s.algorithm,
                                sortorder: s.sortorder,
                                weight: s.weight,
                                description: s.description,
                              });
                            }}
                          >
                            <EditOutlinedIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(s)}>
                            <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog
        open={addOpen || !!editTarget}
        onClose={() => {
          setAddOpen(false);
          setEditTarget(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editTarget ? "Edit service" : "Create service"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Status calculation algorithm</InputLabel>
              <Select
                label="Status calculation algorithm"
                value={form.algorithm}
                onChange={(e) => setForm((f) => ({ ...f, algorithm: Number(e.target.value) }))}
              >
                <MenuItem value={0}>Set manually</MenuItem>
                <MenuItem value={1}>Most critical of children</MenuItem>
                <MenuItem value={2}>Most critical of child problems</MenuItem>
              </Select>
            </FormControl>
            {!editTarget && (
              <Stack direction="row" spacing={2}>
                <TextField
                  size="small"
                  label="Sort order"
                  type="number"
                  value={form.sortorder}
                  onChange={(e) => setForm((f) => ({ ...f, sortorder: Number(e.target.value) }))}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Weight"
                  type="number"
                  value={form.weight}
                  onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))}
                  fullWidth
                  helperText="Used in weighted calculations"
                />
              </Stack>
            )}
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
          <Button
            onClick={() => {
              setAddOpen(false);
              setEditTarget(null);
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={onSave} disabled={saving || !form.name.trim()}>
            {saving ? <CircularProgress size={14} /> : editTarget ? "Save" : "Create"}
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
