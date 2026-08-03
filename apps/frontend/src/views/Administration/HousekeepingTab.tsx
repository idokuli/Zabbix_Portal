"use client";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";

const HK_FIELDS: Array<{ key: string; label: string; unit?: string }> = [
  { key: "hk_events_mode", label: "Enable internal housekeeping for events" },
  { key: "hk_events_trigger", label: "Trigger events storage period", unit: "days" },
  { key: "hk_events_discovery", label: "Discovery events storage period", unit: "days" },
  { key: "hk_events_autoreg", label: "Autoregistration events", unit: "days" },
  { key: "hk_events_internal", label: "Internal events", unit: "days" },
  { key: "hk_services_mode", label: "Enable internal housekeeping for services" },
  { key: "hk_services", label: "Service data storage period", unit: "days" },
  { key: "hk_audit_mode", label: "Enable internal housekeeping for audit" },
  { key: "hk_audit", label: "Audit log storage period", unit: "days" },
  { key: "hk_sessions_mode", label: "Enable internal housekeeping for user sessions" },
  { key: "hk_sessions", label: "User sessions storage period", unit: "days" },
  { key: "hk_history_mode", label: "Enable internal housekeeping for history" },
  { key: "hk_history_global", label: "Override item history period" },
  { key: "hk_history", label: "Data storage period (history)", unit: "days" },
  { key: "hk_trends_mode", label: "Enable internal housekeeping for trends" },
  { key: "hk_trends_global", label: "Override item trend period" },
  { key: "hk_trends", label: "Data storage period (trends)", unit: "days" },
];

export const HousekeepingTab = ({
  showToast,
}: {
  showToast: (m: string, s: "success" | "error") => void;
}) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const tick = useRefreshTick();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const s = await api.getAdminSettings();
        setSettings(s);
        setEdited({});
      } catch (e) {
        showToast(e instanceof Error ? e.message : String(e), "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );
  useEffect(() => {
    void load();
  }, [load]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      void load(true);
    }
  }, [tick]);

  const current = (key: string) => edited[key] ?? settings[key] ?? "";
  const onSave = async () => {
    if (Object.keys(edited).length === 0) {
      return;
    }
    setSaving(true);
    try {
      await api.updateHousekeeping(edited);
      showToast("Settings saved.", "success");
      setEdited({});
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const isToggle = (key: string) =>
    key.endsWith("_mode") ||
    key.startsWith("hk_history_global") ||
    key.startsWith("hk_trends_global");

  return (
    <Stack spacing={2}>
      <TabHeader
        title="Housekeeping"
        description="Configure data retention periods and automatic cleanup settings."
        actions={
          <>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => void load()} disabled={loading}>
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              variant="contained"
              onClick={onSave}
              disabled={saving || Object.keys(edited).length === 0}
            >
              {saving ? <CircularProgress size={14} /> : "Save changes"}
            </Button>
          </>
        }
      />
      {Object.keys(settings).length === 0 && !loading && (
        <Alert severity="warning">
          Could not load Zabbix settings. Check that the backend Zabbix user has admin rights.
        </Alert>
      )}
      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          {HK_FIELDS.map((f) => {
            const val = current(f.key);
            return (
              <Box
                key={f.key}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  py: 0.5,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {f.label}
                </Typography>
                {isToggle(f.key) ? (
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={val === "1"}
                        onChange={(_, v) => setEdited((e) => ({ ...e, [f.key]: v ? "1" : "0" }))}
                      />
                    }
                    label={<Typography variant="caption">{val === "1" ? "On" : "Off"}</Typography>}
                  />
                ) : (
                  <TextField
                    slotProps={{
                      input: {
                        endAdornment: f.unit ? (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                            {f.unit}
                          </Typography>
                        ) : undefined,
                      },
                      htmlInput: { style: { textAlign: "right" } },
                    }}
                    size="small"
                    value={val}
                    onChange={(e) => setEdited((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    sx={{ width: 120 }}
                  />
                )}
              </Box>
            );
          })}
        </Stack>
      </Card>
    </Stack>
  );
};
