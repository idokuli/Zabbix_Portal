"use client";
import { Box, Checkbox, Typography } from "@mui/material";
import { ROLE_OPTIONS } from "./shared";

// Hierarchy from lowest to highest (auditor is standalone — not part of the chain)
const ROLE_HIERARCHY = ["member", "operator", "team_lead"] as const;

const cascadeSelect = (current: string[], clicked: string): string[] => {
  const idx = (ROLE_HIERARCHY as readonly string[]).indexOf(clicked);
  if (idx === -1) {
    // auditor: simple toggle, no cascade
    return current.includes(clicked) ? current.filter((r) => r !== clicked) : [...current, clicked];
  }
  if (current.includes(clicked)) {
    // Unchecking: remove this role + all lower (reverse the cascade)
    const toRemove = new Set((ROLE_HIERARCHY as readonly string[]).slice(0, idx + 1));
    const afterRemoval = current.filter((r) => !toRemove.has(r));
    // Also drop any higher hierarchy roles whose prerequisites were just removed
    return afterRemoval.filter((r) => {
      const rIdx = (ROLE_HIERARCHY as readonly string[]).indexOf(r);
      if (rIdx === -1) {
        return true; // root / auditor are unaffected
      }
      return (ROLE_HIERARCHY as readonly string[])
        .slice(0, rIdx)
        .every((p) => afterRemoval.includes(p));
    });
  }
  // Checking: add this role AND all lower roles
  const toAdd = (ROLE_HIERARCHY as readonly string[]).slice(0, idx + 1);
  return [...new Set([...current, ...toAdd])];
};

const isInherited = (role: string, selected: string[]): boolean => {
  const idx = (ROLE_HIERARCHY as readonly string[]).indexOf(role);
  if (idx === -1 || idx === ROLE_HIERARCHY.length - 1) {
    return false;
  }
  return (ROLE_HIERARCHY as readonly string[]).slice(idx + 1).some((r) => selected.includes(r));
};

export const RolePicker = ({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
}) => {
  const toggleRole = (value: string) => onChange((prev) => cascadeSelect(prev, value));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      {ROLE_OPTIONS.map((r) => {
        const checked = selected.includes(r.value);
        const inherited = isInherited(r.value, selected);
        return (
          <Box
            key={r.value}
            onClick={() => toggleRole(r.value)}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              px: 1.5,
              py: 1,
              borderRadius: 2,
              cursor: "pointer",
              border: `1px solid ${checked ? `${r.color}55` : "rgba(148,163,184,0.2)"}`,
              backgroundColor: checked ? `${r.color}12` : "transparent",
              transition: "all 0.15s ease",
              "&:hover": { borderColor: `${r.color}88`, backgroundColor: `${r.color}08` },
            }}
          >
            <Checkbox
              checked={checked}
              size="small"
              disableRipple
              sx={{ p: 0, mt: 0.1, color: r.color, "&.Mui-checked": { color: r.color } }}
            />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: checked ? r.color : "text.primary",
                    lineHeight: 1.3,
                  }}
                >
                  {r.label}
                </Typography>
                {inherited && (
                  <Typography
                    variant="caption"
                    sx={{ color: r.color, opacity: 0.7, fontSize: "0.6rem", fontWeight: 500 }}
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
  );
};
