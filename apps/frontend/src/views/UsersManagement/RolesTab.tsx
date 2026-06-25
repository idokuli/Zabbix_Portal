"use client";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Box,
  Button,
  Card,
  Chip,
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
import { ConfirmDelete } from "./shared";

// ── Roles ─────────────────────────────────────────────────────────────

type Role = {
  roleid: string;
  name: string;
  type: number;
  type_label: string;
  readonly: number;
  rule_count: number;
};

const UI_SECTIONS = [
  {
    label: "Dashboards",
    items: [{ name: "monitoring.dashboard", label: "Dashboards" }],
  },
  {
    label: "Monitoring",
    items: [
      { name: "monitoring.problems", label: "Problems" },
      { name: "monitoring.hosts", label: "Hosts" },
      { name: "monitoring.latest_data", label: "Latest data" },
      { name: "monitoring.maps", label: "Maps" },
      { name: "monitoring.discovery", label: "Discovery" },
    ],
  },
  {
    label: "Services",
    items: [
      { name: "services.services", label: "Services" },
      { name: "services.sla", label: "SLA" },
      { name: "services.sla_report", label: "SLA report" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { name: "inventory.overview", label: "Overview" },
      { name: "inventory.hosts", label: "Hosts" },
    ],
  },
  {
    label: "Reports",
    items: [
      { name: "reports.system_info", label: "System information" },
      { name: "reports.scheduled_reports", label: "Scheduled reports" },
      { name: "reports.availability_report", label: "Availability report" },
      { name: "reports.top_triggers", label: "Top 100 triggers" },
      { name: "reports.notifications", label: "Notifications" },
      { name: "reports.audit_log", label: "Audit log" },
      { name: "reports.action_log", label: "Action log" },
    ],
  },
  {
    label: "Data collection",
    adminOnly: true,
    items: [
      { name: "data_collection.template_groups", label: "Template groups" },
      { name: "data_collection.host_groups", label: "Host groups" },
      { name: "data_collection.hosts", label: "Hosts" },
      { name: "data_collection.maintenance", label: "Maintenance" },
      { name: "data_collection.templates", label: "Templates" },
      { name: "data_collection.discovery", label: "Discovery" },
      { name: "data_collection.event_correlation", label: "Event correlation" },
    ],
  },
  {
    label: "Alerts",
    adminOnly: true,
    items: [
      { name: "alerts.trigger_actions", label: "Trigger actions" },
      { name: "alerts.service_actions", label: "Service actions" },
      { name: "alerts.discovery_actions", label: "Discovery actions" },
      { name: "alerts.autoregistration_actions", label: "Autoregistration actions" },
      { name: "alerts.internal_actions", label: "Internal actions" },
      { name: "alerts.media_types", label: "Media types" },
      { name: "alerts.scripts", label: "Scripts" },
    ],
  },
  {
    label: "Users",
    adminOnly: true,
    items: [
      { name: "users.user_groups", label: "User groups" },
      { name: "users.users", label: "Users" },
      { name: "users.user_roles", label: "User roles" },
      { name: "users.api_tokens", label: "API tokens" },
      { name: "users.authentication", label: "Authentication" },
    ],
  },
  {
    label: "Administration",
    adminOnly: true,
    items: [
      { name: "administration.general", label: "General" },
      { name: "administration.audit_log", label: "Audit log" },
      { name: "administration.housekeeping", label: "Housekeeping" },
      { name: "administration.proxy_groups", label: "Proxy groups" },
      { name: "administration.proxies", label: "Proxies" },
      { name: "administration.macros", label: "Macros" },
      { name: "administration.queue", label: "Queue" },
    ],
  },
];

const makeDefaultUiAccess = (): Record<string, boolean> => {
  const acc: Record<string, boolean> = {};
  for (const section of UI_SECTIONS) {
    for (const item of section.items) {
      acc[item.name] = true;
    }
  }
  return acc;
};

const makeDefaultRoleForm = () => ({
  name: "",
  type: 1,
  ui_access: makeDefaultUiAccess(),
  ui_default_access: 1,
  services_read_mode: 0,
  services_write_mode: 0,
  modules_default_access: 1,
  api_access: 1,
});

export const RolesTab = ({
  showToast,
}: { showToast: (m: string, s: "success" | "error") => void }) => {
  const [items, setItems] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(makeDefaultRoleForm());
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.listZabbixRoles();
      setItems(r.roles);
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);
  useEffect(() => {
    void load();
  }, [load]);

  const onAdd = async () => {
    setSaving(true);
    try {
      await api.createRole({
        name: form.name,
        type: form.type,
        ui_access: form.ui_access,
        ui_default_access: form.ui_default_access,
        services_read_mode: form.services_read_mode,
        services_write_mode: form.services_write_mode,
        modules_default_access: form.modules_default_access,
        api_access: form.api_access,
      });
      showToast("Role created.", "success");
      setAddOpen(false);
      setForm(makeDefaultRoleForm());
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
      await api.updateRole(editTarget.roleid, { name: editName });
      showToast("Role renamed.", "success");
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
      await api.deleteRole(deleteTarget.roleid);
      showToast("Role deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const toggleUi = (name: string, val: boolean) =>
    setForm((f) => ({ ...f, ui_access: { ...f.ui_access, [name]: val } }));
  const toggleSection = (items: Array<{ name: string }>, val: boolean) =>
    setForm((f) => {
      const updated = { ...f.ui_access };
      for (const item of items) updated[item.name] = val;
      return { ...f, ui_access: updated };
    });
  const sectionAllChecked = (items: Array<{ name: string }>) =>
    items.every((it) => form.ui_access[it.name]);

  const visibleSections = UI_SECTIONS.filter((s) => !s.adminOnly || form.type >= 2);

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Roles
          </Typography>
          {loading ? (
            <CircularProgress size={14} />
          ) : (
            <Chip label={items.length} size="small" sx={{ height: 18, fontSize: "0.62rem" }} />
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={load} disabled={loading}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            startIcon={<AddOutlinedIcon />}
            onClick={() => {
              setForm(makeDefaultRoleForm());
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
              <TableCell sx={{ fontWeight: 700, width: 130 }}>User type</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>Rules</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Built-in</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No roles found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((r) => (
                <TableRow key={r.roleid} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {r.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={r.type_label}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.62rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {r.rule_count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.readonly === 1 ? (
                      <Chip
                        label="Built-in"
                        size="small"
                        sx={{ height: 18, fontSize: "0.62rem" }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Rename">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditTarget(r);
                            setEditName(r.name);
                          }}
                        >
                          <EditOutlinedIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      {r.readonly !== 1 && (
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(r)}>
                            <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create role dialog — full Zabbix-equivalent */}
      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { maxHeight: "90vh" } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Create role</DialogTitle>
        <DialogContent dividers sx={{ overflowY: "auto" }}>
          <Stack spacing={2.5}>
            {/* Basic */}
            <Stack direction="row" spacing={2}>
              <TextField
                size="small"
                label="Name *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                sx={{ flex: 1 }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>User type</InputLabel>
                <Select
                  label="User type"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: Number(e.target.value) }))}
                >
                  <MenuItem value={1}>User</MenuItem>
                  <MenuItem value={2}>Admin</MenuItem>
                  <MenuItem value={3}>Super admin</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Divider />

            {/* UI element access */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Access to UI elements
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {visibleSections.map((section) => (
                <Card key={section.label} variant="outlined" sx={{ p: 1.5 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={sectionAllChecked(section.items)}
                        onChange={(e) => toggleSection(section.items, e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {section.label}
                      </Typography>
                    }
                    sx={{ mb: 0.5 }}
                  />
                  <Box sx={{ pl: 1 }}>
                    {section.items.map((item) => (
                      <FormControlLabel
                        key={item.name}
                        control={
                          <Switch
                            size="small"
                            checked={!!form.ui_access[item.name]}
                            onChange={(e) => toggleUi(item.name, e.target.checked)}
                          />
                        }
                        label={<Typography variant="caption">{item.label}</Typography>}
                        sx={{ display: "flex", my: 0 }}
                      />
                    ))}
                  </Box>
                </Card>
              ))}
            </Box>

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={form.ui_default_access === 1}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ui_default_access: e.target.checked ? 1 : 0 }))
                  }
                />
              }
              label={<Typography variant="body2">Default access to new UI elements</Typography>}
            />

            <Divider />

            {/* Services access */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Access to services
            </Typography>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Read access</InputLabel>
                <Select
                  label="Read access"
                  value={form.services_read_mode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, services_read_mode: Number(e.target.value) }))
                  }
                >
                  <MenuItem value={0}>All</MenuItem>
                  <MenuItem value={1}>None</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Write access</InputLabel>
                <Select
                  label="Write access"
                  value={form.services_write_mode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, services_write_mode: Number(e.target.value) }))
                  }
                >
                  <MenuItem value={0}>All</MenuItem>
                  <MenuItem value={1}>None</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Divider />

            {/* Modules & API */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Access to modules
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={form.modules_default_access === 1}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, modules_default_access: e.target.checked ? 1 : 0 }))
                  }
                />
              }
              label={<Typography variant="body2">Default access to new modules</Typography>}
            />

            <Divider />

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              API access
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={form.api_access === 1}
                  onChange={(e) => setForm((f) => ({ ...f, api_access: e.target.checked ? 1 : 0 }))}
                />
              }
              label={<Typography variant="body2">Enabled</Typography>}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={onAdd} disabled={saving || !form.name.trim()}>
            {saving ? <CircularProgress size={14} /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Rename role</DialogTitle>
        <DialogContent>
          <TextField
            size="small"
            label="Name *"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={onEdit} disabled={saving || !editName.trim()}>
            {saving ? <CircularProgress size={14} /> : "Save"}
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
