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
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3 }}>
          <Box
            component="img"
            src="/Overwatch_sign.png"
            alt="Overwatch"
            sx={{ width: 56, height: 56, objectFit: "contain", mb: 1.5 }}
          />
          <Typography variant="h5">Overwatch</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("auth.monitoringPortal")}
          </Typography>
        </Box>

        {/* Card */}
        <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 2 }}>
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
              label={t("auth.password")}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoComplete="off"
              InputProps={{
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
              }}
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
          sx={{ display: "block", textAlign: "center", mt: 3, color: "text.disabled" }}
        >
          Overwatch · Internal Use Only
        </Typography>
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
