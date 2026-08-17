"use client";
import { Box, Checkbox, Typography } from "@mui/material";
import { RESTRICTION_OPTIONS } from "./shared";

const SECTION_ORDER = ["Data Collection", "Monitoring"] as const;

export const RestrictionPicker = ({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
}) => {
  const toggle = (value: string) =>
    onChange((prev) => (prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {SECTION_ORDER.map((section) => (
        <Box key={section}>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mb: 0.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "text.secondary",
            }}
          >
            {section}
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {RESTRICTION_OPTIONS.filter((r) => r.section === section).map((r) => {
              const checked = selected.includes(r.value);
              return (
                <Box
                  key={r.value}
                  onClick={() => toggle(r.value)}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.5,
                    px: 1.5,
                    py: 1,
                    cursor: "pointer",
                    border: `1px solid ${checked ? "rgba(194,87,79,0.4)" : "rgba(148,163,184,0.2)"}`,
                    backgroundColor: checked ? "rgba(194,87,79,0.08)" : "transparent",
                    transition: "all 0.15s ease",
                    "&:hover": {
                      borderColor: "rgba(194,87,79,0.6)",
                      backgroundColor: "rgba(194,87,79,0.05)",
                    },
                  }}
                >
                  <Checkbox
                    checked={checked}
                    size="small"
                    disableRipple
                    sx={{
                      p: 0,
                      mt: 0.1,
                      color: "#C2574F",
                      "&.Mui-checked": { color: "#C2574F" },
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: checked ? "#C2574F" : "text.primary",
                        lineHeight: 1.3,
                      }}
                    >
                      Restrict {r.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                      {r.description}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
