"use client";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ComputerOutlinedIcon from "@mui/icons-material/ComputerOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  type SelectChangeEvent,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { api, type Host, type HostGroup, type Problem } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { useAuth } from "../../app/context/AuthContext";
import { useRefreshTick } from "../../app/context/RefreshContext";
import { formatDateTime, formatTime } from "../../app/datetime";
import { monoFontFamily } from "../../app/theme";
import { SearchableSelect } from "../../components/SearchableSelect";
import { formatAge, SEVERITY_CONFIG } from "./shared";

// ── Problems tab ──────────────────────────────────────────────────────

// When hideAckedAfterMinutes is set, an acknowledged problem counts down to the
// moment it drops out of `filtered` in ProblemsTab — this renders that countdown
// so the disappearance isn't a surprise. Returns null once time is up (the row
// itself is about to be filtered out on the next tick).
const ackHideCountdown = (
  p: Problem,
  hideAckedAfterMinutes: number | null,
  nowTick: number,
): string | null => {
  if (hideAckedAfterMinutes === null || !p.acknowledged || !p.ack_time) {
    return null;
  }
  const remainingMs = hideAckedAfterMinutes * 60_000 - (nowTick - new Date(p.ack_time).getTime());
  if (remainingMs <= 0) {
    return null;
  }
  return formatAge(Math.ceil(remainingMs / 1000));
};

const isHiddenByAckTimer = (
  p: Problem,
  hideAckedAfterMinutes: number | null,
  nowTick: number,
): boolean => {
  if (hideAckedAfterMinutes === null || !p.acknowledged || !p.ack_time) {
    return false;
  }
  const elapsedMs = nowTick - new Date(p.ack_time).getTime();
  return elapsedMs >= hideAckedAfterMinutes * 60_000;
};

// Kept as standalone (module-scope) functions, not closures inside ProblemsTab, so their
// branching doesn't count toward that component's own cognitive-complexity budget.
const matchesProblemFilters = (
  p: Problem,
  filters: {
    selectedSeverities: number[];
    hostFilter: string;
    selectedGroups: string[];
    searchLower: string;
  },
): boolean => {
  const { selectedSeverities, hostFilter, selectedGroups, searchLower } = filters;
  if (selectedSeverities.length > 0 && !selectedSeverities.includes(p.severity)) {
    return false;
  }
  if (hostFilter && p.hostname !== hostFilter) {
    return false;
  }
  if (selectedGroups.length > 0 && !p.groups.some((g) => selectedGroups.includes(g))) {
    return false;
  }
  if (
    searchLower &&
    !p.name.toLowerCase().includes(searchLower) &&
    !p.hostname.toLowerCase().includes(searchLower)
  ) {
    return false;
  }
  return true;
};

const compareBySort = (a: Problem, b: Problem, sortBy: ProblemSortBy): number =>
  sortBy === "newest" ? b.clock - a.clock : a.clock - b.clock;

const sortProblems = (problems: Problem[], sortBy: ProblemSortBy): Problem[] =>
  sortBy === "default" ? problems : [...problems].sort((a, b) => compareBySort(a, b, sortBy));

const AckCell = ({
  p,
  acknowledging,
  onAckRequest,
  hideAckedAfterMinutes,
  nowTick,
  canUnacknowledge,
  unacknowledging,
  onUnackRequest,
}: {
  p: Problem;
  acknowledging: Set<string>;
  onAckRequest: (p: Problem) => void;
  hideAckedAfterMinutes: number | null;
  nowTick: number;
  canUnacknowledge: boolean;
  unacknowledging: Set<string>;
  onUnackRequest: (p: Problem) => void;
}) =>
  p.acknowledged ? (
    <Stack sx={{ alignItems: "center" }} direction="row" spacing={0.5}>
      <Tooltip
        title={
          p.ack_user ? (
            <Box>
              <Typography variant="caption" sx={{ display: "block", fontWeight: 700 }}>
                Acknowledged by {p.ack_user}
              </Typography>
              {p.ack_time && (
                <Typography variant="caption" sx={{ display: "block" }}>
                  {formatDateTime(p.ack_time)}
                </Typography>
              )}
              {p.ack_note && (
                <Typography
                  variant="caption"
                  sx={{ display: "block", fontStyle: "italic", mt: 0.25 }}
                >
                  "{p.ack_note}"
                </Typography>
              )}
            </Box>
          ) : (
            "Acknowledged"
          )
        }
      >
        <Chip
          label={p.ack_user ? `Ack'd by ${p.ack_user}` : "Ack'd"}
          size="small"
          color="success"
          variant="outlined"
          sx={{ height: 20, fontSize: "0.68rem" }}
        />
      </Tooltip>
      {(() => {
        const countdown = ackHideCountdown(p, hideAckedAfterMinutes, nowTick);
        return countdown ? (
          <Tooltip title="Time until this acknowledged problem is hidden from the list">
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              hides in {countdown}
            </Typography>
          </Tooltip>
        ) : null;
      })()}
      {canUnacknowledge && (
        <Tooltip title="Unacknowledge this problem (Team Lead+)">
          <span>
            <Button
              size="small"
              variant="text"
              color="warning"
              onClick={(e) => {
                e.stopPropagation();
                onUnackRequest(p);
              }}
              disabled={unacknowledging.has(p.eventid)}
              sx={{ fontSize: "0.68rem", height: 20, minWidth: 40, px: 0.75 }}
            >
              {unacknowledging.has(p.eventid) ? "…" : "Unack"}
            </Button>
          </span>
        </Tooltip>
      )}
    </Stack>
  ) : (
    <Tooltip title="Acknowledge this problem">
      <span>
        <Button
          size="small"
          variant="outlined"
          onClick={(e) => {
            e.stopPropagation();
            onAckRequest(p);
          }}
          disabled={acknowledging.has(p.eventid)}
          sx={{ fontSize: "0.68rem", height: 20, minWidth: 50, px: 1 }}
        >
          {acknowledging.has(p.eventid) ? "…" : "Ack"}
        </Button>
      </span>
    </Tooltip>
  );

const DetailField = ({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) => (
  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.875 }}>
    <Box sx={{ display: "flex", color: "text.disabled", mt: "3px", "& svg": { fontSize: 15 } }}>
      {icon}
    </Box>
    <Box>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          color: "text.disabled",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontSize: "0.625rem",
          fontWeight: 600,
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  </Box>
);

const ProblemDetailPanel = ({ p, isExpanded }: { p: Problem; isExpanded: boolean }) => (
  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
    <Box sx={{ px: 3, py: 0.5 }}>
      <Box sx={{ border: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
        <Box sx={{ px: 2, py: 0.875, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontSize: "0.625rem",
            }}
          >
            Problem details
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap", px: 2, py: 1.5 }}>
          <DetailField icon={<ComputerOutlinedIcon />} label="Host">
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.8125rem" }}>
              {p.hostname}
            </Typography>
          </DetailField>
          <DetailField icon={<AccessTimeOutlinedIcon />} label="Started">
            <Typography
              variant="body2"
              sx={{ fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}
            >
              {formatDateTime(p.clock)}
            </Typography>
          </DetailField>
          <DetailField icon={<TimerOutlinedIcon />} label="Duration">
            <Typography
              variant="body2"
              sx={{ fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}
            >
              {formatAge(p.age_seconds)}
            </Typography>
          </DetailField>
          {p.acknowledged && (
            <DetailField icon={<CheckCircleOutlineIcon />} label="Acknowledged by">
              <Typography
                variant="body2"
                sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "success.main" }}
              >
                {p.ack_user || "Unknown"}
                {p.ack_time && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 0.75, fontWeight: 400 }}
                  >
                    · {formatDateTime(p.ack_time)}
                  </Typography>
                )}
              </Typography>
            </DetailField>
          )}
        </Box>
        {p.ack_note && (
          <Box
            sx={{
              mx: 2,
              mb: 1.5,
              px: 1.5,
              py: 0.75,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontSize: "0.625rem",
                fontWeight: 600,
              }}
            >
              Note
            </Typography>
            <Typography variant="body2" sx={{ fontSize: "0.82rem", fontStyle: "italic", mt: 0.25 }}>
              "{p.ack_note}"
            </Typography>
          </Box>
        )}
        {p.acknowledged && !p.ack_note && (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: "block", px: 2, pb: 1.5 }}
          >
            No note was added.
          </Typography>
        )}
        {p.notes && p.notes.length > 0 && (
          <Box sx={{ mx: 2, mb: 1.5, display: "flex", flexDirection: "column", gap: 0.75 }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontSize: "0.625rem",
                fontWeight: 600,
              }}
            >
              Notes ({p.notes.length})
            </Typography>
            {p.notes.map((n, i) => (
              <Box
                // biome-ignore lint/suspicious/noArrayIndexKey: notes are append-only, stable order
                key={i}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
                  {n.note}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.25 }}
                >
                  {n.username} · {formatDateTime(n.created_at)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  </Collapse>
);

// Record-list row: severity dot + expand chevron lead the line, the problem
// name carries primary weight, host/time/duration form a muted mono meta
// line underneath — same reading pattern as Overview's problem feed, not a
// spreadsheet grid.
const ProblemRow = ({
  p,
  isExpanded,
  onToggle,
  acknowledging,
  onAckRequest,
  onNoteRequest,
  hideAckedAfterMinutes,
  nowTick,
  canUnacknowledge,
  unacknowledging,
  onUnackRequest,
}: {
  p: Problem;
  isExpanded: boolean;
  onToggle: () => void;
  acknowledging: Set<string>;
  onAckRequest: (p: Problem) => void;
  onNoteRequest: (p: Problem) => void;
  hideAckedAfterMinutes: number | null;
  nowTick: number;
  canUnacknowledge: boolean;
  unacknowledging: Set<string>;
  onUnackRequest: (p: Problem) => void;
}) => {
  const sev = SEVERITY_CONFIG.find((s) => s.severity === p.severity) ?? SEVERITY_CONFIG[0];
  return (
    <>
      <Box
        onClick={onToggle}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 2,
          py: 1.1,
          cursor: "pointer",
          borderBottom: "1px solid",
          borderColor: "divider",
          "&:hover": { backgroundColor: "action.hover" },
        }}
      >
        {isExpanded ? (
          <KeyboardArrowDownIcon sx={{ fontSize: 16, color: "text.disabled", flexShrink: 0 }} />
        ) : (
          <KeyboardArrowRightIcon sx={{ fontSize: 16, color: "text.disabled", flexShrink: 0 }} />
        )}
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: sev.color, flexShrink: 0 }} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {p.name}
          </Typography>
          <Typography
            sx={{
              fontFamily: monoFontFamily,
              fontSize: "0.6875rem",
              color: "text.secondary",
              fontVariantNumeric: "tabular-nums",
            }}
            noWrap
          >
            {p.hostname} · {formatTime(p.clock)} · {formatAge(p.age_seconds)}
          </Typography>
        </Box>

        <Typography
          variant="caption"
          sx={{
            color: sev.color,
            fontWeight: 700,
            flexShrink: 0,
            whiteSpace: "nowrap",
            minWidth: 64,
            textAlign: "right",
          }}
        >
          {sev.label}
        </Typography>

        <Stack
          direction="row"
          spacing={0.75}
          onClick={(e) => e.stopPropagation()}
          sx={{ alignItems: "center", flexShrink: 0 }}
        >
          {p.notes && p.notes.length > 0 && (
            <Tooltip title={`${p.notes.length} note${p.notes.length !== 1 ? "s" : ""}`}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.375,
                  color: "text.disabled",
                }}
              >
                <EditNoteOutlinedIcon sx={{ fontSize: 15 }} />
                <Typography variant="caption" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {p.notes.length}
                </Typography>
              </Box>
            </Tooltip>
          )}
          <Tooltip title="Add note">
            <IconButton
              size="small"
              onClick={() => onNoteRequest(p)}
              sx={{ color: "text.disabled" }}
            >
              <EditNoteOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <AckCell
            p={p}
            acknowledging={acknowledging}
            onAckRequest={onAckRequest}
            hideAckedAfterMinutes={hideAckedAfterMinutes}
            nowTick={nowTick}
            canUnacknowledge={canUnacknowledge}
            unacknowledging={unacknowledging}
            onUnackRequest={onUnackRequest}
          />
        </Stack>
      </Box>

      <ProblemDetailPanel p={p} isExpanded={isExpanded} />
    </>
  );
};

// Shared shape behind Acknowledge / Add note / Unacknowledge — all three are a small
// dialog confirming an action against one problem with an optional or required note.
const ProblemActionDialog = ({
  target,
  title,
  description,
  note,
  setNote,
  noteLabel,
  notePlaceholder,
  onClose,
  onSubmit,
  busy,
  submitLabel,
  submitColor = "primary",
  noteRequired = false,
}: {
  target: Problem | null;
  title: string;
  description: ReactNode;
  note: string;
  setNote: (v: string) => void;
  noteLabel: string;
  notePlaceholder: string;
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel: string;
  submitColor?: "primary" | "success" | "warning";
  noteRequired?: boolean;
}) => (
  <Dialog open={target !== null} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 0.5 }}>
        {target && (
          <Box sx={{ bgcolor: "action.hover", p: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {target.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {target.hostname} · {target.severity_name}
            </Typography>
          </Box>
        )}
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        <TextField
          size="small"
          multiline
          minRows={2}
          fullWidth
          label={noteLabel}
          placeholder={notePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        variant="contained"
        color={submitColor}
        disabled={busy || (noteRequired && !note.trim())}
        onClick={onSubmit}
      >
        {submitLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

const ProblemsSkeletonRows = () => (
  <>
    {Array.from({ length: 4 }).map((_, i) => (
      <Box
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
        key={i}
        sx={{ px: 2, py: 1.1, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Skeleton variant="text" width="40%" height={20} />
        <Skeleton variant="text" width="25%" height={16} />
      </Box>
    ))}
  </>
);

type ProblemSortBy = "default" | "newest" | "oldest";

// Options for "hide acknowledged after" — value is minutes, null = never hide.
const HIDE_ACKED_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: "Never", value: null },
  { label: "1 minute", value: 1 },
  { label: "5 minutes", value: 5 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "4 hours", value: 240 },
];

// Sort order + "hide acknowledged after" preferences, persisted per-browser (localStorage),
// same pattern as theme mode/direction in ThemeContext. Pulled out of ProblemsTab so the
// load-on-mount/tick effects don't add to that component's own cognitive complexity.
const useProblemsPreferences = () => {
  const [sortBy, setSortByState] = useState<ProblemSortBy>("default");
  const [hideAckedAfterMinutes, setHideAckedAfterMinutesState] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const savedSort = localStorage.getItem("problemsSortBy");
    if (savedSort === "newest" || savedSort === "oldest" || savedSort === "default") {
      setSortByState(savedSort);
    }
    const savedHide = localStorage.getItem("problemsHideAckedAfterMinutes");
    const parsed = savedHide ? Number(savedHide) : Number.NaN;
    if (!Number.isNaN(parsed)) {
      setHideAckedAfterMinutesState(parsed);
    }
  }, []);

  // Only tick while a hide-after-ack timer is actually armed, so the countdown
  // re-renders once a second without a background timer running unconditionally.
  useEffect(() => {
    if (hideAckedAfterMinutes === null) {
      return;
    }
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hideAckedAfterMinutes]);

  const setSortBy = (v: ProblemSortBy) => {
    setSortByState(v);
    localStorage.setItem("problemsSortBy", v);
  };

  const setHideAckedAfterMinutes = (v: number | null) => {
    setHideAckedAfterMinutesState(v);
    localStorage.setItem("problemsHideAckedAfterMinutes", v === null ? "" : String(v));
  };

  return { sortBy, setSortBy, hideAckedAfterMinutes, setHideAckedAfterMinutes, nowTick };
};

const ProblemsHeaderRow = ({
  loading,
  filtered,
  problems,
  search,
  setSearch,
  hostGroups,
  selectedGroups,
  setSelectedGroups,
  visibleHosts,
  hostFilter,
  setHostFilter,
  sortBy,
  setSortBy,
  hideAckedAfterMinutes,
  setHideAckedAfterMinutes,
  onRefresh,
}: {
  loading: boolean;
  filtered: Problem[];
  problems: Problem[];
  search: string;
  setSearch: (v: string) => void;
  hostGroups: HostGroup[];
  selectedGroups: string[];
  setSelectedGroups: (v: string[]) => void;
  visibleHosts: Host[];
  hostFilter: string;
  setHostFilter: (v: string) => void;
  sortBy: ProblemSortBy;
  setSortBy: (v: ProblemSortBy) => void;
  hideAckedAfterMinutes: number | null;
  setHideAckedAfterMinutes: (v: number | null) => void;
  onRefresh: () => void;
}) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
    {!loading && (
      <Chip
        label={
          filtered.length !== problems.length
            ? `${filtered.length} / ${problems.length} problems`
            : `${problems.length} problems`
        }
        size="small"
        sx={{ height: 20, fontSize: "0.6875rem" }}
      />
    )}
    <TextField
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} />
            </InputAdornment>
          ),
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch("")}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
      size="small"
      placeholder="Search problem or host…"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      sx={{ flex: 1, minWidth: 180 }}
    />
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <InputLabel shrink sx={{ fontSize: "0.78rem" }}>
        Filter by group
      </InputLabel>
      <Select<string[]>
        multiple
        value={selectedGroups}
        onChange={(e: SelectChangeEvent<string[]>) =>
          setSelectedGroups(
            typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value,
          )
        }
        input={<OutlinedInput label="Filter by group" sx={{ fontSize: "0.78rem" }} />}
        renderValue={(selected) =>
          selected.length === 0 ? "All groups" : `${selected.length} selected`
        }
        displayEmpty
        sx={{ fontSize: "0.78rem" }}
      >
        {hostGroups.map((g) => (
          <MenuItem key={g.groupid} value={g.name} sx={{ fontSize: "0.78rem", py: 0.25 }}>
            <Checkbox checked={selectedGroups.includes(g.name)} size="small" />
            <ListItemText
              slotProps={{ primary: { sx: { fontSize: "0.78rem" } } }}
              primary={g.name}
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <InputLabel sx={{ fontSize: "0.78rem" }}>Filter by host</InputLabel>
      <SearchableSelect
        label="Filter by host"
        value={visibleHosts.some((h) => h.host === hostFilter) ? hostFilter : ""}
        onChange={(e) => setHostFilter(e.target.value)}
        sx={{ fontSize: "0.78rem" }}
      >
        <MenuItem value="" sx={{ fontSize: "0.78rem" }}>
          All hosts
        </MenuItem>
        {visibleHosts.map((h) => (
          <MenuItem key={h.hostid} value={h.host} sx={{ fontSize: "0.78rem" }}>
            {h.host}
          </MenuItem>
        ))}
      </SearchableSelect>
    </FormControl>
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <InputLabel sx={{ fontSize: "0.78rem" }}>Sort by</InputLabel>
      <Select
        value={sortBy}
        label="Sort by"
        onChange={(e: SelectChangeEvent) => setSortBy(e.target.value as ProblemSortBy)}
        sx={{ fontSize: "0.78rem" }}
      >
        <MenuItem value="default" sx={{ fontSize: "0.78rem" }}>
          Severity (default)
        </MenuItem>
        <MenuItem value="newest" sx={{ fontSize: "0.78rem" }}>
          Newest first
        </MenuItem>
        <MenuItem value="oldest" sx={{ fontSize: "0.78rem" }}>
          Oldest first
        </MenuItem>
      </Select>
    </FormControl>
    <FormControl size="small" sx={{ minWidth: 170 }}>
      <InputLabel sx={{ fontSize: "0.78rem" }}>Hide acked after</InputLabel>
      <Select
        value={hideAckedAfterMinutes === null ? "" : String(hideAckedAfterMinutes)}
        label="Hide acked after"
        onChange={(e: SelectChangeEvent) =>
          setHideAckedAfterMinutes(e.target.value === "" ? null : Number(e.target.value))
        }
        sx={{ fontSize: "0.78rem" }}
      >
        {HIDE_ACKED_OPTIONS.map((opt) => (
          <MenuItem
            key={opt.label}
            value={opt.value === null ? "" : String(opt.value)}
            sx={{ fontSize: "0.78rem" }}
          >
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
    <Tooltip title="Refresh">
      <IconButton size="small" onClick={onRefresh} disabled={loading}>
        <RefreshIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  </Box>
);

const SeverityFilterChips = ({
  loading,
  severityCounts,
  selectedSeverities,
  toggleSeverity,
  hostFilter,
  selectedGroups,
  search,
  onClearFilters,
}: {
  loading: boolean;
  severityCounts: Array<{
    severity: number;
    label: string;
    color: string;
    bg: string;
    count: number;
  }>;
  selectedSeverities: number[];
  toggleSeverity: (sev: number) => void;
  hostFilter: string;
  selectedGroups: string[];
  search: string;
  onClearFilters: () => void;
}) => (
  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
    {loading
      ? SEVERITY_CONFIG.map((s) => (
          <Skeleton key={s.severity} variant="rounded" width={90} height={26} />
        ))
      : severityCounts
          .filter((s) => s.count > 0)
          .map((s) => {
            const active = selectedSeverities.includes(s.severity);
            return (
              <Chip
                key={s.severity}
                label={`${s.label} (${s.count})`}
                size="small"
                onClick={() => toggleSeverity(s.severity)}
                sx={{
                  fontWeight: 500,
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  color: active ? s.color : "text.secondary",
                  backgroundColor: active ? s.bg : "transparent",
                  border: "1px solid",
                  borderColor: active ? `${s.color}80` : "divider",
                  transition: "all 0.15s",
                }}
              />
            );
          })}
    {!loading &&
      (selectedSeverities.length > 0 || hostFilter || selectedGroups.length > 0 || search) && (
        <Chip
          label="Clear filters"
          size="small"
          variant="outlined"
          onDelete={onClearFilters}
          sx={{ fontSize: "0.72rem" }}
        />
      )}
  </Box>
);

export const ProblemsTab = ({ initialHost = "" }: { initialHost?: string }) => {
  const tick = useRefreshTick();
  const { user: authUser } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverities, setSelectedSeverities] = useState<number[]>([]);
  const [hostFilter, setHostFilter] = useState(initialHost);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostGroups, setHostGroups] = useState<HostGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [acknowledging, setAcknowledging] = useState<Set<string>>(new Set());
  const [expandedProblemId, setExpandedProblemId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Sort + "hide acknowledged after" preferences — persisted per-browser, like theme.
  const { sortBy, setSortBy, hideAckedAfterMinutes, setHideAckedAfterMinutes, nowTick } =
    useProblemsPreferences();

  // Ack dialog state
  const [ackTarget, setAckTarget] = useState<Problem | null>(null);
  const [ackNote, setAckNote] = useState("");

  // Add-note dialog state — independent of acknowledging
  const [noteTarget, setNoteTarget] = useState<Problem | null>(null);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState<Set<string>>(new Set());

  // Unacknowledge dialog state — Team Lead+ only, reopens an acknowledged problem
  const canUnacknowledge = (authUser?.roles ?? []).some((r) => r === "root" || r === "team_lead");
  const [unackTarget, setUnackTarget] = useState<Problem | null>(null);
  const [unackNote, setUnackNote] = useState("");
  const [unacknowledging, setUnacknowledging] = useState<Set<string>>(new Set());

  const loadProblems = useCallback((silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setLoadError(null);
    Promise.all([api.getProblems(), api.listHosts(), api.listHostGroups({ mine: true })])
      .then(([pr, hr, gr]) => {
        setProblems(pr.problems);
        setHosts(hr.hosts);
        setHostGroups(gr.groups);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load problems."))
      .finally(() => setLoading(false));
  }, []);

  const handleAcknowledge = useCallback(async (problem: Problem, note: string) => {
    const { eventid } = problem;
    setAcknowledging((prev) => new Set([...prev, eventid]));
    setAckTarget(null);
    setAckNote("");
    try {
      const res = await api.acknowledgeProblem(eventid, {
        problem_name: problem.name,
        hostname: problem.hostname,
        severity: problem.severity,
        note,
      });
      const now = new Date().toISOString();
      setProblems((prev) =>
        prev.map((p) =>
          p.eventid === eventid
            ? {
                ...p,
                acknowledged: true,
                ack_user: res.acknowledged_by,
                ack_time: now,
                ack_note: note,
              }
            : p,
        ),
      );
      window.dispatchEvent(new Event("problemAcknowledged"));
    } catch {
      // no-op — button re-enables so user can retry
    } finally {
      setAcknowledging((prev) => {
        const next = new Set(prev);
        next.delete(eventid);
        return next;
      });
    }
  }, []);

  const handleAddNote = useCallback(async (problem: Problem, note: string) => {
    const { eventid } = problem;
    setAddingNote((prev) => new Set([...prev, eventid]));
    setNoteTarget(null);
    setNoteText("");
    try {
      const res = await api.addProblemNote(eventid, { hostname: problem.hostname, note });
      setProblems((prev) =>
        prev.map((p) =>
          p.eventid === eventid
            ? {
                ...p,
                notes: [
                  ...(p.notes ?? []),
                  { username: res.username, note: res.note, created_at: res.created_at },
                ],
              }
            : p,
        ),
      );
    } catch {
      // no-op — button re-enables so user can retry
    } finally {
      setAddingNote((prev) => {
        const next = new Set(prev);
        next.delete(eventid);
        return next;
      });
    }
  }, []);

  const handleUnacknowledge = useCallback(
    async (problem: Problem, note: string) => {
      const { eventid } = problem;
      setUnacknowledging((prev) => new Set([...prev, eventid]));
      setUnackTarget(null);
      setUnackNote("");
      try {
        await api.unacknowledgeProblem(eventid, { hostname: problem.hostname, note });
        setProblems((prev) =>
          prev.map((p) =>
            p.eventid === eventid
              ? {
                  ...p,
                  acknowledged: false,
                  ack_user: undefined,
                  ack_time: undefined,
                  ack_note: undefined,
                  notes: [
                    ...(p.notes ?? []),
                    {
                      username: authUser?.username ?? "unknown",
                      note: note ? `Unacknowledged: ${note}` : "Unacknowledged",
                      created_at: new Date().toISOString(),
                    },
                  ],
                }
              : p,
          ),
        );
        window.dispatchEvent(new Event("problemAcknowledged"));
      } catch {
        // no-op — button re-enables so user can retry
      } finally {
        setUnacknowledging((prev) => {
          const next = new Set(prev);
          next.delete(eventid);
          return next;
        });
      }
    },
    [authUser?.username],
  );

  useEffect(() => {
    void loadProblems();
  }, [loadProblems]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick triggers silent auto-refresh
  useEffect(() => {
    if (tick > 0) {
      void loadProblems(true);
    }
  }, [tick]);

  const toggleSeverity = (sev: number) => {
    setSelectedSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev],
    );
  };

  // Hosts that belong to any selected group (all hosts when no group selected)
  const visibleHosts =
    selectedGroups.length === 0
      ? hosts
      : hosts.filter((h) => h.groups?.some((g) => selectedGroups.includes(g.name)));

  const searchLower = search.toLowerCase();
  const filtered = problems
    .filter((p) =>
      matchesProblemFilters(p, { selectedSeverities, hostFilter, selectedGroups, searchLower }),
    )
    .filter((p) => !isHiddenByAckTimer(p, hideAckedAfterMinutes, nowTick));

  const sorted = sortProblems(filtered, sortBy);

  const severityCounts = SEVERITY_CONFIG.map((s) => ({
    ...s,
    count: problems.filter((p) => p.severity === s.severity).length,
  }));

  return (
    <Box>
      <TabHeader
        title="Active Problems"
        description="View all current unresolved problems, with severity, duration, and acknowledgement status."
      />
      {loadError && (
        <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
          {loadError}
        </Typography>
      )}
      {/* Header row */}
      <ProblemsHeaderRow
        loading={loading}
        filtered={filtered}
        problems={problems}
        search={search}
        setSearch={setSearch}
        hostGroups={hostGroups}
        selectedGroups={selectedGroups}
        setSelectedGroups={setSelectedGroups}
        visibleHosts={visibleHosts}
        hostFilter={hostFilter}
        setHostFilter={setHostFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        hideAckedAfterMinutes={hideAckedAfterMinutes}
        setHideAckedAfterMinutes={setHideAckedAfterMinutes}
        onRefresh={() => void loadProblems()}
      />

      {/* Severity filter chips */}
      <SeverityFilterChips
        loading={loading}
        severityCounts={severityCounts}
        selectedSeverities={selectedSeverities}
        toggleSeverity={toggleSeverity}
        hostFilter={hostFilter}
        selectedGroups={selectedGroups}
        search={search}
        onClearFilters={() => {
          setSelectedSeverities([]);
          setHostFilter("");
          setSelectedGroups([]);
          setSearch("");
        }}
      />

      {/* Problems list */}
      <Paper variant="outlined">
        <Box
          sx={{
            px: 2,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.625rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "text.secondary",
            }}
          >
            {loading
              ? "Loading…"
              : `Active problems — ${filtered.length}${filtered.length !== problems.length ? ` of ${problems.length}` : ""}`}
          </Typography>
        </Box>
        {loading ? (
          <ProblemsSkeletonRows />
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {problems.length === 0 ? "No active problems" : "No problems match filters"}
            </Typography>
          </Box>
        ) : (
          sorted.map((p) => (
            <ProblemRow
              key={p.eventid}
              p={p}
              isExpanded={expandedProblemId === p.eventid}
              onToggle={() =>
                setExpandedProblemId(expandedProblemId === p.eventid ? null : p.eventid)
              }
              acknowledging={acknowledging}
              onAckRequest={(problem) => {
                setAckTarget(problem);
                setAckNote("");
              }}
              onNoteRequest={(problem) => {
                setNoteTarget(problem);
                setNoteText("");
              }}
              hideAckedAfterMinutes={hideAckedAfterMinutes}
              nowTick={nowTick}
              canUnacknowledge={canUnacknowledge}
              unacknowledging={unacknowledging}
              onUnackRequest={(problem) => {
                setUnackTarget(problem);
                setUnackNote("");
              }}
            />
          ))
        )}
      </Paper>

      <ProblemActionDialog
        target={ackTarget}
        title="Acknowledge problem"
        description={
          <>
            Acknowledging as <strong>{authUser?.username ?? "you"}</strong>. Add an optional note
            explaining what was done.
          </>
        }
        note={ackNote}
        setNote={setAckNote}
        noteLabel="Note (optional)"
        notePlaceholder="e.g. Restarted the service, investigating further…"
        onClose={() => setAckTarget(null)}
        onSubmit={() => ackTarget && handleAcknowledge(ackTarget, ackNote)}
        busy={ackTarget ? acknowledging.has(ackTarget.eventid) : false}
        submitLabel="Acknowledge"
        submitColor="success"
      />

      <ProblemActionDialog
        target={noteTarget}
        title="Add note"
        description={
          <>
            Leave a note as <strong>{authUser?.username ?? "you"}</strong> without changing the
            acknowledgement status.
          </>
        }
        note={noteText}
        setNote={setNoteText}
        noteLabel="Note"
        notePlaceholder="e.g. Escalated to network team, waiting on a response…"
        onClose={() => setNoteTarget(null)}
        onSubmit={() => noteTarget && handleAddNote(noteTarget, noteText.trim())}
        busy={noteTarget ? addingNote.has(noteTarget.eventid) : false}
        submitLabel="Add note"
        noteRequired
      />

      <ProblemActionDialog
        target={unackTarget}
        title="Unacknowledge problem"
        description={
          <>
            Reopening as <strong>{authUser?.username ?? "you"}</strong>. This clears the
            acknowledgement so the problem re-enters the alert workflow. Add an optional reason.
          </>
        }
        note={unackNote}
        setNote={setUnackNote}
        noteLabel="Reason (optional)"
        notePlaceholder="e.g. Recurred — reopening for investigation…"
        onClose={() => setUnackTarget(null)}
        onSubmit={() => unackTarget && handleUnacknowledge(unackTarget, unackNote.trim())}
        busy={unackTarget ? unacknowledging.has(unackTarget.eventid) : false}
        submitLabel="Unacknowledge"
        submitColor="warning"
      />
    </Box>
  );
};
