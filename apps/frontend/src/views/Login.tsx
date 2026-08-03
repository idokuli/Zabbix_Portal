"use client";

import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../app/api";
import { useAuth } from "../app/context/AuthContext";
import { monoFontFamily, sidebarTokens } from "../app/theme";

// Visible build marker — bump when the UI changes so "which build am I
// looking at" is answerable at a glance from the login screen.
const UI_BUILD = "UI NOC-2026.07.19";

type Snack = { open: boolean; message: string; severity: "success" | "error" };

export const Login = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<"local" | "ldap" | false>(false);
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [snack, setSnack] = useState<Snack>({ open: false, message: "", severity: "success" });

  useEffect(() => {
    api
      .ldapStatus()
      .then((r) => setLdapEnabled(r.enabled))
      .catch(() => {});
  }, []);

  const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

  const doLogin = async (method: "local" | "ldap") => {
    if (!(username && password)) {
      return;
    }
    setLoading(method);
    try {
      await login(username, password);
      setSnack({ open: true, message: "Login successful! Redirecting…", severity: "success" });
      setTimeout(() => router.push("/"), 1200);
    } catch (err) {
      setPassword("");
      setShowPassword(false);
      setSnack({
        open: true,
        message: (err as Error).message || "Invalid username or password.",
        severity: "error",
      });
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin("local");
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: "background.default" }}>
      {/* Brand panel — constant dark, matches the app shell's rail surface */}
      <Box
        sx={{
          flex: "0 0 44%",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          p: 6,
          bgcolor: sidebarTokens.bg,
          borderRight: `1px solid ${sidebarTokens.border}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            component="img"
            src="/Overwatch_sign.png"
            alt="Overwatch"
            sx={{ width: 34, height: 34, objectFit: "contain" }}
          />
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: "0.9375rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: sidebarTokens.textActive,
            }}
          >
            Overwatch
          </Typography>
        </Box>

        <Box>
          <Typography
            sx={{
              fontSize: "1.75rem",
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              color: sidebarTokens.textActive,
              maxWidth: "18ch",
              textWrap: "balance",
            }}
          >
            Zabbix operations, on one board.
          </Typography>
          <Typography
            sx={{ mt: 1.5, fontSize: "0.8125rem", color: sidebarTokens.text, maxWidth: "44ch" }}
          >
            Hosts, problems, SLAs, and alerting for your monitoring estate — with team-scoped access
            control.
          </Typography>
        </Box>

        <Typography
          sx={{ fontFamily: monoFontFamily, fontSize: "0.6875rem", color: sidebarTokens.muted }}
        >
          {UI_BUILD} · internal use only
        </Typography>
      </Box>

      {/* Form panel */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 380 }}>
          {/* Compact brand for mobile (brand panel hidden) */}
          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              flexDirection: "column",
              alignItems: "center",
              mb: 3,
            }}
          >
            <Box
              component="img"
              src="/Overwatch_sign.png"
              alt="Overwatch"
              sx={{ width: 48, height: 48, objectFit: "contain", mb: 1.5 }}
            />
            <Typography variant="h5">Overwatch</Typography>
          </Box>

          <Typography
            sx={{
              display: { xs: "none", md: "block" },
              fontSize: "0.8125rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              mb: 2,
            }}
          >
            {t("auth.monitoringPortal")}
          </Typography>

          <Paper sx={{ p: { xs: 3, sm: 4 } }}>
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
            >
              <TextField
                label={t("auth.username")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                autoFocus
                autoComplete="username"
              />

              <TextField
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword((v) => !v)}
                          edge="end"
                          size="small"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} />
                          ) : (
                            <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                label={t("auth.password")}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                autoComplete="off"
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={!!loading || !username || !password}
                sx={{ py: 1, mt: 0.5 }}
              >
                {loading === "local" ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  t("auth.signIn")
                )}
              </Button>

              {ldapEnabled && (
                <>
                  <Divider>
                    <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>
                      or
                    </Typography>
                  </Divider>
                  <Button
                    type="button"
                    variant="outlined"
                    fullWidth
                    disabled={!!loading || !username || !password}
                    onClick={() => doLogin("ldap")}
                    sx={{ py: 1 }}
                  >
                    {loading === "ldap" ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      `${t("auth.signIn")} — LDAP`
                    )}
                  </Button>
                </>
              )}
            </Box>
          </Paper>

          <Typography
            variant="caption"
            sx={{
              display: "block",
              textAlign: "center",
              mt: 3,
              color: "text.disabled",
              fontFamily: monoFontFamily,
              fontSize: "0.6875rem",
            }}
          >
            {UI_BUILD} · internal use only
          </Typography>
        </Box>
      </Box>

      {/* Notifications */}
      <Snackbar
        open={snack.open}
        autoHideDuration={snack.severity === "success" ? 1200 : 4000}
        onClose={closeSnack}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={closeSnack} severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
