"use client";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ClearIcon from "@mui/icons-material/Clear";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
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
import React, { useEffect, useState } from "react";
import { type Host, api } from "../../app/api";
import { AddTriggerDialog } from "./AddTriggerDialog";
import { BulkTriggerDialog } from "./BulkTriggerDialog";
import { EditTriggerDialog } from "./EditTriggerDialog";
import { SEVERITY_CONFIG, SeverityChip, type TriggerRow, timeAgo } from "./shared";

export const Triggers = () => {
  // ── Table / host state ───────────────────────────────────────────────
  const [triggers, setTriggers] = useState<TriggerRow[]>([]);
  const [hostAvailable, setHostAvailable] = useState("0"); // "0"=Unknown "1"=OK "2"=Down
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedHost, setSelectedHost] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedTriggerId, setExpandedTriggerId] = useState<string | null>(null);

  // ── Add trigger form state ───────────────────────────────────────────
  const [formHost, setFormHost] = useState("");
  const [formItemKey, setFormItemKey] = useState("");
  const [formItemValueType, setFormItemValueType] = useState<string>("3");
  const [formName, setFormName] = useState("");
  const [formEventName, setFormEventName] = useState("");
  const [formOperator, setFormOperator] = useState(">");
  const [formThreshold, setFormThreshold] = useState("");
  const [formMatchType, setFormMatchType] = useState("like");
  const [formPattern, setFormPattern] = useState("");
  const [formSeverity, setFormSeverity] = useState(2);
  const [formComments, setFormComments] = useState("");
  const [formHostItems, setFormHostItems] = useState<
    Array<{ itemid: string; name: string; key_: string; value_type: string; delay: string }>
  >([]);
  const [formHostItemsLoading, setFormHostItemsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Edit trigger state ───────────────────────────────────────────────
  const [editTrigger, setEditTrigger] = useState<TriggerRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEventName, setEditEventName] = useState("");
  const [editSeverity, setEditSeverity] = useState(2);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editExpression, setEditExpression] = useState("");
  const [editComments, setEditComments] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const isStringItem = formItemValueType === "1" || formItemValueType === "4";

  // ── Toast ────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });
  const showToast = (message: string, sev: "success" | "error") =>
    setToast({ open: true, message, severity: sev });

  const loadTriggers = async (hostname: string) => {
    if (!hostname) {
      setTriggers([]);
      setHostAvailable("0");
      return;
    }
    setLoading(true);
    try {
      const res = await api.listTriggers(hostname);
      setHostAvailable(res.host_available ?? "0");
      setTriggers(
        res.triggers.map((t) => ({
          triggerid: t.triggerid,
          description: t.description,
          expression: t.expression,
          priority: Number(t.priority),
          status: Number(t.status),
          value: Number(t.value ?? 0),
          lastchange: Number(t.lastchange ?? 0),
        })),
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api
      .listHosts()
      .then((r) => setHosts(r.hosts))
      .catch(() => {});
  }, []);

  const handleHostChange = (hostname: string) => {
    setSelectedHost(hostname);
    void loadTriggers(hostname);
  };

  // Load items for the selected host in the Add form
  useEffect(() => {
    if (!formHost) {
      setFormHostItems([]);
      setFormItemKey("");
      setFormItemValueType("3");
      return;
    }
    setFormHostItemsLoading(true);
    api
      .listItems(formHost, true)
      .then((r) => {
        setFormHostItems(r.items.filter((i) => ["0", "1", "3", "4"].includes(i.value_type)));
        setFormItemKey("");
        setFormItemValueType("3");
      })
      .catch(() => setFormHostItems([]))
      .finally(() => setFormHostItemsLoading(false));
  }, [formHost]);

  const handleAdd = async () => {
    if (!formHost || !formItemKey || !formName) return;
    if (isStringItem && formPattern === "") return;
    if (!isStringItem && formThreshold === "") return;
    setSaving(true);
    try {
      await api.addTrigger(
        isStringItem
          ? {
              hostname: formHost,
              item_key: formItemKey,
              trigger_name: formName,
              severity: formSeverity,
              string_pattern: formPattern,
              match_type: formMatchType,
              event_name: formEventName || undefined,
              comments: formComments || undefined,
            }
          : {
              hostname: formHost,
              item_key: formItemKey,
              trigger_name: formName,
              operator: formOperator,
              threshold: Number(formThreshold),
              severity: formSeverity,
              event_name: formEventName || undefined,
              comments: formComments || undefined,
            },
      );
      showToast("Trigger created.", "success");
      setAddOpen(false);
      setFormHost("");
      setFormItemKey("");
      setFormItemValueType("3");
      setFormName("");
      setFormEventName("");
      setFormThreshold("");
      setFormOperator(">");
      setFormPattern("");
      setFormMatchType("like");
      setFormSeverity(2);
      setFormComments("");
      if (formHost === selectedHost) void loadTriggers(selectedHost);
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (triggerid: string) => {
    try {
      await api.deleteTrigger(triggerid);
      setTriggers((prev) => prev.filter((t) => t.triggerid !== triggerid));
      showToast("Trigger deleted.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const openEdit = (t: TriggerRow) => {
    setEditTrigger(t);
    setEditName(t.description);
    setEditEventName("");
    setEditSeverity(t.priority);
    setEditEnabled(t.status === 0);
    setEditExpression(t.expression);
    setEditComments("");
  };

  const handleEdit = async () => {
    if (!editTrigger) return;
    setEditSaving(true);
    try {
      await api.updateTrigger(editTrigger.triggerid, {
        description: editName,
        priority: editSeverity,
        status: editEnabled ? 0 : 1,
        expression: editExpression,
        event_name: editEventName || undefined,
        comments: editComments || undefined,
      });
      showToast("Trigger updated.", "success");
      setEditTrigger(null);
      void loadTriggers(selectedHost);
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setEditSaving(false);
    }
  };

  const filtered = triggers.filter((t) => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    const desc = t.description.toLowerCase();
    const expr = t.expression.toLowerCase();
    return words.length === 0 || words.every((w) => desc.includes(w) || expr.includes(w));
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Triggers
      </Typography>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            {/* Toolbar */}
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Host</InputLabel>
                <Select
                  value={selectedHost}
                  label="Host"
                  onChange={(e) => handleHostChange(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select a host…</em>
                  </MenuItem>
                  {hosts.map((h) => (
                    <MenuItem key={h.hostid} value={h.host}>
                      {h.host}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                placeholder="Search by name or expression…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!selectedHost}
                sx={{ minWidth: 260 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon sx={{ fontSize: 18 }} />
                    </InputAdornment>
                  ),
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearch("")}>
                        <ClearIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
              <Box sx={{ flex: 1 }} />
              <Tooltip title="Refresh">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => void loadTriggers(selectedHost)}
                    disabled={loading || !selectedHost}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => setBulkOpen(true)}
              >
                Bulk add
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => setAddOpen(true)}
              >
                Add Trigger
              </Button>
            </Stack>

            <Divider />

            {/* Host unreachable banner */}
            {selectedHost && hostAvailable === "2" && (
              <Alert
                severity="warning"
                icon={<WifiOffIcon fontSize="inherit" />}
                sx={{ py: 0.5, fontSize: "0.82rem" }}
              >
                <strong>Host agent unreachable.</strong> Zabbix cannot collect data from this host.
                Trigger states below are stale — they reflect the last known values, not the current
                host condition. A trigger may show OK even though the host is down.
              </Alert>
            )}

            {/* Triggers table */}
            {!selectedHost ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Select a host to view its triggers.
                </Typography>
              </Box>
            ) : (
              <>
                <TableContainer sx={{ maxHeight: 520 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 28, pr: 0, bgcolor: "background.paper" }} />
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>
                          Name
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>
                          Expression
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 700, width: 120, bgcolor: "background.paper" }}
                        >
                          Severity
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 700, width: 110, bgcolor: "background.paper" }}
                        >
                          State
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 90, bgcolor: "background.paper" }}>
                          Status
                        </TableCell>
                        <TableCell sx={{ width: 96, bgcolor: "background.paper" }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length anonymous skeleton placeholders, never reordered
                          <TableRow key={i}>
                            {Array.from({ length: 7 }).map((__, j) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length anonymous skeleton placeholders, never reordered
                              <TableCell key={j}>
                                <Skeleton variant="text" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                              {triggers.length === 0
                                ? "No triggers found for this host."
                                : "No triggers match the search."}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((t) => {
                          const isExpanded = expandedTriggerId === t.triggerid;
                          const severity =
                            SEVERITY_CONFIG.find((s) => s.severity === t.priority) ??
                            SEVERITY_CONFIG[0];
                          return (
                            <React.Fragment key={t.triggerid}>
                              <TableRow
                                hover
                                onClick={() =>
                                  setExpandedTriggerId(isExpanded ? null : t.triggerid)
                                }
                                sx={{ cursor: "pointer" }}
                              >
                                {/* Expand arrow */}
                                <TableCell sx={{ width: 28, pr: 0 }}>
                                  <IconButton size="small" sx={{ p: 0.25 }}>
                                    {isExpanded ? (
                                      <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                                    ) : (
                                      <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
                                    )}
                                  </IconButton>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">{t.description}</Typography>
                                </TableCell>
                                <TableCell sx={{ maxWidth: 300 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontFamily: "monospace",
                                      fontSize: "0.7rem",
                                      color: "text.secondary",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {t.expression}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <SeverityChip priority={t.priority} />
                                </TableCell>
                                <TableCell>
                                  {hostAvailable === "2" ? (
                                    <Tooltip
                                      title="Host agent is unreachable — this state is stale and may be incorrect"
                                      placement="top"
                                    >
                                      <Chip
                                        label="No data"
                                        size="small"
                                        variant="filled"
                                        sx={{
                                          height: 18,
                                          fontSize: "0.65rem",
                                          fontWeight: 700,
                                          bgcolor: "#78716C",
                                          color: "#fff",
                                        }}
                                      />
                                    </Tooltip>
                                  ) : (
                                    <Tooltip
                                      title={
                                        t.lastchange
                                          ? `Since ${timeAgo(t.lastchange)}`
                                          : "No state change recorded"
                                      }
                                      placement="top"
                                    >
                                      <Chip
                                        label={t.value === 1 ? "PROBLEM" : "OK"}
                                        size="small"
                                        variant="filled"
                                        sx={{
                                          height: 18,
                                          fontSize: "0.65rem",
                                          fontWeight: 700,
                                          bgcolor: t.value === 1 ? "error.main" : "success.main",
                                          color: "#fff",
                                        }}
                                      />
                                    </Tooltip>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={t.status === 0 ? "Enabled" : "Disabled"}
                                    size="small"
                                    color={t.status === 0 ? "success" : "default"}
                                    variant="outlined"
                                    sx={{ height: 18, fontSize: "0.65rem" }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Stack direction="row" spacing={0.5}>
                                    <Tooltip title="Edit trigger">
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEdit(t);
                                        }}
                                      >
                                        <EditOutlinedIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete trigger">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteId(t.triggerid);
                                        }}
                                      >
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </Stack>
                                </TableCell>
                              </TableRow>

                              {/* Expanded detail row */}
                              <TableRow key={`${t.triggerid}-detail`}>
                                <TableCell
                                  colSpan={7}
                                  sx={{ py: 0, border: isExpanded ? undefined : "none" }}
                                >
                                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                    <Box
                                      sx={{
                                        px: 3,
                                        py: 1.5,
                                        bgcolor: "action.hover",
                                        borderRadius: 1,
                                        my: 0.5,
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontWeight: 700,
                                          color: "text.secondary",
                                          textTransform: "uppercase",
                                          letterSpacing: "0.07em",
                                          fontSize: "0.6rem",
                                        }}
                                      >
                                        Trigger details
                                      </Typography>
                                      <Box
                                        sx={{ display: "flex", gap: 4, mt: 0.75, flexWrap: "wrap" }}
                                      >
                                        <Box>
                                          <Typography variant="caption" color="text.disabled">
                                            Severity
                                          </Typography>
                                          <Typography
                                            variant="body2"
                                            sx={{
                                              fontSize: "0.8rem",
                                              color: severity.color,
                                              fontWeight: 600,
                                            }}
                                          >
                                            {severity.label}
                                          </Typography>
                                        </Box>
                                        <Box>
                                          <Typography variant="caption" color="text.disabled">
                                            Last state change
                                          </Typography>
                                          <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                                            {t.lastchange
                                              ? new Date(t.lastchange * 1000).toLocaleString()
                                              : "Never"}
                                          </Typography>
                                        </Box>
                                        <Box>
                                          <Typography variant="caption" color="text.disabled">
                                            State
                                          </Typography>
                                          <Typography
                                            variant="body2"
                                            sx={{
                                              fontSize: "0.8rem",
                                              fontWeight: 600,
                                              color: t.value === 1 ? "error.main" : "success.main",
                                            }}
                                          >
                                            {t.value === 1 ? "PROBLEM" : "OK"}
                                          </Typography>
                                        </Box>
                                      </Box>
                                      <Box
                                        sx={{
                                          mt: 1,
                                          px: 1.5,
                                          py: 0.75,
                                          bgcolor: "background.paper",
                                          borderRadius: 1,
                                          borderLeft: "3px solid",
                                          borderColor: "divider",
                                        }}
                                      >
                                        <Typography variant="caption" color="text.disabled">
                                          Expression
                                        </Typography>
                                        <Typography
                                          variant="body2"
                                          sx={{
                                            fontFamily: "monospace",
                                            fontSize: "0.78rem",
                                            wordBreak: "break-all",
                                            mt: 0.25,
                                          }}
                                        >
                                          {t.expression}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  </Collapse>
                                </TableCell>
                              </TableRow>
                            </React.Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography variant="caption" color="text.secondary">
                  {loading
                    ? "Loading…"
                    : `${filtered.length} of ${triggers.length} trigger${triggers.length !== 1 ? "s" : ""}`}
                </Typography>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <AddTriggerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        hosts={hosts}
        formHost={formHost}
        setFormHost={setFormHost}
        formItemKey={formItemKey}
        setFormItemKey={setFormItemKey}
        formHostItems={formHostItems}
        formHostItemsLoading={formHostItemsLoading}
        formName={formName}
        setFormName={setFormName}
        formEventName={formEventName}
        setFormEventName={setFormEventName}
        formSeverity={formSeverity}
        setFormSeverity={setFormSeverity}
        isStringItem={isStringItem}
        formMatchType={formMatchType}
        setFormMatchType={setFormMatchType}
        formPattern={formPattern}
        setFormPattern={setFormPattern}
        formOperator={formOperator}
        setFormOperator={setFormOperator}
        formThreshold={formThreshold}
        setFormThreshold={setFormThreshold}
        formComments={formComments}
        setFormComments={setFormComments}
        saving={saving}
        onItemSelected={(item) => {
          setFormItemValueType(item.value_type);
          if (!formName) setFormName(`${item.name} alert`);
        }}
        onAdd={() => void handleAdd()}
      />

      <BulkTriggerDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        hosts={hosts}
        showToast={showToast}
        onSuccess={() => void loadTriggers(selectedHost)}
      />

      <EditTriggerDialog
        open={!!editTrigger}
        onClose={() => setEditTrigger(null)}
        editName={editName}
        setEditName={setEditName}
        editEventName={editEventName}
        setEditEventName={setEditEventName}
        editSeverity={editSeverity}
        setEditSeverity={setEditSeverity}
        editEnabled={editEnabled}
        setEditEnabled={setEditEnabled}
        editExpression={editExpression}
        setEditExpression={setEditExpression}
        editComments={editComments}
        setEditComments={setEditComments}
        editSaving={editSaving}
        onSave={() => void handleEdit()}
      />

      {/* ── Confirm delete Dialog ── */}
      <Dialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Trigger</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this trigger? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => confirmDeleteId && void handleDelete(confirmDeleteId)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
