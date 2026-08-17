"use client";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { api, type Host } from "../../app/api";
import { ConfirmDelete } from "../../app/components/ConfirmDelete";
import { formatDateTime } from "../../app/datetime";
import { monoFontFamily } from "../../app/theme";
import { FilterSearchField, filterLabelSx } from "../../components/FilterBar";
import { SearchableSelect } from "../../components/SearchableSelect";
import { AddTriggerDialog } from "./AddTriggerDialog";
import { BulkTriggerDialog } from "./BulkTriggerDialog";
import { EditTriggerDialog } from "./EditTriggerDialog";
import { SEVERITY_CONFIG, SeverityChip, type TriggerRow, timeAgo } from "./shared";

const WHITESPACE_RE = /\s+/;

type TriggerRowItemProps = {
  t: TriggerRow;
  index: number;
  isExpanded: boolean;
  hostAvailable: string;
  onToggleExpand: () => void;
  onEdit: (t: TriggerRow) => void;
  onDeleteRequest: (t: TriggerRow) => void;
};

// Row actions consolidate into a single kebab, dimmed until the row is
// hovered or the menu is open — keeps the ledger quiet at rest.
const RowActionsMenu = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton
        size="small"
        className="row-actions-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setAnchor(e.currentTarget);
        }}
        sx={{
          opacity: anchor ? 1 : 0,
          transition: "opacity 0.1s ease",
          ".MuiTableRow-root:hover &, &:focus-visible": { opacity: 1 },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            setAnchor(null);
            onEdit();
          }}
          sx={{ fontSize: "0.8125rem", gap: 1.25 }}
        >
          <EditOutlinedIcon sx={{ fontSize: 16 }} />
          Edit
        </MenuItem>
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            setAnchor(null);
            onDelete();
          }}
          sx={{ fontSize: "0.8125rem", gap: 1.25, color: "error.main" }}
        >
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          Delete
        </MenuItem>
      </Menu>
    </>
  );
};

const TriggerRowItem = ({
  t,
  index,
  isExpanded,
  hostAvailable,
  onToggleExpand,
  onEdit,
  onDeleteRequest,
}: TriggerRowItemProps) => {
  const severity = SEVERITY_CONFIG.find((s) => s.severity === t.priority) ?? SEVERITY_CONFIG[0];
  return (
    <>
      <TableRow hover onClick={onToggleExpand} sx={{ cursor: "pointer" }}>
        <TableCell onClick={(e) => e.stopPropagation()} sx={{ width: 40, pr: 0 }}>
          <RowActionsMenu onEdit={() => onEdit(t)} onDelete={() => onDeleteRequest(t)} />
        </TableCell>
        {/* Ledger index + expand arrow */}
        <TableCell sx={{ width: 52, pr: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography
              sx={{
                fontFamily: monoFontFamily,
                fontSize: "0.6875rem",
                color: "text.disabled",
                width: 20,
                textAlign: "right",
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </Typography>
            {isExpanded ? (
              <KeyboardArrowDownIcon sx={{ fontSize: 16, color: "text.disabled" }} />
            ) : (
              <KeyboardArrowRightIcon sx={{ fontSize: 16, color: "text.disabled" }} />
            )}
          </Box>
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
                variant="outlined"
                sx={{ height: 18, fontSize: "0.65rem", fontWeight: 600 }}
              />
            </Tooltip>
          ) : (
            <Tooltip
              title={t.lastchange ? `Since ${timeAgo(t.lastchange)}` : "No state change recorded"}
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
      </TableRow>

      {/* Expanded detail row */}
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0, border: isExpanded ? undefined : "none" }}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box
              sx={{
                px: 3,
                py: 1.5,
                bgcolor: "action.hover",
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
              <Box sx={{ display: "flex", gap: 4, mt: 0.75, flexWrap: "wrap" }}>
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
                    {formatDateTime(t.lastchange, "Never")}
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
                  border: "1px solid",
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
    </>
  );
};

type TriggerTableBodyProps = {
  loading: boolean;
  filtered: TriggerRow[];
  totalCount: number;
  expandedTriggerId: string | null;
  hostAvailable: string;
  onToggleExpand: (id: string) => void;
  onEdit: (t: TriggerRow) => void;
  onDeleteRequest: (t: TriggerRow) => void;
};

const TriggerTableBody = ({
  loading,
  filtered,
  totalCount,
  expandedTriggerId,
  hostAvailable,
  onToggleExpand,
  onEdit,
  onDeleteRequest,
}: TriggerTableBodyProps) => {
  if (loading) {
    return (
      <>
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length anonymous skeleton placeholders, never reordered
          <TableRow key={i}>
            {Array.from({ length: 7 }).map((__, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length anonymous skeleton placeholders, never reordered
              <TableCell key={j}>
                <Skeleton variant="text" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </>
    );
  }
  if (filtered.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            {totalCount === 0
              ? "No triggers found for this host."
              : "No triggers match the search."}
          </Typography>
        </TableCell>
      </TableRow>
    );
  }
  return (
    <>
      {filtered.map((t, index) => (
        <TriggerRowItem
          key={t.triggerid}
          t={t}
          index={index}
          isExpanded={expandedTriggerId === t.triggerid}
          hostAvailable={hostAvailable}
          onToggleExpand={() => onToggleExpand(t.triggerid)}
          onEdit={onEdit}
          onDeleteRequest={onDeleteRequest}
        />
      ))}
    </>
  );
};

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
  const [confirmDeleteTrigger, setConfirmDeleteTrigger] = useState<TriggerRow | null>(null);
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

  const canAddTrigger =
    !!(formHost && formItemKey && formName) &&
    (isStringItem ? formPattern !== "" : formThreshold !== "");

  const buildAddTriggerPayload = () =>
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
        };

  const handleAdd = async () => {
    if (!canAddTrigger) {
      return;
    }
    setSaving(true);
    try {
      await api.addTrigger(buildAddTriggerPayload());
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
      if (formHost === selectedHost) {
        void loadTriggers(selectedHost);
      }
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
      setConfirmDeleteTrigger(null);
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
    if (!editTrigger) {
      return;
    }
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
    const words = search.toLowerCase().split(WHITESPACE_RE).filter(Boolean);
    const desc = t.description.toLowerCase();
    const expr = t.expression.toLowerCase();
    return words.length === 0 || words.every((w) => desc.includes(w) || expr.includes(w));
  });

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle1">Triggers</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Manage and monitor Zabbix triggers across all hosts.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            {/* Toolbar */}
            <Stack
              sx={{ alignItems: "center" }}
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
            >
              <FilterSearchField
                placeholder="Search by name or expression…"
                value={search}
                onChange={setSearch}
                disabled={!selectedHost}
              />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel sx={filterLabelSx}>Filter by host</InputLabel>
                <SearchableSelect
                  label="Filter by host"
                  value={selectedHost}
                  onChange={(e) => handleHostChange(e.target.value)}
                  sx={filterLabelSx}
                >
                  <MenuItem value="" sx={filterLabelSx}>
                    <em>All hosts</em>
                  </MenuItem>
                  {hosts.map((h) => (
                    <MenuItem key={h.hostid} value={h.host} sx={filterLabelSx}>
                      {h.host}
                    </MenuItem>
                  ))}
                </SearchableSelect>
              </FormControl>
              <Tooltip title="Refresh">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => void loadTriggers(selectedHost)}
                    disabled={loading || !selectedHost}
                  >
                    <RefreshIcon sx={{ fontSize: 18 }} />
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
            {selectedHost ? (
              <>
                <TableContainer sx={{ maxHeight: 520 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 40, bgcolor: "background.paper" }} />
                        <TableCell sx={{ width: 52, pr: 0, bgcolor: "background.paper" }} />
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
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TriggerTableBody
                        loading={loading}
                        filtered={filtered}
                        totalCount={triggers.length}
                        expandedTriggerId={expandedTriggerId}
                        hostAvailable={hostAvailable}
                        onToggleExpand={(id) =>
                          setExpandedTriggerId(expandedTriggerId === id ? null : id)
                        }
                        onEdit={openEdit}
                        onDeleteRequest={setConfirmDeleteTrigger}
                      />
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography variant="caption" color="text.secondary">
                  {loading
                    ? "Loading…"
                    : `${filtered.length} of ${triggers.length} trigger${triggers.length !== 1 ? "s" : ""}`}
                </Typography>
              </>
            ) : (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Select a host to view its triggers.
                </Typography>
              </Box>
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
          if (!formName) {
            setFormName(`${item.name} alert`);
          }
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

      <ConfirmDelete
        open={!!confirmDeleteTrigger}
        name={confirmDeleteTrigger?.description ?? ""}
        onConfirm={() => confirmDeleteTrigger && void handleDelete(confirmDeleteTrigger.triggerid)}
        onClose={() => setConfirmDeleteTrigger(null)}
      />

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
    </Stack>
  );
};
