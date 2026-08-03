"use client";
import ClearIcon from "@mui/icons-material/Clear";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import type { Host } from "../../../app/api";
import { api } from "../../../app/api";
import { generateId } from "../../../app/utils";
import { SearchableSelect } from "../../../components/SearchableSelect";

export type CustomInterval = {
  _key: string;
  type: "flexible" | "scheduling";
  interval: string;
  period: string;
};

export type PanelProps = {
  hosts: Host[];
  hostsLoading: boolean;
  showToast: (msg: string, sev: "success" | "error") => void;
  onSuccess: () => void;
};

export const HostSelect = ({
  label,
  value,
  onChange,
  hosts,
  hostsLoading,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hosts: Host[];
  hostsLoading: boolean;
}) => (
  <FormControl size="small" fullWidth>
    <InputLabel>{label}</InputLabel>
    <SearchableSelect
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={hostsLoading}
      startAdornment={
        hostsLoading ? <CircularProgress size={14} sx={{ ml: 1, mr: 0.5 }} /> : undefined
      }
    >
      {hosts.map((h) => (
        <MenuItem key={h.hostid} value={h.host}>
          {h.host}
        </MenuItem>
      ))}
    </SearchableSelect>
  </FormControl>
);

export const MultiHostSelect = ({
  value,
  onChange,
  label,
  hosts,
  hostsLoading,
}: {
  value: Host[];
  onChange: (v: Host[]) => void;
  label: string;
  hosts: Host[];
  hostsLoading: boolean;
}) => (
  <Autocomplete
    multiple
    size="small"
    options={hosts}
    value={value}
    onChange={(_, v) => onChange(v)}
    getOptionLabel={(o) => o.host}
    isOptionEqualToValue={(o, v) => o.hostid === v.hostid}
    loading={hostsLoading}
    renderInput={(params) => (
      <TextField
        {...params}
        slotProps={{
          input: {
            ...params.slotProps.input,
            endAdornment: (
              <>
                {hostsLoading && <CircularProgress size={14} />}
                {params.slotProps.input.endAdornment}
              </>
            ),
          },
        }}
        label={label}
        placeholder={value.length > 0 ? "" : "Select hosts…"}
      />
    )}
    renderValue={(value, getItemProps) =>
      value.map((opt, index) => {
        const { key, ...tagProps } = getItemProps({ index });
        return <Chip key={key} label={opt.host} size="small" {...tagProps} />;
      })
    }
  />
);

export const CustomIntervalsEditor = ({
  intervals,
  onChange,
}: {
  intervals: CustomInterval[];
  onChange: (v: CustomInterval[]) => void;
}) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
      Custom intervals (override the update interval for specific time windows)
    </Typography>
    <Stack spacing={1}>
      {intervals.map((ci, i) => (
        <Stack sx={{ alignItems: "flex-start" }} key={ci._key} direction="row" spacing={1}>
          <TextField
            select
            size="small"
            label="Type"
            value={ci.type}
            sx={{ minWidth: 120 }}
            onChange={(e) =>
              onChange(
                intervals.map((r, j) =>
                  j === i
                    ? { ...r, type: e.target.value as "flexible" | "scheduling", period: "" }
                    : r,
                ),
              )
            }
          >
            <MenuItem value="flexible">Flexible</MenuItem>
            <MenuItem value="scheduling">Scheduling</MenuItem>
          </TextField>
          <TextField
            size="small"
            label={ci.type === "scheduling" ? "Schedule expression" : "Interval"}
            value={ci.interval}
            sx={{ flex: 1 }}
            placeholder={ci.type === "scheduling" ? "wd1-5h9" : "50s"}
            helperText={ci.type === "scheduling" ? "e.g. wd1-5h9 = Mon–Fri at 09:00" : "e.g. 50s"}
            onChange={(e) =>
              onChange(intervals.map((r, j) => (j === i ? { ...r, interval: e.target.value } : r)))
            }
          />
          {ci.type === "flexible" && (
            <TextField
              size="small"
              label="Period"
              value={ci.period}
              sx={{ flex: 1.5 }}
              placeholder="1-7,00:00-24:00"
              helperText="days,HH:MM-HH:MM e.g. 1-5,09:00-18:00"
              onChange={(e) =>
                onChange(intervals.map((r, j) => (j === i ? { ...r, period: e.target.value } : r)))
              }
            />
          )}
          <IconButton
            size="small"
            sx={{ mt: 0.5 }}
            onClick={() => onChange(intervals.filter((_, j) => j !== i))}
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
          onChange([
            ...intervals,
            { _key: generateId(), type: "flexible", interval: "", period: "" },
          ])
        }
      >
        + Add custom interval
      </Button>
    </Stack>
  </Box>
);

export const TimeoutSelector = ({
  mode,
  value,
  onModeChange,
  onValueChange,
}: {
  mode: "global" | "override";
  value: string;
  onModeChange: (m: "global" | "override") => void;
  onValueChange: (v: string) => void;
}) => (
  <Stack sx={{ alignItems: "center" }} direction="row" spacing={1}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
      Timeout
    </Typography>
    <Button
      size="small"
      variant={mode === "global" ? "contained" : "outlined"}
      onClick={() => onModeChange("global")}
      sx={{ minWidth: 72 }}
    >
      Global
    </Button>
    <Button
      size="small"
      variant={mode === "override" ? "contained" : "outlined"}
      onClick={() => onModeChange("override")}
      sx={{ minWidth: 80 }}
    >
      Override
    </Button>
    {mode === "override" && (
      <TextField
        size="small"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="3s"
        helperText="e.g. 3s, 10s, 30s"
        sx={{ maxWidth: 140 }}
      />
    )}
  </Stack>
);

export const CommonFields = ({
  delay,
  setDelay,
  units,
  setUnits,
  history,
  setHistory,
  trends,
  setTrends,
  description,
  setDescription,
  withUnits = true,
}: {
  delay: string;
  setDelay: (v: string) => void;
  units?: string;
  setUnits?: (v: string) => void;
  history: string;
  setHistory: (v: string) => void;
  trends: string;
  setTrends: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  withUnits?: boolean;
}) => (
  <>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <TextField
        size="small"
        label="Update interval *"
        value={delay}
        onChange={(e) => setDelay(e.target.value)}
        placeholder="1m"
        helperText="e.g. 30s, 1m, 5m, 1h"
        fullWidth
      />
      {withUnits && setUnits && units !== undefined && (
        <TextField
          size="small"
          label="Units"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          placeholder="%, B, bps, rpm…"
          helperText="Displayed after the value"
          fullWidth
        />
      )}
    </Stack>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <TextField
        size="small"
        label="History"
        value={history}
        onChange={(e) => setHistory(e.target.value)}
        placeholder="31d"
        helperText="Keep raw data for (e.g. 7d, 31d, 0 = don't store)"
        fullWidth
      />
      <TextField
        size="small"
        label="Trends"
        value={trends}
        onChange={(e) => setTrends(e.target.value)}
        placeholder="365d"
        helperText="Keep hourly aggregates for (e.g. 365d, 0 = don't store)"
        fullWidth
      />
    </Stack>
    <TextField
      size="small"
      label="Description"
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      placeholder="Optional notes about this item"
      multiline
      minRows={2}
    />
  </>
);

export const EnabledSwitch = ({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <FormControlLabel
    control={<Switch checked={value} onChange={(_, v) => onChange(v)} size="small" />}
    label={<Typography variant="body2">Enabled</Typography>}
  />
);

export const TeamTagSwitch = ({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <FormControlLabel
    control={<Switch checked={value} onChange={(_, v) => onChange(v)} size="small" />}
    label={<Typography variant="body2">Tag with my team</Typography>}
  />
);

export const useCommonItemState = () => {
  const [delay, setDelay] = useState("1m");
  const [units, setUnits] = useState("");
  const [history, setHistory] = useState("31d");
  const [trends, setTrends] = useState("365d");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [applyTeamTag, setApplyTeamTag] = useState(true);
  const [timeoutMode, setTimeoutMode] = useState<"global" | "override">("global");
  const [timeout, setTimeout] = useState("3s");
  const [customIntervals, setCustomIntervals] = useState<CustomInterval[]>([]);

  const assembleDelay = () => {
    const parts = customIntervals
      .filter((ci) => (ci.type === "scheduling" ? ci.interval : ci.interval && ci.period))
      .map((ci) => (ci.type === "flexible" ? `${ci.interval}/${ci.period}` : ci.interval));
    return parts.length > 0 ? `${delay};${parts.join(";")}` : delay;
  };

  const reset = () => {
    setDelay("1m");
    setUnits("");
    setHistory("31d");
    setTrends("365d");
    setDescription("");
    setEnabled(true);
    setApplyTeamTag(true);
    setTimeoutMode("global");
    setTimeout("3s");
    setCustomIntervals([]);
  };

  return {
    delay,
    setDelay,
    units,
    setUnits,
    history,
    setHistory,
    trends,
    setTrends,
    description,
    setDescription,
    enabled,
    setEnabled,
    applyTeamTag,
    setApplyTeamTag,
    timeoutMode,
    setTimeoutMode,
    timeout,
    setTimeout,
    customIntervals,
    setCustomIntervals,
    assembleDelay,
    reset,
  };
};

export const BulkModeToggle = ({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <FormControlLabel
    control={
      <Switch checked={value} onChange={(_, v) => onChange(v)} size="small" color="secondary" />
    }
    label={
      <Typography variant="body2" color={value ? "secondary" : "text.secondary"}>
        Bulk mode (add to multiple hosts)
      </Typography>
    }
  />
);

type InlineItem = { itemid: string; name: string; key_: string; delay: string };

export const useInlineItems = (hostname: string, skip = false) => {
  const [items, setItems] = useState<InlineItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hostname || skip) {
      setItems([]);
      return;
    }
    setLoading(true);
    api
      .listItems(hostname)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [hostname, skip]);

  return { items, loading };
};

export const InlineItemsList = ({
  hostname,
  skip = false,
}: {
  hostname: string;
  skip?: boolean;
}) => {
  const { items, loading } = useInlineItems(hostname, skip);
  if (!hostname || skip) {
    return null;
  }
  return (
    <Box>
      <Divider sx={{ mb: 1 }} />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 0.75, fontWeight: 600 }}
      >
        {loading
          ? "Loading existing items…"
          : `${items.length} existing item${items.length === 1 ? "" : "s"} on this host`}
      </Typography>
      {loading && <CircularProgress size={14} />}
      {!loading && items.length > 0 && (
        <Stack spacing={0.25}>
          {items.map((it) => (
            <Box key={it.itemid} sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: "monospace",
                  color: "text.secondary",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {it.key_}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                {it.name}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
      {!loading && items.length === 0 && (
        <Typography variant="caption" color="text.disabled">
          No items yet on this host.
        </Typography>
      )}
    </Box>
  );
};
