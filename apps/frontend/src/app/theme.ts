import { createTheme } from "@mui/material/styles";
import type { Shadows } from "@mui/material/styles";

export const createAppTheme = (mode: "dark" | "light", direction: "ltr" | "rtl" = "ltr") => {
  const isDark = mode === "dark";

  return createTheme({
    direction,
    shape: { borderRadius: 5 },
    typography: {
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      h4: { fontWeight: 800, letterSpacing: -0.6 },
      h5: { fontWeight: 700, letterSpacing: -0.4 },
      h6: { fontWeight: 600, letterSpacing: -0.2 },
      subtitle1: { fontWeight: 600, fontSize: "0.9375rem" },
      body2: { fontSize: "0.8125rem", lineHeight: 1.65 },
      caption: { fontSize: "0.75rem", lineHeight: 1.5 },
      overline: { fontSize: "0.6875rem", fontWeight: 700, letterSpacing: 1 },
    },
    palette: {
      mode,
      primary: { main: "#8C72E8", light: "#A892F2", dark: "#6C52C8", contrastText: "#fff" },
      secondary: { main: "#5BA8A0", light: "#7AC2BA", dark: "#3D8880", contrastText: "#fff" },
      error: { main: "#C96060", light: "#E07878" },
      warning: { main: "#C4943A", light: "#DDB05A" },
      success: { main: "#5A9E70", light: "#78B88A" },
      background: isDark
        ? { default: "#1A1825", paper: "#231F30" }
        : { default: "#F0EDE8", paper: "#FDFAF6" },
      text: isDark
        ? { primary: "#E2DEFA", secondary: "#9B94B8", disabled: "#4A4360" }
        : { primary: "#1C1828", secondary: "#5A5470", disabled: "#C0BBCC" },
      divider: isDark ? "rgba(212,207,235,0.12)" : "rgba(28,24,40,0.08)",
    },
    shadows: [
      "none",
      isDark ? "0 1px 3px rgba(0,0,0,0.6)" : "0 1px 3px rgba(28,24,40,0.07)",
      isDark ? "0 3px 10px rgba(0,0,0,0.55)" : "0 3px 10px rgba(28,24,40,0.08)",
      isDark ? "0 6px 20px rgba(0,0,0,0.6)" : "0 6px 18px rgba(28,24,40,0.09)",
      ...Array.from({ length: 21 }).map(() =>
        isDark ? "0 10px 32px rgba(0,0,0,0.65)" : "0 10px 28px rgba(28,24,40,0.1)",
      ),
    ] as Shadows,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: isDark ? "#1A1825" : "#F0EDE8",
            minHeight: "100vh",
            scrollbarWidth: "thin",
            scrollbarColor: isDark
              ? "rgba(212,207,235,0.1) transparent"
              : "rgba(28,24,40,0.12) transparent",
          },
          "*::-webkit-scrollbar": { width: 5, height: 5 },
          "*::-webkit-scrollbar-track": { background: "transparent" },
          "*::-webkit-scrollbar-thumb": {
            background: isDark ? "rgba(212,207,235,0.1)" : "rgba(28,24,40,0.12)",
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
                  backgroundColor: "#231F30",
                  border: "1px solid rgba(212,207,235,0.12)",
                }
              : {
                  backgroundColor: "#FDFAF6",
                  border: "1px solid rgba(28,24,40,0.09)",
                  boxShadow: "0 1px 4px rgba(28,24,40,0.05)",
                }),
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: "border-color 0.15s, box-shadow 0.15s",
            "&:hover": {
              borderColor: isDark ? "rgba(140,114,232,0.25)" : "rgba(140,114,232,0.3)",
              boxShadow: isDark ? "0 6px 20px rgba(0,0,0,0.5)" : "0 3px 14px rgba(28,24,40,0.08)",
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
            borderRadius: 5,
            fontSize: "0.8125rem",
            letterSpacing: 0.1,
          },
          contained: {
            "&:hover": { filter: "brightness(1.12)" },
          },
          outlined: {
            borderColor: isDark ? "rgba(212,207,235,0.12)" : "rgba(28,24,40,0.15)",
            "&:hover": {
              borderColor: isDark ? "rgba(212,207,235,0.25)" : "rgba(140,114,232,0.45)",
              backgroundColor: isDark ? "rgba(140,114,232,0.06)" : "rgba(140,114,232,0.05)",
            },
          },
        },
      },
      MuiTextField: { defaultProps: { size: "small" } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 5,
            backgroundColor: isDark ? "rgba(212,207,235,0.03)" : "rgba(28,24,40,0.02)",
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? "rgba(212,207,235,0.18)" : "rgba(28,24,40,0.14)",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? "rgba(212,207,235,0.35)" : "rgba(28,24,40,0.28)",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "#8C72E8",
              borderWidth: 1.5,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 4, fontWeight: 500, fontSize: "0.72rem" },
          sizeSmall: { height: 20, fontSize: "0.68rem" },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? "#2E2940" : "#1C1828",
            border: isDark ? "1px solid rgba(212,207,235,0.09)" : "none",
            fontSize: "0.75rem",
            borderRadius: 4,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? "rgba(212,207,235,0.12)" : "rgba(28,24,40,0.08)",
          },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 8 } },
      },
      MuiAlert: {
        styleOverrides: { root: { borderRadius: 5, fontSize: "0.8125rem" } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isDark ? "rgba(212,207,235,0.11)" : "rgba(28,24,40,0.07)",
            fontSize: "0.8125rem",
          },
          head: {
            fontWeight: 700,
            fontSize: "0.72rem",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: isDark ? "#9B94B8" : "#7A7090",
            backgroundColor: isDark ? "rgba(26,24,37,0.9)" : "rgba(240,237,232,0.9)",
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:last-child td": { borderBottom: 0 },
            "&:hover": {
              backgroundColor: isDark ? "rgba(140,114,232,0.04)" : "rgba(28,24,40,0.02)",
            },
          },
        },
      },
    },
  });
};
