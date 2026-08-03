import type { Shadows } from "@mui/material/styles";
import { createTheme } from "@mui/material/styles";

// Design tokens — single source of truth for the portal's look.
//
// Identity: "signal amber" — the accent is the burnt orange of the Overwatch
// logo, used for actions, selection, and focus. Blue is demoted to purely
// informational (info alerts). Neutrals are blue-tinted graphite in dark mode.
// The sidebar is a constant dark surface in BOTH themes (bicolor shell).
// Elevation is border-based; shadows are reserved for overlays (menus, dialogs).

const accent = {
  light: { main: "#BC4C00", light: "#D9622B", dark: "#953C00" },
  dark: { main: "#F0883E", light: "#F5A164", dark: "#D9702C" },
};

// Informational blue — Alert severity="info", info chips. Not an action color.
const infoBlue = {
  light: { main: "#3369D6", light: "#5B8AE5", dark: "#2554B0" },
  dark: { main: "#6494ED", light: "#8AB0F2", dark: "#4A77D4" },
};

const neutrals = {
  dark: {
    bg: "#0A0C10",
    paper: "#101318",
    divider: "rgba(255,255,255,0.08)",
    textPrimary: "#E2E4E8",
    textSecondary: "#8C939E",
    textDisabled: "#575E68",
  },
  light: {
    bg: "#F5F6F8",
    paper: "#FFFFFF",
    divider: "rgba(20,24,31,0.10)",
    textPrimary: "#1C2128",
    textSecondary: "#59616C",
    textDisabled: "#9AA1AB",
  },
};

// The sidebar is the same deep graphite surface in both themes — the shell's
// silhouette is part of the product identity. Amber marks the active item.
export const sidebarTokens = {
  bg: "#0E1116",
  border: "rgba(255,255,255,0.08)",
  text: "#AEB6C2",
  textActive: "#F3F4F6",
  muted: "#606774",
  icon: "#8C939E",
  accent: accent.dark.main,
  hoverBg: "rgba(255,255,255,0.05)",
  activeBg: "rgba(240,136,62,0.14)",
};

export const monoFontFamily =
  'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';

export const createAppTheme = (mode: "dark" | "light", direction: "ltr" | "rtl" = "ltr") => {
  const isDark = mode === "dark";
  const pick = <T>(dark: T, light: T): T => (isDark ? dark : light);
  const n = isDark ? neutrals.dark : neutrals.light;
  const a = isDark ? accent.dark : accent.light;
  const info = isDark ? infoBlue.dark : infoBlue.light;

  return createTheme({
    direction,
    shape: { borderRadius: 0 },
    typography: {
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      h4: { fontWeight: 700, fontSize: "1.5rem", letterSpacing: "-0.01em" },
      h5: { fontWeight: 700, fontSize: "1.25rem", letterSpacing: "-0.01em" },
      h6: { fontWeight: 600, fontSize: "1rem" },
      subtitle1: { fontWeight: 600, fontSize: "0.9375rem" },
      subtitle2: { fontWeight: 600, fontSize: "0.8125rem" },
      body2: { fontSize: "0.8125rem", lineHeight: 1.6 },
      caption: { fontSize: "0.75rem", lineHeight: 1.5 },
      overline: { fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.08em" },
      button: { textTransform: "none", fontWeight: 500, fontSize: "0.8125rem" },
    },
    palette: {
      mode,
      primary: { ...a, contrastText: pick("#14181F", "#fff") },
      secondary: {
        main: n.textSecondary,
        light: n.textDisabled,
        dark: n.textPrimary,
        contrastText: pick("#0C0F14", "#fff"),
      },
      error: pick(
        { main: "#F0564F", light: "#F58B86", dark: "#C93C37" },
        { main: "#CF222E", light: "#E05561", dark: "#A40E26" },
      ),
      warning: pick(
        { main: "#D29922", light: "#E0B650", dark: "#B08217" },
        { main: "#9A6700", light: "#BF8700", dark: "#7D5300" },
      ),
      success: pick(
        { main: "#3FB950", light: "#6BCB77", dark: "#2E9E42" },
        { main: "#1A7F37", light: "#3FA85A", dark: "#116329" },
      ),
      info: { ...info, contrastText: "#fff" },
      background: { default: n.bg, paper: n.paper },
      text: { primary: n.textPrimary, secondary: n.textSecondary, disabled: n.textDisabled },
      divider: n.divider,
      action: {
        hover: pick("rgba(255,255,255,0.05)", "rgba(20,24,31,0.04)"),
        selected: pick("rgba(240,136,62,0.14)", "rgba(188,76,0,0.08)"),
      },
    },
    shadows: [
      "none",
      pick("0 1px 2px rgba(0,0,0,0.4)", "0 1px 2px rgba(20,24,31,0.06)"),
      pick("0 2px 6px rgba(0,0,0,0.4)", "0 2px 6px rgba(20,24,31,0.07)"),
      pick("0 4px 12px rgba(0,0,0,0.45)", "0 4px 12px rgba(20,24,31,0.08)"),
      ...Array.from({ length: 21 }).map(() =>
        pick("0 8px 24px rgba(0,0,0,0.5)", "0 8px 24px rgba(20,24,31,0.1)"),
      ),
    ] as Shadows,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: n.bg,
            minHeight: "100vh",
            scrollbarWidth: "thin",
            scrollbarColor: `${pick("rgba(255,255,255,0.15)", "rgba(20,24,31,0.2)")} transparent`,
          },
          "*::-webkit-scrollbar": { width: 6, height: 6 },
          "*::-webkit-scrollbar-track": { background: "transparent" },
          "*::-webkit-scrollbar-thumb": {
            background: pick("rgba(255,255,255,0.15)", "rgba(20,24,31,0.2)"),
            borderRadius: 3,
          },
        },
      },
      MuiButtonBase: {
        defaultProps: { disableRipple: true },
        styleOverrides: {
          root: {
            "&.Mui-focusVisible": {
              outline: `2px solid ${a.main}`,
              outlineOffset: 1,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: n.paper,
            border: `1px solid ${n.divider}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 0, boxShadow: "none" },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 0,
            paddingLeft: 14,
            paddingRight: 14,
            textTransform: "uppercase",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
          },
          outlined: {
            borderColor: pick("rgba(255,255,255,0.15)", "rgba(20,24,31,0.18)"),
            color: n.textPrimary,
            "&:hover": {
              borderColor: pick("rgba(255,255,255,0.3)", "rgba(20,24,31,0.35)"),
              backgroundColor: pick("rgba(255,255,255,0.04)", "rgba(20,24,31,0.03)"),
            },
          },
        },
      },
      MuiTextField: { defaultProps: { size: "small" } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: pick("rgba(255,255,255,0.15)", "rgba(20,24,31,0.18)"),
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: pick("rgba(255,255,255,0.3)", "rgba(20,24,31,0.35)"),
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: a.main,
              borderWidth: 1,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            fontWeight: 500,
            fontSize: "0.7rem",
            fontFamily: monoFontFamily,
          },
          sizeSmall: { height: 20, fontSize: "0.6875rem" },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: "#1C2128",
            color: "#E2E4E8",
            border: pick(`1px solid ${n.divider}`, "none"),
            fontSize: "0.75rem",
            borderRadius: 4,
          },
        },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: n.divider } },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 0 } },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 0,
            border: `1px solid ${n.divider}`,
            boxShadow: pick("0 8px 24px rgba(0,0,0,0.5)", "0 8px 24px rgba(20,24,31,0.12)"),
          },
        },
      },
      MuiAlert: {
        styleOverrides: { root: { fontSize: "0.8125rem" } },
      },
      MuiTableContainer: {
        styleOverrides: {
          // Tables sit flush inside their parent Card/Paper — no nested
          // "box within a box" framing.
          root: { backgroundColor: "transparent" },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: "uppercase",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            minHeight: 40,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: n.divider,
            fontSize: "0.75rem",
            fontFamily: monoFontFamily,
            fontVariantNumeric: "tabular-nums",
            paddingTop: 7,
            paddingBottom: 7,
          },
          head: {
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 600,
            fontSize: "0.6563rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: n.textSecondary,
            backgroundColor: n.paper,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:last-child td": { borderBottom: 0 },
            "&:hover": {
              backgroundColor: pick("rgba(255,255,255,0.03)", "rgba(20,24,31,0.025)"),
            },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: { root: { borderRadius: 0 } },
      },
    },
  });
};
