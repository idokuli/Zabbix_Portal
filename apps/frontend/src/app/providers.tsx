"use client";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { Box, CircularProgress, CssBaseline, ThemeProvider } from "@mui/material";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import { useEffect, useMemo } from "react";
import rtlPlugin from "stylis-plugin-rtl";
import "./i18n/config";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RefreshProvider } from "./context/RefreshContext";
import { SyncProvider } from "./context/SyncContext";
import { ThemeModeProvider, useThemeMode } from "./context/ThemeContext";
import i18n from "./i18n/config";
import { AppShell } from "./layout/AppShell";
import { createAppTheme } from "./theme";

// compat = true matches what @mui/material-nextjs's AppRouterCacheProvider sets on its
// own internal cache — without it, Emotion's SSR fallback renders inline <style> tags as
// React children (since these caches aren't wired into AppRouterCacheProvider's
// useServerInsertedHTML flush), which the client never renders, causing a hydration
// mismatch on the very first styled element on any page.
const ltrCache = createCache({ key: "muiltr" });
ltrCache.compat = true;
const rtlCache = createCache({ key: "muirtl", stylisPlugins: [rtlPlugin] });
rtlCache.compat = true;

const ThemedApp = ({ children }: PropsWithChildren) => {
  const pathname = usePathname();
  const { mode, direction, setDirection } = useThemeMode();
  const { loading } = useAuth();
  const theme = useMemo(() => createAppTheme(mode, direction), [mode, direction]);
  const isLogin = pathname === "/login";

  useEffect(() => {
    const sync = (lng: string) => setDirection(lng === "he" ? "rtl" : "ltr");
    sync(i18n.language);
    i18n.on("languageChanged", sync);
    return () => {
      i18n.off("languageChanged", sync);
    };
  }, [setDirection]);

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
        // key={pathname} remounts the boundary (clearing any tripped error state) on
        // navigation, so a crash on one page doesn't permanently freeze the whole app —
        // see CLAUDE.md's note on the MUI Autocomplete null-ref bug for why a crash here
        // is still possible even with the mitigations in place.
        <ErrorBoundary key={pathname}>
          {isLogin ? children : <AppShell>{children}</AppShell>}
        </ErrorBoundary>
      )}
    </ThemeProvider>
  );

  return <CacheProvider value={direction === "rtl" ? rtlCache : ltrCache}>{inner}</CacheProvider>;
};

export const Providers = ({ children }: PropsWithChildren) => (
  <AuthProvider>
    <ThemeModeProvider>
      <SyncProvider>
        <RefreshProvider>
          <ThemedApp>{children}</ThemedApp>
        </RefreshProvider>
      </SyncProvider>
    </ThemeModeProvider>
  </AuthProvider>
);
