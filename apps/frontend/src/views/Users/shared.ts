// Role definitions — ordered from highest to lowest privilege.
// root and auditor are standalone toggles (not part of the cascade chain).
// team_lead → operator → member cascade: checking a higher role auto-checks lower ones.
export const ROLE_OPTIONS = [
  {
    value: "root",
    label: "Root",
    color: "#C2574F",
    description:
      "Full platform access across all teams. Can manage all users, teams, and hosts, and grant any role.",
  },
  {
    value: "team_lead",
    label: "Team Lead",
    color: "#4C7FDB",
    description: "Full team management — add/remove users, assign hosts, reset passwords.",
  },
  {
    value: "operator",
    label: "Operator",
    color: "#3B9E5A",
    description: "Create/delete hosts and monitoring within the team. No user management.",
  },
  {
    value: "member",
    label: "Member",
    color: "#7D8590",
    description: "Read-only access to the team's own hosts.",
  },
  {
    value: "auditor",
    label: "Auditor",
    color: "#C08A2D",
    description:
      "Read-only across ALL teams. For compliance and security reviews. Only root can grant this.",
  },
] as const;

// Per-user write restrictions — independent of roles. Checking one removes write
// access (create/edit/delete) to that resource even though the user's role would
// otherwise grant it. Grouped to mirror the app's own nav sections.
export const RESTRICTION_OPTIONS = [
  {
    value: "hostgroups",
    label: "Host Groups",
    section: "Data Collection",
    description: "Cannot create, rename, delete, or edit membership of host groups.",
  },
  {
    value: "items",
    label: "Items",
    section: "Monitoring",
    description: "Cannot create, edit, or delete items on any host.",
  },
  {
    value: "triggers",
    label: "Triggers",
    section: "Monitoring",
    description: "Cannot create, edit, or delete triggers on any host.",
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
  const colors = ["#4C7FDB", "#7D6BB8", "#3B9E5A", "#C08A2D", "#C2574F", "#3E8E9E"];
  return colors[name.charCodeAt(0) % colors.length];
};
