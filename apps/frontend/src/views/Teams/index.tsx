"use client";

import AddIcon from "@mui/icons-material/Add";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
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
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { type Host, type Team, type TeamUser, api } from "../../app/api";
import { useAuth } from "../../app/context/AuthContext";
import { useSync } from "../../app/context/SyncContext";
import { SearchableSelect } from "../../components/SearchableSelect";
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
  const { lastSync } = useSync();
  const [teams, setTeams] = useState<Team[]>([]);
  const [allHosts, setAllHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<Snack | null>(null);

  // ── Dialog visibility ────────────────────────────────────────────────
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [assignDialogTeamId, setAssignDialogTeamId] = useState<number | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<number | null>(null);
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
  const [selectedHost, setSelectedHost] = useState("");
  const [changePwUser, setChangePwUser] = useState<TeamUser | null>(null);
  const [newPw, setNewPw] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, hostsRes] = await Promise.all([api.getTeamsOverview(), api.listHosts()]);
      setTeams(overview.teams);
      setAllHosts(hostsRes.hosts);
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

  // ── Derived: hosts not assigned to any team ──────────────────────────
  const assignedHostnames = new Set(teams.flatMap((t) => t.hosts));
  const unassignedHosts = allHosts.filter((h) => !assignedHostnames.has(h.host));

  // ── Derived: hosts not yet on the team currently being edited ───────────
  // A host may belong to multiple teams, so this only excludes hosts already
  // on *this* team — hosts assigned elsewhere are still offered here.
  const assignDialogTeamHostnames = new Set(
    teams.find((t) => t.id === assignDialogTeamId)?.hosts ?? [],
  );
  const assignableHosts = allHosts.filter((h) => !assignDialogTeamHostnames.has(h.host));

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

  const handleDeleteUser = async (userId: number) => {
    try {
      await api.deleteUser(userId);
      setSnack({ msg: "User removed.", sev: "success" });
      void load();
    } catch (e) {
      setSnack({ msg: (e as Error).message, sev: "error" });
    }
  };

  // ── Host assignment actions ───────────────────────────────────────────
  const handleAssignHost = async () => {
    if (!selectedHost || assignDialogTeamId === null) return;
    try {
      await api.assignHost(assignDialogTeamId, selectedHost);
      setSnack({ msg: "Host assigned.", sev: "success" });
      setAssignDialogTeamId(null);
      setSelectedHost("");
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <GroupsOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Teams
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
          { label: "Users", value: teams.reduce((s, t) => s + t.users.length, 0) },
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
                onDeleteUser={(id) => setConfirmDeleteUserId(id)}
                onChangePassword={(u) => {
                  setChangePwUser(u);
                  setNewPw("");
                }}
                onUnassignHost={handleUnassignHost}
                onAssignHost={() => {
                  setAssignDialogTeamId(team.id);
                  setSelectedHost("");
                }}
                hostStatusColor={hostStatusColor}
                hostOtherTeams={(hostname) =>
                  teams
                    .filter((t) => t.id !== team.id && t.hosts.includes(hostname))
                    .map((t) => t.name)
                }
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

      {/* ── Assign host dialog ── */}
      <Dialog
        open={assignDialogTeamId !== null}
        onClose={() => setAssignDialogTeamId(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Assign Server</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          <FormControl fullWidth>
            <InputLabel>Server</InputLabel>
            <SearchableSelect
              value={selectedHost}
              label="Server"
              onChange={(e: SelectChangeEvent) => setSelectedHost(e.target.value)}
            >
              {assignableHosts.length === 0 ? (
                <MenuItem disabled value="">
                  All servers are already on this team
                </MenuItem>
              ) : (
                assignableHosts.map((h: Host) => {
                  const otherTeams = teams
                    .filter((t) => t.id !== assignDialogTeamId && t.hosts.includes(h.host))
                    .map((t) => t.name);
                  return (
                    <MenuItem key={h.hostid} value={h.host}>
                      {h.host}
                      {otherTeams.length > 0 ? ` (also on ${otherTeams.join(", ")})` : ""}
                    </MenuItem>
                  );
                })
              )}
            </SearchableSelect>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogTeamId(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssignHost} disabled={!selectedHost}>
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

      {/* ── Confirm delete team ── */}
      <Dialog
        open={confirmDeleteTeamId !== null}
        onClose={() => setConfirmDeleteTeamId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete team?</DialogTitle>
        <DialogContent>
          <Typography>
            This will permanently delete the team and remove all its host assignments. Users will
            not be deleted. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteTeamId(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (confirmDeleteTeamId === null) return;
              await handleDeleteTeam(confirmDeleteTeamId);
              setConfirmDeleteTeamId(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Confirm remove user ── */}
      <Dialog open={confirmDeleteUserId !== null} onClose={() => setConfirmDeleteUserId(null)}>
        <DialogTitle>Remove user?</DialogTitle>
        <DialogContent>
          <Typography>
            This will remove the user from the portal. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteUserId(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (confirmDeleteUserId === null) return;
              await handleDeleteUser(confirmDeleteUserId);
              setConfirmDeleteUserId(null);
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>

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
