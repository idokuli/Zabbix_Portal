"use client";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
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
import { ConfirmDelete } from "./shared";

// ── Scripts ───────────────────────────────────────────────────────────

type Script = {
  scriptid: string;
  name: string;
  command: string;
  execute_on_label: string;
  scope_label: string;
  description: string;
};

export const ScriptsTab = ({
  showToast,
}: { showToast: (m: string, s: "success" | "error") => void }) => {
  const tick = useRefreshTick();
  const [items, setItems] = useState<Script[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Script | null>(null);
  const [form, setForm] = useState({
    name: "",
    command: "",
    execute_on: 1,
    scope: 2,
    description: "",
  });

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const r = await api.listScripts();
        setItems(r.scripts);
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
    if (tick > 0) void load(true);
  }, [tick]);

  const onSave = async () => {
    setSaving(true);
    try {
      await api.createScript(form);
      showToast("Script created.", "success");
      setAddOpen(false);
      setForm({ name: "", command: "", execute_on: 1, scope: 2, description: "" });
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };
  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteScript(deleteTarget.scriptid);
      showToast("Script deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  return (
    <>
      <TabHeader
        title="Scripts"
        description="Custom scripts that can be executed manually or as part of actions."
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Scripts
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
              <TableCell sx={{ fontWeight: 700 }}>Command</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 110 }}>Execute on</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 130 }}>Scope</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 60 }}>Delete</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No scripts found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((s) => (
                <TableRow key={s.scriptid} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {s.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: "monospace", color: "text.secondary" }}
                      noWrap
                    >
                      {s.command}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {s.execute_on_label}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {s.scope_label}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(s)}>
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
        <DialogTitle sx={{ fontWeight: 700 }}>Create script</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              size="small"
              label="Command *"
              value={form.command}
              onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
              multiline
              rows={3}
              placeholder="sh -c 'ping -c 3 {HOST.CONN}'"
            />
            <Stack direction="row" spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Execute on</InputLabel>
                <Select
                  label="Execute on"
                  value={form.execute_on}
                  onChange={(e) => setForm((f) => ({ ...f, execute_on: Number(e.target.value) }))}
                >
                  <MenuItem value={0}>Agent</MenuItem>
                  <MenuItem value={1}>Server</MenuItem>
                  <MenuItem value={2}>Proxy or server</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Scope</InputLabel>
                <Select
                  label="Scope"
                  value={form.scope}
                  onChange={(e) => setForm((f) => ({ ...f, scope: Number(e.target.value) }))}
                >
                  <MenuItem value={1}>Action operation</MenuItem>
                  <MenuItem value={2}>Manual host</MenuItem>
                  <MenuItem value={4}>Manual event</MenuItem>
                </Select>
              </FormControl>
            </Stack>
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
          <Button
            variant="contained"
            onClick={onSave}
            disabled={saving || !form.name.trim() || !form.command.trim()}
          >
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
