"use client";
import { Box, Button, CircularProgress, Divider, MenuItem, Stack, TextField } from "@mui/material";
import { useState } from "react";
import { api } from "../../../app/api";
import { valueTypes } from "../shared";
import {
  CommonFields,
  EnabledSwitch,
  HostSelect,
  InlineItemsList,
  type PanelProps,
  TriggerToggleFields,
  useCommonItemState,
} from "./shared";

const SnmpV3Fields = ({
  v3SecName,
  setV3SecName,
  v3SecLevel,
  setV3SecLevel,
  v3AuthProto,
  setV3AuthProto,
  v3AuthPass,
  setV3AuthPass,
  v3PrivProto,
  setV3PrivProto,
  v3PrivPass,
  setV3PrivPass,
  v3Context,
  setV3Context,
}: {
  v3SecName: string;
  setV3SecName: (v: string) => void;
  v3SecLevel: number;
  setV3SecLevel: (v: number) => void;
  v3AuthProto: number;
  setV3AuthProto: (v: number) => void;
  v3AuthPass: string;
  setV3AuthPass: (v: string) => void;
  v3PrivProto: number;
  setV3PrivProto: (v: number) => void;
  v3PrivPass: string;
  setV3PrivPass: (v: string) => void;
  v3Context: string;
  setV3Context: (v: string) => void;
}) => (
  <>
    <TextField
      size="small"
      label="Security name"
      value={v3SecName}
      onChange={(e) => setV3SecName(e.target.value)}
    />
    <TextField
      select
      size="small"
      label="Security level"
      value={v3SecLevel}
      onChange={(e) => setV3SecLevel(Number(e.target.value))}
    >
      <MenuItem value={0}>noAuthNoPriv</MenuItem>
      <MenuItem value={1}>authNoPriv</MenuItem>
      <MenuItem value={2}>authPriv</MenuItem>
    </TextField>
    {v3SecLevel >= 1 && (
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          size="small"
          label="Auth protocol"
          value={v3AuthProto}
          onChange={(e) => setV3AuthProto(Number(e.target.value))}
          fullWidth
        >
          <MenuItem value={0}>MD5</MenuItem>
          <MenuItem value={1}>SHA1</MenuItem>
          <MenuItem value={2}>SHA224</MenuItem>
          <MenuItem value={3}>SHA256</MenuItem>
          <MenuItem value={4}>SHA384</MenuItem>
          <MenuItem value={5}>SHA512</MenuItem>
        </TextField>
        <TextField
          size="small"
          label="Auth passphrase"
          type="password"
          value={v3AuthPass}
          onChange={(e) => setV3AuthPass(e.target.value)}
          fullWidth
          autoComplete="new-password"
        />
      </Stack>
    )}
    {v3SecLevel === 2 && (
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          size="small"
          label="Priv protocol"
          value={v3PrivProto}
          onChange={(e) => setV3PrivProto(Number(e.target.value))}
          fullWidth
        >
          <MenuItem value={0}>DES</MenuItem>
          <MenuItem value={1}>AES128</MenuItem>
          <MenuItem value={2}>AES192</MenuItem>
          <MenuItem value={3}>AES256</MenuItem>
        </TextField>
        <TextField
          size="small"
          label="Priv passphrase"
          type="password"
          value={v3PrivPass}
          onChange={(e) => setV3PrivPass(e.target.value)}
          fullWidth
          autoComplete="new-password"
        />
      </Stack>
    )}
    <TextField
      size="small"
      label="Context name (optional)"
      value={v3Context}
      onChange={(e) => setV3Context(e.target.value)}
    />
  </>
);

const buildSnmpv3Fields = (
  version: number,
  v3SecLevel: number,
  v3SecName: string,
  v3AuthProto: number,
  v3AuthPass: string,
  v3PrivProto: number,
  v3PrivPass: string,
  v3Context: string,
) => {
  if (version !== 3) {
    return {};
  }
  return {
    snmpv3_securityname: v3SecName,
    snmpv3_securitylevel: v3SecLevel,
    snmpv3_authprotocol: v3SecLevel >= 1 ? v3AuthProto : undefined,
    snmpv3_authpassphrase: v3SecLevel >= 1 ? v3AuthPass : undefined,
    snmpv3_privprotocol: v3SecLevel === 2 ? v3PrivProto : undefined,
    snmpv3_privpassphrase: v3SecLevel === 2 ? v3PrivPass : undefined,
    snmpv3_contextname: v3Context,
  };
};

export const SnmpPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [oid, setOid] = useState("");
  const [version, setVersion] = useState(2);
  const [community, setCommunity] = useState("public");
  const [v3SecName, setV3SecName] = useState("");
  const [v3SecLevel, setV3SecLevel] = useState(0);
  const [v3AuthProto, setV3AuthProto] = useState(0);
  const [v3AuthPass, setV3AuthPass] = useState("");
  const [v3PrivProto, setV3PrivProto] = useState(0);
  const [v3PrivPass, setV3PrivPass] = useState("");
  const [v3Context, setV3Context] = useState("");
  const [valueType, setValueType] = useState(3);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const isDisabled = saving || !hostname || !itemName || !oid;

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addSnmpItem({
        hostname,
        item_name: itemName,
        snmp_oid: oid,
        snmp_version: version,
        value_type: valueType,
        snmp_community: version < 3 ? community : undefined,
        ...buildSnmpv3Fields(
          version,
          v3SecLevel,
          v3SecName,
          v3AuthProto,
          v3AuthPass,
          v3PrivProto,
          v3PrivPass,
          v3Context,
        ),
        delay: common.delay,
        units: common.units || undefined,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
        ...common.triggerFields(),
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setOid("");
      setCommunity("public");
      setV3SecName("");
      setV3AuthPass("");
      setV3PrivPass("");
      setV3Context("");
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
        label="OID *"
        value={oid}
        onChange={(e) => setOid(e.target.value)}
        placeholder="e.g. .1.3.6.1.2.1.1.3.0"
        helperText="The SNMP OID to poll"
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          size="small"
          label="SNMP version"
          value={version}
          onChange={(e) => setVersion(Number(e.target.value))}
          fullWidth
        >
          <MenuItem value={1}>SNMPv1</MenuItem>
          <MenuItem value={2}>SNMPv2c</MenuItem>
          <MenuItem value={3}>SNMPv3</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Value type"
          value={valueType}
          onChange={(e) => setValueType(Number(e.target.value))}
          fullWidth
        >
          {valueTypes.map((t) => (
            <MenuItem key={t.value} value={t.value}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {version < 3 && (
        <TextField
          size="small"
          label="Community"
          value={community}
          onChange={(e) => setCommunity(e.target.value)}
          placeholder="public"
        />
      )}
      {version === 3 && (
        <SnmpV3Fields
          v3SecName={v3SecName}
          setV3SecName={setV3SecName}
          v3SecLevel={v3SecLevel}
          setV3SecLevel={setV3SecLevel}
          v3AuthProto={v3AuthProto}
          setV3AuthProto={setV3AuthProto}
          v3AuthPass={v3AuthPass}
          setV3AuthPass={setV3AuthPass}
          v3PrivProto={v3PrivProto}
          setV3PrivProto={setV3PrivProto}
          v3PrivPass={v3PrivPass}
          setV3PrivPass={setV3PrivPass}
          v3Context={v3Context}
          setV3Context={setV3Context}
        />
      )}
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
      <EnabledSwitch value={common.enabled} onChange={common.setEnabled} />
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

export const SnmpTrapPanel = ({ hosts, hostsLoading, showToast, onSuccess }: PanelProps) => {
  const [hostname, setHostname] = useState("");
  const [itemName, setItemName] = useState("");
  const [trapKey, setTrapKey] = useState("snmptrap.fallback");
  const [valueType, setValueType] = useState(1);
  const [saving, setSaving] = useState(false);
  const common = useCommonItemState();

  const onSubmit = async () => {
    setSaving(true);
    try {
      await api.addSnmpTrapItem({
        hostname,
        item_name: itemName,
        item_key: trapKey,
        value_type: valueType,
        history: common.history,
        trends: common.trends,
        description: common.description || undefined,
        status: common.enabled ? 0 : 1,
        ...common.triggerFields(),
      });
      showToast("Item added successfully.", "success");
      setItemName("");
      setTrapKey("snmptrap.fallback");
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
        label="Trap key"
        value={trapKey}
        onChange={(e) => setTrapKey(e.target.value)}
        placeholder="snmptrap.fallback"
        helperText="Use snmptrap[regex] to match specific traps, or snmptrap.fallback for unmatched"
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
          placeholder="31d"
          fullWidth
        />
        <TextField
          size="small"
          label="Trends"
          value={common.trends}
          onChange={(e) => common.setTrends(e.target.value)}
          placeholder="365d"
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
      <Box>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSubmit}
          disabled={saving || !hostname || !itemName}
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
      <InlineItemsList hostname={hostname} />
    </Stack>
  );
};
