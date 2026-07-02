"use client";

import AddIcon from "@mui/icons-material/Add";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { type Host, type Team, type TeamUser, type UserRow, api } from "../../app/api";
import { ConfirmDelete } from "../../app/components/ConfirmDelete";
import { useAuth } from "../../app/context/AuthContext";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { useSync } from "../../app/context/SyncContext";
import { TeamCard } from "./TeamCard";

type Snack = { msg: string; sev: "success" | "error" };

const ROLE_OPTIONS = [
  {
    value: "team_lead",
    label: "Team Lead",
    color: "#3B82F6",
    description: "Full team management — add/remove users, assign servers, reset passwords.",
  },
  {
    value: "operator",
    label: "Operator",
    color: "#10B981",
    description:
      "Create and delete hosts, items, and triggers within the team. Cannot manage users.",
  },
  {
    value: "member",
    label: "Member",
    color: "#64748B",
    description: "Read-only access to the team's hosts. Cannot create, delete, or modify anything.",
  },
  {
    value: "auditor",
    label: "Auditor",
    color: "#F59E0B",
    description: "Read-only access across ALL teams. Intended for compliance and security reviews.",
  },
] as const;

const ROLE_HIERARCHY = ["member", "operator", "team_lead"] as const;

const cascadeSelect = (current: string[], clicked: string): string[] => {
  const idx = (ROLE_HIERARCHY as readonly string[]).indexOf(clicked);
  if (idx === -1) {
    return current.includes(clicked) ? current.filter((r) => r !== clicked) : [...current, clicked];
  }
  if (current.includes(clicked)) {
    const toRemove = new Set((ROLE_HIERARCHY as readonly string[]).slice(idx));
    return current.filter((r) => !toRemove.has(r));
  }
  const toAdd = (ROLE_HIERARCHY as readonly string[]).slice(0, idx + 1);
  return [...new Set([...current, ...toAdd])];
};

const isInherited = (role: string, selected: string[]): boolean => {
  const idx = (ROLE_HIERARCHY as readonly string[]).indexOf(role);
  if (idx === -1 || idx === ROLE_HIERARCHY.length - 1) return false;
  return (ROLE_HIERARCHY as readonly string[]).slice(idx + 1).some((r) => selected.includes(r));
};

const ROLE_LEVELS: Record<string, number> = { member: 1, operator: 2, team_lead: 3, root: 4 };

const grantableRoles = (callerRoles: string[]): Set<string> => {
  if (callerRoles.includes("root"))
    return new Set(["member", "operator", "team_lead", "auditor", "root"]);
  const max = Math.max(0, ...callerRoles.map((r) => ROLE_LEVELS[r] ?? 0));
  return new Set(
    Object.entries(ROLE_LEVELS)
      .filter(([, level]) => level <= max)
      .map(([role]) => role),
  );
};

export const Teams = () => {
  const tick = useRefreshTick();
  const { lastSync } = useSync();
  const [teams, setTeams] = useState<Team[]>([]);
  const [allHosts, setAllHosts] = useState<Host[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<Snack | null>(null);

  // ── Dialog visibility ────────────────────────────────────────────────
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [assignDialogTeamId, setAssignDialogTeamId] = useState<number | null>(null);
  const [addMemberDialogTeamId, setAddMemberDialogTeamId] = useState<number | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<{
    userId: number;
    teamId: number;
  } | null>(null);
  const [confirmDeleteTeamId, setConfirmDeleteTeamId] = useState<number | null>(null);

  // ── Form state ───────────────────────────────────────────────────────
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.roles?.includes("root") ?? false;
  const isAdmin = isSuperadmin || (currentUser?.roles?.includes("team_lead") ?? false);

  const [username, setUsername] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRoles, setUserRoles] = useState<string[]>(["member"]);
  const [userTeamId, setUserTeamId] = useState<number | "">("");
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [hostSearch, setHostSearch] = useState("");
  const [assignMode, setAssignMode] = useState<"hosts" | "groups">("hosts");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [changePwUser, setChangePwUser] = useState<TeamUser | null>(null);
  const [newPw, setNewPw] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [overview, hostsRes, usersRes] = await Promise.all([
        api.getTeamsOverview(),
        api.listHosts(),
        api.listUsers(),
      ]);
      setTeams(overview.teams);
      setAllHosts(hostsRes.hosts);
      setAllUsers(usersRes.users);
    } catch {
      setSnack({ msg: "Failed to load teams.", sev: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastSync triggers re-fetch on sync events
  useEffect(() => {
    void load();
  }, [load, lastSync]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) void load(true);
  }, [tick]);

  // ── Derived: hosts not assigned to any team ──────────────────────────
  const assignedHostnames = new Set(teams.flatMap((t) => t.hosts));
  const unassignedHosts = allHosts.filter((h) => !assignedHostnames.has(h.host));

  // ── Derived: hosts not yet on the team currently being edited ───────────
  const assignDialogTeamHostnames = new Set(
    teams.find((t) => t.id === assignDialogTeamId)?.hosts ?? [],
  );
  const assignableHosts = allHosts.filter((h) => !assignDialogTeamHostnames.has(h.host));

  // ── Derived: host groups available for bulk-assign ────────────────────
  type GroupEntry = { name: string; hosts: string[] };
  const groupHostMap: Record<string, GroupEntry> = {};
  for (const h of allHosts) {
    for (const g of h.groups ?? []) {
      if (!groupHostMap[g.groupid]) groupHostMap[g.groupid] = { name: g.name, hosts: [] };
      if (!assignDialogTeamHostnames.has(h.host)) groupHostMap[g.groupid].hosts.push(h.host);
    }
  }
  const assignableGroups: Array<[string, GroupEntry]> = Object.entries(groupHostMap)
    .filter(([, g]) => g.hosts.length > 0)
    .sort((a, b) => a[1].name.localeCompare(b[1].name));

  // ── Derived: users not yet in the team being edited ──────────────────
  const addMemberTeam = teams.find((t) => t.id === addMemberDialogTeamId);
  const existingMemberIds = new Set(addMemberTeam?.users.map((u) => u.id) ?? []);
  const addableUsers = allUsers.filter((u) => !existingMemberIds.has(u.id));

  // ── Team actions ─────────────────────────────────────────────────────
  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;
    try {
      await api.createTeam({ name: teamName.trim(), description: teamDesc.trim() });
      setSnack({ msg: "Team created.", sev: "success" });
      setTeamDialogOpen(false);
      setTeamName("");
      setTeamDesc("");
      void load();
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  const handleDeleteTeam = async (teamId: number) => {
    try {
      await api.deleteTeam(teamId);
      setSnack({ msg: "Team deleted.", sev: "success" });
      void load();
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  // ── User actions ─────────────────────────────────────────────────────
  const handleCreateUser = async () => {
    if (!username.trim()) return;
    try {
      await api.createUser({
        username: username.trim(),
        password: userPassword,
        email: userEmail.trim(),
        roles: userRoles.length > 0 ? userRoles : ["member"],
        team_id: userTeamId !== "" ? userTeamId : undefined,
      });
      setSnack({ msg: "User created.", sev: "success" });
      setUserDialogOpen(false);
      setUsername("");
      setUserPassword("");
      setUserEmail("");
      setUserRoles(["member"]);
      setUserTeamId("");
      void load();
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  const handleRemoveFromTeam = async (userId: number, teamId: number) => {
    try {
      await api.removeTeamMember(teamId, userId);
      setSnack({ msg: "User removed from team.", sev: "success" });
      void load();
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  const handleAddMembers = async () => {
    if (selectedMembers.length === 0 || addMemberDialogTeamId === null) return;
    try {
      await Promise.all(
        selectedMembers.map((uid) => api.addTeamMember(addMemberDialogTeamId, uid)),
      );
      setSnack({
        msg: `${selectedMembers.length} member${selectedMembers.length > 1 ? "s" : ""} added.`,
        sev: "success",
      });
      setAddMemberDialogTeamId(null);
      setSelectedMembers([]);
      setMemberSearch("");
      void load();
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  // ── Host assignment actions ───────────────────────────────────────────
  const closeAssignDialog = () => {
    setAssignDialogTeamId(null);
    setSelectedHosts([]);
    setSelectedGroups([]);
    setHostSearch("");
    setGroupSearch("");
    setAssignMode("hosts");
  };

  const handleAssignHost = async () => {
    if (assignDialogTeamId === null) return;
    const hostsFromGroups = selectedGroups.flatMap((gid: string) => groupHostMap[gid]?.hosts ?? []);
    const toAssign = [...new Set([...selectedHosts, ...hostsFromGroups])];
    if (toAssign.length === 0) return;
    try {
      await Promise.all(toAssign.map((h) => api.assignHost(assignDialogTeamId, h)));
      setSnack({
        msg: `${toAssign.length} server${toAssign.length > 1 ? "s" : ""} assigned.`,
        sev: "success",
      });
      closeAssignDialog();
      void load();
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  const handleChangePassword = async () => {
    if (!changePwUser || !newPw.trim()) return;
    try {
      await api.changePassword(changePwUser.id, newPw);
      setSnack({ msg: "Password updated.", sev: "success" });
      setChangePwUser(null);
      setNewPw("");
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  const handleUnassignHost = async (teamId: number, hostname: string) => {
    try {
      await api.unassignHost(teamId, hostname);
      setSnack({ msg: "Host removed from team.", sev: "success" });
      void load();
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  const hostStatusColor = (hostname: string): "success" | "default" => {
    const h = allHosts.find((x) => x.host === hostname);
    return h?.status === "0" ? "success" : "default";
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <Box>
      {/* Header */}
      <Box
        sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Teams
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Manage teams, assign users, and control host access.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          {isAdmin && (
            <Button
              variant="outlined"
              startIcon={<PersonAddOutlinedIcon />}
              onClick={() => {
                setUserTeamId(isSuperadmin ? "" : (currentUser?.team_id ?? ""));
                setUserDialogOpen(true);
              }}
              size="small"
            >
              New User
            </Button>
          )}
          {isSuperadmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setTeamDialogOpen(true)}
              size="small"
            >
              New Team
            </Button>
          )}
        </Box>
      </Box>

      {/* Stats */}
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        {[
          { label: "Teams", value: teams.length },
          { label: "Users", value: allUsers.length },
          { label: "Assigned servers", value: assignedHostnames.size },
          { label: "Unassigned servers", value: unassignedHosts.length },
        ].map((s) => (
          <Card key={s.label} sx={{ px: 2, py: 1.5, minWidth: 130 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.main" }}>
              {s.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {s.label}
            </Typography>
          </Card>
        ))}
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Team cards */}
      {!loading && (
        <Grid container spacing={3}>
          {teams.map((team) => (
            <Grid item xs={12} md={6} xl={4} key={team.id}>
              <TeamCard
                team={team}
                canManage={isSuperadmin || (isAdmin && currentUser?.team_id === team.id)}
                canDeleteTeam={isSuperadmin}
                onDeleteTeam={(id) => setConfirmDeleteTeamId(id)}
                onRemoveFromTeam={(userId, teamId) => setConfirmRemoveMember({ userId, teamId })}
                onChangePassword={(u) => {
                  setChangePwUser(u);
                  setNewPw("");
                }}
                onUnassignHost={handleUnassignHost}
                onAssignHost={() => {
                  setAssignDialogTeamId(team.id);
                  setSelectedHosts([]);
                  setHostSearch("");
                }}
                onAddMember={() => {
                  setAddMemberDialogTeamId(team.id);
                  setMemberSearch("");
                }}
                hostStatusColor={hostStatusColor}
                hostOtherTeams={(hostname) =>
                  teams
                    .filter((t) => t.id !== team.id && t.hosts.includes(hostname))
                    .map((t) => t.name)
                }
                onRolesUpdated={() => void load(true)}
                showToast={(msg, sev) => setSnack({ msg, sev })}
              />
            </Grid>
          ))}

          {teams.length === 0 && (
            <Grid item xs={12}>
              <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
                No teams yet. Create one to get started.
              </Typography>
            </Grid>
          )}
        </Grid>
      )}

      {/* Unassigned servers */}
      {!loading && unassignedHosts.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            Unassigned servers ({unassignedHosts.length})
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {unassignedHosts.map((h) => (
              <Chip
                key={h.hostid}
                label={h.host}
                size="small"
                variant="outlined"
                color={h.status === "0" ? "success" : "default"}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* ── Create team dialog ── */}
      <Dialog
        open={teamDialogOpen}
        onClose={() => setTeamDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>New Team</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}
        >
          <TextField
            label="Team name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label="Description (optional)"
            value={teamDesc}
            onChange={(e) => setTeamDesc(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTeamDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateTeam} disabled={!teamName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Create user dialog ── */}
      <Dialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>New User</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}
        >
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            value={userPassword}
            onChange={({ target: { value } }) => setUserPassword(value)}
            fullWidth
          />
          <TextField
            label="Email (optional)"
            value={userEmail}
            onChange={({ target: { value } }) => setUserEmail(value)}
            fullWidth
          />
          <Box>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontWeight: 500, mb: 1, display: "block" }}
            >
              Roles — select one or more
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              {ROLE_OPTIONS.filter((r) =>
                grantableRoles(currentUser?.roles ?? []).has(r.value),
              ).map((r) => {
                const selected = userRoles.includes(r.value);
                const inherited = isInherited(r.value, userRoles);
                return (
                  <Box
                    key={r.value}
                    onClick={() => setUserRoles((prev) => cascadeSelect(prev, r.value))}
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1.5,
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      border: `1px solid ${selected ? `${r.color}55` : "rgba(148,163,184,0.2)"}`,
                      backgroundColor: selected ? `${r.color}12` : "transparent",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      "&:hover": { borderColor: `${r.color}88`, backgroundColor: `${r.color}08` },
                    }}
                  >
                    <Checkbox
                      checked={selected}
                      size="small"
                      sx={{ p: 0, mt: 0.1, color: r.color, "&.Mui-checked": { color: r.color } }}
                      disableRipple
                    />
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: selected ? r.color : "text.primary",
                            lineHeight: 1.3,
                          }}
                        >
                          {r.label}
                        </Typography>
                        {inherited && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: r.color,
                              opacity: 0.7,
                              fontSize: "0.6rem",
                              fontWeight: 500,
                            }}
                          >
                            inherited
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                        {r.description}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
          <FormControl fullWidth>
            <InputLabel>Team (optional)</InputLabel>
            <Select
              value={userTeamId}
              label="Team (optional)"
              onChange={(e: SelectChangeEvent<number | "">) =>
                setUserTeamId(e.target.value as number | "")
              }
            >
              <MenuItem value="">— No team —</MenuItem>
              {teams.map((t: Team) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateUser} disabled={!username.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add member to team dialog ── */}
      <Dialog
        open={addMemberDialogTeamId !== null}
        onClose={() => {
          setAddMemberDialogTeamId(null);
          setSelectedMembers([]);
          setMemberSearch("");
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          Add Member{selectedMembers.length > 0 ? ` (${selectedMembers.length} selected)` : ""} —{" "}
          {addMemberTeam?.name}
        </DialogTitle>
        <DialogContent sx={{ pt: "12px !important", pb: 0 }}>
          {addableUsers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              All users are already members of this team.
            </Typography>
          ) : (
            <>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <TextField
                  size="small"
                  placeholder="Search users…"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  sx={{ flex: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  size="small"
                  onClick={() => setSelectedMembers(addableUsers.map((u) => u.id))}
                >
                  All
                </Button>
                <Button
                  size="small"
                  onClick={() => setSelectedMembers([])}
                  disabled={selectedMembers.length === 0}
                >
                  Clear
                </Button>
              </Stack>
              <Box
                sx={{
                  maxHeight: 320,
                  overflowY: "auto",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                {addableUsers
                  .filter((u) => {
                    const q = memberSearch.toLowerCase();
                    return (
                      u.username.toLowerCase().includes(q) ||
                      (u.display_name ?? "").toLowerCase().includes(q) ||
                      (u.team_name ?? "").toLowerCase().includes(q)
                    );
                  })
                  .map((u) => {
                    const checked = selectedMembers.includes(u.id);
                    const label = u.display_name?.trim() || u.username;
                    const showUsername = label !== u.username;
                    return (
                      <Box
                        key={u.id}
                        onClick={() =>
                          setSelectedMembers((prev) =>
                            checked ? prev.filter((id) => id !== u.id) : [...prev, u.id],
                          )
                        }
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          px: 1,
                          py: 0.75,
                          cursor: "pointer",
                          bgcolor: checked ? "action.selected" : "transparent",
                          "&:hover": { bgcolor: checked ? "action.selected" : "action.hover" },
                          "&:not(:last-child)": {
                            borderBottom: "1px solid",
                            borderColor: "divider",
                          },
                        }}
                      >
                        <Checkbox checked={checked} size="small" disableRipple sx={{ p: 0.5 }} />
                        <Box sx={{ flex: 1, ml: 0.5 }}>
                          <Typography variant="body2" sx={{ fontSize: "0.83rem", fontWeight: 500 }}>
                            {label}
                          </Typography>
                          {(showUsername || u.team_name) && (
                            <Typography variant="caption" color="text.secondary">
                              {showUsername ? u.username : ""}
                              {showUsername && u.team_name ? " · " : ""}
                              {u.team_name ?? ""}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          {(u.roles ?? []).map((r) => (
                            <Chip
                              key={r}
                              label={r}
                              size="small"
                              variant="outlined"
                              sx={{ height: 18, fontSize: "0.6rem" }}
                            />
                          ))}
                        </Box>
                      </Box>
                    );
                  })}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddMemberDialogTeamId(null);
              setSelectedMembers([]);
              setMemberSearch("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddMembers}
            disabled={selectedMembers.length === 0}
          >
            Add {selectedMembers.length > 0 ? `(${selectedMembers.length})` : ""}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Assign hosts dialog ── */}
      <Dialog
        open={assignDialogTeamId !== null}
        onClose={closeAssignDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          Assign Servers
          {selectedHosts.length + selectedGroups.length > 0 && (
            <Typography component="span" variant="body2" color="primary.main" sx={{ ml: 1 }}>
              (
              {selectedHosts.length +
                selectedGroups.reduce(
                  (s: number, gid: string) => s + (groupHostMap[gid]?.hosts.length ?? 0),
                  0,
                )}{" "}
              hosts)
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: "4px !important", pb: 0 }}>
          <Tabs
            value={assignMode}
            onChange={(_e, v: "hosts" | "groups") => setAssignMode(v)}
            sx={{ mb: 1.5, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab
              label="Individual Hosts"
              value="hosts"
              sx={{ fontSize: "0.8rem", minHeight: 40 }}
            />
            <Tab label="Host Groups" value="groups" sx={{ fontSize: "0.8rem", minHeight: 40 }} />
          </Tabs>

          {assignMode === "hosts" ? (
            assignableHosts.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                All servers are already on this team.
              </Typography>
            ) : (
              <>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search servers…"
                  value={hostSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setHostSearch(e.target.value)
                  }
                  sx={{ mb: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Box
                  sx={{
                    maxHeight: 280,
                    overflowY: "auto",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  {assignableHosts
                    .filter((h) => h.host.toLowerCase().includes(hostSearch.toLowerCase()))
                    .map((h) => {
                      const otherTeams = teams
                        .filter((t) => t.id !== assignDialogTeamId && t.hosts.includes(h.host))
                        .map((t) => t.name);
                      const checked = selectedHosts.includes(h.host);
                      return (
                        <Box
                          key={h.hostid}
                          onClick={() =>
                            setSelectedHosts((prev: string[]) =>
                              checked
                                ? prev.filter((x: string) => x !== h.host)
                                : [...prev, h.host],
                            )
                          }
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            px: 1,
                            py: 0.5,
                            cursor: "pointer",
                            bgcolor: checked ? "action.selected" : "transparent",
                            "&:hover": { bgcolor: "action.hover" },
                            "&:not(:last-child)": {
                              borderBottom: "1px solid",
                              borderColor: "divider",
                            },
                          }}
                        >
                          <Checkbox checked={checked} size="small" disableRipple sx={{ p: 0.5 }} />
                          <Box sx={{ ml: 0.5 }}>
                            <Typography
                              variant="body2"
                              sx={{ fontSize: "0.83rem", fontWeight: 500 }}
                            >
                              {h.host}
                            </Typography>
                            {otherTeams.length > 0 && (
                              <Typography variant="caption" color="text.secondary">
                                also on {otherTeams.join(", ")}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1, mb: 0.5 }}>
                  <Button
                    size="small"
                    onClick={() => setSelectedHosts(assignableHosts.map((h) => h.host))}
                    disabled={selectedHosts.length === assignableHosts.length}
                  >
                    Select all
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setSelectedHosts([])}
                    disabled={selectedHosts.length === 0}
                  >
                    Clear
                  </Button>
                </Box>
              </>
            )
          ) : assignableGroups.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No host groups with unassigned servers.
            </Typography>
          ) : (
            <>
              <TextField
                size="small"
                fullWidth
                placeholder="Search groups…"
                value={groupSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setGroupSearch(e.target.value)
                }
                sx={{ mb: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Box
                sx={{
                  maxHeight: 280,
                  overflowY: "auto",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                {assignableGroups
                  .filter(([, g]) => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
                  .map(([gid, g]) => {
                    const checked = selectedGroups.includes(gid);
                    return (
                      <Box
                        key={gid}
                        onClick={() =>
                          setSelectedGroups((prev: string[]) =>
                            checked ? prev.filter((x: string) => x !== gid) : [...prev, gid],
                          )
                        }
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          px: 1,
                          py: 0.5,
                          cursor: "pointer",
                          bgcolor: checked ? "action.selected" : "transparent",
                          "&:hover": { bgcolor: "action.hover" },
                          "&:not(:last-child)": {
                            borderBottom: "1px solid",
                            borderColor: "divider",
                          },
                        }}
                      >
                        <Checkbox checked={checked} size="small" disableRipple sx={{ p: 0.5 }} />
                        <Box sx={{ ml: 0.5, flex: 1 }}>
                          <Typography variant="body2" sx={{ fontSize: "0.83rem", fontWeight: 500 }}>
                            {g.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {g.hosts.length} server{g.hosts.length !== 1 ? "s" : ""}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1, mb: 0.5 }}>
                <Button
                  size="small"
                  onClick={() => setSelectedGroups(assignableGroups.map(([gid]) => gid))}
                  disabled={selectedGroups.length === assignableGroups.length}
                >
                  Select all
                </Button>
                <Button
                  size="small"
                  onClick={() => setSelectedGroups([])}
                  disabled={selectedGroups.length === 0}
                >
                  Clear
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAssignDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAssignHost}
            disabled={selectedHosts.length === 0 && selectedGroups.length === 0}
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Change password dialog ── */}
      <Dialog
        open={changePwUser !== null}
        onClose={() => setChangePwUser(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Change Password — {changePwUser?.username}</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          <TextField
            label="New password"
            type="password"
            value={newPw}
            onChange={({ target: { value } }) => setNewPw(value)}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangePwUser(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleChangePassword} disabled={!newPw.trim()}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDelete
        open={confirmDeleteTeamId !== null}
        name={teams.find((t) => t.id === confirmDeleteTeamId)?.name ?? ""}
        description="This will permanently delete the team and remove all its host assignments. Users will not be deleted. This cannot be undone."
        onConfirm={async () => {
          if (confirmDeleteTeamId === null) return;
          await handleDeleteTeam(confirmDeleteTeamId);
          setConfirmDeleteTeamId(null);
        }}
        onClose={() => setConfirmDeleteTeamId(null)}
      />

      <ConfirmDelete
        open={confirmRemoveMember !== null}
        name=""
        description="This will remove the user from this team. The user account will not be deleted — they can be added back at any time."
        onConfirm={async () => {
          if (confirmRemoveMember === null) return;
          await handleRemoveFromTeam(confirmRemoveMember.userId, confirmRemoveMember.teamId);
          setConfirmRemoveMember(null);
        }}
        onClose={() => setConfirmRemoveMember(null)}
      />

      {/* ── Snackbar ── */}
      <Snackbar
        open={snack !== null}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack?.sev} onClose={() => setSnack(null)} variant="filled">
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};
