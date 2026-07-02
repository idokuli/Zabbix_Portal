"use client";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { ConfirmDelete, type DiscoveryRule, SectionHeader, StatusChip, fmtTs } from "./shared";

const CHECK_TYPE_OPTIONS = [
  "icmp",
  "ssh",
  "http",
  "https",
  "ftp",
  "smtp",
  "snmp",
  "telnet",
  "tcp",
  "zabbix",
  "ldap",
];

export const DiscoveryTab = ({
  showToast,
}: { showToast: (m: string, s: "success" | "error") => void }) => {
  const [rules, setRules] = useState<DiscoveryRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DiscoveryRule | null>(null);
  const [form, setForm] = useState({
    name: "",
    iprange: "",
    delay: "1h",
    check_types: ["icmp"] as string[],
    ports: "",
  });
  const tick = useRefreshTick();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const r = await api.listDiscoveryRules();
        setRules(r.rules);
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
    if (tick > 0) void load(true);
  }, [tick]);

  const onSave = async () => {
    setSaving(true);
    try {
      await api.createDiscoveryRule(form);
      showToast("Discovery rule created.", "success");
      setAddOpen(false);
      setForm({ name: "", iprange: "", delay: "1h", check_types: ["icmp"], ports: "" });
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteDiscoveryRule(deleteTarget.druleid);
      showToast("Discovery rule deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  return (
    <>
      <TabHeader
        title="Discovery Rules"
        description="Configure network discovery rules to automatically detect and add hosts."
      />
      <SectionHeader
        title="Discovery"
        count={rules.length}
        loading={loading}
        onRefresh={load}
        onAdd={() => {
          setForm({ name: "", iprange: "", delay: "1h", check_types: ["icmp"], ports: "" });
          setAddOpen(true);
        }}
        addLabel="Add rule"
      />
      <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>IP range</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Interval</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Checks</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Next run</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 60 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No discovery rules found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rules.map((r) => (
                <TableRow key={r.druleid} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {r.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                    >
                      {r.iprange}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{r.delay}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {r.check_count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={r.status} labels={["Active", "Disabled"]} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                      {r.nextcheck ? fmtTs(r.nextcheck) : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(r)}>
                        <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create discovery rule</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Rule name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              size="small"
              label="IP range *"
              value={form.iprange}
              onChange={(e) => setForm((f) => ({ ...f, iprange: e.target.value }))}
              placeholder="e.g. 192.168.1.1-254"
              helperText="Supports ranges (1-254), CIDR (192.168.1.0/24), or single IPs"
            />
            <TextField
              size="small"
              label="Interval"
              value={form.delay}
              onChange={(e) => setForm((f) => ({ ...f, delay: e.target.value }))}
              placeholder="e.g. 1h, 30m"
              helperText="How often to run the discovery scan"
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Check types *</InputLabel>
              <Select
                multiple
                label="Check types *"
                value={form.check_types}
                onChange={(e) =>
                  setForm((f) => ({ ...f, check_types: e.target.value as string[] }))
                }
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(selected as string[]).map((ct) => (
                      <Chip key={ct} label={ct.toUpperCase()} size="small" sx={{ height: 20 }} />
                    ))}
                  </Box>
                )}
              >
                {CHECK_TYPE_OPTIONS.map((ct) => (
                  <MenuItem key={ct} value={ct}>
                    {ct.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {form.check_types.some((ct) => ct !== "icmp") && (
              <TextField
                size="small"
                label="Ports"
                value={form.ports}
                onChange={(e) => setForm((f) => ({ ...f, ports: e.target.value }))}
                placeholder="e.g. 22,80,443"
                helperText="Comma-separated ports for non-ICMP checks"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={
              saving || !form.name.trim() || !form.iprange.trim() || !form.check_types.length
            }
          >
            {saving ? <CircularProgress size={14} /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onConfirm={onDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
};
