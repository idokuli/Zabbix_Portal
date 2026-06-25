"use client";
import ClearIcon from "@mui/icons-material/Clear";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../../../app/api";
import type { Item } from "../shared";
import { valueTypes } from "../shared";
import {
  CommonFields,
  EnabledSwitch,
  HostSelect,
  type PanelProps,
  useCommonItemState,
} from "./shared";

// ── Internal ──────────────────────────────────────────────────────────
export const InternalItemPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [key, setKey] = useState("");
  const [valueType, setValueType] = useState(3);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addInternalItem({
        hostname,
        item_name: itemName,
        item_key: key,
        value_type: valueType,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setKey("");
      common.reset();
      onSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <HostSelect
        label="Host *"
        value={hostname}
        onChange={setHostname}
        hosts={hosts}
        hostsLoading={hostsLoading}
      />
      <TextField
        size="small"
        label="Item name *"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />
      <TextField
        size="small"
        label="Item key *"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="e.g. zabbix[queue]"
        helperText="Must be a valid Zabbix internal item key"
      />
      <TextField
        select
        size="small"
        label="Value type"
        value={valueType}
        onChange={(e) => setValueType(Number(e.target.value))}
      >
        {valueTypes.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <CommonFields
        delay={common.delay}
        setDelay={common.setDelay}
        history={common.history}
        setHistory={common.setHistory}
        trends={common.trends}
        setTrends={common.setTrends}
        description={common.description}
        setDescription={common.setDescription}
        withUnits={false}
      />
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />
      <Box>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSubmit}
          disabled={saving || !hostname || !itemName || !key}
        >
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add item"
          )}
        </Button>
      </Box>
    </Stack>
  );
};

// ── Trapper ───────────────────────────────────────────────────────────
export const TrapperItemPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [key, setKey] = useState("");
  const [valueType, setValueType] = useState(4);
  const [allowTraps] = useState(true);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addTrapperItem({
        hostname,
        item_name: itemName,
        item_key: key,
        value_type: valueType,
        allow_traps: allowTraps,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setKey("");
      common.reset();
      onSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <HostSelect
        label="Host *"
        value={hostname}
        onChange={setHostname}
        hosts={hosts}
        hostsLoading={hostsLoading}
      />
      <TextField
        size="small"
        label="Item name *"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />
      <TextField
        size="small"
        label="Trap key *"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="e.g. my.custom.trap"
      />
      <TextField
        select
        size="small"
        label="Value type"
        value={valueType}
        onChange={(e) => setValueType(Number(e.target.value))}
      >
        {valueTypes.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          size="small"
          label="History"
          value={common.history}
          onChange={(e) => common.setHistory(e.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Trends"
          value={common.trends}
          onChange={(e) => common.setTrends(e.target.value)}
          fullWidth
        />
      </Stack>
      <TextField
        size="small"
        label="Description"
        value={common.description}
        onChange={(e) => common.setDescription(e.target.value)}
        multiline
        minRows={2}
      />
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />
      <Box>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSubmit}
          disabled={saving || !hostname || !itemName || !key}
        >
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add item"
          )}
        </Button>
      </Box>
    </Stack>
  );
};

// ── External ──────────────────────────────────────────────────────────
export const ExternalItemPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [key, setKey] = useState("");
  const [valueType, setValueType] = useState(4);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addExternalItem({
        hostname,
        item_name: itemName,
        item_key: key,
        value_type: valueType,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setKey("");
      common.reset();
      onSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <HostSelect
        label="Host *"
        value={hostname}
        onChange={setHostname}
        hosts={hosts}
        hostsLoading={hostsLoading}
      />
      <TextField
        size="small"
        label="Item name *"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />
      <TextField
        size="small"
        label="Script name (key) *"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="e.g. check_disk.sh[/,pfree]"
        helperText="Script in ExternalScripts dir — may include [] params"
      />
      <TextField
        select
        size="small"
        label="Value type"
        value={valueType}
        onChange={(e) => setValueType(Number(e.target.value))}
      >
        {valueTypes.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <CommonFields
        delay={common.delay}
        setDelay={common.setDelay}
        history={common.history}
        setHistory={common.setHistory}
        trends={common.trends}
        setTrends={common.setTrends}
        description={common.description}
        setDescription={common.setDescription}
        withUnits={false}
      />
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />
      <Box>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSubmit}
          disabled={saving || !hostname || !itemName || !key}
        >
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add item"
          )}
        </Button>
      </Box>
    </Stack>
  );
};

// ── IPMI ──────────────────────────────────────────────────────────────
export const IpmiItemPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [sensor, setSensor] = useState("");
  const [valueType, setValueType] = useState(0);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addIpmiItem({
        hostname,
        item_name: itemName || undefined,
        ipmi_sensor: sensor,
        value_type: valueType,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setSensor("");
      common.reset();
      onSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <HostSelect
        label="Host *"
        value={hostname}
        onChange={setHostname}
        hosts={hosts}
        hostsLoading={hostsLoading}
      />
      <TextField
        size="small"
        label="IPMI sensor *"
        value={sensor}
        onChange={(e) => setSensor(e.target.value)}
        placeholder="e.g. CPU Temp"
        helperText="Sensor name as reported by ipmitool"
      />
      <TextField
        size="small"
        label="Item name (optional)"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />
      <TextField
        select
        size="small"
        label="Value type"
        value={valueType}
        onChange={(e) => setValueType(Number(e.target.value))}
      >
        {valueTypes.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <CommonFields
        delay={common.delay}
        setDelay={common.setDelay}
        history={common.history}
        setHistory={common.setHistory}
        trends={common.trends}
        setTrends={common.setTrends}
        description={common.description}
        setDescription={common.setDescription}
        withUnits={false}
      />
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />
      <Box>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSubmit}
          disabled={saving || !hostname || !sensor}
        >
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add item"
          )}
        </Button>
      </Box>
    </Stack>
  );
};

// ── SSH ───────────────────────────────────────────────────────────────
export const SshItemPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [params, setParams] = useState("");
  const [authType, setAuthType] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [valueType, setValueType] = useState(1);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addSshItem({
        hostname,
        item_name: itemName,
        params,
        authtype: authType,
        username: username || undefined,
        password: authType === 0 ? password || undefined : undefined,
        publickey: authType === 1 ? publicKey || undefined : undefined,
        privatekey: authType === 1 ? privateKey || undefined : undefined,
        value_type: valueType,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setParams("");
      setUsername("");
      setPassword("");
      setPublicKey("");
      setPrivateKey("");
      common.reset();
      onSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <HostSelect
        label="Host *"
        value={hostname}
        onChange={setHostname}
        hosts={hosts}
        hostsLoading={hostsLoading}
      />
      <TextField
        size="small"
        label="Item name *"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />
      <TextField
        size="small"
        label="Command *"
        value={params}
        onChange={(e) => setParams(e.target.value)}
        placeholder="e.g. df -h / | awk 'NR==2{print $5}'"
        multiline
        minRows={2}
      />
      <TextField
        select
        size="small"
        label="Auth type"
        value={authType}
        onChange={(e) => {
          setAuthType(Number(e.target.value));
          setPassword("");
          setPublicKey("");
          setPrivateKey("");
        }}
      >
        <MenuItem value={0}>Password</MenuItem>
        <MenuItem value={1}>Public key</MenuItem>
      </TextField>
      <TextField
        size="small"
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="off"
      />
      {authType === 0 ? (
        <TextField
          size="small"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      ) : (
        <Stack spacing={2}>
          <TextField
            size="small"
            label="Public key file"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="/var/lib/zabbix/.ssh/id_rsa.pub"
          />
          <TextField
            size="small"
            label="Private key file"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="/var/lib/zabbix/.ssh/id_rsa"
          />
        </Stack>
      )}
      <TextField
        select
        size="small"
        label="Value type"
        value={valueType}
        onChange={(e) => setValueType(Number(e.target.value))}
      >
        {valueTypes.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <CommonFields
        delay={common.delay}
        setDelay={common.setDelay}
        history={common.history}
        setHistory={common.setHistory}
        trends={common.trends}
        setTrends={common.setTrends}
        description={common.description}
        setDescription={common.setDescription}
        withUnits={false}
      />
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />
      <Box>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSubmit}
          disabled={saving || !hostname || !itemName || !params}
        >
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add item"
          )}
        </Button>
      </Box>
    </Stack>
  );
};

// ── Telnet ────────────────────────────────────────────────────────────
export const TelnetItemPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [params, setParams] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [valueType, setValueType] = useState(1);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addTelnetItem({
        hostname,
        item_name: itemName,
        params,
        username: username || undefined,
        password: password || undefined,
        value_type: valueType,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setParams("");
      setUsername("");
      setPassword("");
      common.reset();
      onSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <HostSelect
        label="Host *"
        value={hostname}
        onChange={setHostname}
        hosts={hosts}
        hostsLoading={hostsLoading}
      />
      <TextField
        size="small"
        label="Item name *"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />
      <TextField
        size="small"
        label="Command *"
        value={params}
        onChange={(e) => setParams(e.target.value)}
        multiline
        minRows={2}
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          size="small"
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          autoComplete="off"
        />
        <TextField
          size="small"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          autoComplete="new-password"
        />
      </Stack>
      <TextField
        select
        size="small"
        label="Value type"
        value={valueType}
        onChange={(e) => setValueType(Number(e.target.value))}
      >
        {valueTypes.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <CommonFields
        delay={common.delay}
        setDelay={common.setDelay}
        history={common.history}
        setHistory={common.setHistory}
        trends={common.trends}
        setTrends={common.setTrends}
        description={common.description}
        setDescription={common.setDescription}
        withUnits={false}
      />
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />
      <Box>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSubmit}
          disabled={saving || !hostname || !itemName || !params}
        >
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add item"
          )}
        </Button>
      </Box>
    </Stack>
  );
};

// ── JMX ───────────────────────────────────────────────────────────────
export const JmxItemPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [key, setKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [valueType, setValueType] = useState(3);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addJmxItem({
        hostname,
        item_name: itemName,
        item_key: key,
        jmx_endpoint: endpoint || undefined,
        username: username || undefined,
        password: password || undefined,
        value_type: valueType,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setKey("");
      setEndpoint("");
      setUsername("");
      setPassword("");
      common.reset();
      onSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <HostSelect
        label="Host *"
        value={hostname}
        onChange={setHostname}
        hosts={hosts}
        hostsLoading={hostsLoading}
      />
      <TextField
        size="small"
        label="Item name *"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />
      <TextField
        size="small"
        label="JMX key *"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder='jmx["java.lang:type=Memory","HeapMemoryUsage.used"]'
      />
      <TextField
        size="small"
        label="JMX endpoint (optional)"
        value={endpoint}
        onChange={(e) => setEndpoint(e.target.value)}
        placeholder="service:jmx:rmi:///jndi/rmi://host:9999/jmxrmi"
        helperText="Leave empty to use the host JMX interface"
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          size="small"
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          autoComplete="off"
        />
        <TextField
          size="small"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          autoComplete="new-password"
        />
      </Stack>
      <TextField
        select
        size="small"
        label="Value type"
        value={valueType}
        onChange={(e) => setValueType(Number(e.target.value))}
      >
        {valueTypes.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <CommonFields
        delay={common.delay}
        setDelay={common.setDelay}
        history={common.history}
        setHistory={common.setHistory}
        trends={common.trends}
        setTrends={common.setTrends}
        description={common.description}
        setDescription={common.setDescription}
        withUnits={false}
      />
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />
      <Box>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSubmit}
          disabled={saving || !hostname || !itemName || !key}
        >
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add item"
          )}
        </Button>
      </Box>
    </Stack>
  );
};

// ── Calculated ────────────────────────────────────────────────────────
export const CalculatedItemPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [key, setKey] = useState("");
  const [formula, setFormula] = useState("");
  const [valueType, setValueType] = useState(0);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addCalculatedItem({
        hostname,
        item_name: itemName,
        item_key: key,
        formula,
        value_type: valueType,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setKey("");
      setFormula("");
      common.reset();
      onSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <HostSelect
        label="Host *"
        value={hostname}
        onChange={setHostname}
        hosts={hosts}
        hostsLoading={hostsLoading}
      />
      <TextField
        size="small"
        label="Item name *"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />
      <TextField
        size="small"
        label="Item key *"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="e.g. cpu.usage.total"
      />
      <TextField
        size="small"
        label="Formula *"
        value={formula}
        onChange={(e) => setFormula(e.target.value)}
        multiline
        minRows={2}
        placeholder='avg("hostname","system.cpu.util[,user]",5m) + avg("hostname","system.cpu.util[,system]",5m)'
        helperText="Zabbix calculated item formula — use item keys from this host"
      />
      <TextField
        select
        size="small"
        label="Value type"
        value={valueType}
        onChange={(e) => setValueType(Number(e.target.value))}
      >
        {valueTypes.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <CommonFields
        delay={common.delay}
        setDelay={common.setDelay}
        history={common.history}
        setHistory={common.setHistory}
        trends={common.trends}
        setTrends={common.setTrends}
        description={common.description}
        setDescription={common.setDescription}
        withUnits={false}
      />
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />
      <Box>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSubmit}
          disabled={saving || !hostname || !itemName || !key || !formula}
        >
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add item"
          )}
        </Button>
      </Box>
    </Stack>
  );
};

// ── Dependent ─────────────────────────────────────────────────────────
export const DependentItemPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [key, setKey] = useState("");
  const [masterItemId, setMasterItemId] = useState("");
  const [inlineItems, setInlineItems] = useState<Item[]>([]);
  const [valueType, setValueType] = useState(4);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  useEffect(() => {
    if (!hostname) {
      setInlineItems([]);
      return;
    }
    api
      .listItems(hostname)
      .then((r) => setInlineItems(r.items))
      .catch(() => setInlineItems([]));
  }, [hostname]);

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addDependentItem({
        hostname,
        item_name: itemName,
        item_key: key,
        master_itemid: masterItemId,
        value_type: valueType,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setKey("");
      setMasterItemId("");
      common.reset();
      onSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <HostSelect
        label="Host *"
        value={hostname}
        onChange={setHostname}
        hosts={hosts}
        hostsLoading={hostsLoading}
      />
      <TextField
        select
        size="small"
        label="Master item *"
        value={masterItemId}
        onChange={(e) => setMasterItemId(e.target.value)}
        helperText="Select the master item — this dependent item will derive its value from it"
      >
        <MenuItem value="">
          <em>Select master item…</em>
        </MenuItem>
        {inlineItems.map((i) => (
          <MenuItem key={i.itemid} value={i.itemid}>
            {i.name} ({i.key_})
          </MenuItem>
        ))}
      </TextField>
      <TextField
        size="small"
        label="Item name *"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />
      <TextField
        size="small"
        label="Item key *"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <TextField
        select
        size="small"
        label="Value type"
        value={valueType}
        onChange={(e) => setValueType(Number(e.target.value))}
      >
        {valueTypes.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          size="small"
          label="History"
          value={common.history}
          onChange={(e) => common.setHistory(e.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Trends"
          value={common.trends}
          onChange={(e) => common.setTrends(e.target.value)}
          fullWidth
        />
      </Stack>
      <TextField
        size="small"
        label="Description"
        value={common.description}
        onChange={(e) => common.setDescription(e.target.value)}
        multiline
        minRows={2}
      />
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />
      <Box>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSubmit}
          disabled={saving || !hostname || !itemName || !key || !masterItemId}
        >
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add item"
          )}
        </Button>
      </Box>
    </Stack>
  );
};

// ── Zabbix Script (JS) ────────────────────────────────────────────────
export const ZabbixScriptItemPanel = ({
  hosts,
  hostsLoading,
  showToast,
  onSuccess,
}: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [key, setKey] = useState("");
  const [script, setScript] = useState("");
  const [params, setParams] = useState<{ _key: string; name: string; value: string }[]>([]);
  const [valueType, setValueType] = useState(4);
  const [timeout, setScriptTimeout] = useState("");
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addZabbixScriptItem({
        hostname,
        item_name: itemName,
        item_key: key,
        params: script,
        parameters: params.filter((p) => p.name).map(({ name, value }) => ({ name, value })),
        value_type: valueType,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        timeout: timeout || undefined,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setKey("");
      setScript("");
      setParams([]);
      setScriptTimeout("");
      common.reset();
      onSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <HostSelect
        label="Host *"
        value={hostname}
        onChange={setHostname}
        hosts={hosts}
        hostsLoading={hostsLoading}
      />
      <TextField
        size="small"
        label="Item name *"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />
      <TextField
        size="small"
        label="Item key *"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="e.g. custom.js.check"
      />
      <TextField
        size="small"
        label="JavaScript *"
        value={script}
        onChange={(e) => setScript(e.target.value)}
        multiline
        minRows={5}
        placeholder={"var r = new HttpRequest();\nreturn r.get('http://example.com/health');"}
        inputProps={{ style: { fontFamily: "monospace", fontSize: "0.82rem" } }}
      />
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          Script parameters (accessible in JS as value)
        </Typography>
        <Stack spacing={1}>
          {params.map((p, i) => (
            <Stack key={p._key} direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="name"
                value={p.name}
                sx={{ flex: 1 }}
                onChange={(e) =>
                  setParams((prev) =>
                    prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)),
                  )
                }
              />
              <TextField
                size="small"
                placeholder="value"
                value={p.value}
                sx={{ flex: 2 }}
                onChange={(e) =>
                  setParams((prev) =>
                    prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)),
                  )
                }
              />
              <IconButton
                size="small"
                onClick={() => setParams((prev) => prev.filter((_, j) => j !== i))}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button
            size="small"
            variant="text"
            sx={{ alignSelf: "flex-start", fontSize: "0.75rem" }}
            onClick={() =>
              setParams((p) => [...p, { _key: crypto.randomUUID(), name: "", value: "" }])
            }
          >
            + Add parameter
          </Button>
        </Stack>
      </Box>
      <Divider />
      <TextField
        select
        size="small"
        label="Value type"
        value={valueType}
        onChange={(e) => setValueType(Number(e.target.value))}
      >
        {valueTypes.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        size="small"
        label="Timeout (optional)"
        value={timeout}
        onChange={(e) => setScriptTimeout(e.target.value)}
        placeholder="3s"
      />
      <CommonFields
        delay={common.delay}
        setDelay={common.setDelay}
        history={common.history}
        setHistory={common.setHistory}
        trends={common.trends}
        setTrends={common.setTrends}
        description={common.description}
        setDescription={common.setDescription}
        withUnits={false}
      />
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />
      <Box>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSubmit}
          disabled={saving || !hostname || !itemName || !key || !script}
        >
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add item"
          )}
        </Button>
      </Box>
    </Stack>
  );
};

// ── Browser (JS) ──────────────────────────────────────────────────────
export const BrowserItemPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [key, setKey] = useState("");
  const [script, setScript] = useState("");
  const [params, setParams] = useState<{ _key: string; name: string; value: string }[]>([]);
  const [valueType, setValueType] = useState(4);
  const [timeout, setBrowserTimeout] = useState("");
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addBrowserItem({
        hostname,
        item_name: itemName,
        item_key: key,
        params: script,
        parameters: params.filter((p) => p.name).map(({ name, value }) => ({ name, value })),
        value_type: valueType,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        timeout: timeout || undefined,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setKey("");
      setScript("");
      setParams([]);
      setBrowserTimeout("");
      common.reset();
      onSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <HostSelect
        label="Host *"
        value={hostname}
        onChange={setHostname}
        hosts={hosts}
        hostsLoading={hostsLoading}
      />
      <TextField
        size="small"
        label="Item name *"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />
      <TextField
        size="small"
        label="Item key *"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="e.g. browser.login.check"
      />
      <TextField
        size="small"
        label="Browser script *"
        value={script}
        onChange={(e) => setScript(e.target.value)}
        multiline
        minRows={5}
        placeholder={
          "var page = new WebPage();\npage.navigate('https://example.com');\nreturn page.title;"
        }
        inputProps={{ style: { fontFamily: "monospace", fontSize: "0.82rem" } }}
      />
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          Script parameters
        </Typography>
        <Stack spacing={1}>
          {params.map((p, i) => (
            <Stack key={p._key} direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="name"
                value={p.name}
                sx={{ flex: 1 }}
                onChange={(e) =>
                  setParams((prev) =>
                    prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)),
                  )
                }
              />
              <TextField
                size="small"
                placeholder="value"
                value={p.value}
                sx={{ flex: 2 }}
                onChange={(e) =>
                  setParams((prev) =>
                    prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)),
                  )
                }
              />
              <IconButton
                size="small"
                onClick={() => setParams((prev) => prev.filter((_, j) => j !== i))}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button
            size="small"
            variant="text"
            sx={{ alignSelf: "flex-start", fontSize: "0.75rem" }}
            onClick={() =>
              setParams((p) => [...p, { _key: crypto.randomUUID(), name: "", value: "" }])
            }
          >
            + Add parameter
          </Button>
        </Stack>
      </Box>
      <Divider />
      <TextField
        select
        size="small"
        label="Value type"
        value={valueType}
        onChange={(e) => setValueType(Number(e.target.value))}
      >
        {valueTypes.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        size="small"
        label="Timeout (optional)"
        value={timeout}
        onChange={(e) => setBrowserTimeout(e.target.value)}
        placeholder="30s"
      />
      <CommonFields
        delay={common.delay}
        setDelay={common.setDelay}
        history={common.history}
        setHistory={common.setHistory}
        trends={common.trends}
        setTrends={common.setTrends}
        description={common.description}
        setDescription={common.setDescription}
        withUnits={false}
      />
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />
      <Box>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSubmit}
          disabled={saving || !hostname || !itemName || !key || !script}
        >
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add item"
          )}
        </Button>
      </Box>
    </Stack>
  );
};
