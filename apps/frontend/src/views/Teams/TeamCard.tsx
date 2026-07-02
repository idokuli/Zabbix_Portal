"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import type React from "react";
import { useState } from "react";
import type { Team, TeamUser } from "../../app/api";
import { teamsApi } from "../../app/api/teams";

const roleColor = (r: string): "error" | "primary" | "secondary" | "warning" | "default" =>
  r === "root"
    ? "error"
    : r === "team_lead"
      ? "primary"
      : r === "operator"
        ? "secondary"
        : r === "auditor"
          ? "warning"
          : "default";
const roleLabel = (r: string) =>
  r === "team_lead" ? "Team Lead" : r.charAt(0).toUpperCase() + r.slice(1);

type TeamCardProps = {
  team: Team;
  canManage: boolean;
  canDeleteTeam: boolean;
  onDeleteTeam: (id: number) => void;
  onRemoveFromTeam: (userId: number, teamId: number) => void;
  onChangePassword: (user: TeamUser) => void;
  onUnassignHost: (teamId: number, hostname: string) => void;
  onAssignHost: () => void;
  onAddMember: () => void;
  hostStatusColor: (hostname: string) => "success" | "default";
  hostOtherTeams: (hostname: string) => string[];
  onRolesUpdated: () => void;
  showToast: (msg: string, sev: "success" | "error") => void;
};

const sourceLabel = (src?: string) =>
  src === "ldap" ? "LDAP" : src === "zabbix" ? "Zabbix" : "Local";

const sourceColor = (src?: string): "info" | "warning" | "default" =>
  src === "ldap" ? "info" : src === "zabbix" ? "warning" : "default";

const ASSIGNABLE_ROLES = ["team_lead", "operator", "auditor", "member"] as const;

export const TeamCard = ({
  team,
  canManage,
  canDeleteTeam,
  onDeleteTeam,
  onRemoveFromTeam,
  onChangePassword,
  onUnassignHost,
  onAssignHost,
  onAddMember,
  hostStatusColor,
  hostOtherTeams,
  onRolesUpdated,
  showToast,
}: TeamCardProps) => {
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [serversOpen, setServersOpen] = useState(false);
  const [pendingRoles, setPendingRoles] = useState<string[]>(team.roles ?? []);
  const [savingRoles, setSavingRoles] = useState(false);
  const rolesChanged =
    JSON.stringify([...pendingRoles].sort()) !== JSON.stringify([...(team.roles ?? [])].sort());

  const handleSaveRoles = async () => {
    setSavingRoles(true);
    try {
      await teamsApi.setTeamRoles(team.id, pendingRoles);
      showToast("Team permissions updated. Members will inherit on next login.", "success");
      onRolesUpdated();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSavingRoles(false);
    }
  };

  return (
    <Card sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
        {/* Card header */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {team.name}
            </Typography>
            {team.description && (
              <Typography variant="body2" color="text.secondary">
                {team.description}
              </Typography>
            )}
          </Box>
          {canDeleteTeam && (
            <Tooltip title="Delete team">
              <IconButton size="small" color="error" onClick={() => onDeleteTeam(team.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Divider />

        {/* Members */}
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
            Members ({team.users.length})
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.75 }}>
            {team.users.length === 0 ? (
              <Typography variant="body2" color="text.disabled">
                No members
              </Typography>
            ) : (
              team.users.map((u: TeamUser) => {
                const isExpanded = expandedUserId === u.id;
                const displayName = u.display_name?.trim() || u.username;
                return (
                  <Box
                    key={u.id}
                    sx={{
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      overflow: "hidden",
                    }}
                  >
                    {/* Main row */}
                    <Box
                      onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 1,
                        py: 0.5,
                        cursor: "pointer",
                        backgroundColor: "action.hover",
                        "&:hover": { backgroundColor: "action.selected" },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                        <IconButton size="small" sx={{ p: 0.25 }} disableRipple>
                          {isExpanded ? (
                            <KeyboardArrowDownIcon sx={{ fontSize: 15 }} />
                          ) : (
                            <KeyboardArrowRightIcon sx={{ fontSize: 15 }} />
                          )}
                        </IconButton>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, fontSize: "0.82rem" }}
                          noWrap
                        >
                          {displayName}
                        </Typography>
                        {(u.roles ?? []).map((r) => (
                          <Chip
                            key={r}
                            label={roleLabel(r)}
                            size="small"
                            color={roleColor(r)}
                            variant="outlined"
                            sx={{ height: 18, fontSize: "0.6rem" }}
                          />
                        ))}
                      </Box>
                      {canManage && (
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Tooltip title="Reset password">
                            <IconButton
                              size="small"
                              onClick={() => onChangePassword(u)}
                              sx={{ color: "warning.main" }}
                            >
                              <LockResetOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remove from team">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => onRemoveFromTeam(u.id, team.id)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </Box>

                    {/* Expanded detail */}
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box
                        sx={{
                          px: 2,
                          py: 1,
                          display: "flex",
                          gap: 3,
                          flexWrap: "wrap",
                          bgcolor: "background.paper",
                          borderTop: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Box>
                          <Typography variant="caption" color="text.disabled">
                            Login
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: "0.78rem", fontWeight: 500 }}>
                            {u.username}
                          </Typography>
                        </Box>
                        {u.display_name?.trim() && u.display_name !== u.username && (
                          <Box>
                            <Typography variant="caption" color="text.disabled">
                              Display name
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>
                              {u.display_name}
                            </Typography>
                          </Box>
                        )}
                        {u.email && (
                          <Box>
                            <Typography variant="caption" color="text.disabled">
                              Email
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>
                              {u.email}
                            </Typography>
                          </Box>
                        )}
                        <Box>
                          <Typography variant="caption" color="text.disabled">
                            Source
                          </Typography>
                          <Box>
                            <Chip
                              label={sourceLabel(u.source)}
                              size="small"
                              color={sourceColor(u.source)}
                              variant="outlined"
                              sx={{ height: 18, fontSize: "0.6rem" }}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </Collapse>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>

        <Divider />

        {/* Servers */}
        <Box sx={{ flex: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              cursor: team.hosts.length > 0 ? "pointer" : "default",
            }}
            onClick={() => team.hosts.length > 0 && setServersOpen((v) => !v)}
          >
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ letterSpacing: 1, flex: 1 }}
            >
              Servers ({team.hosts.length})
            </Typography>
            {team.hosts.length > 0 &&
              (serversOpen ? (
                <KeyboardArrowDownIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              ) : (
                <KeyboardArrowRightIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              ))}
          </Box>
          <Collapse in={serversOpen}>
            {team.hosts.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                No servers assigned
              </Typography>
            ) : (
              <Box
                sx={{
                  mt: 0.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {team.hosts.map((hostname: string) => {
                  const otherTeams = hostOtherTeams(hostname);
                  return (
                    <Tooltip
                      key={hostname}
                      title={otherTeams.length > 0 ? `Also on: ${otherTeams.join(", ")}` : ""}
                      placement="left"
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          px: 1,
                          py: 0.4,
                          "&:not(:last-child)": {
                            borderBottom: "1px solid",
                            borderColor: "divider",
                          },
                          "&:hover": { bgcolor: "action.hover" },
                        }}
                      >
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            bgcolor:
                              hostStatusColor(hostname) === "success"
                                ? "success.main"
                                : "action.disabled",
                            flexShrink: 0,
                            mr: 1,
                          }}
                        />
                        <Typography variant="body2" sx={{ fontSize: "0.8rem", flex: 1 }} noWrap>
                          {hostname}
                        </Typography>
                        {otherTeams.length > 0 && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mr: 0.5, flexShrink: 0 }}
                          >
                            +{otherTeams.length}
                          </Typography>
                        )}
                        {canManage && (
                          <IconButton
                            size="small"
                            sx={{
                              p: 0.2,
                              color: "text.disabled",
                              "&:hover": { color: "error.main" },
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onUnassignHost(team.id, hostname);
                            }}
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            )}
          </Collapse>
        </Box>

        {canManage && (
          <>
            <Divider />
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                Team Permissions
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                Members inherit these roles automatically on login.
              </Typography>
              <ToggleButtonGroup
                size="small"
                value={pendingRoles}
                onChange={(_e: React.MouseEvent, newRoles: string[]) => setPendingRoles(newRoles)}
                sx={{ flexWrap: "wrap", gap: 0.5 }}
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <ToggleButton
                    key={r}
                    value={r}
                    sx={{
                      fontSize: "0.7rem",
                      px: 1.5,
                      py: 0.4,
                      borderRadius: "12px !important",
                      border: "1px solid !important",
                    }}
                  >
                    {roleLabel(r)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {rolesChanged && (
                <Box sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    onClick={() => void handleSaveRoles()}
                    disabled={savingRoles}
                  >
                    Save permissions
                  </Button>
                </Box>
              )}
            </Box>
          </>
        )}

        {canManage && (
          <Box sx={{ display: "flex", gap: 1, mt: "auto" }}>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={onAddMember}>
              Add Member
            </Button>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={onAssignHost}>
              Assign Server
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
