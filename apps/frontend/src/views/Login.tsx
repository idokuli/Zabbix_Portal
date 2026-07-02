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
    if (!username || !password) return;
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
        background: "#07111D",
        backgroundImage: [
          "radial-gradient(ellipse 90vw 70vh at 20% -10%, rgba(59,130,246,0.2) 0%, transparent 55%)",
          "radial-gradient(ellipse 60vw 50vh at 85% 5%, rgba(16,185,129,0.1) 0%, transparent 55%)",
        ].join(","),
        px: 2,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 4 }}>
          <Box
            component="img"
            src="/Overwatch_sign.png"
            alt="Overwatch"
            sx={{ width: 72, height: 72, objectFit: "contain", mb: 2 }}
          />
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: -0.4, color: "#E2E8F0" }}>
            Overwatch
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: "#64748B" }}>
            {t("auth.monitoringPortal")}
          </Typography>
        </Box>

        {/* Card */}
        <Box
          sx={{
            backgroundColor: "rgba(12, 26, 46, 0.92)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 3,
            p: { xs: 3, sm: 4 },
          }}
        >
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
          >
            <Box>
              <Typography
                variant="caption"
                sx={{ color: "#64748B", fontWeight: 500, mb: 0.75, display: "block" }}
              >
                {t("auth.username")}
              </Typography>
              <TextField
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                autoFocus
                autoComplete="username"
                placeholder="Admin"
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "rgba(255,255,255,0.04)",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
                    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                    "&.Mui-focused fieldset": { borderColor: "#3B82F6" },
                  },
                  "& input": { color: "#E2E8F0" },
                  "& input::placeholder": { color: "#334155" },
                }}
              />
            </Box>

            <Box>
              <Typography
                variant="caption"
                sx={{ color: "#64748B", fontWeight: 500, mb: 0.75, display: "block" }}
              >
                {t("auth.password")}
              </Typography>
              <TextField
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                autoComplete="off"
                placeholder="••••••••"
                size="small"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                        size="small"
                        tabIndex={-1}
                        sx={{ color: "#475569", "&:hover": { color: "#94A3B8" } }}
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
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "rgba(255,255,255,0.04)",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
                    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                    "&.Mui-focused fieldset": { borderColor: "#3B82F6" },
                  },
                  "& input": { color: "#E2E8F0" },
                  "& input::placeholder": { color: "#334155" },
                }}
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={!!loading || !username || !password}
              sx={{
                mt: 0.5,
                py: 1.25,
                fontSize: "0.875rem",
                fontWeight: 600,
                background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
                boxShadow: "0 4px 14px rgba(59,130,246,0.35)",
                "&:hover:not(:disabled)": {
                  boxShadow: "0 6px 20px rgba(59,130,246,0.5)",
                  filter: "brightness(1.06)",
                },
                "&:disabled": { opacity: 0.6 },
              }}
            >
              {loading === "local" ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                t("auth.signIn")
              )}
            </Button>

            {ldapEnabled && (
              <>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 0.5 }}>
                  <Typography variant="caption" sx={{ color: "#334155", px: 1 }}>
                    or
                  </Typography>
                </Divider>
                <Button
                  type="button"
                  variant="outlined"
                  fullWidth
                  size="large"
                  disabled={!!loading || !username || !password}
                  onClick={() => doLogin("ldap")}
                  sx={{
                    py: 1.25,
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    borderColor: "rgba(99,179,237,0.35)",
                    color: "#63B3ED",
                    "&:hover:not(:disabled)": {
                      borderColor: "#63B3ED",
                      background: "rgba(99,179,237,0.08)",
                    },
                    "&:disabled": { opacity: 0.4 },
                  }}
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
        </Box>

        <Typography
          variant="caption"
          sx={{ display: "block", textAlign: "center", mt: 3, color: "#1E3A5F" }}
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
        <Alert
          onClose={closeSnack}
          severity={snack.severity}
          variant="filled"
          sx={{
            borderRadius: 2,
            fontSize: "0.8125rem",
            fontWeight: 500,
            minWidth: 280,
            boxShadow:
              snack.severity === "success"
                ? "0 4px 20px rgba(34,197,94,0.4)"
                : "0 4px 20px rgba(239,68,68,0.4)",
          }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
