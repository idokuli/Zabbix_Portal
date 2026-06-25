"use client";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
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
import { useCallback, useEffect, useState } from "react";
import { type Team, type UserRow, api } from "../../app/api";
import { useAuth } from "../../app/context/AuthContext";
import { useSync } from "../../app/context/SyncContext";
import { RolePicker } from "./RolePicker";
import { ROLE_OPTIONS, avatarColor, roleColor, roleLabel, userInitials } from "./shared";

export const Users = () => {
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
  const [newTeamId, setNewTeamId] = useState<number | "">("");

  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showCreatePw, setShowCreatePw] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; sev: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastSync triggers re-fetch on sync events
  useEffect(() => {
    void load();
  }, [load, lastSync]);

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditRoles(u.roles ?? []);
    setEditTeamId(u.team_id ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    try {
      await api.updateUser(editUser.id, {
        roles: editRoles,
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
    if (!pwUser || !newPw.trim()) return;
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
    if (!newUsername.trim() || !newPassword) return;
    try {
      await api.createUser({
        username: newUsername.trim(),
        password: newPassword,
        email: newEmail.trim(),
        roles: newRoles,
        team_id: newTeamId !== "" ? newTeamId : undefined,
      });
      setSnack({ msg: "User created.", sev: "success" });
      setCreateOpen(false);
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewRoles([]);
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <PeopleOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Users
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isRoot ? "All users across every team" : "Users in your team"}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButton size="small" onClick={load} disabled={loading}>
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
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
            <TextField
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                  </InputAdornment>
                ),
              }}
            />
            {isRoot && (
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Team</InputLabel>
                <Select
                  value={filterTeam}
                  label="Team"
                  onChange={(e: SelectChangeEvent<number | "">) =>
                    setFilterTeam(e.target.value as number | "")
                  }
                >
                  <MenuItem value="">All teams</MenuItem>
                  {teams.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={filterRole}
                label="Role"
                onChange={(e: SelectChangeEvent) => setFilterRole(e.target.value)}
              >
                <MenuItem value="">All roles</MenuItem>
                {ROLE_OPTIONS.map((r) => (
                  <MenuItem key={r.value} value={r.value}>
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
              <Box key={u.id}>
                {idx > 0 && <Divider />}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    px: 2.5,
                    py: 1.75,
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
                      fontWeight: 700,
                      background: `linear-gradient(135deg, ${avatarColor(u.username)}, ${avatarColor(u.username)}99)`,
                      flexShrink: 0,
                    }}
                  >
                    {userInitials(u.username)}
                  </Avatar>

                  {/* Identity */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {u.username}
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
                        sx={{
                          height: 20,
                          fontSize: "0.68rem",
                          borderColor: "rgba(148,163,184,0.3)",
                        }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        No team
                      </Typography>
                    )}
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0 }}>
                    <Tooltip title="Edit roles & team">
                      <IconButton
                        size="small"
                        onClick={() => openEdit(u)}
                        sx={{ color: "primary.main" }}
                      >
                        <EditOutlinedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Reset password">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setPwUser(u);
                          setNewPw("");
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
                        onClick={() => setConfirmDelete(u)}
                        sx={{ color: "error.main" }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editUser} onClose={() => setEditUser(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Edit User — {editUser?.username}</DialogTitle>
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
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={editRoles.length === 0}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reset password dialog ── */}
      <Dialog open={!!pwUser} onClose={() => setPwUser(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Reset Password — {pwUser?.username}</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          <TextField
            label="New password"
            type={showNewPw ? "text" : "password"}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            fullWidth
            autoFocus
            InputProps={{
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
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwUser(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleResetPassword} disabled={!newPw.trim()}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Create user dialog ── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
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
              label="Password"
              type={showCreatePw ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              InputProps={{
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
              }}
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
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newUsername.trim() || !newPassword || newRoles.length === 0}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete user?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Permanently delete <strong>{confirmDelete?.username}</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => confirmDelete && void handleDelete(confirmDelete)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

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
