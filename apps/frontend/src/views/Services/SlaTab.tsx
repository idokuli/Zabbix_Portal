"use client";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
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
  Paper,
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
import { ConfirmDelete } from "./shared";

type Sla = {
  slaid: string;
  name: string;
  slo: number;
  period_label: string;
  timezone: string;
  description: string;
  status: number;
  service_tags: Array<{ tag: string; value: string }>;
};

export const SlaTab = ({
  showToast,
}: { showToast: (m: string, s: "success" | "error") => void }) => {
  const tick = useRefreshTick();
  const [items, setItems] = useState<Sla[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sla | null>(null);
  const [reportSla, setReportSla] = useState<Sla | null>(null);
  const [reportData, setReportData] = useState<Array<Record<string, unknown>>>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slo: 99.9,
    period: "PERIOD_MONTHLY",
    timezone: "UTC",
    description: "",
  });

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const r = await api.listSlas();
        setItems(r.slas);
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
      await api.createSla(form);
      showToast("SLA created.", "success");
      setAddOpen(false);
      setForm({ name: "", slo: 99.9, period: "PERIOD_MONTHLY", timezone: "UTC", description: "" });
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };
  const openReport = async (sla: Sla) => {
    setReportSla(sla);
    setReportData([]);
    setReportLoading(true);
    try {
      const r = await api.getSlaReport(sla.slaid);
      setReportData(r.report);
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setReportLoading(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteSla(deleteTarget.slaid);
      showToast("SLA deleted.", "success");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  return (
    <>
      <TabHeader
        title="SLA Monitoring"
        description="Define service level agreements and track compliance against uptime targets."
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            SLA
          </Typography>
          {loading ? (
            <CircularProgress size={14} />
          ) : (
            <Chip label={items.length} size="small" sx={{ height: 18, fontSize: "0.62rem" }} />
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => void load()} disabled={loading}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            startIcon={<AddOutlinedIcon />}
            onClick={() => setAddOpen(true)}
          >
            Add
          </Button>
        </Stack>
      </Box>
      <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>SLO %</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 110 }}>Period</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Service tags</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 90 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No SLAs defined.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((s) => (
                <TableRow key={s.slaid} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {s.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        color: s.slo >= 99.9 ? "#22C55E" : s.slo >= 99 ? "#F59E0B" : "#EF4444",
                      }}
                    >
                      {s.slo}%
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={s.period_label}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.62rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={s.status === 0 ? "Enabled" : "Disabled"}
                      size="small"
                      color={s.status === 0 ? "success" : "default"}
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.62rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4 }}>
                      {s.service_tags.map((t) => (
                        <Chip
                          key={`${t.tag}:${t.value}`}
                          label={`${t.tag}${t.value ? `:${t.value}` : ""}`}
                          size="small"
                          sx={{ height: 16, fontSize: "0.6rem" }}
                        />
                      ))}
                      {s.service_tags.length === 0 && (
                        <Typography variant="caption" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Tooltip title="View SLA report">
                        <IconButton size="small" color="primary" onClick={() => openReport(s)}>
                          <AssessmentOutlinedIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(s)}>
                          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create SLA</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                size="small"
                label="SLO % *"
                type="number"
                value={form.slo}
                onChange={(e) => setForm((f) => ({ ...f, slo: Number(e.target.value) }))}
                fullWidth
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                helperText="e.g. 99.9 for 99.9%"
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Period</InputLabel>
                <Select
                  label="Period"
                  value={form.period}
                  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as string }))}
                >
                  <MenuItem value="PERIOD_DAILY">Daily</MenuItem>
                  <MenuItem value="PERIOD_WEEKLY">Weekly</MenuItem>
                  <MenuItem value="PERIOD_MONTHLY">Monthly</MenuItem>
                  <MenuItem value="PERIOD_QUARTERLY">Quarterly</MenuItem>
                  <MenuItem value="PERIOD_ANNUALLY">Annually</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <TextField
              size="small"
              label="Timezone"
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              placeholder="UTC"
            />
            <TextField
              size="small"
              label="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={onSave} disabled={saving || !form.name.trim()}>
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

      <Dialog open={!!reportSla} onClose={() => setReportSla(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>SLA Report — {reportSla?.name}</DialogTitle>
        <DialogContent>
          {reportLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : reportData.length === 0 ? (
            <Typography variant="body2" color="text.disabled" sx={{ py: 2 }}>
              No report data available for this SLA.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {Object.keys(reportData[0] ?? {}).map((col) => (
                      <TableCell key={col} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.map((row, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: read-only SLA report rows, no stable id
                    <TableRow key={i} hover>
                      {Object.values(row).map((val, j) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: read-only cell values
                        <TableCell key={j} sx={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>
                          {String(val ?? "—")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportSla(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
