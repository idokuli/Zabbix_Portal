"use client";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { api } from "../../../app/api";
import type { Host } from "../../../app/api";
import type { BulkResult } from "../shared";
import { BulkResults, valueTypes } from "../shared";
import {
  BulkModeToggle,
  CommonFields,
  CustomIntervalsEditor,
  EnabledSwitch,
  HostSelect,
  InlineItemsList,
  MultiHostSelect,
  type PanelProps,
  TimeoutSelector,
  useCommonItemState,
} from "./shared";

export const ScriptPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [scriptType, setScriptType] = useState<"bash" | "powershell">("bash");
  const [scriptMode, setScriptMode] = useState<"command" | "file">("command");
  const [scriptContent, setScriptContent] = useState("");
  const [scriptFileArg, setScriptFileArg] = useState("");
  const [scriptItemName, setScriptItemName] = useState("");
  const [scriptValueType, setScriptValueType] = useState(1);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkHosts, setBulkHosts] = useState<Host[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const isDisabled = saving || (bulkMode ? !bulkHosts.length : !hostname) || !scriptContent;

  const onSubmit = async () => {
    setSaving(true);
    setBulkResults([]);
    const assembledDelay = common.assembleDelay();
    try {
      if (bulkMode) {
        const result = await api.bulkAddItems({
          hostnames: bulkHosts.map((h) => h.host),
          item_type: "script",
          script_type: scriptType,
          script_mode: scriptMode,
          script: scriptContent,
          file_arg: scriptFileArg || undefined,
          item_name: scriptItemName || undefined,
          value_type: scriptValueType,
        });
        setBulkResults(result.results);
        showToast(result.message, result.results.some((r) => r.error) ? "error" : "success");
      } else {
        await api.addScriptItem({
          hostname,
          script_type: scriptType,
          script_mode: scriptMode,
          script: scriptContent,
          file_arg: scriptFileArg || undefined,
          item_name: scriptItemName || undefined,
          value_type: scriptValueType,
          delay: assembledDelay,
          units: common.units || undefined,
          history: common.history,
          trends: common.trends,
          description: common.description || undefined,
          status: common.enabled ? 0 : 1,
          timeout: common.timeoutMode === "override" ? common.timeout : undefined,
        });
        showToast("Item added successfully.", "success");
        setScriptContent("");
        setScriptFileArg("");
        setScriptItemName("");
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

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          size="small"
          label="Script type"
          value={scriptType}
          onChange={(e) => setScriptType(e.target.value as "bash" | "powershell")}
          fullWidth
        >
          <MenuItem value="bash">Bash (Linux / macOS)</MenuItem>
          <MenuItem value="powershell">PowerShell (Windows)</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Mode"
          value={scriptMode}
          onChange={(e) => {
            setScriptMode(e.target.value as "command" | "file");
            setScriptContent("");
            setScriptFileArg("");
          }}
          fullWidth
        >
          <MenuItem value="command">
            <Box>
              <Typography variant="body2">Run command</Typography>
              <Typography variant="caption" color="text.secondary">
                Inline shell command
              </Typography>
            </Box>
          </MenuItem>
          <MenuItem value="file">
            <Box>
              <Typography variant="body2">Run script file</Typography>
              <Typography variant="caption" color="text.secondary">
                Path to a script already on the host
              </Typography>
            </Box>
          </MenuItem>
        </TextField>
      </Stack>

      {scriptMode === "command" ? (
        <TextField
          size="small"
          label="Command *"
          value={scriptContent}
          onChange={(e) => setScriptContent(e.target.value)}
          multiline
          minRows={3}
          placeholder={
            scriptType === "bash"
              ? "e.g.  stat -c %s /var/log/app.log"
              : "e.g.  (Get-Item C:\\logs\\app.log).Length"
          }
          helperText="The full command is passed to system.run[] on the agent"
        />
      ) : (
        <>
          <TextField
            size="small"
            label="Script path on host *"
            value={scriptContent}
            onChange={(e) => setScriptContent(e.target.value)}
            placeholder={
              scriptType === "bash" ? "/opt/checks/check_file.sh" : "C:\\checks\\check_file.ps1"
            }
          />
          <TextField
            size="small"
            label="File to check (optional)"
            value={scriptFileArg}
            onChange={(e) => setScriptFileArg(e.target.value)}
            placeholder={scriptType === "bash" ? "/var/log/app.log" : "C:\\logs\\app.log"}
            helperText="Passed as the first argument ($1 / $args[0]) to your script"
          />
        </>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          size="small"
          label="Value type"
          value={scriptValueType}
          onChange={(e) => setScriptValueType(Number(e.target.value))}
          fullWidth
        >
          {valueTypes.map((t) => (
            <MenuItem key={t.value} value={t.value}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Item name (optional)"
          value={scriptItemName}
          onChange={(e) => setScriptItemName(e.target.value)}
          placeholder="Leave blank for auto-generated name"
          fullWidth
        />
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
      <CustomIntervalsEditor
        intervals={common.customIntervals}
        onChange={common.setCustomIntervals}
      />
      <TimeoutSelector
        mode={common.timeoutMode}
        value={common.timeout}
        onModeChange={common.setTimeoutMode}
        onValueChange={common.setTimeout}
      />
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />

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
