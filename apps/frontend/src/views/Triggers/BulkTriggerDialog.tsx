"use client";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { api } from "../../app/api";
import type { Host } from "../../app/api";
import { MultiHostSelect } from "../Items/panels/shared";
import { BulkResults } from "../Items/shared";
import type { BulkResult } from "../Items/shared";

const PRIORITIES = [
  { value: 0, label: "Not classified" },
  { value: 1, label: "Information" },
  { value: 2, label: "Warning" },
  { value: 3, label: "Average" },
  { value: 4, label: "High" },
  { value: 5, label: "Disaster" },
];

const OPERATORS = [
  { value: ">", label: "> (greater than)" },
  { value: ">=", label: ">= (greater than or equal)" },
  { value: "<", label: "< (less than)" },
  { value: "<=", label: "<= (less than or equal)" },
  { value: "=", label: "= (equal)" },
  { value: "<>", label: "<> (not equal)" },
];

export const BulkTriggerDialog = ({
  open,
  onClose,
  hosts,
  showToast,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  hosts: Host[];
  showToast: (msg: string, sev: "success" | "error") => void;
  onSuccess: () => void;
}) => {
  const [selectedHosts, setSelectedHosts] = useState<Host[]>([]);
  const [triggerName, setTriggerName] = useState("");
  const [itemKey, setItemKey] = useState("");
  const [threshold, setThreshold] = useState("");
  const [operator, setOperator] = useState(">");
  const [priority, setPriority] = useState(2);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<BulkResult[]>([]);

  const isDisabled = saving || selectedHosts.length === 0 || !triggerName || !itemKey || !threshold;

  const handleClose = () => {
    setSelectedHosts([]);
    setTriggerName("");
    setItemKey("");
    setThreshold("");
    setOperator(">");
    setPriority(2);
    setResults([]);
    onClose();
  };

  const onSubmit = async () => {
    setSaving(true);
    setResults([]);
    try {
      const res = await api.bulkAddTriggers({
        hostnames: selectedHosts.map((h) => h.host),
        trigger_name: triggerName,
        item_key: itemKey,
        threshold: Number(threshold),
        operator,
        priority,
      });
      const mapped: BulkResult[] = res.results.map((r) => ({
        hostname: r.hostname,
        item_id: r.trigger_id,
        error: r.error,
      }));
      setResults(mapped);
      const hasErrors = mapped.some((r) => r.error);
      showToast(res.message, hasErrors ? "error" : "success");
      if (!hasErrors) {
        onSuccess();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Bulk add trigger</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <MultiHostSelect
            label="Hosts *"
            value={selectedHosts}
            onChange={setSelectedHosts}
            hosts={hosts}
            hostsLoading={false}
          />
          <TextField
            size="small"
            label="Trigger name *"
            value={triggerName}
            onChange={(e) => setTriggerName(e.target.value)}
            placeholder="e.g. High CPU on {HOST.HOST}"
            helperText="Use {HOST.HOST} as a placeholder for the host name"
          />
          <TextField
            size="small"
            label="Item key *"
            value={itemKey}
            onChange={(e) => setItemKey(e.target.value)}
            placeholder="e.g. system.cpu.util[,user]"
            helperText="Must exist on every selected host"
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              size="small"
              label="Operator"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              fullWidth
            >
              {OPERATORS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Threshold *"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="e.g. 90"
              type="number"
              fullWidth
            />
          </Stack>
          <TextField
            select
            size="small"
            label="Severity"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          >
            {PRIORITIES.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" color="text.secondary">
            Creates the trigger expression:{" "}
            <code>
              {`last(/${"{HOST.HOST}"}/${itemKey || "item.key"})`} {operator} {threshold || "N"}
            </code>{" "}
            on each selected host.
          </Typography>
          {results.length > 0 && <BulkResults results={results} label="Bulk trigger add" />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
        <Button variant="contained" onClick={onSubmit} disabled={isDisabled}>
          {saving ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Adding…
            </>
          ) : (
            "Add to all hosts"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
