"use client";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { api } from "../../../app/api";
import type { Host } from "../../../app/api";
import type { BulkResult, ServerItemKey } from "../shared";
import {
  BulkResults,
  COMMON_ITEM_KEYS,
  KEY_PARAM_DEFS,
  assembleAgentKey,
  valueTypes,
} from "../shared";
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

export const AgentItemPanel = ({
  hosts,
  hostsLoading,
  serverItemKeys,
  itemKeysLoading,
  showToast,
  onSuccess,
}: PanelProps & {
  serverItemKeys: ServerItemKey[];
  itemKeysLoading: boolean;
}) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemKey, setItemKey] = useState("");
  const [agentParamMode, setAgentParamMode] = useState(false);
  const [agentKeyBase, setAgentKeyBase] = useState("");
  const [agentKeyParams, setAgentKeyParams] = useState<string[]>([]);
  const effectiveItemKey =
    agentParamMode && agentKeyBase ? assembleAgentKey(agentKeyBase, agentKeyParams) : itemKey;
  const [valueType, setValueType] = useState(3);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkHosts, setBulkHosts] = useState<Host[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const isDisabled =
    saving || (bulkMode ? !bulkHosts.length : !hostname) || !itemName || !effectiveItemKey;

  const onSubmit = async () => {
    setSaving(true);
    setBulkResults([]);
    const assembledDelay = common.assembleDelay();
    try {
      if (bulkMode) {
        const result = await api.bulkAddItems({
          hostnames: bulkHosts.map((h) => h.host),
          item_type: "agent",
          item_name: itemName,
          item_key: effectiveItemKey,
          value_type: valueType,
          delay: assembledDelay,
          units: common.units || undefined,
          history: common.history,
          trends: common.trends,
          description: common.description || undefined,
        });
        setBulkResults(result.results);
        showToast(result.message, result.results.some((r) => r.error) ? "error" : "success");
      } else {
        await api.addItem({
          hostname,
          item_name: itemName,
          item_key: effectiveItemKey,
          value_type: valueType,
          delay: assembledDelay,
          units: common.units || undefined,
          history: common.history,
          trends: common.trends,
          description: common.description || undefined,
          status: common.enabled ? 0 : 1,
          timeout: common.timeoutMode === "override" ? common.timeout : undefined,
        });
        showToast("Item added successfully.", "success");
        setItemName("");
        setItemKey("");
        setAgentParamMode(false);
        setAgentKeyBase("");
        setAgentKeyParams([]);
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
        label="Item name"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        placeholder="e.g. CPU User Time"
      />

      {!agentParamMode ? (
        <Autocomplete
          freeSolo
          size="small"
          options={serverItemKeys.length > 0 ? serverItemKeys : COMMON_ITEM_KEYS}
          getOptionLabel={(opt) => (typeof opt === "string" ? opt : `${opt.key} — ${opt.name}`)}
          groupBy={(opt) => (typeof opt === "string" ? "" : opt.group)}
          loading={itemKeysLoading}
          inputValue={itemKey}
          onInputChange={(_, v, reason) => {
            if (reason === "input" || reason === "clear") setItemKey(v);
          }}
          onChange={(_, v) => {
            if (v === null) {
              setItemKey("");
              return;
            }
            const rawKey = typeof v === "string" ? v : v.key;
            if (typeof v !== "string") {
              if (!itemName) setItemName(v.name);
              setValueType(v.valueType);
              const sk = v as ServerItemKey;
              if (sk.delay) common.setDelay(sk.delay);
              if (sk.units !== undefined) common.setUnits(sk.units);
              if (sk.history) common.setHistory(sk.history);
              if (sk.trends) common.setTrends(sk.trends);
              if (sk.description) common.setDescription(sk.description);
            }
            const bracketIdx = rawKey.indexOf("[");
            const base = bracketIdx >= 0 ? rawKey.slice(0, bracketIdx) : rawKey;
            const paramDefs = KEY_PARAM_DEFS[base];
            if (paramDefs && paramDefs.length > 0) {
              const existingParams =
                bracketIdx >= 0 ? rawKey.slice(bracketIdx + 1, -1).split(",") : [];
              const initial = paramDefs.map((def, i) => existingParams[i] ?? def.default ?? "");
              setAgentKeyBase(base);
              setAgentKeyParams(initial);
              setAgentParamMode(true);
              setItemKey(rawKey);
            } else {
              setItemKey(rawKey);
            }
          }}
          renderOption={(props, opt) => (
            <Box component="li" {...props} key={typeof opt === "string" ? opt : opt.key}>
              <Box>
                <Typography sx={{ fontSize: "0.82rem", fontFamily: "monospace", fontWeight: 500 }}>
                  {typeof opt === "string" ? opt : opt.key}
                </Typography>
                {typeof opt !== "string" && (
                  <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                    {opt.name} · {valueTypes.find((t) => t.value === opt.valueType)?.label}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Item key *"
              placeholder="e.g. system.cpu.util[,user]"
              helperText={
                itemKeysLoading
                  ? "Loading items from Zabbix…"
                  : `${serverItemKeys.length > 0 ? `${serverItemKeys.length} keys from Zabbix` : "Using built-in keys"} — select or type your own`
              }
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {itemKeysLoading && <CircularProgress size={14} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      ) : (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
            <Typography
              variant="body2"
              sx={{ fontFamily: "monospace", fontWeight: 600, color: "primary.main" }}
            >
              {agentKeyBase}
            </Typography>
            <Button
              size="small"
              variant="text"
              sx={{ minWidth: 0, fontSize: "0.72rem" }}
              onClick={() => {
                setAgentParamMode(false);
                setItemKey(agentKeyBase);
                setAgentKeyBase("");
                setAgentKeyParams([]);
              }}
            >
              Change key
            </Button>
          </Stack>
          <Stack spacing={1.5}>
            {(KEY_PARAM_DEFS[agentKeyBase] ?? []).map((param, i) =>
              param.type === "select" ? (
                <TextField
                  key={param.label}
                  select
                  size="small"
                  label={param.label}
                  value={agentKeyParams[i] ?? param.default ?? ""}
                  helperText={param.helperText}
                  onChange={(e) =>
                    setAgentKeyParams((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                >
                  {param.options.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  key={param.label}
                  size="small"
                  label={param.label}
                  value={agentKeyParams[i] ?? ""}
                  placeholder={param.placeholder}
                  helperText={param.helperText}
                  onChange={(e) =>
                    setAgentKeyParams((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                />
              ),
            )}
          </Stack>
          <Typography
            variant="caption"
            sx={{ mt: 1.5, display: "block", fontFamily: "monospace", color: "text.secondary" }}
          >
            Key: <strong>{effectiveItemKey}</strong>
          </Typography>
        </Box>
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
