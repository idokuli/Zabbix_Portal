"use client";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import { api } from "../../app/api";
import { TabHeader } from "../../app/components/TabHeader";
import { FILTER_BAR_SX, filterLabelSx } from "../../components/FilterBar";
import { TimeBar } from "./shared";
import { useReportLoader } from "./useReportLoader";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// "YYYY-MM" — sortable as a plain string, and trivial to split back into year/month.
const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, "0")}`;

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

const monthDiff = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

// The report's month-range picker allows a span of up to 6 calendar months.
const MAX_RANGE_MONTHS = 6;

// Last 24 months, newest first, as picker options.
const MONTH_OPTIONS = (() => {
  const now = new Date();
  const opts: string[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push(monthKey(d.getFullYear(), d.getMonth()));
  }
  return opts;
})();

const monthStartEpoch = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, 1) / 1000);
};

const monthEndEpoch = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m, 1) / 1000) - 1;
};

// Mode-independent bar fill (chart-series style) + mode-aware text token.
const availabilityTone = (pct: number) => {
  if (pct >= 99) {
    return { bar: "#2EA043", text: "success.main" };
  }
  if (pct >= 95) {
    return { bar: "#DBA243", text: "warning.main" };
  }
  return { bar: "#E45959", text: "error.main" };
};

export const AvailabilityTab = () => {
  const [hours, setHours] = useState(24);
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [data, setData] = useState<
    Array<{
      hostid: string;
      hostname: string;
      availability_pct: number;
      downtime_seconds: number;
      problem_count: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Memoized so `load` below only gets a new identity when fromMonth/toMonth
  // actually change — a plain ternary object literal here would be a fresh
  // reference every render, making `load` (and its effect in useReportLoader)
  // re-fire on every render, which sets state, which re-renders, forever.
  const range = useMemo(
    () => (fromMonth && toMonth ? { from: fromMonth, to: toMonth } : null),
    [fromMonth, toMonth],
  );

  const toMonthOptions = useMemo(
    () =>
      fromMonth
        ? MONTH_OPTIONS.filter((m) => {
            const d = monthDiff(fromMonth, m);
            return d >= 0 && d < MAX_RANGE_MONTHS;
          })
        : [],
    [fromMonth],
  );

  const clearRange = () => {
    setFromMonth("");
    setToMonth("");
  };

  const load = useCallback(
    (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      const params = range
        ? { time_from: monthStartEpoch(range.from), time_to: monthEndEpoch(range.to) }
        : { hours };
      api
        .getAvailability(params)
        .then((r) => setData(r.hosts))
        .catch((err: unknown) => {
          console.error("Failed to load availability data:", err);
        })
        .finally(() => setLoading(false));
    },
    [hours, range],
  );
  useReportLoader(load);

  return (
    <Stack spacing={2}>
      <TabHeader
        title="Availability Report"
        description="Measure uptime and SLA compliance per host group over a selected time window."
      />
      <Box sx={FILTER_BAR_SX}>
        <TimeBar
          hours={hours}
          onChange={(h) => {
            clearRange();
            setHours(h);
          }}
        />
        <Typography variant="caption" color="text.disabled">
          or a custom range —
        </Typography>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={filterLabelSx}>From month</InputLabel>
          <Select
            label="From month"
            value={fromMonth}
            onChange={(e: SelectChangeEvent) => {
              const v = e.target.value;
              setFromMonth(v);
              // Keep "To" only if it's still within range of the new "From".
              if (
                !v ||
                (toMonth &&
                  (monthDiff(v, toMonth) < 0 || monthDiff(v, toMonth) >= MAX_RANGE_MONTHS))
              ) {
                setToMonth("");
              }
            }}
            sx={filterLabelSx}
          >
            <MenuItem value="" sx={filterLabelSx}>
              —
            </MenuItem>
            {MONTH_OPTIONS.map((m) => (
              <MenuItem key={m} value={m} sx={filterLabelSx}>
                {monthLabel(m)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }} disabled={!fromMonth}>
          <InputLabel sx={filterLabelSx}>To month</InputLabel>
          <Select
            label="To month"
            value={toMonth}
            onChange={(e: SelectChangeEvent) => setToMonth(e.target.value)}
            sx={filterLabelSx}
          >
            <MenuItem value="" sx={filterLabelSx}>
              —
            </MenuItem>
            {toMonthOptions.map((m) => (
              <MenuItem key={m} value={m} sx={filterLabelSx}>
                {monthLabel(m)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {range && (
          <Chip
            label={`${monthLabel(range.from)} – ${monthLabel(range.to)}`}
            size="small"
            onDelete={clearRange}
            deleteIcon={<CloseIcon />}
          />
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </Button>
        {loading && <CircularProgress size={14} />}
      </Box>
      <Alert severity="info" sx={{ py: 0.5 }}>
        Availability is calculated from Zabbix problems in the selected window. Hosts with no
        problems show 100%.
      </Alert>
      <TableContainer sx={{ border: "1px solid", borderColor: "divider" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 32, p: 0 }} />
              <TableCell sx={{ fontWeight: 700 }}>Host</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 200 }}>Availability</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Uptime %</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 120 }}>Downtime</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>Problems</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                    No data — all hosts may be 100% available.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {data.map((h) => {
              const pct = h.availability_pct;
              const tone = availabilityTone(pct);
              const downMins = Math.floor(h.downtime_seconds / 60);
              const downStr =
                downMins >= 60 ? `${Math.floor(downMins / 60)}h ${downMins % 60}m` : `${downMins}m`;
              return (
                <>
                  <TableRow
                    key={h.hostid}
                    hover
                    onClick={() => setExpandedId(expandedId === h.hostid ? null : h.hostid)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell sx={{ width: 32, p: 0, pl: 0.5 }}>
                      <IconButton size="small" tabIndex={-1}>
                        {expandedId === h.hostid ? (
                          <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {h.hostname}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            flex: 1,
                            height: 6,
                            bgcolor: "action.hover",
                            "& .MuiLinearProgress-bar": { bgcolor: tone.bar },
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: tone.text }}>
                        {pct.toFixed(2)}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {h.downtime_seconds > 0 ? downStr : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {h.problem_count}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow key={`${h.hostid}-detail`}>
                    <TableCell
                      colSpan={6}
                      sx={{ p: 0, borderBottom: expandedId === h.hostid ? undefined : "none" }}
                    >
                      <Collapse in={expandedId === h.hostid} timeout="auto" unmountOnExit>
                        <Box
                          sx={{
                            px: 3,
                            py: 1.5,
                            bgcolor: "action.hover",
                            display: "grid",
                            gridTemplateColumns: "140px 1fr",
                            gap: "4px 12px",
                          }}
                        >
                          {[
                            ["Host ID", h.hostid],
                            ["Availability", `${h.availability_pct.toFixed(3)}%`],
                            ["Downtime", h.downtime_seconds > 0 ? downStr : "—"],
                            ["Problems", String(h.problem_count)],
                            [
                              "Window",
                              range
                                ? `${monthLabel(range.from)} – ${monthLabel(range.to)}`
                                : `${hours}h`,
                            ],
                          ].map(([label, value]) => (
                            <>
                              <Typography
                                key={`${label}-label`}
                                variant="caption"
                                sx={{
                                  color: "text.disabled",
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  fontSize: "0.6rem",
                                  alignSelf: "center",
                                }}
                              >
                                {label}
                              </Typography>
                              <Typography
                                key={`${label}-value`}
                                variant="body2"
                                sx={{ fontSize: "0.78rem" }}
                              >
                                {value}
                              </Typography>
                            </>
                          ))}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};
