"use client";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ToggleOffOutlinedIcon from "@mui/icons-material/ToggleOffOutlined";
import ToggleOnOutlinedIcon from "@mui/icons-material/ToggleOnOutlined";
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
import { ConfirmDelete, StatusChip } from "./shared";

// ── Media Types ───────────────────────────────────────────────────────

type MediaType = {
  mediatypeid: string;
  name: string;
  type: number;
  type_label: string;
  status: number;
  description: string;
};

export const MediaTypesTab = ({
  showToast,
}: { showToast: (m: string, s: "success" | "error") => void }) => {
  const tick = useRefreshTick();
  const [items, setItems] = useState<MediaType[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaType | null>(null);
  const [editTarget, setEditTarget] = useState<MediaType | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    type: 0,
    description: "",
    smtp_server: "",
    smtp_email: "",
    script: "",
    webhook_script: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: 0,
    description: "",
    smtp_server: "",
    smtp_email: "",
    script: "",
    webhook_script: "",
  });

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const r = await api.listMediaTypes();
        setItems(r.media_types);
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
      await api.createMediaType(form);
      showToast("Media type created.", "success");
      setAddOpen(false);
      setForm({
        name: "",
        type: 0,
        description: "",
        smtp_server: "",
        smtp_email: "",
        script: "",
        webhook_script: "",
      });
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };
  const openEdit = (m: MediaType) => {
    setEditTarget(m);
    setEditForm({
      name: m.name,
      type: m.type,
      description: m.description,
      smtp_server: "",
      smtp_email: "",
      script: "",
      webhook_script: "",
    });
  };

  const onEditSave = async () => {
    if (!editTarget) {
      return;
    }
    setEditSaving(true);
    try {
      await api.updateMediaType(editTarget.mediatypeid, editForm);
      showToast("Media type updated.", "success");
      setEditTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setEditSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await api.deleteMediaType(deleteTarget.mediatypeid);
      showToast("Media type deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };
  const onToggle = async (m: MediaType) => {
    try {
      await api.toggleMediaType(m.mediatypeid, m.status === 0 ? 1 : 0);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const TYPE_ICONS: Record<number, string> = {
    0: "📧",
    1: "💬",
    2: "📜",
    4: "🔗",
    5: "💼",
    6: "💬",
  };

  return (
    <>
      <TabHeader
        title="Media Types"
        description="Notification channels — email, SMS, webhooks — used to deliver action alerts."
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Media Types
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
            onClick={() => setAddOpen(true)}
          >
            Add
          </Button>
        </Stack>
      </Box>
      <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 110 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No media types found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((m) => (
                <TableRow key={m.mediatypeid} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {m.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {TYPE_ICONS[m.type] ?? "📦"} {m.type_label}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={m.status} />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ maxWidth: 240, display: "block" }}
                    >
                      {m.description || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title={m.status === 0 ? "Disable" : "Enable"}>
                        <IconButton size="small" onClick={() => onToggle(m)}>
                          {m.status === 0 ? (
                            <ToggleOnOutlinedIcon sx={{ fontSize: 16, color: "success.main" }} />
                          ) : (
                            <ToggleOffOutlinedIcon sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(m)}>
                          <EditOutlinedIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(m)}>
                          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create media type</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Type *</InputLabel>
              <Select
                label="Type *"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: Number(e.target.value) }))}
              >
                <MenuItem value={0}>Email</MenuItem>
                <MenuItem value={2}>Script</MenuItem>
                <MenuItem value={4}>Webhook</MenuItem>
              </Select>
            </FormControl>
            {form.type === 0 && (
              <>
                <TextField
                  size="small"
                  label="SMTP server"
                  value={form.smtp_server}
                  onChange={(e) => setForm((f) => ({ ...f, smtp_server: e.target.value }))}
                />
                <TextField
                  size="small"
                  label="SMTP email (from)"
                  value={form.smtp_email}
                  onChange={(e) => setForm((f) => ({ ...f, smtp_email: e.target.value }))}
                />
              </>
            )}
            {form.type === 2 && (
              <TextField
                size="small"
                label="Script path"
                value={form.script}
                onChange={(e) => setForm((f) => ({ ...f, script: e.target.value }))}
                placeholder="/usr/local/bin/notify.sh"
              />
            )}
            {form.type === 4 && (
              <TextField
                size="small"
                label="Webhook script"
                value={form.webhook_script}
                onChange={(e) => setForm((f) => ({ ...f, webhook_script: e.target.value }))}
                multiline
                rows={3}
                placeholder="var params = JSON.parse(value); ..."
              />
            )}
            <TextField
              size="small"
              label="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit media type — {editTarget?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Name *"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Type *</InputLabel>
              <Select
                label="Type *"
                value={editForm.type}
                onChange={(e) => setEditForm((f) => ({ ...f, type: Number(e.target.value) }))}
              >
                <MenuItem value={0}>Email</MenuItem>
                <MenuItem value={2}>Script</MenuItem>
                <MenuItem value={4}>Webhook</MenuItem>
              </Select>
            </FormControl>
            {editForm.type === 0 && (
              <>
                <TextField
                  size="small"
                  label="SMTP server"
                  value={editForm.smtp_server}
                  onChange={(e) => setEditForm((f) => ({ ...f, smtp_server: e.target.value }))}
                />
                <TextField
                  size="small"
                  label="SMTP email (from)"
                  value={editForm.smtp_email}
                  onChange={(e) => setEditForm((f) => ({ ...f, smtp_email: e.target.value }))}
                />
              </>
            )}
            {editForm.type === 2 && (
              <TextField
                size="small"
                label="Script path"
                value={editForm.script}
                onChange={(e) => setEditForm((f) => ({ ...f, script: e.target.value }))}
                placeholder="/usr/local/bin/notify.sh"
              />
            )}
            {editForm.type === 4 && (
              <TextField
                size="small"
                label="Webhook script"
                value={editForm.webhook_script}
                onChange={(e) => setEditForm((f) => ({ ...f, webhook_script: e.target.value }))}
                multiline
                rows={3}
                placeholder="var params = JSON.parse(value); ..."
              />
            )}
            <TextField
              size="small"
              label="Description"
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={onEditSave}
            disabled={editSaving || !editForm.name.trim()}
          >
            {editSaving ? <CircularProgress size={14} /> : "Save"}
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
