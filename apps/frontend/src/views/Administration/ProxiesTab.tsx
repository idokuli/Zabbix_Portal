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
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { type ProxyConfig, api } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";
import {
  ConfirmDelete,
  DEFAULT_PROXY_FORM,
  // biome-ignore lint/suspicious/noShadowRestrictedNames: Zabbix domain type
  type Proxy,
  ProxyFormDialog,
  type ProxyGroup,
  fmtTs,
  proxyFormFromExisting,
} from "./shared";

export const ProxiesTab = ({
  showToast,
}: { showToast: (m: string, s: "success" | "error") => void }) => {
  const [items, setItems] = useState<Proxy[]>([]);
  const [proxyGroups, setProxyGroups] = useState<ProxyGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Proxy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Proxy | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProxyConfig>(DEFAULT_PROXY_FORM);
  const [editForm, setEditForm] = useState<ProxyConfig>(DEFAULT_PROXY_FORM);
  const tick = useRefreshTick();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [r, g] = await Promise.all([api.listProxies(), api.listProxyGroups()]);
        setItems(r.proxies);
        setProxyGroups(g.proxy_groups);
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

  const onAdd = async () => {
    setSaving(true);
    try {
      await api.createProxy(form);
      showToast("Proxy created.", "success");
      setAddOpen(false);
      setForm(DEFAULT_PROXY_FORM);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };
  const onEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await api.updateProxy(editTarget.proxyid, editForm);
      showToast("Proxy updated.", "success");
      setEditTarget(null);
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
      await api.deleteProxy(deleteTarget.proxyid);
      showToast("Proxy deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  return (
    <>
      <TabHeader
        title="Proxies"
        description="Manage Zabbix proxies, their connection mode, and assigned hosts."
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Proxies
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
              setForm(DEFAULT_PROXY_FORM);
              setAddOpen(true);
            }}
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
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Mode</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 90 }}>Version</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 70 }}>Hosts</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 150 }}>Last seen</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No proxies configured.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((p) => (
                <TableRow key={p.proxyid} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {p.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={p.mode_label}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.62rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {p.version || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {p.host_count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      {fmtTs(p.lastaccess)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {p.description || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditTarget(p);
                            setEditForm(proxyFormFromExisting(p));
                          }}
                        >
                          <EditOutlinedIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(p)}>
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

      <ProxyFormDialog
        open={addOpen}
        title="New proxy"
        form={form}
        setForm={setForm}
        proxyGroups={proxyGroups}
        saving={saving}
        onCancel={() => setAddOpen(false)}
        onSubmit={onAdd}
        submitLabel="Add"
      />
      <ProxyFormDialog
        open={!!editTarget}
        title="Edit proxy"
        form={editForm}
        setForm={setEditForm}
        proxyGroups={proxyGroups}
        saving={saving}
        onCancel={() => setEditTarget(null)}
        onSubmit={onEdit}
        submitLabel="Save"
      />

      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onConfirm={onDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
};
