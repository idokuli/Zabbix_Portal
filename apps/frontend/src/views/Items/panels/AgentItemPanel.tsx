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
import { useEffect, useState } from "react";
import type { Host } from "../../../app/api";
import { api } from "../../../app/api";
import type { BulkResult, ServerItemKey } from "../shared";
import {
  assembleAgentKey,
  BulkResults,
  COMMON_ITEM_KEYS,
  KEY_PARAM_DEFS,
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
  TeamTagSwitch,
  TimeoutSelector,
  TriggerToggleFields,
  useCommonItemState,
} from "./shared";

const applyServerItemKey = (
  v: ServerItemKey,
  currentItemName: string,
  {
    setItemName,
    setValueType,
    common,
  }: {
    setItemName: (v: string) => void;
    setValueType: (v: number) => void;
    common: ReturnType<typeof useCommonItemState>;
  },
) => {
  if (!currentItemName) {
    setItemName(v.name);
  }
  setValueType(v.valueType);
  if (v.delay) {
    common.setDelay(v.delay);
  }
  if (v.units !== undefined) {
    common.setUnits(v.units);
  }
  if (v.history) {
    common.setHistory(v.history);
  }
  if (v.trends) {
    common.setTrends(v.trends);
  }
  if (v.description) {
    common.setDescription(v.description);
  }
};

const applyItemKeyString = (
  rawKey: string,
  {
    setItemKey,
    setAgentKeyBase,
    setAgentKeyParams,
    setAgentParamMode,
  }: {
    setItemKey: (v: string) => void;
    setAgentKeyBase: (v: string) => void;
    setAgentKeyParams: (v: string[]) => void;
    setAgentParamMode: (v: boolean) => void;
  },
) => {
  const bracketIdx = rawKey.indexOf("[");
  const base = bracketIdx >= 0 ? rawKey.slice(0, bracketIdx) : rawKey;
  const paramDefs = KEY_PARAM_DEFS[base];
  if (paramDefs && paramDefs.length > 0) {
    const existingParams = bracketIdx >= 0 ? rawKey.slice(bracketIdx + 1, -1).split(",") : [];
    const initial = paramDefs.map((def, i) => existingParams[i] ?? def.default ?? "");
    setAgentKeyBase(base);
    setAgentKeyParams(initial);
    setAgentParamMode(true);
    setItemKey(rawKey);
  } else {
    setItemKey(rawKey);
  }
};

export const AgentItemPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [serverItemKeys, setServerItemKeys] = useState<ServerItemKey[]>([]);
  const [itemKeysLoading, setItemKeysLoading] = useState(false);
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

  useEffect(() => {
    if (!hostname) {
      setServerItemKeys([]);
      return;
    }
    let cancelled = false;
    setItemKeysLoading(true);
    api
      .listItemKeys(hostname)
      .then((r) => {
        if (cancelled) {
          return;
        }
        setServerItemKeys(
          r.items.map((i) => ({
            key: i.key_,
            name: i.name,
            valueType: Number.parseInt(i.value_type, 10),
            group: i.group,
            delay: i.delay,
            units: i.units,
            history: i.history,
            trends: i.trends,
            description: i.description,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setServerItemKeys([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setItemKeysLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hostname]);

  const isDisabled =
    saving || (bulkMode ? bulkHosts.length === 0 : !hostname) || !itemName || !effectiveItemKey;

  const submitBulk = async () => {
    const result = await api.bulkAddItems({
      hostnames: bulkHosts.map((h) => h.host),
      item_type: "agent",
      item_name: itemName,
      item_key: effectiveItemKey,
      value_type: valueType,
      delay: common.assembleDelay(),
      units: common.units || undefined,
      history: common.history,
      trends: common.trends,
      description: common.description || undefined,
      apply_team_tag: common.applyTeamTag,
    });
    setBulkResults(result.results);
    showToast(result.message, result.results.some((r) => r.error) ? "error" : "success");
  };

  const submitSingle = async () => {
    await api.addItem({
      hostname,
      item_name: itemName,
      item_key: effectiveItemKey,
      value_type: valueType,
      delay: common.assembleDelay(),
      units: common.units || undefined,
      history: common.history,
      trends: common.trends,
      description: common.description || undefined,
      status: common.enabled ? 0 : 1,
      timeout: common.timeoutMode === "override" ? common.timeout : undefined,
      apply_team_tag: common.applyTeamTag,
      ...common.triggerFields(),
    });
    showToast("Item added successfully.", "success");
    setItemName("");
    setItemKey("");
    setAgentParamMode(false);
    setAgentKeyBase("");
    setAgentKeyParams([]);
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
        label="Item name"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        placeholder="e.g. CPU User Time"
      />

      {agentParamMode ? (
        <Box sx={{ border: "1px solid", borderColor: "divider", p: 1.5 }}>
          <Stack
            sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
            direction="row"
          >
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
      ) : (
        <Autocomplete
          freeSolo
          size="small"
          options={serverItemKeys.length > 0 ? serverItemKeys : COMMON_ITEM_KEYS}
          getOptionLabel={(opt) => (typeof opt === "string" ? opt : `${opt.key} — ${opt.name}`)}
          groupBy={(opt) => (typeof opt === "string" ? "" : opt.group)}
          loading={itemKeysLoading}
          inputValue={itemKey}
          onInputChange={(_, v, reason) => {
            if (reason === "input" || reason === "clear") {
              setItemKey(v);
            }
          }}
          onChange={(_, v) => {
            if (v === null) {
              setItemKey("");
              return;
            }
            if (typeof v !== "string") {
              applyServerItemKey(v, itemName, { setItemName, setValueType, common });
            }
            applyItemKeyString(typeof v === "string" ? v : v.key, {
              setItemKey,
              setAgentKeyBase,
              setAgentKeyParams,
              setAgentParamMode,
            });
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
              slotProps={{
                input: {
                  ...params.slotProps.input,
                  endAdornment: (
                    <>
                      {itemKeysLoading && <CircularProgress size={14} />}
                      {params.slotProps.input.endAdornment}
                    </>
                  ),
                },
              }}
              label="Item key *"
              placeholder="e.g. system.cpu.util[,user]"
              helperText={
                itemKeysLoading
                  ? "Loading items from Zabbix…"
                  : `${serverItemKeys.length > 0 ? `${serverItemKeys.length} keys from Zabbix` : "Using built-in keys"} — select or type your own`
              }
            />
          )}
        />
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
      <TeamTagSwitch value={common.applyTeamTag} onChange={common.setApplyTeamTag} />

      {!bulkMode && (
        <TriggerToggleFields
          valueType={valueType}
          createTrigger={common.createTrigger}
          setCreateTrigger={common.setCreateTrigger}
          triggerOperator={common.triggerOperator}
          setTriggerOperator={common.setTriggerOperator}
          triggerThreshold={common.triggerThreshold}
          setTriggerThreshold={common.setTriggerThreshold}
          triggerPattern={common.triggerPattern}
          setTriggerPattern={common.setTriggerPattern}
          triggerMatchType={common.triggerMatchType}
          setTriggerMatchType={common.setTriggerMatchType}
          triggerPriority={common.triggerPriority}
          setTriggerPriority={common.setTriggerPriority}
        />
      )}

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
