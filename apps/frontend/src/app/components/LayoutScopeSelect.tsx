"use client";

import { MenuItem, Select } from "@mui/material";
import type { DashboardScope } from "../api";
import { useCanViewAllTeams } from "../context/AuthContext";

type LayoutScopeSelectProps = {
  scope: DashboardScope;
  onChange: (scope: DashboardScope) => void;
};

export const LayoutScopeSelect = ({ scope, onChange }: LayoutScopeSelectProps) => {
  const canViewAllTeams = useCanViewAllTeams();
  return (
    <Select
      size="small"
      value={scope}
      onChange={(e) => onChange(e.target.value as DashboardScope)}
      sx={{
        fontSize: "0.72rem",
        height: 28,
        "& .MuiSelect-select": { py: 0, px: 1, lineHeight: "28px" },
      }}
    >
      <MenuItem value="user" sx={{ fontSize: "0.78rem" }}>
        Mine
      </MenuItem>
      <MenuItem value="team" sx={{ fontSize: "0.78rem" }}>
        Team
      </MenuItem>
      {canViewAllTeams && (
        <MenuItem value="all" sx={{ fontSize: "0.78rem" }}>
          All Teams
        </MenuItem>
      )}
    </Select>
  );
};
