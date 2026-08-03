"use client";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
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
import { fmtTs } from "../../app/utils";
import { ConfirmDelete } from "./shared";

// ── API Tokens ────────────────────────────────────────────────────────

type ApiToken = {
  tokenid: string;
  name: string;
  userid: string;
  username: string;
  status: number;
  expires_at: number;
  created_at: number;
  lastaccess: number;
};

export const ApiTokensTab = ({
  showToast,
}: {
  showToast: (m: string, s: "success" | "error") => void;
}) => {
  const tick = useRefreshTick();
  const [items, setItems] = useState<ApiToken[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; username: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiToken | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", userid: "", expires_at: "" });

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const [tr, ur] = await Promise.all([api.listApiTokens(), api.listUsers()]);
        setItems(tr.tokens);
        setUsers(ur.users);
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
      const payload: { name: string; userid: string; expires_at?: number } = {
        name: form.name,
        userid: form.userid,
      };
      if (form.expires_at) {
        payload.expires_at = Math.floor(new Date(form.expires_at).getTime() / 1000);
      }
      const r = await api.createApiToken(payload);
      if (r.token) {
        setNewToken(r.token);
      }
      showToast("API token created.", "success");
      setAddOpen(false);
      setForm({ name: "", userid: "", expires_at: "" });
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
      await api.deleteApiToken(deleteTarget.tokenid);
      showToast("Token deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const now = Math.floor(Date.now() / 1000);

  return (
    <>
      <TabHeader
        title="API Tokens"
        description="Generate and manage long-lived tokens for programmatic Zabbix API access."
        count={items.length}
        loading={loading}
        actions={
          <>
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
          </>
        }
      />

      {newToken && (
        <Alert severity="success" onClose={() => setNewToken(null)} sx={{ mb: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Token created — copy it now, it won&apos;t be shown again:
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: "monospace",
              wordBreak: "break-all",
              bgcolor: "rgba(0,0,0,0.12)",
              p: 0.75,
            }}
          >
            {newToken}
          </Typography>
        </Alert>
      )}

      <TableContainer sx={{ border: "1px solid", borderColor: "divider" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 120 }}>User</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 140 }}>Expires</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 140 }}>Created</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 140 }}>Last access</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 60 }}>Delete</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No API tokens found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((t) => {
                const expired = t.expires_at > 0 && t.expires_at < now;
                return (
                  <TableRow key={t.tokenid} hover sx={expired ? { opacity: 0.6 } : {}}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t.name}
                        {expired && (
                          <Chip
                            label="Expired"
                            size="small"
                            color="error"
                            sx={{ height: 16, fontSize: "0.55rem", ml: 0.75 }}
                          />
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {t.username || t.userid}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t.status === 0 ? "Enabled" : "Disabled"}
                        size="small"
                        color={t.status === 0 ? "success" : "default"}
                        variant="outlined"
                        sx={{ height: 18, fontSize: "0.62rem" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {t.expires_at ? fmtTs(t.expires_at) : "Never"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {fmtTs(t.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {fmtTs(t.lastaccess)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(t)}>
                          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create API token</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Token name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>User *</InputLabel>
              <Select
                label="User *"
                value={form.userid}
                onChange={(e) => setForm((f) => ({ ...f, userid: e.target.value as string }))}
              >
                {users.map((u) => (
                  <MenuItem key={u.id} value={String(u.id)}>
                    {u.username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
              label="Expires (optional)"
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
              helperText="Leave blank for no expiry"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={saving || !form.name.trim() || !form.userid}
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
