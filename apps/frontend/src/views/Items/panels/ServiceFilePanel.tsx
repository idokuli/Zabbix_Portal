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
import { icmpTypes, serviceTypes, severities } from "../shared";
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
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  useEffect(() => {
    const found = serviceTypes.find((s) => s.value === svcType);
    setSvcPort(found?.port != null ? String(found.port) : "");
    setSvcItemName("");
  }, [svcType]);

  const isDisabled = saving || !hostname;

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addServiceItem({
        hostname,
        service_type: svcType,
        port: svcPort ? Number(svcPort) : null,
        item_name: svcItemName || undefined,
        delay: common.delay,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
      });
      showToast("Item added successfully.", "success");
      setSvcItemName("");
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
      {!icmpTypes.has(svcType) && (
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
      if (res.trigger_error)
        showToast(`Item created, but trigger failed: ${res.trigger_error}`, "error");
      else showToast("Item added successfully.", "success");
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
