"use client";
import { Box, Button, CircularProgress, Divider, MenuItem, Stack, TextField } from "@mui/material";
import { useState } from "react";
import { api } from "../../../app/api";
import { DB_AGENT2_METRICS, valueTypes } from "../shared";
import {
  CommonFields,
  CustomIntervalsEditor,
  EnabledSwitch,
  HostSelect,
  InlineItemsList,
  type PanelProps,
  TimeoutSelector,
  useCommonItemState,
} from "./shared";

type DbMetaDef = { hasExtra?: boolean; extraLabel?: string } | undefined;

const Agent2Fields = ({
  engine,
  onEngineChange,
  metric,
  onMetricChange,
  metaDef,
  extraParam,
  onExtraParamChange,
  connString,
  onConnStringChange,
  agent2ItemName,
  onAgent2ItemNameChange,
}: {
  engine: string;
  onEngineChange: (v: string) => void;
  metric: string;
  onMetricChange: (v: string) => void;
  metaDef: DbMetaDef;
  extraParam: string;
  onExtraParamChange: (v: string) => void;
  connString: string;
  onConnStringChange: (v: string) => void;
  agent2ItemName: string;
  onAgent2ItemNameChange: (v: string) => void;
}) => (
  <>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <TextField
        select
        size="small"
        label="Database engine"
        value={engine}
        onChange={(e) => onEngineChange(e.target.value)}
        fullWidth
      >
        {Object.keys(DB_AGENT2_METRICS).map((k) => (
          <MenuItem key={k} value={k}>
            {k}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Metric"
        value={metric}
        onChange={(e) => onMetricChange(e.target.value)}
        fullWidth
      >
        {(DB_AGENT2_METRICS[engine] ?? []).map((m) => (
          <MenuItem key={m.value} value={m.value}>
            {m.label}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
    <TextField
      size="small"
      label="Connection string *"
      value={connString}
      onChange={(e) => onConnStringChange(e.target.value)}
      placeholder="e.g. postgresql://user:pass@localhost:5432/mydb"
    />
    {metaDef?.hasExtra && (
      <TextField
        size="small"
        label={metaDef.extraLabel ?? "Extra parameter"}
        value={extraParam}
        onChange={(e) => onExtraParamChange(e.target.value)}
      />
    )}
    <TextField
      size="small"
      label="Item name (optional)"
      value={agent2ItemName}
      onChange={(e) => onAgent2ItemNameChange(e.target.value)}
    />
  </>
);

const OdbcFields = ({
  dsn,
  onDsnChange,
  dbDesc,
  onDbDescChange,
  sqlQuery,
  onSqlQueryChange,
  odbcValueType,
  onOdbcValueTypeChange,
  odbcUsername,
  onOdbcUsernameChange,
  odbcPassword,
  onOdbcPasswordChange,
  odbcItemName,
  onOdbcItemNameChange,
  common,
}: {
  dsn: string;
  onDsnChange: (v: string) => void;
  dbDesc: string;
  onDbDescChange: (v: string) => void;
  sqlQuery: string;
  onSqlQueryChange: (v: string) => void;
  odbcValueType: number;
  onOdbcValueTypeChange: (v: number) => void;
  odbcUsername: string;
  onOdbcUsernameChange: (v: string) => void;
  odbcPassword: string;
  onOdbcPasswordChange: (v: string) => void;
  odbcItemName: string;
  onOdbcItemNameChange: (v: string) => void;
  common: ReturnType<typeof useCommonItemState>;
}) => (
  <>
    <TextField
      size="small"
      label="DSN *"
      value={dsn}
      onChange={(e) => onDsnChange(e.target.value)}
      placeholder="e.g. my_db_dsn"
      helperText="Configured in /etc/odbc.ini on the Zabbix server"
    />
    <TextField
      size="small"
      label="Description *"
      value={dbDesc}
      onChange={(e) => onDbDescChange(e.target.value)}
    />
    <TextField
      size="small"
      label="SQL query *"
      value={sqlQuery}
      onChange={(e) => onSqlQueryChange(e.target.value)}
      multiline
      minRows={3}
      placeholder="SELECT COUNT(*) FROM orders WHERE status='open'"
    />
    <TextField
      select
      size="small"
      label="Value type"
      value={odbcValueType}
      onChange={(e) => onOdbcValueTypeChange(Number(e.target.value))}
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
        label="Username (optional)"
        value={odbcUsername}
        onChange={(e) => onOdbcUsernameChange(e.target.value)}
        fullWidth
        autoComplete="off"
      />
      <TextField
        size="small"
        label="Password (optional)"
        type="password"
        value={odbcPassword}
        onChange={(e) => onOdbcPasswordChange(e.target.value)}
        fullWidth
        autoComplete="new-password"
      />
    </Stack>
    <TextField
      size="small"
      label="Item name (optional)"
      value={odbcItemName}
      onChange={(e) => onOdbcItemNameChange(e.target.value)}
    />
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
  </>
);

export const DatabasePanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [mode, setMode] = useState<"odbc" | "agent2">("agent2");
  // ODBC
  const [dsn, setDsn] = useState("");
  const [dbDesc, setDbDesc] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");
  const [odbcValueType, setOdbcValueType] = useState(3);
  const [odbcUsername, setOdbcUsername] = useState("");
  const [odbcPassword, setOdbcPassword] = useState("");
  const [odbcItemName, setOdbcItemName] = useState("");
  // Agent2
  const [engine, setEngine] = useState("postgresql");
  const [metric, setMetric] = useState("ping");
  const [connString, setConnString] = useState("");
  const [extraParam, setExtraParam] = useState("");
  const [agent2ItemName, setAgent2ItemName] = useState("");
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const metaDef = DB_AGENT2_METRICS[engine]?.find((m) => m.value === metric);
  const isDisabled =
    saving ||
    !hostname ||
    (mode === "odbc" ? !(dsn && dbDesc && sqlQuery) : !(connString && metric));

  const submitOdbcItem = () =>
    api.addDbOdbcItem({
      hostname,
      dsn,
      sql_query: sqlQuery,
      description: dbDesc,
      item_name: odbcItemName || undefined,
      value_type: odbcValueType,
      username: odbcUsername || undefined,
      password: odbcPassword || undefined,
      delay: common.assembleDelay(),
      units: common.units || undefined,
      history: common.history,
      trends: common.trends,
      status: common.enabled ? 0 : 1,
      timeout: common.timeoutMode === "override" ? common.timeout : undefined,
    });

  const submitAgent2Item = () =>
    api.addDbAgent2Item({
      hostname,
      engine,
      conn_string: connString,
      metric,
      extra_param: metaDef?.hasExtra ? extraParam : undefined,
      item_name: agent2ItemName || undefined,
    });

  const onSubmit = async () => {
    setSaving(true);
    try {
      if (mode === "odbc") {
        await submitOdbcItem();
      } else {
        await submitAgent2Item();
      }
      showToast("Item added successfully.", "success");
      setDsn("");
      setDbDesc("");
      setSqlQuery("");
      setConnString("");
      setExtraParam("");
      setOdbcItemName("");
      setAgent2ItemName("");
      setOdbcUsername("");
      setOdbcPassword("");
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

      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant={mode === "agent2" ? "contained" : "outlined"}
          onClick={() => setMode("agent2")}
        >
          Agent2 Plugin
        </Button>
        <Button
          size="small"
          variant={mode === "odbc" ? "contained" : "outlined"}
          onClick={() => setMode("odbc")}
        >
          ODBC
        </Button>
      </Stack>

      {mode === "agent2" ? (
        <Agent2Fields
          engine={engine}
          onEngineChange={(v) => {
            setEngine(v);
            setMetric(DB_AGENT2_METRICS[v]?.[0]?.value ?? "ping");
            setExtraParam("");
          }}
          metric={metric}
          onMetricChange={(v) => {
            setMetric(v);
            setExtraParam("");
          }}
          metaDef={metaDef}
          extraParam={extraParam}
          onExtraParamChange={setExtraParam}
          connString={connString}
          onConnStringChange={setConnString}
          agent2ItemName={agent2ItemName}
          onAgent2ItemNameChange={setAgent2ItemName}
        />
      ) : (
        <OdbcFields
          dsn={dsn}
          onDsnChange={setDsn}
          dbDesc={dbDesc}
          onDbDescChange={setDbDesc}
          sqlQuery={sqlQuery}
          onSqlQueryChange={setSqlQuery}
          odbcValueType={odbcValueType}
          onOdbcValueTypeChange={setOdbcValueType}
          odbcUsername={odbcUsername}
          onOdbcUsernameChange={setOdbcUsername}
          odbcPassword={odbcPassword}
          onOdbcPasswordChange={setOdbcPassword}
          odbcItemName={odbcItemName}
          onOdbcItemNameChange={setOdbcItemName}
          common={common}
        />
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
