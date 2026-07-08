"use client";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../../app/api";
import { generateId } from "../../app/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type ProvisionGroup = {
  _key: string;
  name: string;
  roleid: string;
  user_groups: string[];
};

export type ProvisionMedia = {
  _key: string;
  name: string;
  mediatypeid: string;
  attribute: string;
  period: string;
  severity: number;
  active: number;
};

export type LdapServerForm = {
  name: string;
  host: string;
  port: string;
  base_dn: string;
  search_attribute: string;
  bind_dn: string;
  bind_password: string;
  description: string;
  provision_status: string;
  start_tls: string;
  search_filter: string;
  group_name: string;
  group_member: string;
  user_username: string;
  user_lastname: string;
  provision_groups: Omit<ProvisionGroup, "_key">[];
  provision_media: Omit<ProvisionMedia, "_key">[];
};

export const EMPTY_LDAP_FORM: LdapServerForm = {
  name: "",
  host: "",
  port: "389",
  base_dn: "",
  search_attribute: "",
  bind_dn: "",
  bind_password: "",
  description: "",
  provision_status: "0",
  start_tls: "0",
  search_filter: "",
  group_name: "",
  group_member: "",
  user_username: "",
  user_lastname: "",
  provision_groups: [],
  provision_media: [],
};

const SEVERITY_BITS = [
  { label: "Not classified", bit: 1 },
  { label: "Information", bit: 2 },
  { label: "Warning", bit: 4 },
  { label: "Average", bit: 8 },
  { label: "High", bit: 16 },
  { label: "Disaster", bit: 32 },
];

// ── User group mapping sub-dialog ─────────────────────────────────────────

const GroupMappingDialog = ({
  open,
  initial,
  userGroups,
  roles,
  onClose,
  onAdd,
}: {
  open: boolean;
  initial?: ProvisionGroup;
  userGroups: Array<{ usrgrpid: string; name: string }>;
  roles: Array<{ roleid: string; name: string }>;
  onClose: () => void;
  onAdd: (g: Omit<ProvisionGroup, "_key">) => void;
}) => {
  const [name, setName] = useState("");
  const [roleid, setRoleid] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setRoleid(initial?.roleid ?? "");
      setSelectedGroups(initial?.user_groups ?? []);
    }
  }, [open, initial]);

  const toggleGroup = (id: string) =>
    setSelectedGroups((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const valid = name.trim() && roleid && selectedGroups.length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {initial ? "Edit user group mapping" : "New user group mapping"}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            size="small"
            label="LDAP group pattern"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
            helperText="e.g. cn=admins,ou=groups,dc=example,dc=com"
          />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              User groups *
            </Typography>
            <Box
              sx={{
                mt: 0.5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {userGroups.length === 0 ? (
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ p: 1.5, display: "block" }}
                >
                  No user groups available
                </Typography>
              ) : (
                userGroups.map((g) => (
                  <FormControlLabel
                    key={g.usrgrpid}
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedGroups.includes(g.usrgrpid)}
                        onChange={() => toggleGroup(g.usrgrpid)}
                      />
                    }
                    label={<Typography variant="body2">{g.name}</Typography>}
                    sx={{ display: "flex", mx: 0, px: 1, py: 0.25 }}
                  />
                ))
              )}
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              User role *
            </Typography>
            <Select
              size="small"
              fullWidth
              value={roleid}
              onChange={(e) => setRoleid(e.target.value)}
              displayEmpty
              sx={{ mt: 0.5 }}
            >
              <MenuItem value="" disabled>
                <em>Select a role</em>
              </MenuItem>
              {roles.map((r) => (
                <MenuItem key={r.roleid} value={r.roleid}>
                  {r.name}
                </MenuItem>
              ))}
            </Select>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!valid}
          onClick={() => {
            onAdd({ name: name.trim(), roleid, user_groups: selectedGroups });
            onClose();
          }}
        >
          {initial ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Media type mapping sub-dialog ─────────────────────────────────────────

const MediaMappingDialog = ({
  open,
  initial,
  mediaTypes,
  onClose,
  onAdd,
}: {
  open: boolean;
  initial?: ProvisionMedia;
  mediaTypes: Array<{ mediatypeid: string; name: string }>;
  onClose: () => void;
  onAdd: (m: Omit<ProvisionMedia, "_key">) => void;
}) => {
  const [name, setName] = useState("");
  const [mediatypeid, setMediatypeid] = useState("");
  const [attribute, setAttribute] = useState("");
  const [period, setPeriod] = useState("1-7,00:00-24:00");
  const [severity, setSeverity] = useState(63);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setMediatypeid(initial?.mediatypeid ?? "");
      setAttribute(initial?.attribute ?? "");
      setPeriod(initial?.period ?? "1-7,00:00-24:00");
      setSeverity(initial?.severity ?? 63);
      setActive(initial?.active ?? 0);
    }
  }, [open, initial]);

  const toggleBit = (bit: number) => setSeverity((s) => s ^ bit);
  const valid = name.trim() && mediatypeid && attribute.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {initial ? "Edit media type mapping" : "New media type mapping"}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            size="small"
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Media type *
            </Typography>
            <Select
              size="small"
              fullWidth
              value={mediatypeid}
              onChange={(e) => setMediatypeid(e.target.value)}
              displayEmpty
              sx={{ mt: 0.5 }}
            >
              <MenuItem value="" disabled>
                <em>Select media type</em>
              </MenuItem>
              {mediaTypes.map((m) => (
                <MenuItem key={m.mediatypeid} value={m.mediatypeid}>
                  {m.name}
                </MenuItem>
              ))}
            </Select>
          </Box>
          <TextField
            size="small"
            label="Attribute"
            required
            value={attribute}
            onChange={(e) => setAttribute(e.target.value)}
            fullWidth
            placeholder="email"
          />
          <Divider>
            <Typography variant="caption" color="text.secondary">
              User media
            </Typography>
          </Divider>
          <TextField
            size="small"
            label="When active"
            required
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            fullWidth
            helperText="e.g. 1-7,00:00-24:00"
          />
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600, display: "block", mb: 0.5 }}
            >
              Use if severity
            </Typography>
            {SEVERITY_BITS.map(({ label, bit }) => (
              <FormControlLabel
                key={bit}
                control={
                  <Checkbox
                    size="small"
                    checked={!!(severity & bit)}
                    onChange={() => toggleBit(bit)}
                  />
                }
                label={<Typography variant="body2">{label}</Typography>}
                sx={{ display: "flex", ml: 0 }}
              />
            ))}
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={active === 0}
                onChange={(_, v) => setActive(v ? 0 : 1)}
              />
            }
            label={<Typography variant="body2">Create enabled</Typography>}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!valid}
          onClick={() => {
            onAdd({
              name: name.trim(),
              mediatypeid,
              attribute: attribute.trim(),
              period,
              severity,
              active,
            });
            onClose();
          }}
        >
          {initial ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Main dialog ───────────────────────────────────────────────────────────

export const LdapServerDialog = ({
  open,
  editId,
  initialForm,
  onClose,
  onSaved,
  showToast,
}: {
  open: boolean;
  editId: string | null;
  initialForm: LdapServerForm;
  onClose: () => void;
  onSaved: () => void;
  showToast: (m: string, s: "success" | "error") => void;
}) => {
  const [form, setForm] = useState<LdapServerForm>(initialForm);
  // UI-only toggle: memberOf (0) vs groupOfNames (1) — not a real Zabbix API field
  const [groupConfig, setGroupConfig] = useState("0");
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testUsername, setTestUsername] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [testing, setTesting] = useState(false);

  // Provision state
  const [provisionGroups, setProvisionGroups] = useState<ProvisionGroup[]>([]);
  const [provisionMedia, setProvisionMedia] = useState<ProvisionMedia[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [editGroupIdx, setEditGroupIdx] = useState<number | null>(null);
  const [editMediaIdx, setEditMediaIdx] = useState<number | null>(null);

  // Dropdown data (lazy loaded)
  const [userGroups, setUserGroups] = useState<Array<{ usrgrpid: string; name: string }>>([]);
  const [roles, setRoles] = useState<Array<{ roleid: string; name: string }>>([]);
  const [mediaTypes, setMediaTypes] = useState<Array<{ mediatypeid: string; name: string }>>([]);
  const [dropdownsLoaded, setDropdownsLoaded] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: open is an intentional trigger to reset form on dialog reopen
  useEffect(() => {
    setForm(initialForm);
    setGroupConfig("0");
    setTestUsername("");
    setTestPassword("");
    setProvisionGroups(
      (initialForm.provision_groups ?? []).map((g) => ({ _key: generateId(), ...g })),
    );
    setProvisionMedia(
      (initialForm.provision_media ?? []).map((m) => ({ _key: generateId(), ...m })),
    );
    setDropdownsLoaded(false);
  }, [initialForm, open]);

  // Load dropdowns when JIT provisioning is toggled on (or on open if already on)
  const loadDropdowns = async () => {
    if (dropdownsLoaded) return;
    try {
      const [ugRes, rolesRes, mtRes] = await Promise.all([
        api.listUserGroups(),
        api.listZabbixRoles(),
        api.listMediaTypes(),
      ]);
      setUserGroups(ugRes.groups.map((g) => ({ usrgrpid: g.usrgrpid, name: g.name })));
      setRoles(rolesRes.roles.map((r) => ({ roleid: r.roleid, name: r.name })));
      setMediaTypes(mtRes.media_types.map((m) => ({ mediatypeid: m.mediatypeid, name: m.name })));
      setDropdownsLoaded(true);
    } catch (e) {
      showToast(
        `Could not load LDAP dropdowns: ${e instanceof Error ? e.message : String(e)}`,
        "error",
      );
    }
  };

  const set = (key: keyof LdapServerForm, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const onSave = async () => {
    if (!form.name || !form.host || !form.base_dn || !form.search_attribute) {
      showToast("Name, Host, Base DN and Search attribute are required.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        host: form.host,
        port: Number(form.port) || 389,
        base_dn: form.base_dn,
        search_attribute: form.search_attribute,
        bind_dn: form.bind_dn,
        bind_password: form.bind_password,
        description: form.description,
        start_tls: Number(form.start_tls),
        search_filter: form.search_filter,
        provision_status: Number(form.provision_status),
        group_name: form.group_name,
        group_member: form.group_member,
        user_username: form.user_username,
        user_lastname: form.user_lastname,
        provision_groups: provisionGroups.map(({ _key: _, ...g }) => g),
        provision_media: provisionMedia.map(({ _key: _, ...m }) => m),
      };
      if (editId) {
        await api.updateLdapServer(editId, payload);
        showToast("LDAP server updated.", "success");
      } else {
        await api.createLdapServer(payload);
        showToast("LDAP server added.", "success");
      }
      onSaved();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    try {
      const res = await api.testLdapConnection({
        host: form.host,
        port: Number(form.port) || 389,
        base_dn: form.base_dn,
        search_attribute: form.search_attribute,
        bind_dn: form.bind_dn || undefined,
        bind_password: form.bind_password || undefined,
        start_tls: Number(form.start_tls),
        search_filter: form.search_filter || undefined,
        ...(editId ? { userdirectoryid: editId } : {}),
        test_username: testUsername,
        test_password: testPassword,
      });
      if (res.result) {
        showToast(`LDAP connection succeeded for "${testUsername}".`, "success");
        setTestOpen(false);
      } else {
        showToast("LDAP connection test failed.", "error");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setTesting(false);
    }
  };

  const isJIT = form.provision_status === "1";

  const addOrEditGroup = (g: Omit<ProvisionGroup, "_key">) => {
    if (editGroupIdx !== null) {
      setProvisionGroups((prev) =>
        prev.map((item, i) => (i === editGroupIdx ? { ...item, ...g } : item)),
      );
    } else {
      setProvisionGroups((prev) => [...prev, { _key: generateId(), ...g }]);
    }
    setEditGroupIdx(null);
  };

  const addOrEditMedia = (m: Omit<ProvisionMedia, "_key">) => {
    if (editMediaIdx !== null) {
      setProvisionMedia((prev) =>
        prev.map((item, i) => (i === editMediaIdx ? { ...item, ...m } : item)),
      );
    } else {
      setProvisionMedia((prev) => [...prev, { _key: generateId(), ...m }]);
    }
    setEditMediaIdx(null);
  };

  const roleLabel = (roleid: string) => roles.find((r) => r.roleid === roleid)?.name ?? roleid;
  const groupNames = (ids: string[]) =>
    ids.map((id) => userGroups.find((g) => g.usrgrpid === id)?.name ?? id).join(", ");
  const mediaLabel = (id: string) => mediaTypes.find((m) => m.mediatypeid === id)?.name ?? id;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editId ? "Edit LDAP server" : "Add LDAP server"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {/* ── Core fields ── */}
            <TextField
              size="small"
              label="Name"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="Host"
              required
              value={form.host}
              onChange={(e) => set("host", e.target.value)}
              fullWidth
              placeholder="ldap.example.com"
            />
            <TextField
              size="small"
              label="Port"
              required
              type="number"
              value={form.port}
              onChange={(e) => set("port", e.target.value)}
              sx={{ maxWidth: 120 }}
              inputProps={{ min: 1, max: 65535 }}
            />
            <TextField
              size="small"
              label="Base DN"
              required
              value={form.base_dn}
              onChange={(e) => set("base_dn", e.target.value)}
              fullWidth
              placeholder="dc=example,dc=com"
            />
            <TextField
              size="small"
              label="Search attribute"
              required
              value={form.search_attribute}
              onChange={(e) => set("search_attribute", e.target.value)}
              fullWidth
              placeholder="uid"
            />
            <TextField
              size="small"
              label="Bind DN"
              value={form.bind_dn}
              onChange={(e) => set("bind_dn", e.target.value)}
              fullWidth
              placeholder="cn=admin,dc=example,dc=com"
            />
            <TextField
              size="small"
              label="Bind password"
              type="password"
              value={form.bind_password}
              onChange={(e) => set("bind_password", e.target.value)}
              fullWidth
              helperText={editId ? "Leave blank to keep the existing password." : undefined}
            />
            <TextField
              size="small"
              label="Description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />

            {/* ── JIT Provisioning ── */}
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={isJIT}
                  onChange={(_, v) => {
                    set("provision_status", v ? "1" : "0");
                    if (v) void loadDropdowns();
                  }}
                />
              }
              label={<Typography variant="body2">Configure JIT provisioning</Typography>}
            />

            {isJIT && (
              <Box sx={{ pl: 1, borderLeft: "2px solid", borderColor: "divider" }}>
                <Stack spacing={2}>
                  {/* Group configuration toggle */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 600, display: "block", mb: 0.75 }}
                    >
                      Group configuration
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={groupConfig}
                      onChange={(_, v) => {
                        if (v !== null) setGroupConfig(v);
                      }}
                    >
                      <ToggleButton value="0" sx={{ px: 2, fontSize: "0.8rem" }}>
                        memberOf
                      </ToggleButton>
                      <ToggleButton value="1" sx={{ px: 2, fontSize: "0.8rem" }}>
                        groupOfNames
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  <TextField
                    size="small"
                    label="Group name attribute"
                    value={form.group_name}
                    onChange={(e) => set("group_name", e.target.value)}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="User group membership attribute"
                    value={form.group_member}
                    onChange={(e) => set("group_member", e.target.value)}
                    fullWidth
                    placeholder="memberOf"
                  />
                  <TextField
                    size="small"
                    label="User name attribute"
                    value={form.user_username}
                    onChange={(e) => set("user_username", e.target.value)}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="User last name attribute"
                    value={form.user_lastname}
                    onChange={(e) => set("user_lastname", e.target.value)}
                    fullWidth
                  />

                  {/* User group mapping */}
                  <Box>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mb: 0.75 }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        User group mapping
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => {
                          setEditGroupIdx(null);
                          setGroupDialogOpen(true);
                        }}
                      >
                        Add
                      </Button>
                    </Stack>
                    {provisionGroups.length === 0 ? (
                      <Typography variant="caption" color="text.disabled">
                        No mappings defined.
                      </Typography>
                    ) : (
                      <Table
                        size="small"
                        sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}
                      >
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>
                              LDAP group pattern
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>
                              User groups
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>
                              Role
                            </TableCell>
                            <TableCell sx={{ width: 40 }} />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {provisionGroups.map((g, i) => (
                            <TableRow
                              key={g._key}
                              hover
                              sx={{ cursor: "pointer" }}
                              onClick={() => {
                                setEditGroupIdx(i);
                                setGroupDialogOpen(true);
                              }}
                            >
                              <TableCell
                                sx={{
                                  fontSize: "0.75rem",
                                  fontFamily: "monospace",
                                  maxWidth: 140,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {g.name}
                              </TableCell>
                              <TableCell sx={{ fontSize: "0.75rem" }}>
                                {dropdownsLoaded ? (
                                  groupNames(g.user_groups)
                                ) : (
                                  <Chip label={g.user_groups.length} size="small" />
                                )}
                              </TableCell>
                              <TableCell sx={{ fontSize: "0.75rem" }}>
                                {dropdownsLoaded ? roleLabel(g.roleid) : g.roleid}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Tooltip title="Remove">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() =>
                                      setProvisionGroups((prev) => prev.filter((_, j) => j !== i))
                                    }
                                  >
                                    <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Box>

                  {/* Media type mapping */}
                  <Box>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mb: 0.75 }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Media type mapping
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => {
                          setEditMediaIdx(null);
                          setMediaDialogOpen(true);
                        }}
                      >
                        Add
                      </Button>
                    </Stack>
                    {provisionMedia.length === 0 ? (
                      <Typography variant="caption" color="text.disabled">
                        No mappings defined.
                      </Typography>
                    ) : (
                      <Table
                        size="small"
                        sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}
                      >
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>
                              Name
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>
                              Media type
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>
                              Attribute
                            </TableCell>
                            <TableCell sx={{ width: 40 }} />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {provisionMedia.map((m, i) => (
                            <TableRow
                              key={m._key}
                              hover
                              sx={{ cursor: "pointer" }}
                              onClick={() => {
                                setEditMediaIdx(i);
                                setMediaDialogOpen(true);
                              }}
                            >
                              <TableCell sx={{ fontSize: "0.75rem" }}>{m.name}</TableCell>
                              <TableCell sx={{ fontSize: "0.75rem" }}>
                                {dropdownsLoaded ? mediaLabel(m.mediatypeid) : m.mediatypeid}
                              </TableCell>
                              <TableCell sx={{ fontSize: "0.75rem" }}>{m.attribute}</TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Tooltip title="Remove">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() =>
                                      setProvisionMedia((prev) => prev.filter((_, j) => j !== i))
                                    }
                                  >
                                    <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Box>
                </Stack>
              </Box>
            )}

            {/* ── Advanced ── */}
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}
              >
                Advanced configuration
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={1.5}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={form.start_tls === "1"}
                      onChange={(_, v) => set("start_tls", v ? "1" : "0")}
                    />
                  }
                  label={<Typography variant="body2">StartTLS</Typography>}
                />
                <TextField
                  size="small"
                  label="Search filter"
                  value={form.search_filter}
                  onChange={(e) => set("search_filter", e.target.value)}
                  fullWidth
                  placeholder="(%(attr)=%(user))"
                />
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="outlined"
            onClick={() => setTestOpen(true)}
            disabled={!form.host || !form.base_dn || !form.search_attribute}
          >
            Test
          </Button>
          <Button variant="contained" onClick={onSave} disabled={saving}>
            {saving ? <CircularProgress size={14} /> : editId ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test credentials dialog */}
      <Dialog open={testOpen} onClose={() => setTestOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Test LDAP connection</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Binds to the LDAP server and attempts to authenticate this user.
          </Typography>
          <Stack spacing={2}>
            <TextField
              size="small"
              label="LDAP username"
              value={testUsername}
              onChange={(e) => setTestUsername(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              size="small"
              label="Password"
              type="password"
              value={testPassword}
              onChange={(e) => setTestPassword(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={onTest}
            disabled={testing || !testUsername || !testPassword}
          >
            {testing ? <CircularProgress size={14} /> : "Test"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sub-dialogs */}
      <GroupMappingDialog
        open={groupDialogOpen}
        initial={editGroupIdx !== null ? provisionGroups[editGroupIdx] : undefined}
        userGroups={userGroups}
        roles={roles}
        onClose={() => {
          setGroupDialogOpen(false);
          setEditGroupIdx(null);
        }}
        onAdd={addOrEditGroup}
      />
      <MediaMappingDialog
        open={mediaDialogOpen}
        initial={editMediaIdx !== null ? provisionMedia[editMediaIdx] : undefined}
        mediaTypes={mediaTypes}
        onClose={() => {
          setMediaDialogOpen(false);
          setEditMediaIdx(null);
        }}
        onAdd={addOrEditMedia}
      />
    </>
  );
};
