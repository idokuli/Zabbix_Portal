"use client";
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
import { generateId } from "../../../app/utils";
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
  TeamTagSwitch,
  useCommonItemState,
} from "./shared";

type KeyValuePair = { _key: string; name: string; value: string };

const KeyValueListEditor = ({
  label,
  namePlaceholder,
  addLabel,
  items,
  onChange,
}: {
  label: string;
  namePlaceholder: string;
  addLabel: string;
  items: KeyValuePair[];
  onChange: (updater: (prev: KeyValuePair[]) => KeyValuePair[]) => void;
}) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
      {label}
    </Typography>
    <Stack spacing={1}>
      {items.map((item, i) => (
        <Stack key={item._key} direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder={namePlaceholder}
            value={item.name}
            sx={{ flex: 1 }}
            onChange={(e) =>
              onChange((p) => p.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
            }
          />
          <TextField
            size="small"
            placeholder="value"
            value={item.value}
            sx={{ flex: 2 }}
            onChange={(e) =>
              onChange((p) => p.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
            }
          />
          <ClearIcon
            fontSize="small"
            onClick={() => onChange((p) => p.filter((_, j) => j !== i))}
            sx={{ cursor: "pointer" }}
          />
        </Stack>
      ))}
      <Button
        size="small"
        variant="text"
        sx={{ alignSelf: "flex-start", fontSize: "0.75rem" }}
        onClick={() => onChange((p) => [...p, { _key: generateId(), name: "", value: "" }])}
      >
        {addLabel}
      </Button>
    </Stack>
  </Box>
);

const RequestBodyFields = ({
  postBodyType,
  onPostBodyTypeChange,
  postBody,
  onPostBodyChange,
}: {
  postBodyType: number;
  onPostBodyTypeChange: (v: number) => void;
  postBody: string;
  onPostBodyChange: (v: string) => void;
}) => (
  <>
    <TextField
      select
      size="small"
      label="Request body type"
      value={postBodyType}
      onChange={(e) => onPostBodyTypeChange(Number(e.target.value))}
    >
      <MenuItem value={0}>Raw</MenuItem>
      <MenuItem value={2}>JSON</MenuItem>
      <MenuItem value={3}>XML</MenuItem>
    </TextField>
    <TextField
      size="small"
      label="Request body"
      value={postBody}
      onChange={(e) => onPostBodyChange(e.target.value)}
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
);

const AuthCredentialFields = ({
  username,
  onUsernameChange,
  password,
  onPasswordChange,
}: {
  username: string;
  onUsernameChange: (v: string) => void;
  password: string;
  onPasswordChange: (v: string) => void;
}) => (
  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
    <TextField
      size="small"
      label="Username"
      value={username}
      onChange={(e) => onUsernameChange(e.target.value)}
      fullWidth
      autoComplete="off"
    />
    <TextField
      size="small"
      label="Password"
      type="password"
      value={password}
      onChange={(e) => onPasswordChange(e.target.value)}
      fullWidth
      autoComplete="new-password"
    />
  </Stack>
);

const RegexPreprocessingFields = ({
  regexPattern,
  onRegexPatternChange,
  regexOutput,
  onRegexOutputChange,
  regexNoMatch,
  onRegexNoMatchChange,
}: {
  regexPattern: string;
  onRegexPatternChange: (v: string) => void;
  regexOutput: string;
  onRegexOutputChange: (v: string) => void;
  regexNoMatch: string;
  onRegexNoMatchChange: (v: string) => void;
}) => (
  <Stack spacing={2}>
    <TextField
      size="small"
      label="Pattern *"
      value={regexPattern}
      onChange={(e) => onRegexPatternChange(e.target.value)}
      placeholder='"status":"(ok|healthy)"'
      helperText="PCRE regex — use a capture group ( ) to extract a value"
    />
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <TextField
        size="small"
        label="Output"
        value={regexOutput}
        onChange={(e) => onRegexOutputChange(e.target.value)}
        fullWidth
        placeholder="\1"
        helperText="\1 = first capture group"
      />
      <TextField
        size="small"
        label="Value if no match"
        value={regexNoMatch}
        onChange={(e) => onRegexNoMatchChange(e.target.value)}
        fullWidth
        placeholder="0"
      />
    </Stack>
  </Stack>
);

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
  const [valueType, setValueType] = useState(4);
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

  const isDisabled = saving || (bulkMode ? bulkHosts.length === 0 : !hostname) || !itemName || !url;

  const submitBulk = async () => {
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
      apply_team_tag: common.applyTeamTag,
    });
    setBulkResults(result.results);
    showToast(result.message, result.results.some((r) => r.error) ? "error" : "success");
  };

  const buildHttpAuthFields = () => ({
    authtype: authType,
    username: authType ? authUsername : undefined,
    password: authType ? authPassword : undefined,
  });

  const buildHttpRegexFields = () => ({
    regex_preprocessing: regexEnabled,
    regex_pattern: regexEnabled ? regexPattern : undefined,
    regex_output: regexEnabled ? regexOutput : undefined,
    regex_no_match_value: regexEnabled ? regexNoMatch : undefined,
  });

  const buildHttpSslFields = () => ({
    ssl_cert_file: sslCertFile || undefined,
    ssl_key_file: sslKeyFile || undefined,
    ssl_key_password: sslKeyFile && sslKeyPassword ? sslKeyPassword : undefined,
  });

  const buildHeadersAndQueryFields = () => ({
    headers:
      headers
        .filter((h) => h.name)
        .map((h) => `${h.name}: ${h.value}`)
        .join("\n") || undefined,
    query_fields: (() => {
      const qf = queryFields.filter((q) => q.name).map(({ name, value }) => ({ name, value }));
      return qf.length > 0 ? qf : undefined;
    })(),
  });

  const submitSingle = async () => {
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
      ...buildHeadersAndQueryFields(),
      http_proxy: proxy || undefined,
      ...buildHttpAuthFields(),
      ...buildHttpSslFields(),
      convert_to_json: convertToJson || undefined,
      allow_traps: allowTraps || undefined,
      status: enabled ? 0 : 1,
      ...buildHttpRegexFields(),
      delay: common.delay,
      units: common.units || undefined,
      history: common.history,
      trends: common.trends,
      description: common.description || undefined,
      apply_team_tag: common.applyTeamTag,
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
  };

  const onSubmit = async () => {
    setSaving(true);
    setBulkResults([]);
    try {
      if (bulkMode) {
        await submitBulk();
      } else {
        await submitSingle();
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

      <KeyValueListEditor
        label="Query fields (appended to URL as ?key=value)"
        namePlaceholder="name"
        addLabel="+ Add query field"
        items={queryFields}
        onChange={setQueryFields}
      />

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
            valueType === 0 ? "Stores response time in seconds" : "Stores full response body text"
          }
        >
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

      <TextField
        size="small"
        label="Required status codes"
        value={statusCodes}
        onChange={(e) => setStatusCodes(e.target.value)}
        placeholder="200"
        helperText="Comma-separated, e.g. 200,201,301. The item becomes unsupported if Zabbix gets a different code — alert on that state to catch bad responses."
      />

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
        <RequestBodyFields
          postBodyType={postBodyType}
          onPostBodyTypeChange={setPostBodyType}
          postBody={postBody}
          onPostBodyChange={setPostBody}
        />
      )}

      <KeyValueListEditor
        label="Request headers"
        namePlaceholder="Header name"
        addLabel="+ Add header"
        items={headers}
        onChange={setHeaders}
      />

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
        <AuthCredentialFields
          username={authUsername}
          onUsernameChange={setAuthUsername}
          password={authPassword}
          onPasswordChange={setAuthPassword}
        />
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
        <RegexPreprocessingFields
          regexPattern={regexPattern}
          onRegexPatternChange={setRegexPattern}
          regexOutput={regexOutput}
          onRegexOutputChange={setRegexOutput}
          regexNoMatch={regexNoMatch}
          onRegexNoMatchChange={setRegexNoMatch}
        />
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
        <TeamTagSwitch value={common.applyTeamTag} onChange={common.setApplyTeamTag} />
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
