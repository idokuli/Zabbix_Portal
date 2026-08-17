"use client";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
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
import { useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { formatDateTimeCompact } from "../../app/datetime";
import { FilterSearchField, filterLabelSx } from "../../components/FilterBar";
import { SeverityChip } from "./shared";

// ── Problem History tab ───────────────────────────────────────────────

type HistoryProblem = {
  eventid: string;
  name: string;
  hostname: string;
  severity: number;
  severity_name: string;
  clock: number;
  r_clock: number;
  resolved: boolean;
  duration_seconds: number;
  acknowledged: boolean;
  ack_user: string | null;
  ack_note: string;
  ack_time: number | null;
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
};

const formatAbsTime = (clock: number): string => formatDateTimeCompact(clock);

const TIME_RANGES = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
] as const;

const StatusDotLabel = ({
  color,
  label,
  labelColor,
}: {
  color: string;
  label: string;
  labelColor?: string;
}) => (
  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
    <Typography
      variant="caption"
      sx={{ fontWeight: 500, whiteSpace: "nowrap", color: labelColor ?? "text.primary" }}
    >
      {label}
    </Typography>
  </Box>
);

const ProblemStatusCell = ({ problem }: { problem: HistoryProblem }) =>
  problem.resolved ? (
    <Tooltip title={`Resolved ${formatAbsTime(problem.r_clock)}`} placement="top">
      <Box sx={{ display: "inline-flex", cursor: "default" }}>
        <StatusDotLabel color="success.main" label="Resolved" labelColor="text.secondary" />
      </Box>
    </Tooltip>
  ) : (
    <StatusDotLabel color="error.main" label="Active" labelColor="error.main" />
  );

const ProblemAckCell = ({ problem }: { problem: HistoryProblem }) => {
  if (problem.acknowledged && problem.ack_user) {
    return (
      <Tooltip title={problem.ack_note ? `"${problem.ack_note}"` : "No note"} placement="top">
        <Typography
          variant="caption"
          sx={{ color: "primary.main", cursor: "default", textDecoration: "underline dotted" }}
        >
          {problem.ack_user}
        </Typography>
      </Tooltip>
    );
  }
  if (problem.acknowledged) {
    return (
      <Typography variant="caption" color="success.main">
        ✓
      </Typography>
    );
  }
  return (
    <Typography variant="caption" color="text.disabled">
      —
    </Typography>
  );
};

const HistoryProblemRow = ({ p }: { p: HistoryProblem }) => (
  <TableRow sx={{ "&:hover": { bgcolor: "action.hover" } }}>
    <TableCell
      sx={{
        fontSize: "0.78rem",
        fontFamily: "monospace",
        color: "text.secondary",
        whiteSpace: "nowrap",
      }}
    >
      {formatAbsTime(p.clock)}
    </TableCell>
    <TableCell>
      <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 500, maxWidth: 130 }}>
        {p.hostname}
      </Typography>
    </TableCell>
    <TableCell>
      <Typography noWrap sx={{ fontSize: "0.82rem", maxWidth: 320 }}>
        {p.name}
      </Typography>
    </TableCell>
    <TableCell>
      <SeverityChip severity={p.severity} />
    </TableCell>
    <TableCell>
      <ProblemStatusCell problem={p} />
    </TableCell>
    <TableCell sx={{ fontSize: "0.78rem", fontFamily: "monospace", color: "text.secondary" }}>
      {formatDuration(p.duration_seconds)}
    </TableCell>
    <TableCell>
      <ProblemAckCell problem={p} />
    </TableCell>
  </TableRow>
);

const ProblemHistorySkeletonRows = () => (
  <>
    {Array.from({ length: 6 }).map((_, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length anonymous skeleton placeholders, never reordered
      <TableRow key={i}>
        {[120, 120, 240, 70, 90, 60, 110].map((w, j) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length anonymous skeleton placeholders, never reordered
          <TableCell key={j}>
            <Skeleton width={w} height={14} />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

const ProblemHistoryFilters = ({
  hours,
  setHours,
  search,
  setSearch,
  severityMin,
  setSeverityMin,
  loading,
  onRefresh,
}: {
  hours: number;
  setHours: (h: number) => void;
  search: string;
  setSearch: (v: string) => void;
  severityMin: number;
  setSeverityMin: (v: number) => void;
  loading: boolean;
  onRefresh: () => void;
}) => (
  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
    <Box sx={{ display: "flex", gap: 0.5 }}>
      {TIME_RANGES.map(({ label, hours: h }) => (
        <Button
          key={label}
          size="small"
          variant={hours === h ? "contained" : "outlined"}
          onClick={() => setHours(h)}
          sx={{ minWidth: 42, px: 1, fontSize: "0.75rem", textTransform: "none" }}
        >
          {label}
        </Button>
      ))}
    </Box>
    <FilterSearchField
      placeholder="Filter by problem or host…"
      value={search}
      onChange={setSearch}
    />
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <InputLabel sx={filterLabelSx}>Min severity</InputLabel>
      <Select
        value={severityMin}
        label="Min severity"
        onChange={(e) => setSeverityMin(Number(e.target.value))}
        sx={filterLabelSx}
      >
        <MenuItem value={0} sx={filterLabelSx}>
          All
        </MenuItem>
        <MenuItem value={2} sx={filterLabelSx}>
          Warning+
        </MenuItem>
        <MenuItem value={3} sx={filterLabelSx}>
          Average+
        </MenuItem>
        <MenuItem value={4} sx={filterLabelSx}>
          High+
        </MenuItem>
        <MenuItem value={5} sx={filterLabelSx}>
          Disaster only
        </MenuItem>
      </Select>
    </FormControl>
    <Tooltip title="Refresh">
      <span>
        <IconButton size="small" onClick={onRefresh} disabled={loading}>
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </span>
    </Tooltip>
  </Box>
);

const problemHistorySummaryText = (
  loading: boolean,
  fetchError: boolean,
  filtered: HistoryProblem[],
  rangeLabel: string,
  search: string,
): string => {
  if (loading) {
    return "Loading…";
  }
  if (fetchError) {
    return "Failed to load — Zabbix may be unreachable";
  }
  return `${filtered.length} problem${filtered.length !== 1 ? "s" : ""} in the last ${rangeLabel}${search ? " (filtered)" : ""}`;
};

const ProblemHistoryTable = ({
  fetchError,
  loading,
  problems,
  filtered,
  isDark,
}: {
  fetchError: boolean;
  loading: boolean;
  problems: HistoryProblem[];
  filtered: HistoryProblem[];
  isDark: boolean;
}) => {
  if (fetchError) {
    return (
      <Alert severity="warning">Could not load problem history. Check Zabbix connectivity.</Alert>
    );
  }
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)" }}>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem", width: 145 }}>Started</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem", width: 140 }}>Host</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Problem</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem", width: 90 }}>Severity</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem", width: 110 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem", width: 80 }}>Duration</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem", width: 130 }}>
              Ack'd by
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && problems.length === 0 ? (
            <ProblemHistorySkeletonRows />
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                <Typography variant="body2" color="text.disabled">
                  No problems found in this window
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((p) => <HistoryProblemRow key={p.eventid} p={p} />)
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export const ProblemHistoryTab = () => {
  const [hours, setHours] = useState<number>(24);
  const [severityMin, setSeverityMin] = useState(0);
  const [search, setSearch] = useState("");
  const [problems, setProblems] = useState<HistoryProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const { palette } = useTheme();
  const isDark = palette.mode === "dark";

  const load = useCallback(() => {
    setLoading(true);
    setFetchError(false);
    api
      .getProblemHistory({ hours, severityMin: severityMin > 0 ? severityMin : undefined })
      .then((r) => setProblems(r.problems))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [hours, severityMin]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return problems;
    }
    return problems.filter(
      (p) => p.name.toLowerCase().includes(q) || p.hostname.toLowerCase().includes(q),
    );
  }, [problems, search]);

  const rangeLabel = TIME_RANGES.find((r) => r.hours === hours)?.label ?? `${hours}h`;

  return (
    <Stack spacing={2}>
      <TabHeader
        title="Problem History"
        description="Browse resolved and active problems with severity and host filters."
      />
      {/* Filters */}
      <ProblemHistoryFilters
        hours={hours}
        setHours={setHours}
        search={search}
        setSearch={setSearch}
        severityMin={severityMin}
        setSeverityMin={setSeverityMin}
        loading={loading}
        onRefresh={() => void load()}
      />

      {/* Summary */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {loading && <CircularProgress size={13} />}
        <Typography variant="caption" color="text.secondary">
          {problemHistorySummaryText(loading, fetchError, filtered, rangeLabel, search)}
        </Typography>
      </Box>

      <ProblemHistoryTable
        fetchError={fetchError}
        loading={loading}
        problems={problems}
        filtered={filtered}
        isDark={isDark}
      />
    </Stack>
  );
};
