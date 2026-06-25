"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import type { Team, TeamUser } from "../../app/api";

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
  onDeleteUser: (id: number) => void;
  onChangePassword: (user: TeamUser) => void;
  onUnassignHost: (teamId: number, hostname: string) => void;
  onAssignHost: () => void;
  hostStatusColor: (hostname: string) => "success" | "default";
  hostOtherTeams: (hostname: string) => string[];
};

export const TeamCard = ({
  team,
  canManage,
  canDeleteTeam,
  onDeleteTeam,
  onDeleteUser,
  onChangePassword,
  onUnassignHost,
  onAssignHost,
  hostStatusColor,
  hostOtherTeams,
}: TeamCardProps) => (
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
            team.users.map((u: TeamUser) => (
              <Box
                key={u.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 1,
                  py: 0.5,
                  borderRadius: 1.5,
                  backgroundColor: "action.hover",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                    {u.username}
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
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}>
                    <Tooltip title="Reset password">
                      <IconButton
                        size="small"
                        onClick={() => onChangePassword(u)}
                        sx={{ color: "warning.main" }}
                      >
                        <LockResetOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove user">
                      <IconButton size="small" color="error" onClick={() => onDeleteUser(u.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            ))
          )}
        </Box>
      </Box>

      <Divider />

      {/* Servers */}
      <Box sx={{ flex: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
          Servers ({team.hosts.length})
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
          {team.hosts.length === 0 ? (
            <Typography variant="body2" color="text.disabled">
              No servers assigned
            </Typography>
          ) : (
            team.hosts.map((hostname: string) => {
              const otherTeams = hostOtherTeams(hostname);
              const chip = (
                <Chip
                  key={hostname}
                  label={otherTeams.length > 0 ? `${hostname} (+${otherTeams.length})` : hostname}
                  size="small"
                  color={hostStatusColor(hostname)}
                  variant="outlined"
                  onDelete={canManage ? () => onUnassignHost(team.id, hostname) : undefined}
                />
              );
              return otherTeams.length > 0 ? (
                <Tooltip key={hostname} title={`Also on: ${otherTeams.join(", ")}`}>
                  {chip}
                </Tooltip>
              ) : (
                chip
              );
            })
          )}
        </Box>
      </Box>

      {canManage && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAssignHost}
          sx={{ alignSelf: "flex-start", mt: "auto" }}
        >
          Assign Server
        </Button>
      )}
    </CardContent>
  </Card>
);
