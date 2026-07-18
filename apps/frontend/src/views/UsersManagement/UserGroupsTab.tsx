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
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { generateId } from "../../app/utils";
import { ConfirmDelete } from "./shared";

// ── User Groups ───────────────────────────────────────────────────────

type UserGroup = {
  usrgrpid: string;
  name: string;
  gui_access_label: string;
  users_status_label: string;
  user_count: number;
};
type ZabbixUser = { userid: string; username: string; display: string };
type HGRight = { id: string; permission: number };
type TagFilter = { _key: string; groupid: string; tag: string; value: string };

export const makeEmptyUGForm = () => ({
  name: "",
  gui_access: 0,
  users_status: 0,
  debug_mode: 0,
  userids: [] as string[],
  hostgroup_rights: [] as HGRight[],
  templategroup_rights: [] as HGRight[],
  tag_filters: [] as TagFilter[],
});

export const UserGroupsTab = ({
  showToast,
}: { showToast: (m: string, s: "success" | "error") => void }) => {
  const tick = useRefreshTick();
  const [items, setItems] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserGroup | null>(null);
  const [form, setForm] = useState(makeEmptyUGForm());
  const [dialogTab, setDialogTab] = useState(0);
  const [zabbixUsers, setZabbixUsers] = useState<ZabbixUser[]>([]);
  const [hostGroups, setHostGroups] = useState<Array<{ groupid: string; name: string }>>([]);
  const [templateGroups, setTemplateGroups] = useState<Array<{ groupid: string; name: string }>>(
    [],
  );

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const r = await api.listUserGroups();
        setItems(r.groups);
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

  const openAdd = async () => {
    setForm(makeEmptyUGForm());
    setDialogTab(0);
    setAddOpen(true);
    try {
      const [zu, hg, tg] = await Promise.all([
        api.listZabbixUsers(),
        api.listHostGroups(),
        api.listTemplateGroups(),
      ]);
      setZabbixUsers(zu.users);
      setHostGroups(hg.groups);
      setTemplateGroups(tg.groups);
    } catch {
      /* non-critical */
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await api.createUserGroup({
        name: form.name,
        gui_access: form.gui_access,
        users_status: form.users_status,
        debug_mode: form.debug_mode,
        userids: form.userids.length > 0 ? form.userids : undefined,
        hostgroup_rights: form.hostgroup_rights.length > 0 ? form.hostgroup_rights : undefined,
        templategroup_rights:
          form.templategroup_rights.length > 0 ? form.templategroup_rights : undefined,
        tag_filters:
          form.tag_filters.length > 0
            ? form.tag_filters.map(({ groupid, tag, value }) => ({ groupid, tag, value }))
            : undefined,
      });
      showToast("User group created.", "success");
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
      await api.deleteUserGroup(deleteTarget.usrgrpid);
      showToast("User group deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const addHGRight = (rights: HGRight[], setRights: (r: HGRight[]) => void, id: string) => {
    if (!id || rights.some((r) => r.id === id)) {
      return;
    }
    setRights([...rights, { id, permission: 2 }]);
  };
  const removeRight = (rights: HGRight[], setRights: (r: HGRight[]) => void, id: string) =>
    setRights(rights.filter((r) => r.id !== id));
  const updatePerm = (
    rights: HGRight[],
    setRights: (r: HGRight[]) => void,
    id: string,
    perm: number,
  ) => setRights(rights.map((r) => (r.id === id ? { ...r, permission: perm } : r)));

  return (
    <>
      <TabHeader
        title="User Groups"
        description="Group users to simplify host and template permission assignments."
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            User Groups
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
            onClick={openAdd}
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
              <TableCell sx={{ fontWeight: 700, width: 130 }}>GUI Access</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 110 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>Members</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 60 }}>Delete</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No user groups found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((g) => (
                <TableRow key={g.usrgrpid} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {g.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {g.gui_access_label}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={g.users_status_label}
                      size="small"
                      color={g.users_status_label === "Enabled" ? "success" : "default"}
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.62rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {g.user_count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(g)}>
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

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>Create user group</DialogTitle>
        <Tabs
          value={dialogTab}
          onChange={(_, v) => setDialogTab(v)}
          sx={{ px: 3, borderBottom: "1px solid", borderColor: "divider", minHeight: 36 }}
          TabIndicatorProps={{ style: { height: 2 } }}
        >
          <Tab
            label="User group"
            sx={{ fontSize: "0.8rem", textTransform: "none", minHeight: 36, py: 0.5 }}
          />
          <Tab
            label="Users"
            sx={{ fontSize: "0.8rem", textTransform: "none", minHeight: 36, py: 0.5 }}
          />
          <Tab
            label="Host permissions"
            sx={{ fontSize: "0.8rem", textTransform: "none", minHeight: 36, py: 0.5 }}
          />
          <Tab
            label="Template permissions"
            sx={{ fontSize: "0.8rem", textTransform: "none", minHeight: 36, py: 0.5 }}
          />
          <Tab
            label="Problem tag filter"
            sx={{ fontSize: "0.8rem", textTransform: "none", minHeight: 36, py: 0.5 }}
          />
        </Tabs>
        <DialogContent sx={{ minHeight: 320 }}>
          {/* Tab 0 — Basic */}
          {dialogTab === 0 && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                size="small"
                label="Group name *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Frontend access</InputLabel>
                <Select
                  label="Frontend access"
                  value={form.gui_access}
                  onChange={(e) => setForm((f) => ({ ...f, gui_access: Number(e.target.value) }))}
                >
                  <MenuItem value={0}>System default</MenuItem>
                  <MenuItem value={1}>Internal</MenuItem>
                  <MenuItem value={2}>LDAP</MenuItem>
                  <MenuItem value={3}>Disabled</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.users_status === 0}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, users_status: e.target.checked ? 0 : 1 }))
                    }
                    size="small"
                  />
                }
                label="Enabled"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.debug_mode === 1}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, debug_mode: e.target.checked ? 1 : 0 }))
                    }
                    size="small"
                  />
                }
                label="Debug mode"
              />
            </Stack>
          )}

          {/* Tab 1 — Users */}
          {dialogTab === 1 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Select users to add to this group:
              </Typography>
              {zabbixUsers.length === 0 ? (
                <Typography variant="body2" color="text.disabled">
                  No users found.
                </Typography>
              ) : (
                <Box
                  sx={{
                    maxHeight: 320,
                    overflowY: "auto",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  {zabbixUsers.map((u) => (
                    <FormControlLabel
                      key={u.userid}
                      control={
                        <Switch
                          size="small"
                          checked={form.userids.includes(u.userid)}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              userids: e.target.checked
                                ? [...f.userids, u.userid]
                                : f.userids.filter((id) => id !== u.userid),
                            }))
                          }
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {u.username}
                          {u.display !== u.username ? ` (${u.display})` : ""}
                        </Typography>
                      }
                      sx={{
                        display: "flex",
                        mx: 0,
                        px: 1.5,
                        py: 0.5,
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* Tab 2 — Host permissions */}
          {dialogTab === 2 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Set host group access permissions:
              </Typography>
              {form.hostgroup_rights.length > 0 && (
                <TableContainer
                  sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 1.5 }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Host group</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 150 }}>Permission</TableCell>
                        <TableCell sx={{ width: 40 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {form.hostgroup_rights.map((r) => {
                        const grp = hostGroups.find((g) => g.groupid === r.id);
                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              <Typography variant="body2">{grp?.name ?? r.id}</Typography>
                            </TableCell>
                            <TableCell>
                              <Select
                                size="small"
                                value={r.permission}
                                onChange={(e) =>
                                  updatePerm(
                                    form.hostgroup_rights,
                                    (v) => setForm((f) => ({ ...f, hostgroup_rights: v })),
                                    r.id,
                                    Number(e.target.value),
                                  )
                                }
                                sx={{ fontSize: "0.8rem" }}
                              >
                                <MenuItem value={0}>Denied</MenuItem>
                                <MenuItem value={2}>Read only</MenuItem>
                                <MenuItem value={3}>Read-write</MenuItem>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  removeRight(
                                    form.hostgroup_rights,
                                    (v) => setForm((f) => ({ ...f, hostgroup_rights: v })),
                                    r.id,
                                  )
                                }
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel>Add host group</InputLabel>
                <Select
                  label="Add host group"
                  value=""
                  onChange={(e) => {
                    addHGRight(
                      form.hostgroup_rights,
                      (v) => setForm((f) => ({ ...f, hostgroup_rights: v })),
                      e.target.value as string,
                    );
                  }}
                >
                  {hostGroups
                    .filter((g) => !form.hostgroup_rights.some((r) => r.id === g.groupid))
                    .map((g) => (
                      <MenuItem key={g.groupid} value={g.groupid}>
                        {g.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Box>
          )}

          {/* Tab 3 — Template permissions */}
          {dialogTab === 3 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Set template group access permissions:
              </Typography>
              {form.templategroup_rights.length > 0 && (
                <TableContainer
                  sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 1.5 }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Template group</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 150 }}>Permission</TableCell>
                        <TableCell sx={{ width: 40 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {form.templategroup_rights.map((r) => {
                        const grp = templateGroups.find((g) => g.groupid === r.id);
                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              <Typography variant="body2">{grp?.name ?? r.id}</Typography>
                            </TableCell>
                            <TableCell>
                              <Select
                                size="small"
                                value={r.permission}
                                onChange={(e) =>
                                  updatePerm(
                                    form.templategroup_rights,
                                    (v) => setForm((f) => ({ ...f, templategroup_rights: v })),
                                    r.id,
                                    Number(e.target.value),
                                  )
                                }
                                sx={{ fontSize: "0.8rem" }}
                              >
                                <MenuItem value={0}>Denied</MenuItem>
                                <MenuItem value={2}>Read only</MenuItem>
                                <MenuItem value={3}>Read-write</MenuItem>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  removeRight(
                                    form.templategroup_rights,
                                    (v) => setForm((f) => ({ ...f, templategroup_rights: v })),
                                    r.id,
                                  )
                                }
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel>Add template group</InputLabel>
                <Select
                  label="Add template group"
                  value=""
                  onChange={(e) => {
                    addHGRight(
                      form.templategroup_rights,
                      (v) => setForm((f) => ({ ...f, templategroup_rights: v })),
                      e.target.value as string,
                    );
                  }}
                >
                  {templateGroups
                    .filter((g) => !form.templategroup_rights.some((r) => r.id === g.groupid))
                    .map((g) => (
                      <MenuItem key={g.groupid} value={g.groupid}>
                        {g.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Box>
          )}

          {/* Tab 4 — Problem tag filter */}
          {dialogTab === 4 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Filter problems visible to this group by host group and tag:
              </Typography>
              {form.tag_filters.map((tf, idx) => (
                <Stack key={tf._key} direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Host group</InputLabel>
                    <Select
                      label="Host group"
                      value={tf.groupid}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          tag_filters: f.tag_filters.map((x, i) =>
                            i === idx ? { ...x, groupid: e.target.value as string } : x,
                          ),
                        }))
                      }
                    >
                      {hostGroups.map((g) => (
                        <MenuItem key={g.groupid} value={g.groupid}>
                          {g.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Tag"
                    value={tf.tag}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        tag_filters: f.tag_filters.map((x, i) =>
                          i === idx ? { ...x, tag: e.target.value } : x,
                        ),
                      }))
                    }
                    sx={{ width: 140 }}
                  />
                  <TextField
                    size="small"
                    label="Value"
                    value={tf.value}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        tag_filters: f.tag_filters.map((x, i) =>
                          i === idx ? { ...x, value: e.target.value } : x,
                        ),
                      }))
                    }
                    sx={{ width: 140 }}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        tag_filters: f.tag_filters.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Stack>
              ))}
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    tag_filters: [
                      ...f.tag_filters,
                      {
                        _key: generateId(),
                        groupid: hostGroups[0]?.groupid ?? "",
                        tag: "",
                        value: "",
                      },
                    ],
                  }))
                }
              >
                Add filter
              </Button>
            </Box>
          )}
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
