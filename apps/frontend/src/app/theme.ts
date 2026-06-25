import { createTheme } from "@mui/material/styles";
import type { Shadows } from "@mui/material/styles";

export const createAppTheme = (mode: "dark" | "light", direction: "ltr" | "rtl" = "ltr") => {
  const isDark = mode === "dark";

  return createTheme({
    direction,
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      h4: { fontWeight: 700, letterSpacing: -0.6 },
      h5: { fontWeight: 700, letterSpacing: -0.4 },
      h6: { fontWeight: 600, letterSpacing: -0.2 },
      subtitle1: { fontWeight: 600, fontSize: "0.9375rem" },
      body2: { fontSize: "0.8125rem", lineHeight: 1.6 },
      caption: { fontSize: "0.75rem", lineHeight: 1.5 },
      overline: { fontSize: "0.6875rem", fontWeight: 600, letterSpacing: 0.8 },
    },
    palette: {
      mode,
      primary: { main: "#3B82F6", light: "#60A5FA", dark: "#2563EB", contrastText: "#fff" },
      secondary: { main: "#10B981", light: "#34D399", dark: "#059669", contrastText: "#fff" },
      error: { main: "#EF4444", light: "#F87171" },
      warning: { main: "#F59E0B", light: "#FCD34D" },
      success: { main: "#22C55E", light: "#4ADE80" },
      background: isDark
        ? { default: "#0B1628", paper: "#0F1E35" }
        : { default: "#F1F5F9", paper: "#FFFFFF" },
      text: isDark
        ? { primary: "#E2E8F0", secondary: "#64748B", disabled: "#334155" }
        : { primary: "#0F172A", secondary: "#64748B", disabled: "#CBD5E1" },
      divider: isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)",
    },
    shadows: [
      "none",
      isDark ? "0 1px 3px rgba(0,0,0,0.4)" : "0 1px 3px rgba(15,23,42,0.06)",
      isDark ? "0 4px 16px rgba(0,0,0,0.5)" : "0 4px 12px rgba(15,23,42,0.08)",
      isDark ? "0 8px 32px rgba(0,0,0,0.6)" : "0 8px 24px rgba(15,23,42,0.1)",
      ...Array.from({ length: 21 }).map(() =>
        isDark ? "0 12px 40px rgba(0,0,0,0.65)" : "0 12px 32px rgba(15,23,42,0.12)",
      ),
    ] as Shadows,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: isDark ? "#0B1628" : "#F1F5F9",
            backgroundImage: isDark
              ? [
                  "radial-gradient(ellipse 80vw 55vh at 10% -5%, rgba(59,130,246,0.14) 0%, transparent 60%)",
                  "radial-gradient(ellipse 55vw 45vh at 92% 2%, rgba(16,185,129,0.08) 0%, transparent 55%)",
                ].join(",")
              : [
                  "radial-gradient(ellipse 70vw 45vh at 5% -5%, rgba(59,130,246,0.07) 0%, transparent 60%)",
                  "radial-gradient(ellipse 50vw 40vh at 95% 0%, rgba(16,185,129,0.05) 0%, transparent 55%)",
                ].join(","),
            backgroundAttachment: "fixed",
            minHeight: "100vh",
            scrollbarWidth: "thin",
            scrollbarColor: isDark
              ? "rgba(255,255,255,0.1) transparent"
              : "rgba(15,23,42,0.15) transparent",
          },
          "*::-webkit-scrollbar": { width: 5, height: 5 },
          "*::-webkit-scrollbar-track": { background: "transparent" },
          "*::-webkit-scrollbar-thumb": {
            background: isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.15)",
            borderRadius: 4,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            ...(isDark
              ? {
                  backgroundColor: "rgba(15, 30, 53, 0.85)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }
              : {
                  backgroundColor: "#FFFFFF",
                  border: "1px solid rgba(15,23,42,0.08)",
                  boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
                }),
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
            "&:hover": {
              borderColor: isDark ? "rgba(255,255,255,0.13)" : "rgba(59,130,246,0.25)",
              boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 4px 20px rgba(15,23,42,0.1)",
            },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 8,
            fontSize: "0.8125rem",
            letterSpacing: 0.1,
          },
          contained: {
            "&:hover": { filter: "brightness(1.08)" },
          },
          outlined: {
            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.15)",
            "&:hover": {
              borderColor: isDark ? "rgba(255,255,255,0.25)" : "rgba(59,130,246,0.5)",
              backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(59,130,246,0.05)",
            },
          },
        },
      },
      MuiTextField: { defaultProps: { size: "small" } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.02)",
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.15)",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.3)",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "#3B82F6",
              borderWidth: 1.5,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 500, fontSize: "0.72rem" },
          sizeSmall: { height: 20, fontSize: "0.68rem" },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? "#1E2D45" : "#1E293B",
            border: isDark ? "1px solid rgba(255,255,255,0.1)" : "none",
            fontSize: "0.75rem",
            borderRadius: 6,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)",
          },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 14 } },
      },
      MuiAlert: {
        styleOverrides: { root: { borderRadius: 8, fontSize: "0.8125rem" } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.06)",
            fontSize: "0.8125rem",
          },
          head: {
            fontWeight: 700,
            fontSize: "0.72rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: isDark ? "#64748B" : "#94A3B8",
            backgroundColor: isDark ? "rgba(11,22,40,0.5)" : "rgba(241,245,249,0.8)",
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:last-child td": { borderBottom: 0 },
            "&:hover": {
              backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(15,23,42,0.025)",
            },
          },
        },
      },
    },
  });
};
