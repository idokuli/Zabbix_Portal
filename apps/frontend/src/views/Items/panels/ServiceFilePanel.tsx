"use client";
import TerminalIcon from "@mui/icons-material/Terminal";
import {
  Alert,
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
import { useEffect, useState } from "react";
import { api } from "../../../app/api";
import { agentServiceTypes, icmpTypes, serviceTypes, severities } from "../shared";
import {
  CommonFields,
  HostSelect,
  InlineItemsList,
  type PanelProps,
  useCommonItemState,
} from "./shared";

export const ServicePanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [svcType, setSvcType] = useState("icmp_ping");
  const [svcPort, setSvcPort] = useState("");
  const [svcItemName, setSvcItemName] = useState("");
  const [agentName, setAgentName] = useState(""); // process name or Windows service name
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const isAgentType = agentServiceTypes.has(svcType);

  useEffect(() => {
    const found = serviceTypes.find((s) => s.value === svcType);
    setSvcPort(found?.port != null ? String(found.port) : "");
    setSvcItemName("");
    setAgentName("");
  }, [svcType]);

  const isDisabled = saving || !hostname || (isAgentType && !agentName.trim());

  const submitLinuxProcess = () =>
    api.addProcessItem({
      hostname,
      process_name: agentName.trim(),
      item_name: svcItemName || undefined,
      delay: common.delay,
      history: common.history,
      trends: common.trends,
      description: common.description || undefined,
    });

  const submitWindowsService = () =>
    api.addWindowsServiceItem({
      hostname,
      service_name: agentName.trim(),
      item_name: svcItemName || undefined,
      delay: common.delay,
      history: common.history,
      trends: common.trends,
      description: common.description || undefined,
    });

  const submitGenericService = () =>
    api.addServiceItem({
      hostname,
      service_type: svcType,
      port: svcPort ? Number(svcPort) : null,
      item_name: svcItemName || undefined,
      delay: common.delay,
      history: common.history,
      trends: common.trends,
      description: common.description || undefined,
    });

  const onSubmit = async () => {
    setSaving(true);
    try {
      if (svcType === "linux_process") {
        await submitLinuxProcess();
      } else if (svcType === "windows_service") {
        await submitWindowsService();
      } else {
        await submitGenericService();
      }
      showToast("Item added successfully.", "success");
      setSvcItemName("");
      setAgentName("");
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
        label="Service type *"
        value={svcType}
        onChange={(e) => setSvcType(e.target.value)}
      >
        {serviceTypes.map((s) => (
          <MenuItem key={s.value} value={s.value}>
            <Box>
              <Typography variant="body2">{s.label}</Typography>
              <Typography variant="caption" color="text.secondary">
                {s.description}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </TextField>

      {isAgentType && (
        <TextField
          size="small"
          label={svcType === "windows_service" ? "Service name *" : "Process name *"}
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          placeholder={
            svcType === "windows_service"
              ? "e.g. W3SVC, nginx, MSSQLSERVER"
              : "e.g. nginx, java, python3"
          }
          helperText={
            svcType === "windows_service"
              ? "Internal service name — run 'sc query' or 'Get-Service' to find it"
              : "Exact process name as shown in ps/top"
          }
        />
      )}

      {!(icmpTypes.has(svcType) || isAgentType) && (
        <TextField
          size="small"
          label="Port"
          value={svcPort}
          onChange={(e) => setSvcPort(e.target.value)}
          type="number"
          placeholder="e.g. 80"
          helperText="Auto-filled from service type — override if needed"
        />
      )}
      <TextField
        size="small"
        label="Item name (optional)"
        value={svcItemName}
        onChange={(e) => setSvcItemName(e.target.value)}
        placeholder="Leave blank for auto-generated name"
      />

      <Divider />
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

      <Box>
        <Button variant="contained" color="secondary" onClick={onSubmit} disabled={isDisabled}>
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
      <InlineItemsList hostname={hostname} />
    </Stack>
  );
};

export const WindowsServicePanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [itemName, setItemName] = useState("");
  const [createTrigger, setCreateTrigger] = useState(true);
  const [triggerPriority, setTriggerPriority] = useState(3);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const isDisabled = saving || !hostname || !serviceName.trim();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addWindowsServiceItem({
        hostname,
        service_name: serviceName.trim(),
        item_name: itemName.trim() || undefined,
        create_trigger: createTrigger,
        trigger_priority: triggerPriority,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
      });
      showToast("Windows service monitor item added successfully.", "success");
      setServiceName("");
      setItemName("");
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
        label="Service name *"
        value={serviceName}
        onChange={(e) => setServiceName(e.target.value)}
        placeholder="e.g. wuauserv, W3SVC, MSSQLSERVER"
        helperText="Use the internal service name (not display name). Run 'sc query' or 'Get-Service' to find it."
      />

      <TextField
        size="small"
        label="Item name (optional)"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        placeholder="Leave blank for auto-generated name"
      />

      <FormControlLabel
        control={
          <Switch
            checked={createTrigger}
            onChange={(e) => setCreateTrigger(e.target.checked)}
            size="small"
          />
        }
        label="Auto-create trigger (fires when service is not running)"
      />

      {createTrigger && (
        <TextField
          select
          size="small"
          label="Trigger severity"
          value={triggerPriority}
          onChange={(e) => setTriggerPriority(Number(e.target.value))}
        >
          {severities.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
      )}

      <Alert severity="info" icon={<TerminalIcon />} sx={{ fontSize: "0.78rem" }}>
        Uses <strong>service.info[name,state]</strong> — Windows-only Zabbix agent key. Returns 0
        when running. The Zabbix agent must be installed on the Windows host.
      </Alert>

      <Divider />
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

      <Box>
        <Button variant="contained" color="secondary" onClick={onSubmit} disabled={isDisabled}>
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add service monitor"
          )}
        </Button>
      </Box>
      <InlineItemsList hostname={hostname} />
    </Stack>
  );
};

export const ProcessPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [processName, setProcessName] = useState("");
  const [runAsUser, setRunAsUser] = useState("");
  const [cmdlineRegex, setCmdlineRegex] = useState("");
  const [state, setState] = useState("all");
  const [itemName, setItemName] = useState("");
  const [createTrigger, setCreateTrigger] = useState(true);
  const [triggerPriority, setTriggerPriority] = useState(3);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const isDisabled = saving || !hostname || !processName.trim();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addProcessItem({
        hostname,
        process_name: processName.trim(),
        run_as_user: runAsUser.trim() || undefined,
        cmdline_regex: cmdlineRegex.trim() || undefined,
        state,
        item_name: itemName.trim() || undefined,
        create_trigger: createTrigger,
        trigger_priority: triggerPriority,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
      });
      showToast("Process monitor item added successfully.", "success");
      setProcessName("");
      setRunAsUser("");
      setCmdlineRegex("");
      setItemName("");
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
        label="Process name *"
        value={processName}
        onChange={(e) => setProcessName(e.target.value)}
        placeholder="e.g. nginx, java, python3"
        helperText="Exact process name as shown in ps/top"
      />

      <TextField
        size="small"
        label="Run as user (optional)"
        value={runAsUser}
        onChange={(e) => setRunAsUser(e.target.value)}
        placeholder="e.g. www-data, root"
        helperText="Filter by the OS user running the process"
      />

      <TextField
        size="small"
        label="Command-line regex (optional)"
        value={cmdlineRegex}
        onChange={(e) => setCmdlineRegex(e.target.value)}
        placeholder="e.g. /etc/nginx/nginx.conf"
        helperText="Regex matched against the full command line"
      />

      <TextField
        select
        size="small"
        label="Process state"
        value={state}
        onChange={(e) => setState(e.target.value)}
      >
        {[
          { value: "all", label: "All" },
          { value: "run", label: "Running" },
          { value: "sleep", label: "Sleeping" },
          { value: "zomb", label: "Zombie" },
        ].map((s) => (
          <MenuItem key={s.value} value={s.value}>
            {s.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        size="small"
        label="Item name (optional)"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        placeholder="Leave blank for auto-generated name"
      />

      <FormControlLabel
        control={
          <Switch
            checked={createTrigger}
            onChange={(e) => setCreateTrigger(e.target.checked)}
            size="small"
          />
        }
        label="Auto-create trigger (fires when process count = 0)"
      />

      {createTrigger && (
        <TextField
          select
          size="small"
          label="Trigger severity"
          value={triggerPriority}
          onChange={(e) => setTriggerPriority(Number(e.target.value))}
        >
          {severities.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
      )}

      <Alert severity="info" icon={<TerminalIcon />} sx={{ fontSize: "0.78rem" }}>
        Uses Zabbix agent key <code>proc.num[name,user,state,cmdline]</code>. The Zabbix agent must
        be running on the host.
      </Alert>

      <Divider />
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

      <Box>
        <Button variant="contained" color="secondary" onClick={onSubmit} disabled={isDisabled}>
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add process monitor"
          )}
        </Button>
      </Box>
      <InlineItemsList hostname={hostname} />
    </Stack>
  );
};

export const FileWatchPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [filePath, setFilePath] = useState("");
  const [checkType, setCheckType] = useState<
    "checksum" | "mtime" | "size" | "exists" | "folder_latest"
  >("checksum");
  const [folderOs, setFolderOs] = useState<"linux" | "windows">("linux");
  const [itemName, setItemName] = useState("");
  const [createTrigger, setCreateTrigger] = useState(true);
  const [triggerName, setTriggerName] = useState("");
  const [triggerPriority, setTriggerPriority] = useState(2);
  const [triggerType, setTriggerType] = useState<"change" | "age">("change");
  const [maxAgeMinutes, setMaxAgeMinutes] = useState(60);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const isDisabled = saving || !hostname || !filePath;

  const onSubmit = async () => {
    setSaving(true);
    try {
      const res = await api.addFileWatchItem({
        hostname,
        file_path: filePath,
        check_type: checkType,
        folder_os: folderOs,
        item_name: itemName || undefined,
        create_trigger: createTrigger,
        trigger_name: triggerName || undefined,
        trigger_priority: triggerPriority,
        trigger_type: triggerType,
        max_age_minutes: maxAgeMinutes,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
      });
      if (res.trigger_error) {
        showToast(`Item created, but trigger failed: ${res.trigger_error}`, "error");
      } else {
        showToast("Item added successfully.", "success");
      }
      setFilePath("");
      setItemName("");
      setTriggerName("");
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
        label="File path *"
        value={filePath}
        onChange={(e) => setFilePath(e.target.value)}
        placeholder="e.g. /var/log/app.log  or  C:\logs\app.log"
        helperText="Absolute path to the file on the host"
      />

      <TextField
        select
        size="small"
        label="What to check"
        value={checkType}
        onChange={(e) => {
          setCheckType(e.target.value as typeof checkType);
          setTriggerType("change");
        }}
      >
        <MenuItem value="checksum">
          <Box>
            <Typography variant="body2">MD5 checksum — detects content changes</Typography>
            <Typography variant="caption" color="text.secondary">
              Zabbix key: vfs.file.md5sum[path]
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem value="mtime">
          <Box>
            <Typography variant="body2">Modification time — detects any write</Typography>
            <Typography variant="caption" color="text.secondary">
              Zabbix key: vfs.file.time[path,modify]
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem value="size">
          <Box>
            <Typography variant="body2">File size — detects additions / truncation</Typography>
            <Typography variant="caption" color="text.secondary">
              Zabbix key: vfs.file.size[path]
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem value="exists">
          <Box>
            <Typography variant="body2">File existence — detects creation / deletion</Typography>
            <Typography variant="caption" color="text.secondary">
              Zabbix key: vfs.file.exists[path]
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem value="folder_latest">
          <Box>
            <Typography variant="body2">Latest modified file in folder</Typography>
            <Typography variant="caption" color="text.secondary">
              Uses system.run — requires EnableRemoteCommands=1
            </Typography>
          </Box>
        </MenuItem>
      </TextField>

      {checkType === "folder_latest" && (
        <>
          <Alert severity="warning" icon={<TerminalIcon fontSize="small" />} sx={{ py: 0.5 }}>
            This check uses <code>system.run</code>. Make sure{" "}
            <strong>EnableRemoteCommands=1</strong> is set in the Zabbix agent config.
          </Alert>
          <TextField
            select
            size="small"
            label="Host OS"
            value={folderOs}
            onChange={(e) => setFolderOs(e.target.value as "linux" | "windows")}
          >
            <MenuItem value="linux">Linux / macOS (bash + find)</MenuItem>
            <MenuItem value="windows">Windows (PowerShell)</MenuItem>
          </TextField>
        </>
      )}

      <TextField
        size="small"
        label="Item name (optional)"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        placeholder="Leave blank for auto-generated name"
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

      <Divider />

      {checkType !== "folder_latest" && (
        <FormControlLabel
          control={
            <Switch checked={createTrigger} onChange={(_, v) => setCreateTrigger(v)} size="small" />
          }
          label={<Typography variant="body2">Auto-create trigger</Typography>}
        />
      )}

      {createTrigger && checkType !== "folder_latest" && (
        <Stack spacing={2}>
          {checkType === "mtime" && (
            <TextField
              select
              size="small"
              label="Trigger type"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as "change" | "age")}
            >
              <MenuItem value="change">
                <Box>
                  <Typography variant="body2">File changed — fires when mtime changes</Typography>
                </Box>
              </MenuItem>
              <MenuItem value="age">
                <Box>
                  <Typography variant="body2">
                    File too old — fires when not updated in X minutes
                  </Typography>
                </Box>
              </MenuItem>
            </TextField>
          )}
          {triggerType === "age" && checkType === "mtime" && (
            <TextField
              size="small"
              label="Max age (minutes)"
              type="number"
              value={maxAgeMinutes}
              onChange={(e) => setMaxAgeMinutes(Number(e.target.value))}
              inputProps={{ min: 1 }}
            />
          )}
          <TextField
            size="small"
            label="Trigger name"
            value={triggerName}
            onChange={(e) => setTriggerName(e.target.value)}
            placeholder={
              triggerType === "age"
                ? `File not updated in ${maxAgeMinutes}m: ${filePath || "/path/to/file"} on {HOST.NAME}`
                : `File changed: ${filePath || "/path/to/file"} on {HOST.NAME}`
            }
            helperText="Leave blank to use the default name above"
          />
          <TextField
            select
            size="small"
            label="Severity"
            value={triggerPriority}
            onChange={(e) => setTriggerPriority(Number(e.target.value))}
          >
            {severities.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      )}

      <Box>
        <Button variant="contained" color="secondary" onClick={onSubmit} disabled={isDisabled}>
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
      <InlineItemsList hostname={hostname} />
    </Stack>
  );
};
