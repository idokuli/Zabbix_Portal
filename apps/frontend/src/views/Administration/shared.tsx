"use client";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import type React from "react";
import { useEffect, useState } from "react";
import type { ProxyConfig } from "../../app/api";

export { ConfirmDelete } from "../../app/components/ConfirmDelete";

export { fmtTs } from "../../app/utils";

// ── Proxies ───────────────────────────────────────────────────────────

export type ProxyGroup = {
  proxygroupid: string;
  name: string;
  failover_delay: string;
  min_online: number;
  description: string;
  proxy_count: number;
};

export type Proxy = ProxyConfig & {
  proxyid: string;
  mode: number;
  mode_label: string;
  lastaccess: number;
  version: string;
  host_count: number;
};

export const DEFAULT_PROXY_FORM: ProxyConfig = {
  name: "",
  operating_mode: 0,
  description: "",
  proxy_groupid: "",
  local_address: "",
  local_port: "10051",
  address: "127.0.0.1",
  port: "10051",
  allowed_addresses: "",
  tls_connect: 1,
  tls_accept: 1,
  tls_issuer: "",
  tls_subject: "",
  tls_psk_identity: "",
  tls_psk: "",
  custom_timeouts: 0,
  timeout_zabbix_agent: "",
  timeout_simple_check: "",
  timeout_snmp_agent: "",
  timeout_external_check: "",
  timeout_db_monitor: "",
  timeout_http_agent: "",
  timeout_ssh_agent: "",
  timeout_telnet_agent: "",
  timeout_script: "",
  timeout_browser: "",
};

export const proxyFormFromExisting = (p: Proxy): ProxyConfig => ({
  name: p.name,
  operating_mode: p.mode,
  description: p.description,
  proxy_groupid: p.proxy_groupid && p.proxy_groupid !== "0" ? p.proxy_groupid : "",
  local_address: p.local_address || "",
  local_port: p.local_port || "10051",
  address: p.address || "127.0.0.1",
  port: p.port || "10051",
  allowed_addresses: p.allowed_addresses || "",
  tls_connect: p.tls_connect || 1,
  tls_accept: p.tls_accept || 1,
  tls_issuer: p.tls_issuer || "",
  tls_subject: p.tls_subject || "",
  tls_psk_identity: p.tls_psk_identity || "",
  tls_psk: "",
  custom_timeouts: p.custom_timeouts || 0,
  timeout_zabbix_agent: p.timeout_zabbix_agent || "",
  timeout_simple_check: p.timeout_simple_check || "",
  timeout_snmp_agent: p.timeout_snmp_agent || "",
  timeout_external_check: p.timeout_external_check || "",
  timeout_db_monitor: p.timeout_db_monitor || "",
  timeout_http_agent: p.timeout_http_agent || "",
  timeout_ssh_agent: p.timeout_ssh_agent || "",
  timeout_telnet_agent: p.timeout_telnet_agent || "",
  timeout_script: p.timeout_script || "",
  timeout_browser: p.timeout_browser || "",
});

const TLS_NONE = 1;
const TLS_PSK = 2;
const TLS_CERT = 4;

const TIMEOUT_FIELDS: Array<{ key: keyof ProxyConfig; label: string }> = [
  { key: "timeout_zabbix_agent", label: "Zabbix agent" },
  { key: "timeout_simple_check", label: "Simple check" },
  { key: "timeout_snmp_agent", label: "SNMP agent" },
  { key: "timeout_external_check", label: "External check" },
  { key: "timeout_db_monitor", label: "Database monitor" },
  { key: "timeout_http_agent", label: "HTTP agent" },
  { key: "timeout_ssh_agent", label: "SSH agent" },
  { key: "timeout_telnet_agent", label: "Telnet agent" },
  { key: "timeout_script", label: "Script" },
  { key: "timeout_browser", label: "Browser" },
];

export const ProxyFormDialog = ({
  open,
  title,
  form,
  setForm,
  proxyGroups,
  saving,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  open: boolean;
  title: string;
  form: ProxyConfig;
  setForm: React.Dispatch<React.SetStateAction<ProxyConfig>>;
  proxyGroups: ProxyGroup[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
}) => {
  const [tab, setTab] = useState(0);
  useEffect(() => {
    if (open) setTab(0);
  }, [open]);
  const set = <K extends keyof ProxyConfig>(key: K, value: ProxyConfig[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const isActive = form.operating_mode === 0;
  const connectEncrypted = !isActive && form.tls_connect !== TLS_NONE;
  const acceptPsk = isActive && (form.tls_accept & TLS_PSK) !== 0;
  const acceptCert = isActive && (form.tls_accept & TLS_CERT) !== 0;
  const showPsk = (connectEncrypted && form.tls_connect === TLS_PSK) || acceptPsk;
  const showCert = (connectEncrypted && form.tls_connect === TLS_CERT) || acceptCert;

  const canSubmit =
    !!form.name.trim() &&
    (isActive || (!!form.address.trim() && !!form.port.trim())) &&
    (!form.proxy_groupid || !!form.local_address.trim());

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ px: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="Proxy" />
        <Tab label="Encryption" />
        <Tab label="Timeouts" />
      </Tabs>
      <DialogContent>
        {tab === 0 && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Proxy name *"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Proxy group</InputLabel>
              <Select
                label="Proxy group"
                value={form.proxy_groupid}
                onChange={(e) => set("proxy_groupid", e.target.value)}
              >
                <MenuItem value="">— None —</MenuItem>
                {proxyGroups.map((g) => (
                  <MenuItem key={g.proxygroupid} value={g.proxygroupid}>
                    {g.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant={isActive ? "contained" : "outlined"}
                color={isActive ? "secondary" : "inherit"}
                onClick={() => set("operating_mode", 0)}
              >
                Active
              </Button>
              <Button
                fullWidth
                variant={!isActive ? "contained" : "outlined"}
                color={!isActive ? "secondary" : "inherit"}
                onClick={() => set("operating_mode", 1)}
              >
                Passive
              </Button>
            </Stack>
            {isActive ? (
              <TextField
                size="small"
                label="Allowed addresses"
                value={form.allowed_addresses}
                onChange={(e) => set("allowed_addresses", e.target.value)}
                helperText="Comma-separated list of addresses allowed to connect as this proxy. Leave blank to allow any."
              />
            ) : (
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  fullWidth
                  label="Address *"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                />
                <TextField
                  size="small"
                  sx={{ width: 110 }}
                  label="Port *"
                  value={form.port}
                  onChange={(e) => set("port", e.target.value)}
                />
              </Stack>
            )}
            {!!form.proxy_groupid && (
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  fullWidth
                  label="Local address *"
                  value={form.local_address}
                  onChange={(e) => set("local_address", e.target.value)}
                  helperText="Address other components use to reach this proxy within the group"
                />
                <TextField
                  size="small"
                  sx={{ width: 110 }}
                  label="Local port"
                  value={form.local_port}
                  onChange={(e) => set("local_port", e.target.value)}
                />
              </Stack>
            )}
            <TextField
              size="small"
              label="Description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              multiline
              rows={3}
            />
          </Stack>
        )}
        {tab === 1 && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {!isActive ? (
              <FormControl size="small" fullWidth>
                <InputLabel>Connections to proxy</InputLabel>
                <Select
                  label="Connections to proxy"
                  value={form.tls_connect}
                  onChange={(e) => set("tls_connect", Number(e.target.value))}
                >
                  <MenuItem value={TLS_NONE}>No encryption</MenuItem>
                  <MenuItem value={TLS_PSK}>PSK</MenuItem>
                  <MenuItem value={TLS_CERT}>Certificate</MenuItem>
                </Select>
              </FormControl>
            ) : (
              <Stack spacing={0.5}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Connections from proxy
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={(form.tls_accept & TLS_NONE) !== 0}
                      onChange={(_, c) =>
                        set(
                          "tls_accept",
                          c ? form.tls_accept | TLS_NONE : form.tls_accept & ~TLS_NONE,
                        )
                      }
                    />
                  }
                  label={<Typography variant="body2">No encryption</Typography>}
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={(form.tls_accept & TLS_PSK) !== 0}
                      onChange={(_, c) =>
                        set(
                          "tls_accept",
                          c ? form.tls_accept | TLS_PSK : form.tls_accept & ~TLS_PSK,
                        )
                      }
                    />
                  }
                  label={<Typography variant="body2">PSK</Typography>}
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={(form.tls_accept & TLS_CERT) !== 0}
                      onChange={(_, c) =>
                        set(
                          "tls_accept",
                          c ? form.tls_accept | TLS_CERT : form.tls_accept & ~TLS_CERT,
                        )
                      }
                    />
                  }
                  label={<Typography variant="body2">Certificate</Typography>}
                />
              </Stack>
            )}
            {showPsk && (
              <>
                <TextField
                  size="small"
                  label="PSK identity"
                  value={form.tls_psk_identity}
                  onChange={(e) => set("tls_psk_identity", e.target.value)}
                />
                <TextField
                  size="small"
                  label="PSK value"
                  value={form.tls_psk}
                  onChange={(e) => set("tls_psk", e.target.value)}
                  type="password"
                  helperText="Leave blank to keep the existing key when editing"
                />
              </>
            )}
            {showCert && (
              <>
                <TextField
                  size="small"
                  label="Issuer"
                  value={form.tls_issuer}
                  onChange={(e) => set("tls_issuer", e.target.value)}
                />
                <TextField
                  size="small"
                  label="Subject"
                  value={form.tls_subject}
                  onChange={(e) => set("tls_subject", e.target.value)}
                />
              </>
            )}
          </Stack>
        )}
        {tab === 2 && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={form.custom_timeouts === 1}
                  onChange={(_, v) => set("custom_timeouts", v ? 1 : 0)}
                />
              }
              label={<Typography variant="body2">Override global item timeouts</Typography>}
            />
            {form.custom_timeouts === 1 &&
              TIMEOUT_FIELDS.map(({ key, label }) => (
                <TextField
                  key={key}
                  size="small"
                  label={label}
                  value={form[key] as string}
                  onChange={(e) => set(key, e.target.value as ProxyConfig[typeof key])}
                  placeholder="e.g. 3s or {$MACRO}"
                />
              ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={saving || !canSubmit}>
          {saving ? <CircularProgress size={14} /> : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
