"use client";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import { api, type Team, type UserRow } from "../../app/api";
import { ConfirmDelete } from "../../app/components/ConfirmDelete";
import { useAuth } from "../../app/context/AuthContext";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { useSync } from "../../app/context/SyncContext";
import { FilterSearchField, filterLabelSx } from "../../components/FilterBar";
import { RestrictionPicker } from "./RestrictionPicker";
import { RolePicker } from "./RolePicker";
import { avatarColor, ROLE_OPTIONS, roleColor, roleLabel, userInitials } from "./shared";

const userSourceLabel = (source: UserRow["source"]) =>
  source === "ldap" ? "LDAP" : source === "zabbix" ? "Zabbix" : "Local";

const userSourceColor = (source: UserRow["source"]) =>
  source === "ldap" ? "info" : source === "zabbix" ? "warning" : ("default" as const);

const UserRowItem = ({
  u,
  idx,
  isExpanded,
  onToggle,
  onEdit,
  onResetPassword,
  onDeleteRequest,
}: {
  u: UserRow;
  idx: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (u: UserRow) => void;
  onResetPassword: (u: UserRow) => void;
  onDeleteRequest: (u: UserRow) => void;
}) => {
  const displayLabel = u.display_name?.trim() || u.username;
  const sourceLabel = userSourceLabel(u.source);
  const sourceColor = userSourceColor(u.source);
  return (
    <Box>
      {idx > 0 && <Divider />}
      {/* Clickable summary row */}
      <Box
        onClick={onToggle}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 2.5,
          py: 1.75,
          cursor: "pointer",
          "&:hover": { backgroundColor: "action.hover" },
          transition: "background 0.15s ease",
        }}
      >
        {/* Avatar */}
        <Avatar
          sx={{
            width: 36,
            height: 36,
            fontSize: "0.75rem",
            fontWeight: 600,
            bgcolor: avatarColor(u.username),
            flexShrink: 0,
          }}
        >
          {userInitials(u.display_name?.trim() || u.username)}
        </Avatar>

        {/* Identity */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {displayLabel}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {u.email || "—"}
          </Typography>
        </Box>

        {/* Roles */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.5,
            flex: 1,
            justifyContent: "flex-start",
          }}
        >
          {(u.roles ?? []).map((r) => (
            <Chip
              key={r}
              label={roleLabel(r)}
              size="small"
              color={roleColor(r)}
              variant="outlined"
              sx={{ height: 20, fontSize: "0.68rem" }}
            />
          ))}
        </Box>

        {/* Team */}
        <Box sx={{ minWidth: 120, display: { xs: "none", md: "block" } }}>
          {u.team_name ? (
            <Chip
              label={u.team_name}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: "0.68rem", borderColor: "rgba(148,163,184,0.3)" }}
            />
          ) : (
            <Typography variant="caption" color="text.disabled">
              No team
            </Typography>
          )}
        </Box>
      </Box>

      {/* Expanded detail */}
      <Collapse in={isExpanded} unmountOnExit>
        <Box
          sx={{
            px: 3,
            pb: 1.5,
            pt: 0,
            bgcolor: "action.hover",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack spacing={0.5} sx={{ pt: 1.25, pb: 1 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography variant="caption" color="text.disabled" sx={{ minWidth: 90 }}>
                Login
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                {u.username}
              </Typography>
            </Box>
            {u.display_name?.trim() && u.display_name !== u.username && (
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Typography variant="caption" color="text.disabled" sx={{ minWidth: 90 }}>
                  Display name
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  {u.display_name}
                </Typography>
              </Box>
            )}
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography variant="caption" color="text.disabled" sx={{ minWidth: 90 }}>
                Email
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                {u.email || "—"}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography variant="caption" color="text.disabled" sx={{ minWidth: 90 }}>
                Source
              </Typography>
              <Chip
                label={sourceLabel}
                size="small"
                color={sourceColor}
                variant="outlined"
                sx={{ height: 16, fontSize: "0.6rem" }}
              />
            </Box>
          </Stack>
          {/* Actions */}
          <Box sx={{ display: "flex", gap: 0.5, pt: 0.5 }}>
            <Tooltip title="Edit roles & team">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(u);
                }}
                sx={{ color: "primary.main" }}
              >
                <EditOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset password">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onResetPassword(u);
                }}
                sx={{ color: "warning.main" }}
              >
                <LockResetOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete user">
              <IconButton
                size="small"
                aria-label="Delete user"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRequest(u);
                }}
                sx={{ color: "error.main" }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

const EditUserDialog = ({
  editUser,
  editRoles,
  setEditRoles,
  editRestrictions,
  setEditRestrictions,
  isRoot,
  teams,
  editTeamId,
  setEditTeamId,
  onClose,
  onSave,
}: {
  editUser: UserRow | null;
  editRoles: string[];
  setEditRoles: Dispatch<SetStateAction<string[]>>;
  editRestrictions: string[];
  setEditRestrictions: Dispatch<SetStateAction<string[]>>;
  isRoot: boolean;
  teams: Team[];
  editTeamId: number | "";
  setEditTeamId: (id: number | "") => void;
  onClose: () => void;
  onSave: () => void;
}) => (
  <Dialog open={!!editUser} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle sx={{ fontWeight: 700 }}>
      Edit User — {editUser?.display_name?.trim() || editUser?.username}
    </DialogTitle>
    <DialogContent sx={{ pt: "16px !important" }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 500, mb: 1, display: "block" }}
          >
            Roles — select one or more
          </Typography>
          <RolePicker selected={editRoles} onChange={setEditRoles} />
        </Box>
        <Box>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 500, mb: 1, display: "block" }}
          >
            Restrictions — removes write access even if the role above allows it
          </Typography>
          <RestrictionPicker selected={editRestrictions} onChange={setEditRestrictions} />
        </Box>
        {isRoot && (
          <FormControl fullWidth size="small">
            <InputLabel>Team</InputLabel>
            <Select
              value={editTeamId}
              label="Team"
              onChange={(e: SelectChangeEvent<number | "">) =>
                setEditTeamId(e.target.value as number | "")
              }
            >
              <MenuItem value="">— No team —</MenuItem>
              {teams.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="contained" onClick={onSave} disabled={editRoles.length === 0}>
        Save
      </Button>
    </DialogActions>
  </Dialog>
);

const ResetPasswordDialog = ({
  pwUser,
  newPw,
  setNewPw,
  showNewPw,
  setShowNewPw,
  onClose,
  onSave,
}: {
  pwUser: UserRow | null;
  newPw: string;
  setNewPw: (v: string) => void;
  showNewPw: boolean;
  setShowNewPw: (fn: (v: boolean) => boolean) => void;
  onClose: () => void;
  onSave: () => void;
}) => (
  <Dialog open={!!pwUser} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle sx={{ fontWeight: 700 }}>
      Reset Password — {pwUser?.display_name?.trim() || pwUser?.username}
    </DialogTitle>
    <DialogContent sx={{ pt: "16px !important" }}>
      <TextField
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowNewPw((v) => !v)}
                >
                  {showNewPw ? (
                    <VisibilityOffIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <VisibilityIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        label="New password"
        type={showNewPw ? "text" : "password"}
        value={newPw}
        onChange={(e) => setNewPw(e.target.value)}
        fullWidth
        autoFocus
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="contained" onClick={onSave} disabled={!newPw.trim()}>
        Update
      </Button>
    </DialogActions>
  </Dialog>
);

const CreateUserDialog = ({
  open,
  onClose,
  newUsername,
  setNewUsername,
  newPassword,
  setNewPassword,
  showCreatePw,
  setShowCreatePw,
  newEmail,
  setNewEmail,
  newRoles,
  setNewRoles,
  newRestrictions,
  setNewRestrictions,
  teams,
  newTeamId,
  setNewTeamId,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  newUsername: string;
  setNewUsername: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  showCreatePw: boolean;
  setShowCreatePw: (fn: (v: boolean) => boolean) => void;
  newEmail: string;
  setNewEmail: (v: string) => void;
  newRoles: string[];
  setNewRoles: Dispatch<SetStateAction<string[]>>;
  newRestrictions: string[];
  setNewRestrictions: Dispatch<SetStateAction<string[]>>;
  teams: Team[];
  newTeamId: number | "";
  setNewTeamId: (id: number | "") => void;
  onCreate: () => void;
}) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle sx={{ fontWeight: 700 }}>New User</DialogTitle>
    <DialogContent sx={{ pt: "16px !important" }}>
      <Stack spacing={2}>
        <TextField
          label="Username"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          fullWidth
          autoFocus
        />
        <TextField
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowCreatePw((v) => !v)}
                  >
                    {showCreatePw ? (
                      <VisibilityOffIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <VisibilityIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
          label="Password"
          type={showCreatePw ? "text" : "password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          fullWidth
        />
        <TextField
          label="Email (optional)"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          fullWidth
        />
        <Box>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 500, mb: 1, display: "block" }}
          >
            Roles — select one or more
          </Typography>
          <RolePicker selected={newRoles} onChange={setNewRoles} />
        </Box>
        <Box>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 500, mb: 1, display: "block" }}
          >
            Restrictions — removes write access even if the role above allows it
          </Typography>
          <RestrictionPicker selected={newRestrictions} onChange={setNewRestrictions} />
        </Box>
        <FormControl fullWidth size="small">
          <InputLabel>Team (optional)</InputLabel>
          <Select
            value={newTeamId}
            label="Team (optional)"
            onChange={(e: SelectChangeEvent<number | "">) =>
              setNewTeamId(e.target.value as number | "")
            }
          >
            <MenuItem value="">— No team —</MenuItem>
            {teams.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        variant="contained"
        onClick={onCreate}
        disabled={!(newUsername.trim() && newPassword) || newRoles.length === 0}
      >
        Create
      </Button>
    </DialogActions>
  </Dialog>
);

export const Users = () => {
  const tick = useRefreshTick();
  const { lastSync } = useSync();
  const { user: currentUser } = useAuth();
  const isRoot = currentUser?.roles?.includes("root") ?? false;

  const [users, setUsers] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState<number | "">("");
  const [filterRole, setFilterRole] = useState("");

  // ── Edit dialog ────────────────────────────────────────────────────────
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editRestrictions, setEditRestrictions] = useState<string[]>([]);
  const [editTeamId, setEditTeamId] = useState<number | "">("");

  // ── Password dialog ────────────────────────────────────────────────────
  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [newPw, setNewPw] = useState("");

  // ── Create dialog ──────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoles, setNewRoles] = useState<string[]>([]);
  const [newRestrictions, setNewRestrictions] = useState<string[]>([]);
  const [newTeamId, setNewTeamId] = useState<number | "">("");

  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showCreatePw, setShowCreatePw] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; sev: "success" | "error" } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const [usersRes, teamsRes] = await Promise.all([api.listUsers(), api.getTeamsOverview()]);
      setUsers(usersRes.users);
      setTeams(teamsRes.teams);
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(lastSync > 0);
  }, [load, lastSync]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      void load(true);
    }
  }, [tick]);

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditRoles(u.roles ?? []);
    setEditRestrictions(u.restrictions ?? []);
    setEditTeamId(u.team_id ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editUser) {
      return;
    }
    try {
      await api.updateUser(editUser.id, {
        roles: editRoles,
        restrictions: editRestrictions,
        team_id: editTeamId !== "" ? editTeamId : null,
      });
      setSnack({ msg: "User updated.", sev: "success" });
      setEditUser(null);
      void load();
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  const handleResetPassword = async () => {
    if (!(pwUser && newPw.trim())) {
      return;
    }
    try {
      await api.changePassword(pwUser.id, newPw.trim());
      setSnack({ msg: "Password updated.", sev: "success" });
      setPwUser(null);
      setNewPw("");
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  const handleDelete = async (u: UserRow) => {
    try {
      await api.deleteUser(u.id);
      setSnack({ msg: `User '${u.username}' deleted.`, sev: "success" });
      setConfirmDelete(null);
      void load();
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  const handleCreate = async () => {
    if (!(newUsername.trim() && newPassword)) {
      return;
    }
    try {
      await api.createUser({
        username: newUsername.trim(),
        password: newPassword,
        email: newEmail.trim(),
        roles: newRoles,
        restrictions: newRestrictions,
        team_id: newTeamId !== "" ? newTeamId : undefined,
      });
      setSnack({ msg: "User created.", sev: "success" });
      setCreateOpen(false);
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewRoles([]);
      setNewRestrictions([]);
      setNewTeamId("");
      void load();
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchTeam = filterTeam === "" || u.team_id === filterTeam;
    const matchRole = !filterRole || (u.roles ?? []).includes(filterRole);
    return matchSearch && matchTeam && matchRole;
  });

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="subtitle1">Users</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {isRoot ? "All users across every team" : "Users in your team"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButton size="small" onClick={() => void load()} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
          <Button
            variant="contained"
            startIcon={<PersonAddOutlinedIcon />}
            size="small"
            onClick={() => setCreateOpen(true)}
          >
            New User
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Card>
        <CardContent sx={{ py: "12px !important" }}>
          <Stack
            sx={{ alignItems: "center" }}
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
          >
            <FilterSearchField
              placeholder="Search by name or email…"
              value={search}
              onChange={setSearch}
            />
            {isRoot && (
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel sx={filterLabelSx}>Team</InputLabel>
                <Select
                  value={filterTeam}
                  label="Team"
                  onChange={(e: SelectChangeEvent<number | "">) =>
                    setFilterTeam(e.target.value as number | "")
                  }
                  sx={filterLabelSx}
                >
                  <MenuItem value="" sx={filterLabelSx}>
                    All teams
                  </MenuItem>
                  {teams.map((t) => (
                    <MenuItem key={t.id} value={t.id} sx={filterLabelSx}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel sx={filterLabelSx}>Role</InputLabel>
              <Select
                value={filterRole}
                label="Role"
                onChange={(e: SelectChangeEvent) => setFilterRole(e.target.value)}
                sx={filterLabelSx}
              >
                <MenuItem value="" sx={filterLabelSx}>
                  All roles
                </MenuItem>
                {ROLE_OPTIONS.map((r) => (
                  <MenuItem key={r.value} value={r.value} sx={filterLabelSx}>
                    {r.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {/* User list */}
      <Card>
        <CardContent sx={{ p: "0 !important" }}>
          {loading && users.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <PeopleOutlinedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
              <Typography color="text.secondary" variant="body2">
                No users found
              </Typography>
            </Box>
          ) : (
            filtered.map((u, idx) => (
              <UserRowItem
                key={u.id}
                u={u}
                idx={idx}
                isExpanded={expandedUserId === u.id}
                onToggle={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                onEdit={openEdit}
                onResetPassword={(user) => {
                  setPwUser(user);
                  setNewPw("");
                }}
                onDeleteRequest={setConfirmDelete}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Edit dialog ── */}
      <EditUserDialog
        editUser={editUser}
        editRoles={editRoles}
        setEditRoles={setEditRoles}
        editRestrictions={editRestrictions}
        setEditRestrictions={setEditRestrictions}
        isRoot={isRoot}
        teams={teams}
        editTeamId={editTeamId}
        setEditTeamId={setEditTeamId}
        onClose={() => setEditUser(null)}
        onSave={() => void handleSaveEdit()}
      />

      {/* ── Reset password dialog ── */}
      <ResetPasswordDialog
        pwUser={pwUser}
        newPw={newPw}
        setNewPw={setNewPw}
        showNewPw={showNewPw}
        setShowNewPw={setShowNewPw}
        onClose={() => setPwUser(null)}
        onSave={() => void handleResetPassword()}
      />

      {/* ── Create user dialog ── */}
      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        newUsername={newUsername}
        setNewUsername={setNewUsername}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        showCreatePw={showCreatePw}
        setShowCreatePw={setShowCreatePw}
        newEmail={newEmail}
        setNewEmail={setNewEmail}
        newRoles={newRoles}
        setNewRoles={setNewRoles}
        newRestrictions={newRestrictions}
        setNewRestrictions={setNewRestrictions}
        teams={teams}
        newTeamId={newTeamId}
        setNewTeamId={setNewTeamId}
        onCreate={() => void handleCreate()}
      />

      <ConfirmDelete
        open={!!confirmDelete}
        name={confirmDelete?.display_name?.trim() || confirmDelete?.username || ""}
        onConfirm={() => confirmDelete && void handleDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />

      {/* Toast */}
      <Snackbar
        open={!!snack}
        autoHideDuration={3500}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnack(null)}
          severity={snack?.sev ?? "success"}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
};
