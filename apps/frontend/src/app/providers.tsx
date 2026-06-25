"use client";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { Box, CircularProgress, CssBaseline, ThemeProvider } from "@mui/material";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { PropsWithChildren } from "react";
import rtlPlugin from "stylis-plugin-rtl";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SyncProvider } from "./context/SyncContext";
import { ThemeModeProvider, useThemeMode } from "./context/ThemeContext";
import { AppShell } from "./layout/AppShell";
import { createAppTheme } from "./theme";

const ltrCache = createCache({ key: "muiltr" });
const rtlCache = createCache({ key: "muirtl", stylisPlugins: [rtlPlugin] });

const ThemedApp = ({ children }: PropsWithChildren) => {
  const pathname = usePathname();
  const { mode, direction } = useThemeMode();
  const { loading } = useAuth();
  const theme = useMemo(() => createAppTheme(mode, direction), [mode, direction]);
  const isLogin = pathname === "/login";

  const inner = (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!isLogin && loading ? (
        <Box
          sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <ErrorBoundary>{isLogin ? children : <AppShell>{children}</AppShell>}</ErrorBoundary>
      )}
    </ThemeProvider>
  );

  return <CacheProvider value={direction === "rtl" ? rtlCache : ltrCache}>{inner}</CacheProvider>;
};

export const Providers = ({ children }: PropsWithChildren) => (
  <AuthProvider>
    <ThemeModeProvider>
      <SyncProvider>
        <ThemedApp>{children}</ThemedApp>
      </SyncProvider>
    </ThemeModeProvider>
  </AuthProvider>
);
