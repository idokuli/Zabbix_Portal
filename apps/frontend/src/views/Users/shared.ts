// Role definitions — ordered from highest to lowest privilege.
// root and auditor are standalone toggles (not part of the cascade chain).
// team_lead → operator → member cascade: checking a higher role auto-checks lower ones.
export const ROLE_OPTIONS = [
  {
    value: "root",
    label: "Root",
    color: "#EF4444",
    description:
      "Full platform access across all teams. Can manage all users, teams, and hosts, and grant any role.",
  },
  {
    value: "team_lead",
    label: "Team Lead",
    color: "#3B82F6",
    description: "Full team management — add/remove users, assign hosts, reset passwords.",
  },
  {
    value: "operator",
    label: "Operator",
    color: "#10B981",
    description: "Create/delete hosts and monitoring within the team. No user management.",
  },
  {
    value: "member",
    label: "Member",
    color: "#64748B",
    description: "Read-only access to the team's own hosts.",
  },
  {
    value: "auditor",
    label: "Auditor",
    color: "#F59E0B",
    description:
      "Read-only across ALL teams. For compliance and security reviews. Only root can grant this.",
  },
] as const;

export const roleColor = (r: string): "error" | "primary" | "secondary" | "warning" | "default" =>
  r === "root"
    ? "error"
    : r === "team_lead"
      ? "primary"
      : r === "operator"
        ? "secondary"
        : r === "auditor"
          ? "warning"
          : "default";

export const roleLabel = (r: string) =>
  r === "team_lead" ? "Team Lead" : r.charAt(0).toUpperCase() + r.slice(1);

export const userInitials = (name: string) => name.slice(0, 2).toUpperCase();

export const avatarColor = (name: string) => {
  const colors = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];
  return colors[name.charCodeAt(0) % colors.length];
};
