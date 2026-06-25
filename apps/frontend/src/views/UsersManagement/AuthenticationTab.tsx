"use client";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";
import { EMPTY_LDAP_FORM, LdapServerDialog, type LdapServerForm } from "./LdapServerDialog";

const AUTH_TYPE_LABELS: Record<string, string> = { "0": "Internal", "1": "LDAP", "2": "SAML" };

const PASSWD_RULES: Array<{ bit: number; label: string }> = [
  { bit: 1, label: "Avoid easy-to-guess passwords" },
  { bit: 2, label: "Must contain uppercase letters" },
  { bit: 4, label: "Must contain lowercase letters" },
  { bit: 8, label: "Must contain digits" },
  { bit: 16, label: "Must contain special characters" },
];

type LdapServer = {
  userdirectoryid: string;
  name: string;
  host: string;
  port: string;
  base_dn: string;
  bind_dn: string;
  search_attribute: string;
  description: string;
  provision_status: string;
  usrgrp_count: number;
  is_default: boolean;
};

// ── Main tab ─────────────────────────────────────────────────────────

export const AuthenticationTab = ({
  showToast,
}: { showToast: (m: string, s: "success" | "error") => void }) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string | number>>({});

  const [ldapServers, setLdapServers] = useState<LdapServer[]>([]);
  const [ldapServersLoading, setLdapServersLoading] = useState(false);

  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [editServerId, setEditServerId] = useState<string | null>(null);
  const [editServerForm, setEditServerForm] = useState<LdapServerForm>(EMPTY_LDAP_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Portal login LDAP config (stored in portal DB, separate from Zabbix)
  const [portalLdap, setPortalLdap] = useState({
    enabled: false,
    host: "",
    port: 389,
    use_ssl: false,
    start_tls: false,
    base_dn: "",
    bind_dn: "",
    bind_password: "",
    search_attribute: "sAMAccountName",
    search_filter: "",
  });
  const [portalLdapSaving, setPortalLdapSaving] = useState(false);
  const [portalLdapLoadError, setPortalLdapLoadError] = useState(false);
  const [portalLdapTest, setPortalLdapTest] = useState({
    username: "",
    password: "",
    loading: false,
    result: "",
  });

  const setPortalLdapField = <K extends keyof typeof portalLdap>(
    key: K,
    val: (typeof portalLdap)[K],
  ) => setPortalLdap((p) => ({ ...p, [key]: val }));

  const loadPortalLdap = useCallback(async () => {
    try {
      const cfg = await api.getPortalLdapConfig();
      setPortalLdap((prev) => ({ ...prev, ...cfg, bind_password: "" }));
      setPortalLdapLoadError(false);
    } catch {
      setPortalLdapLoadError(true);
    }
  }, []);

  const savePortalLdap = async () => {
    setPortalLdapSaving(true);
    try {
      await api.savePortalLdapConfig(portalLdap);
      showToast("Portal login settings saved.", "success");
      void loadPortalLdap();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setPortalLdapSaving(false);
    }
  };

  const runPortalLdapTest = async () => {
    setPortalLdapTest((t) => ({ ...t, loading: true, result: "" }));
    try {
      const res = await api.testPortalLdap({
        ...portalLdap,
        test_username: portalLdapTest.username || undefined,
        test_password: portalLdapTest.password || undefined,
      });
      setPortalLdapTest((t) => ({ ...t, result: `OK: ${res.message}` }));
    } catch (e) {
      setPortalLdapTest((t) => ({
        ...t,
        result: `Error: ${e instanceof Error ? e.message : String(e)}`,
      }));
    } finally {
      setPortalLdapTest((t) => ({ ...t, loading: false }));
    }
  };

  const fillFromLdapServer = (server: LdapServer) => {
    setPortalLdap((prev) => ({
      ...prev,
      host: server.host,
      port: Number(server.port),
      base_dn: server.base_dn,
      bind_dn: server.bind_dn,
    }));
  };

  const loadLdapServers = useCallback(async () => {
    setLdapServersLoading(true);
    try {
      const { servers } = await api.listLdapServers();
      setLdapServers(servers);
    } catch {
      setLdapServers([]);
    } finally {
      setLdapServersLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.getAuthSettings();
      setSettings(s);
      setForm(s);
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
    void loadLdapServers();
    void loadPortalLdap();
  }, [load, loadLdapServers, loadPortalLdap]);

  const set = (key: string, val: string | number) => setForm((f) => ({ ...f, [key]: val }));

  const AUTH_INT_FIELDS = new Set([
    "authentication_type",
    "http_auth_enabled",
    "http_login_form",
    "http_case_sensitive",
    "ldap_configured",
    "ldap_auth_enabled",
    "ldap_case_sensitive",
    "ldap_jit_status",
    "saml_auth_enabled",
    "saml_sign_messages",
    "saml_sign_assertions",
    "saml_sign_authn_requests",
    "saml_sign_logout_requests",
    "saml_sign_logout_responses",
    "saml_encrypt_nameid",
    "saml_encrypt_assertions",
    "saml_case_sensitive",
    "passwd_min_length",
    "passwd_check_rules",
    "mfa_status",
  ]);

  const onSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string | number> = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [
          k,
          AUTH_INT_FIELDS.has(k) && v !== "" ? Number(v) : v,
        ]),
      );
      if (payload.authentication_type === 1) payload.ldap_configured = 1;
      await api.updateAuthSettings(payload);
      showToast("Authentication settings updated.", "success");
      void load();
      void loadLdapServers();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setEditServerId(null);
    setEditServerForm(EMPTY_LDAP_FORM);
    setServerDialogOpen(true);
  };

  const openEdit = async (server: LdapServer) => {
    try {
      const full = await api.getLdapServer(server.userdirectoryid);
      setEditServerId(server.userdirectoryid);
      setEditServerForm({
        name: full.name ?? "",
        host: full.host ?? "",
        port: String(full.port ?? 389),
        base_dn: full.base_dn ?? "",
        search_attribute: full.search_attribute ?? "",
        bind_dn: full.bind_dn ?? "",
        bind_password: "",
        description: full.description ?? "",
        provision_status: String(full.provision_status ?? 0),
        start_tls: String(full.start_tls ?? 0),
        search_filter: full.search_filter ?? "",
        group_name: full.group_name ?? "",
        group_member: full.group_member ?? "",
        user_username: full.user_username ?? "",
        user_lastname: full.user_lastname ?? "",
        provision_groups: full.provision_groups ?? [],
        provision_media: full.provision_media ?? [],
      });
      setServerDialogOpen(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const onDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await api.deleteLdapServer(deleteConfirmId);
      showToast("LDAP server deleted.", "success");
      setDeleteConfirmId(null);
      void loadLdapServers();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setDeleting(false);
    }
  };

  const onSetDefault = async (id: string) => {
    try {
      await api.setDefaultLdapServer(id);
      showToast("Default LDAP server updated.", "success");
      void loadLdapServers();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const authType = String(form.authentication_type ?? settings.authentication_type ?? "0");
  const passwdRules = Number(form.passwd_check_rules ?? settings.passwd_check_rules ?? 0);
  const toggleRule = (bit: number) => {
    const cur = Number(form.passwd_check_rules ?? settings.passwd_check_rules ?? 0);
    set("passwd_check_rules", cur ^ bit);
  };

  const ldapEnabled =
    String(
      form.ldap_configured ??
        form.ldap_auth_enabled ??
        settings.ldap_configured ??
        settings.ldap_auth_enabled ??
        "0",
    ) === "1";
  const jitEnabled = String(form.ldap_jit_status ?? settings.ldap_jit_status ?? "0") === "1";
  const caseSensitive =
    String(form.ldap_case_sensitive ?? settings.ldap_case_sensitive ?? "1") === "1";

  if (loading) return <LinearProgress sx={{ mt: 2 }} />;

  return (
    <Stack spacing={3}>
      {/* Portal login via LDAP — shown first since this is the primary use case for this page */}
      <Box
        sx={{
          border: "1px solid",
          borderColor: portalLdap.enabled ? "primary.main" : "divider",
          borderRadius: 2,
          p: 2.5,
          transition: "border-color 0.2s",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
            Portal Login (LDAP)
          </Typography>
          {portalLdap.enabled && (
            <Chip
              label="Enabled"
              size="small"
              color="success"
              sx={{ height: 18, fontSize: "0.68rem" }}
            />
          )}
          {portalLdapLoadError && (
            <Chip
              label="Load error"
              size="small"
              color="error"
              sx={{ height: 18, fontSize: "0.68rem" }}
            />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          When enabled, users can sign into Overwatch with their LDAP/AD credentials. Accounts are
          created automatically on first login (JIT provisioning) with the <strong>operator</strong>{" "}
          role. The <strong>root</strong> account always uses its local password.
        </Typography>
        {portalLdapLoadError && (
          <Alert severity="warning" sx={{ mb: 2, fontSize: "0.8rem" }}>
            Could not load saved configuration — saving now will overwrite it. Refresh to retry.
          </Alert>
        )}
        <Stack spacing={1.5}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={portalLdap.enabled}
                onChange={(_, v) => setPortalLdapField("enabled", v)}
              />
            }
            label={<Typography variant="body2">Enable LDAP login for the portal</Typography>}
          />

          <Collapse in={portalLdap.enabled}>
            <Stack spacing={1.5}>
              {ldapServers.length > 0 && (
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mb: 0.5 }}
                  >
                    Pre-fill from a configured server:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {ldapServers.map((s) => (
                      <Button
                        key={s.userdirectoryid}
                        size="small"
                        variant="outlined"
                        onClick={() => fillFromLdapServer(s)}
                      >
                        {s.name}
                      </Button>
                    ))}
                  </Stack>
                </Box>
              )}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  size="small"
                  label="Host"
                  required
                  value={portalLdap.host}
                  onChange={(e) => setPortalLdapField("host", e.target.value)}
                  fullWidth
                  placeholder="ldap.corp.example.com"
                />
                <TextField
                  size="small"
                  label="Port"
                  type="number"
                  value={portalLdap.port}
                  onChange={(e) => setPortalLdapField("port", Number(e.target.value))}
                  sx={{ maxWidth: 100 }}
                />
              </Stack>
              <TextField
                size="small"
                label="Base DN"
                required
                value={portalLdap.base_dn}
                onChange={(e) => setPortalLdapField("base_dn", e.target.value)}
                fullWidth
                placeholder="dc=corp,dc=example,dc=com"
              />
              <TextField
                size="small"
                label="Search attribute"
                value={portalLdap.search_attribute}
                onChange={(e) => setPortalLdapField("search_attribute", e.target.value)}
                fullWidth
                placeholder="sAMAccountName (AD) or uid (OpenLDAP)"
              />
              <TextField
                size="small"
                label="Bind DN (service account)"
                value={portalLdap.bind_dn}
                onChange={(e) => setPortalLdapField("bind_dn", e.target.value)}
                fullWidth
                placeholder="cn=svc-overwatch,ou=service,dc=corp,dc=example,dc=com"
                helperText="Leave blank if your LDAP allows anonymous search"
              />
              <TextField
                size="small"
                label="Bind password"
                type="password"
                value={portalLdap.bind_password}
                onChange={(e) => setPortalLdapField("bind_password", e.target.value)}
                fullWidth
                helperText="Leave blank to keep the existing password"
              />
              <TextField
                size="small"
                label="Search filter (optional)"
                value={portalLdap.search_filter}
                onChange={(e) => setPortalLdapField("search_filter", e.target.value)}
                fullWidth
                placeholder="(%(attr)=%(user))"
              />
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={portalLdap.use_ssl}
                      onChange={(_, v) => setPortalLdapField("use_ssl", v)}
                    />
                  }
                  label={<Typography variant="body2">LDAPS (SSL)</Typography>}
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={portalLdap.start_tls}
                      onChange={(_, v) => setPortalLdapField("start_tls", v)}
                    />
                  }
                  label={<Typography variant="body2">StartTLS</Typography>}
                />
              </Stack>
            </Stack>
          </Collapse>

          {/* Test connectivity */}
          <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 1, fontWeight: 600 }}
            >
              Test connection
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
              <TextField
                size="small"
                label="Test username (optional)"
                value={portalLdapTest.username}
                onChange={(e) => setPortalLdapTest((t) => ({ ...t, username: e.target.value }))}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label="Test password"
                type="password"
                value={portalLdapTest.password}
                onChange={(e) => setPortalLdapTest((t) => ({ ...t, password: e.target.value }))}
                sx={{ flex: 1 }}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={runPortalLdapTest}
                disabled={portalLdapTest.loading || !portalLdap.host}
                sx={{ whiteSpace: "nowrap", mt: { xs: 0, sm: "2px" } }}
              >
                {portalLdapTest.loading ? <CircularProgress size={14} /> : "Test"}
              </Button>
            </Stack>
            {portalLdapTest.result && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mt: 1,
                  color: portalLdapTest.result.startsWith("OK") ? "success.main" : "error.main",
                  fontFamily: "monospace",
                  wordBreak: "break-word",
                }}
              >
                {portalLdapTest.result.startsWith("OK") ? "✓ " : "✗ "}
                {portalLdapTest.result}
              </Typography>
            )}
          </Box>

          <Box>
            <Button
              variant="contained"
              size="small"
              onClick={savePortalLdap}
              disabled={portalLdapSaving || portalLdapLoadError}
            >
              {portalLdapSaving ? <CircularProgress size={14} /> : "Save portal login settings"}
            </Button>
          </Box>
        </Stack>
      </Box>

      <Divider />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Zabbix Authentication Settings
        </Typography>
        <Button variant="contained" size="small" onClick={onSave} disabled={saving}>
          {saving ? <CircularProgress size={14} /> : "Save"}
        </Button>
      </Box>

      {/* Auth method */}
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          Authentication method
        </Typography>
        <Divider sx={{ my: 1 }} />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Default auth method</InputLabel>
          <Select
            label="Default auth method"
            value={authType}
            onChange={(e) => set("authentication_type", e.target.value)}
          >
            {Object.entries(AUTH_TYPE_LABELS).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* LDAP section */}
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          LDAP
        </Typography>
        <Divider sx={{ my: 1 }} />
        <Stack spacing={1.5}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={ldapEnabled}
                onChange={(_, v) => {
                  const key =
                    "ldap_auth_enabled" in settings ? "ldap_auth_enabled" : "ldap_configured";
                  set(key, v ? "1" : "0");
                }}
              />
            }
            label={<Typography variant="body2">Enable LDAP authentication</Typography>}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={jitEnabled}
                onChange={(_, v) => set("ldap_jit_status", v ? "1" : "0")}
              />
            }
            label={<Typography variant="body2">Enable JIT provisioning</Typography>}
          />

          {/* Servers table */}
          <Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 0.5,
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Servers
              </Typography>
              <Tooltip title="Refresh">
                <IconButton size="small" onClick={() => void loadLdapServers()}>
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
            {ldapServersLoading ? (
              <LinearProgress />
            ) : (
              <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Host</TableCell>
                      <TableCell>User groups</TableCell>
                      <TableCell>Default</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ldapServers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          sx={{ color: "text.secondary", fontStyle: "italic" }}
                        >
                          No LDAP servers configured yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      ldapServers.map((s) => (
                        <TableRow key={s.userdirectoryid} hover>
                          <TableCell>{s.name}</TableCell>
                          <TableCell>{s.host}</TableCell>
                          <TableCell>{s.usrgrp_count}</TableCell>
                          <TableCell>
                            {s.is_default && <Chip size="small" color="success" label="Yes" />}
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5}>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => void openEdit(s)}>
                                  <EditOutlinedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              {!s.is_default && (
                                <Tooltip title="Set as default">
                                  <IconButton
                                    size="small"
                                    onClick={() => void onSetDefault(s.userdirectoryid)}
                                  >
                                    <StarOutlineIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => setDeleteConfirmId(s.userdirectoryid)}
                                >
                                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    <TableRow>
                      <TableCell colSpan={5} sx={{ py: 0.5 }}>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={openAdd}
                          sx={{ textDecoration: "underline", textTransform: "none", p: 0.5 }}
                        >
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={caseSensitive}
                onChange={(_, v) => set("ldap_case_sensitive", v ? "1" : "0")}
              />
            }
            label={<Typography variant="body2">Case-sensitive login</Typography>}
          />

          <Collapse in={jitEnabled}>
            <TextField
              size="small"
              label="Provisioning period"
              value={String(form.jit_provision_interval ?? settings.jit_provision_interval ?? "1h")}
              onChange={(e) => set("jit_provision_interval", e.target.value)}
              sx={{ maxWidth: 160 }}
              placeholder="1h"
            />
          </Collapse>

          <Box sx={{ pt: 0.5 }}>
            <Button variant="contained" size="small" onClick={onSave} disabled={saving}>
              {saving ? <CircularProgress size={14} /> : "Update"}
            </Button>
          </Box>
        </Stack>
      </Box>

      {/* SAML settings */}
      {authType === "2" && (
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            SAML Configuration
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Stack spacing={1.5}>
            <TextField
              size="small"
              label="IdP entity ID"
              value={String(form.saml_idp_entityid ?? "")}
              onChange={(e) => set("saml_idp_entityid", e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="SSO service URL"
              value={String(form.saml_sso_url ?? "")}
              onChange={(e) => set("saml_sso_url", e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="SLO service URL"
              value={String(form.saml_slo_url ?? "")}
              onChange={(e) => set("saml_slo_url", e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="SP entity ID"
              value={String(form.saml_sp_entityid ?? "")}
              onChange={(e) => set("saml_sp_entityid", e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="Username attribute"
              value={String(form.saml_username_attribute ?? "")}
              onChange={(e) => set("saml_username_attribute", e.target.value)}
              fullWidth
              placeholder="uid"
            />
            <Stack direction="row" flexWrap="wrap" gap={1.5}>
              {[
                { key: "saml_sign_messages", label: "Sign messages" },
                { key: "saml_sign_assertions", label: "Sign assertions" },
                { key: "saml_sign_authn_requests", label: "Sign AuthnRequests" },
                { key: "saml_encrypt_nameid", label: "Encrypt NameID" },
                { key: "saml_encrypt_assertions", label: "Encrypt assertions" },
                { key: "saml_case_sensitive", label: "Case-sensitive" },
              ].map(({ key, label }) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Switch
                      size="small"
                      checked={String(form[key] ?? "0") === "1"}
                      onChange={(_, v) => set(key, v ? "1" : "0")}
                    />
                  }
                  label={<Typography variant="body2">{label}</Typography>}
                />
              ))}
            </Stack>
          </Stack>
        </Box>
      )}

      {/* Password policy */}
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          Password Policy
        </Typography>
        <Divider sx={{ my: 1 }} />
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="Minimum password length"
            type="number"
            value={String(form.passwd_min_length ?? settings.passwd_min_length ?? "8")}
            onChange={(e) => set("passwd_min_length", e.target.value)}
            sx={{ maxWidth: 220 }}
            inputProps={{ min: 1, max: 70 }}
          />
          <Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
              Password complexity rules
            </Typography>
            <Stack spacing={0.5}>
              {PASSWD_RULES.map(({ bit, label }) => (
                <FormControlLabel
                  key={bit}
                  control={
                    <Switch
                      size="small"
                      checked={(passwdRules & bit) !== 0}
                      onChange={() => toggleRule(bit)}
                    />
                  }
                  label={<Typography variant="body2">{label}</Typography>}
                />
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Box>

      {/* HTTP auth */}
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          HTTP Authentication
        </Typography>
        <Divider sx={{ my: 1 }} />
        <Stack spacing={1.5}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={
                  String(form.http_auth_enabled ?? settings.http_auth_enabled ?? "0") === "1"
                }
                onChange={(_, v) => set("http_auth_enabled", v ? "1" : "0")}
              />
            }
            label={<Typography variant="body2">Enable HTTP authentication</Typography>}
          />
          {String(form.http_auth_enabled ?? settings.http_auth_enabled ?? "0") === "1" && (
            <TextField
              size="small"
              label="Strip domains (comma-separated)"
              value={String(form.http_strip_domains ?? "")}
              onChange={(e) => set("http_strip_domains", e.target.value)}
              fullWidth
              placeholder="DOMAIN,DOMAIN2"
            />
          )}
        </Stack>
      </Box>

      <Box sx={{ pt: 1 }}>
        <Button variant="contained" size="small" onClick={onSave} disabled={saving}>
          {saving ? <CircularProgress size={14} /> : "Save changes"}
        </Button>
      </Box>

      {/* LDAP server add/edit dialog */}
      <LdapServerDialog
        open={serverDialogOpen}
        editId={editServerId}
        initialForm={editServerForm}
        onClose={() => setServerDialogOpen(false)}
        onSaved={() => void loadLdapServers()}
        showToast={showToast}
      />

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete LDAP server?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will remove the LDAP server from Zabbix. Any user groups mapped to it may lose
            their authentication.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={onDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={14} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
