"use client";
import { generateId } from "../../../app/utils";
import ClearIcon from "@mui/icons-material/Clear";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { api } from "../../../app/api";
import type { Host } from "../../../app/api";
import type { BulkResult } from "../shared";
import { BulkResults, httpMethods } from "../shared";
import {
  BulkModeToggle,
  CommonFields,
  EnabledSwitch,
  HostSelect,
  InlineItemsList,
  MultiHostSelect,
  type PanelProps,
  useCommonItemState,
} from "./shared";

export const HttpItemPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState(0);
  const [statusCodes, setStatusCodes] = useState("200");
  const [timeout, setTimeout] = useState("15s");
  const [verifyTLS, setVerifyTLS] = useState(true);
  const [verifyHost, setVerifyHost] = useState(true);
  const [followRedirects, setFollowRedirects] = useState(true);
  const [postBody, setPostBody] = useState("");
  const [postBodyType, setPostBodyType] = useState(0);
  const [retrieveMode, setRetrieveMode] = useState(0);
  const [valueType, setValueType] = useState(3);
  const [headers, setHeaders] = useState<{ _key: string; name: string; value: string }[]>([]);
  const [queryFields, setQueryFields] = useState<{ _key: string; name: string; value: string }[]>(
    [],
  );
  const [proxy, setProxy] = useState("");
  const [sslCertFile, setSslCertFile] = useState("");
  const [sslKeyFile, setSslKeyFile] = useState("");
  const [sslKeyPassword, setSslKeyPassword] = useState("");
  const [convertToJson, setConvertToJson] = useState(false);
  const [allowTraps, setAllowTraps] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [authType, setAuthType] = useState(0);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [regexEnabled, setRegexEnabled] = useState(false);
  const [regexPattern, setRegexPattern] = useState("");
  const [regexOutput, setRegexOutput] = useState("\\1");
  const [regexNoMatch, setRegexNoMatch] = useState("0");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkHosts, setBulkHosts] = useState<Host[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const isDisabled = saving || (bulkMode ? !bulkHosts.length : !hostname) || !itemName || !url;

  const onSubmit = async () => {
    setSaving(true);
    setBulkResults([]);
    try {
      const headersStr = headers
        .filter((h) => h.name)
        .map((h) => `${h.name}: ${h.value}`)
        .join("\n");
      const qf = queryFields.filter((q) => q.name).map(({ name, value }) => ({ name, value }));
      if (bulkMode) {
        const result = await api.bulkAddItems({
          hostnames: bulkHosts.map((h) => h.host),
          item_type: "http",
          item_name: itemName,
          url,
          request_method: method,
          status_codes: statusCodes,
          timeout,
          verify_peer: verifyTLS,
          follow_redirects: followRedirects,
          posts: postBody,
          value_type: valueType,
        });
        setBulkResults(result.results);
        showToast(result.message, result.results.some((r) => r.error) ? "error" : "success");
      } else {
        await api.addHttpItem({
          hostname,
          item_name: itemName,
          url,
          request_method: method,
          status_codes: statusCodes,
          timeout,
          verify_peer: verifyTLS,
          verify_host: verifyHost,
          follow_redirects: followRedirects,
          posts: postBody || undefined,
          post_type: postBodyType,
          retrieve_mode: retrieveMode,
          value_type: valueType,
          headers: headersStr || undefined,
          query_fields: qf.length ? qf : undefined,
          http_proxy: proxy || undefined,
          authtype: authType,
          username: authType ? authUsername : undefined,
          password: authType ? authPassword : undefined,
          ssl_cert_file: sslCertFile || undefined,
          ssl_key_file: sslKeyFile || undefined,
          ssl_key_password: sslKeyFile && sslKeyPassword ? sslKeyPassword : undefined,
          convert_to_json: convertToJson || undefined,
          allow_traps: allowTraps || undefined,
          status: enabled ? 0 : 1,
          regex_preprocessing: regexEnabled,
          regex_pattern: regexEnabled ? regexPattern : undefined,
          regex_output: regexEnabled ? regexOutput : undefined,
          regex_no_match_value: regexEnabled ? regexNoMatch : undefined,
          delay: common.delay,
          units: common.units || undefined,
          history: common.history,
          trends: common.trends,
          description: common.description || undefined,
        });
        showToast("Item added successfully.", "success");
        setItemName("");
        setUrl("");
        setPostBody("");
        setHeaders([]);
        setQueryFields([]);
        setProxy("");
        setRetrieveMode(0);
        setPostBodyType(0);
        common.reset();
        onSuccess();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <BulkModeToggle value={bulkMode} onChange={setBulkMode} />
      {bulkMode ? (
        <MultiHostSelect
          label="Hosts *"
          value={bulkHosts}
          onChange={setBulkHosts}
          hosts={hosts}
          hostsLoading={hostsLoading}
        />
      ) : (
        <HostSelect
          label="Host *"
          value={hostname}
          onChange={setHostname}
          hosts={hosts}
          hostsLoading={hostsLoading}
        />
      )}

      <TextField
        size="small"
        label="Item name *"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        placeholder="e.g. API health check"
      />
      <TextField
        size="small"
        label="URL *"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com/health"
      />

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          Query fields (appended to URL as ?key=value)
        </Typography>
        <Stack spacing={1}>
          {queryFields.map((qf, i) => (
            <Stack key={qf._key} direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="name"
                value={qf.name}
                sx={{ flex: 1 }}
                onChange={(e) =>
                  setQueryFields((p) =>
                    p.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)),
                  )
                }
              />
              <TextField
                size="small"
                placeholder="value"
                value={qf.value}
                sx={{ flex: 2 }}
                onChange={(e) =>
                  setQueryFields((p) =>
                    p.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)),
                  )
                }
              />
              <ClearIcon
                fontSize="small"
                onClick={() => setQueryFields((p) => p.filter((_, j) => j !== i))}
                sx={{ cursor: "pointer" }}
              />
            </Stack>
          ))}
          <Button
            size="small"
            variant="text"
            sx={{ alignSelf: "flex-start", fontSize: "0.75rem" }}
            onClick={() =>
              setQueryFields((p) => [...p, { _key: generateId(), name: "", value: "" }])
            }
          >
            + Add query field
          </Button>
        </Stack>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          size="small"
          label="Method"
          value={method}
          onChange={(e) => {
            setMethod(Number(e.target.value));
            setPostBody("");
            setPostBodyType(0);
          }}
          fullWidth
        >
          {httpMethods.map((m) => (
            <MenuItem key={m.value} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Store as"
          value={valueType}
          onChange={(e) => setValueType(Number(e.target.value))}
          fullWidth
          helperText={
            valueType === 3
              ? "Stores HTTP response code (e.g. 200)"
              : valueType === 0
                ? "Stores response time in seconds"
                : "Stores full response body text"
          }
        >
          <MenuItem value={3}>Integer — response code</MenuItem>
          <MenuItem value={0}>Float — response time (s)</MenuItem>
          <MenuItem value={4}>Text — response body</MenuItem>
        </TextField>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          size="small"
          label="Retrieve"
          value={retrieveMode}
          onChange={(e) => setRetrieveMode(Number(e.target.value))}
          fullWidth
        >
          <MenuItem value={0}>Body only</MenuItem>
          <MenuItem value={1}>Headers only</MenuItem>
          <MenuItem value={2}>Body + headers</MenuItem>
        </TextField>
        <TextField
          size="small"
          label="Timeout"
          value={timeout}
          onChange={(e) => setTimeout(e.target.value)}
          fullWidth
          placeholder="15s"
          helperText="e.g. 15s, 1m"
        />
      </Stack>

      {valueType === 3 && (
        <TextField
          size="small"
          label="Expected status codes"
          value={statusCodes}
          onChange={(e) => setStatusCodes(e.target.value)}
          placeholder="200"
          helperText="Comma-separated, e.g. 200,201,301"
        />
      )}

      <Stack direction="row" spacing={2} flexWrap="wrap">
        <FormControlLabel
          control={<Switch checked={verifyTLS} onChange={(_, v) => setVerifyTLS(v)} size="small" />}
          label={<Typography variant="body2">Verify TLS certificate</Typography>}
        />
        <FormControlLabel
          control={
            <Switch checked={verifyHost} onChange={(_, v) => setVerifyHost(v)} size="small" />
          }
          label={<Typography variant="body2">Verify hostname</Typography>}
        />
        <FormControlLabel
          control={
            <Switch
              checked={followRedirects}
              onChange={(_, v) => setFollowRedirects(v)}
              size="small"
            />
          }
          label={<Typography variant="body2">Follow redirects</Typography>}
        />
      </Stack>

      {(method === 1 || method === 2) && (
        <>
          <TextField
            select
            size="small"
            label="Request body type"
            value={postBodyType}
            onChange={(e) => setPostBodyType(Number(e.target.value))}
          >
            <MenuItem value={0}>Raw</MenuItem>
            <MenuItem value={2}>JSON</MenuItem>
            <MenuItem value={3}>XML</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Request body"
            value={postBody}
            onChange={(e) => setPostBody(e.target.value)}
            multiline
            minRows={3}
            placeholder={
              postBodyType === 2
                ? '{"key": "value"}'
                : postBodyType === 3
                  ? "<root><key>value</key></root>"
                  : "raw body content"
            }
          />
        </>
      )}

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          Request headers
        </Typography>
        <Stack spacing={1}>
          {headers.map((h, i) => (
            <Stack key={h._key} direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="Header name"
                value={h.name}
                sx={{ flex: 1 }}
                onChange={(e) =>
                  setHeaders((p) => p.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                }
              />
              <TextField
                size="small"
                placeholder="Value"
                value={h.value}
                sx={{ flex: 2 }}
                onChange={(e) =>
                  setHeaders((p) =>
                    p.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)),
                  )
                }
              />
              <ClearIcon
                fontSize="small"
                onClick={() => setHeaders((p) => p.filter((_, j) => j !== i))}
                sx={{ cursor: "pointer" }}
              />
            </Stack>
          ))}
          <Button
            size="small"
            variant="text"
            sx={{ alignSelf: "flex-start", fontSize: "0.75rem" }}
            onClick={() => setHeaders((p) => [...p, { _key: generateId(), name: "", value: "" }])}
          >
            + Add header
          </Button>
        </Stack>
      </Box>

      <TextField
        size="small"
        label="HTTP proxy"
        value={proxy}
        onChange={(e) => setProxy(e.target.value)}
        placeholder="http://proxy.example.com:3128"
        helperText="Optional: leave empty to use direct connection"
      />

      <Divider />
      <Typography variant="body2" color="text.secondary" fontWeight={500}>
        SSL / TLS certificate
      </Typography>
      <Stack spacing={2}>
        <TextField
          size="small"
          label="SSL certificate file"
          value={sslCertFile}
          onChange={(e) => setSslCertFile(e.target.value)}
          placeholder="/etc/ssl/client.crt"
          helperText="Path to client-side certificate file."
        />
        <TextField
          size="small"
          label="SSL key file"
          value={sslKeyFile}
          onChange={(e) => setSslKeyFile(e.target.value)}
          placeholder="/etc/ssl/client.key"
          helperText="Path to client private key file."
        />
        {sslKeyFile && (
          <TextField
            size="small"
            label="SSL key password"
            type="password"
            value={sslKeyPassword}
            onChange={(e) => setSslKeyPassword(e.target.value)}
            autoComplete="new-password"
          />
        )}
      </Stack>

      <Divider />
      <TextField
        select
        size="small"
        label="Authentication"
        value={authType}
        onChange={(e) => {
          setAuthType(Number(e.target.value));
          setAuthUsername("");
          setAuthPassword("");
        }}
      >
        <MenuItem value={0}>None</MenuItem>
        <MenuItem value={1}>Basic (username / password)</MenuItem>
        <MenuItem value={2}>NTLM (Windows)</MenuItem>
      </TextField>
      {authType > 0 && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            size="small"
            label="Username"
            value={authUsername}
            onChange={(e) => setAuthUsername(e.target.value)}
            fullWidth
            autoComplete="off"
          />
          <TextField
            size="small"
            label="Password"
            type="password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            fullWidth
            autoComplete="new-password"
          />
        </Stack>
      )}

      <Divider />
      <FormControlLabel
        control={
          <Switch checked={regexEnabled} onChange={(_, v) => setRegexEnabled(v)} size="small" />
        }
        label={
          <Typography variant="body2">Apply regex to response body (preprocessing)</Typography>
        }
      />
      {regexEnabled && (
        <Stack spacing={2}>
          <TextField
            size="small"
            label="Pattern *"
            value={regexPattern}
            onChange={(e) => setRegexPattern(e.target.value)}
            placeholder='"status":"(ok|healthy)"'
            helperText="PCRE regex — use a capture group ( ) to extract a value"
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              size="small"
              label="Output"
              value={regexOutput}
              onChange={(e) => setRegexOutput(e.target.value)}
              fullWidth
              placeholder="\1"
              helperText="\1 = first capture group"
            />
            <TextField
              size="small"
              label="Value if no match"
              value={regexNoMatch}
              onChange={(e) => setRegexNoMatch(e.target.value)}
              fullWidth
              placeholder="0"
            />
          </Stack>
        </Stack>
      )}

      <Divider />
      <Stack spacing={1}>
        <FormControlLabel
          control={
            <Switch checked={convertToJson} onChange={(_, v) => setConvertToJson(v)} size="small" />
          }
          label={<Typography variant="body2">Convert to JSON</Typography>}
        />
        <FormControlLabel
          control={
            <Switch checked={allowTraps} onChange={(_, v) => setAllowTraps(v)} size="small" />
          }
          label={<Typography variant="body2">Enable trapping</Typography>}
        />
        <EnabledSwitch value={enabled} onChange={setEnabled} />
      </Stack>

      <Divider />
      <CommonFields
        delay={common.delay}
        setDelay={common.setDelay}
        units={common.units}
        setUnits={common.setUnits}
        history={common.history}
        setHistory={common.setHistory}
        trends={common.trends}
        setTrends={common.setTrends}
        description={common.description}
        setDescription={common.setDescription}
      />

      {bulkResults.length > 0 && <BulkResults results={bulkResults} label="Bulk item add" />}

      <Box>
        <Button variant="contained" color="secondary" onClick={onSubmit} disabled={isDisabled}>
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : bulkMode ? (
            "Add to all hosts"
          ) : (
            "Add item"
          )}
        </Button>
      </Box>

      <InlineItemsList hostname={hostname} skip={bulkMode} />
    </Stack>
  );
};
