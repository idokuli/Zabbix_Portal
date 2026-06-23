"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChart";
import TuneIcon from "@mui/icons-material/Tune";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  CategoryScale,
  Chart as ChartJS,
  Tooltip as ChartTooltip,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
} from "chart.js";
import ZoomPlugin from "chartjs-plugin-zoom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import ReactGridLayout, { WidthProvider } from "react-grid-layout";
import {
  type AlertEvent,
  type DashboardGraph,
  type DashboardMeta,
  type GraphData,
  type Host,
  type HostMetrics,
  type RecentItem,
  type Team,
  type WidgetConfig,
  api,
} from "../app/api";
import { SearchableSelect } from "../components/SearchableSelect";

const GridLayout = WidthProvider(ReactGridLayout);

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler,
  ZoomPlugin,
);

// ── Constants ────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: "1 m", period: 60, minutes: 1 },
  { label: "5 m", period: 300, minutes: 5 },
  { label: "15 m", period: 900, minutes: 15 },
  { label: "30 m", period: 1800, minutes: 30 },
  { label: "1 h", period: 3600, minutes: 60 },
  { label: "3 h", period: 10800, minutes: 180 },
  { label: "6 h", period: 21600, minutes: 360 },
  { label: "12 h", period: 43200, minutes: 720 },
  { label: "24 h", period: 86400, minutes: 1440 },
  { label: "7 d", period: 604800, minutes: 10080 },
] as const;

const VALUE_TYPE_LABELS: Record<string, string> = {
  "0": "Numeric (float)",
  "1": "Character",
  "2": "Log",
  "3": "Numeric (int)",
  "4": "Text",
};

// Kibana/Elastic-inspired palette — vibrant on dark backgrounds
const CHART_COLORS = [
  "#1BA7F5",
  "#00BFB3",
  "#F77B00",
  "#9170B8",
  "#E7664C",
  "#D6BF57",
  "#54B399",
  "#D36086",
];

const PRESET_COLORS = [
  "#1BA7F5", "#00BFB3", "#F77B00", "#9170B8",
  "#E7664C", "#22C55E", "#F44336", "#FFC107",
  "#8B5CF6", "#D36086", "#54B399", "#D6BF57",
];

const ALERT_SEV_COLORS: Record<number, string> = {
  5: "#B71C1C",
  4: "#F44336",
  3: "#FF5722",
  2: "#FFC107",
  1: "#2196F3",
  0: "#9E9E9E",
};

const ALERT_SEV_LABELS: Record<number, string> = {
  5: "Critical",
  4: "High",
  3: "Medium",
  2: "Low",
  1: "Info",
  0: "None",
};

type GradientCtx = {
  chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } };
};

// ── Helpers ───────────────────────────────────────────────────────────

const formatTimestamp = (clock: number, minutes?: number) => {
  const d = new Date(clock * 1000);
  if (minutes !== undefined && minutes <= 5) {
    // Short range — show seconds
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }
  if (minutes !== undefined && minutes >= 1440) {
    // Multi-day — show date + hour
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
};

const formatRangeTime = (clock: number) =>
  new Date(clock * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const formatLastSeen = (clock: number | null) => {
  if (!clock) return "—";
  const diff = Math.floor(Date.now() / 1000) - clock;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const utilColor = (val: number): string => {
  if (val >= 90) return "#F44336";
  if (val >= 75) return "#FF5722";
  if (val >= 50) return "#FFC107";
  return "#22C55E";
};

// ── Sub-components ────────────────────────────────────────────────────

const MetricBar = ({ value, label }: { value?: number; label: string }) => {
  if (value === undefined)
    return (
      <Typography variant="caption" color="text.disabled">
        —
      </Typography>
    );
  return (
    <Tooltip title={`${label}: ${value}%`}>
      <Box sx={{ minWidth: 80 }}>
        <Typography variant="caption" sx={{ color: utilColor(value), fontWeight: 700 }}>
          {value}%
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(value, 100)}
          sx={{
            height: 4,
            borderRadius: 2,
            mt: 0.25,
            backgroundColor: "rgba(255,255,255,0.08)",
            "& .MuiLinearProgress-bar": { backgroundColor: utilColor(value), borderRadius: 2 },
          }}
        />
      </Box>
    </Tooltip>
  );
};

// Renders a Chart.js line chart from graph history data
const ChartJsGraph = ({
  graphid,
  minutes,
  alertEvents = [],
  lineColor,
  onPeriodChange,
}: {
  graphid: string;
  minutes: number;
  alertEvents?: AlertEvent[];
  lineColor?: string;
  onPeriodChange?: (delta: number) => void;
}) => {
  const { palette } = useTheme();
  const isDark = palette.mode === "dark";
  const chartBg = isDark ? "#0D1B2A" : "#F1F5F9";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  // Light mode needs a clearly dark tick so the time axis doesn't blend into the
  // pale chart background.
  const tickColor = isDark ? "#94A3B8" : "#334155";
  const tooltipBg = isDark ? "rgba(5,15,30,0.97)" : "rgba(255,255,255,0.97)";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
  const tooltipTitle = isDark ? "#94A3B8" : "#64748B";
  const tooltipBody = isDark ? "#F1F5F9" : "#1E293B";

  // biome-ignore lint/suspicious/noExplicitAny: chartjs-plugin-zoom resetZoom ref
  const chartRef = useRef<any>(null);

  const prevGraphIdRef = useRef<string>("");
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Only show the full skeleton when the graph itself changes (different widget).
    // A period/minutes change keeps the existing chart and refreshes in the background.
    const isNewGraph = prevGraphIdRef.current !== graphid;
    prevGraphIdRef.current = graphid;

    if (isNewGraph) {
      setLoading(true);
      setError(false);
      setData(null);
      setRefreshing(false);
    } else {
      setRefreshing(true);
    }

    api
      .getDashboardGraphData(graphid, minutes)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
          setRefreshing(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (isNewGraph) { setError(true); setLoading(false); }
          else setRefreshing(false);
        }
      });

    const timer = setInterval(() => {
      setRefreshing(true);
      api
        .getDashboardGraphData(graphid, minutes)
        .then((res) => { if (!cancelled) { setData(res); setRefreshing(false); } })
        .catch(() => { if (!cancelled) setRefreshing(false); });
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [graphid, minutes]);

  // Reset visual zoom whenever the period selector changes (component stays alive, no remount)
  useEffect(() => { chartRef.current?.resetZoom(); }, [minutes]);

  if (loading)
    return <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: 1 }} />;

  if (error)
    return (
      <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed", borderColor: "divider", borderRadius: 1 }}>
        <Typography color="text.secondary" variant="body2">Failed to load data</Typography>
      </Box>
    );

  const noRecordings = !data || data.series.length === 0 || data.series.every((s) => s.points.length === 0);

  if (noRecordings) {
    const currentIdx = PERIOD_OPTIONS.findIndex((o) => o.minutes === minutes);
    const largerOptions = currentIdx >= 0 ? PERIOD_OPTIONS.slice(currentIdx + 1) : [];
    return (
      <Box
        sx={{
          height: "100%",
          bgcolor: chartBg,
          borderRadius: 1.5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1.5,
          p: 3,
        }}
      >
        <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "text.secondary" }}>
          No data in the last {PERIOD_OPTIONS[currentIdx]?.label ?? `${minutes} min`}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "text.disabled", textAlign: "center", maxWidth: 240 }}>
          No recordings in this window. Try a wider range to find when data was last collected.
        </Typography>
        {largerOptions.length > 0 && onPeriodChange && (
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", justifyContent: "center", mt: 0.5 }}>
            {largerOptions.map((opt, i) => (
              <Chip
                key={opt.label}
                label={opt.label}
                size="small"
                clickable
                variant="outlined"
                color="primary"
                onClick={() => onPeriodChange(i + 1)}
                sx={{ fontSize: "0.72rem" }}
              />
            ))}
          </Box>
        )}
      </Box>
    );
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const rangeFrom = nowSec - minutes * 60;

  // Compute per-series stats (last, min, avg, max)
  const seriesStats = data.series.map((s) => {
    const vals = s.points.map((p) => p.value);
    if (vals.length === 0) return { last: null, min: null, avg: null, max: null, units: s.units };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const last = vals[vals.length - 1];
    return { last, min, avg, max, units: s.units || "" };
  });

  const fmtVal = (v: number | null, units: string): string => {
    if (v === null) return "—";
    const abs = Math.abs(v);
    const u = units && units !== "%" ? ` ${units}` : "";
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M${u}`;
    if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K${u}`;
    return `${v % 1 === 0 ? v : v.toFixed(2)}${u}`;
  };

  const unitsLabel = seriesStats[0]?.units || "";

  const maxPoints = Math.max(...data.series.map((s) => s.points.length), 0);
  const sparsePoints = maxPoints <= 20;

  // Map alert events to nearest data point per series using clock proximity.
  // Clock-keyed so results stay accurate after scale format changes.
  type DashEventItem = { x: number; y: number; color: string; sevLabel: string; actualValue: number };
  const eventItems: DashEventItem[] = (() => {
    if (noRecordings) return [];
    const clockMap = new Map<number, DashEventItem>();
    for (const e of alertEvents) {
      if (!data.series.some((s) => s.itemid === e.item_id)) continue;
      if (e.fired_at < rangeFrom || e.fired_at > nowSec) continue;
      const matchingSeries = data.series.find((s) => s.itemid === e.item_id);
      if (!matchingSeries || matchingSeries.points.length === 0) continue;
      const nearest = matchingSeries.points.reduce((best, p) =>
        Math.abs(p.clock - e.fired_at) < Math.abs(best.clock - e.fired_at) ? p : best,
      );
      const existing = clockMap.get(nearest.clock);
      if (!existing || e.severity > (existing as DashEventItem & { severity: number }).severity) {
        clockMap.set(nearest.clock, {
          x: e.fired_at,
          y: nearest.value,
          color: ALERT_SEV_COLORS[e.severity] ?? "#F44336",
          sevLabel: ALERT_SEV_LABELS[e.severity] ?? "Alert",
          actualValue: e.actual_value,
        });
      }
    }
    return [...clockMap.values()];
  })();

  const chartData = {
    datasets: [
      ...data.series.map((s, idx) => {
        const color = (idx === 0 && lineColor) ? lineColor : CHART_COLORS[idx % CHART_COLORS.length];
        const pts = s.points.map((p) => ({ x: p.clock, y: p.value }));
        return {
          label: s.name,
          data: pts,
          borderColor: color,
          backgroundColor: (context: GradientCtx) => {
            const { ctx: c, chartArea } = context.chart;
            if (!chartArea) return `${color}30`;
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, `${color}70`);
            g.addColorStop(0.55, `${color}25`);
            g.addColorStop(1, `${color}00`);
            return g;
          },
          borderWidth: sparsePoints ? 2.5 : 2,
          pointRadius: sparsePoints ? 4 : 0,
          pointBackgroundColor: color,
          pointBorderColor: "#fff",
          pointBorderWidth: sparsePoints ? 1.5 : 0,
          pointHoverRadius: sparsePoints ? 6 : 5,
          pointHoverBackgroundColor: color,
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2,
          tension: 0.3,
          fill: true,
          spanGaps: true,
        };
      }),
      ...(eventItems.length > 0
        ? [
            {
              label: "Alert fired",
              data: eventItems,
              borderColor: "transparent",
              backgroundColor: "transparent",
              pointStyle: "circle" as const,
              pointRadius: 8,
              pointHoverRadius: 10,
              pointBackgroundColor: eventItems.map((e) => e.color),
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              showLine: false,
              fill: false,
              spanGaps: false,
            },
          ]
        : []),
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 } as const,
    interaction: { mode: "nearest" as const, intersect: false, axis: "x" as const },
    plugins: {
      legend: { display: false },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: "x" as const,
          onZoomComplete: ({ chart }: { chart: any }) => {
            if (!onPeriodChange) return;
            const xScale = chart.scales.x;
            const visibleMinutes = (xScale.max - xScale.min) / 60;
            const currentIdx = PERIOD_OPTIONS.findIndex((o) => o.minutes === minutes);
            let closestIdx = 0;
            let closestDiff = Number.POSITIVE_INFINITY;
            PERIOD_OPTIONS.forEach((opt, i) => {
              const diff = Math.abs(opt.minutes - visibleMinutes);
              if (diff < closestDiff) { closestDiff = diff; closestIdx = i; }
            });
            if (currentIdx !== -1 && closestIdx !== currentIdx) {
              onPeriodChange(closestIdx - currentIdx);
            }
          },
        },
        pan: { enabled: true, mode: "x" as const },
      },
      tooltip: {
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 10,
        titleFont: { size: 10, weight: "bold" as const },
        bodyFont: { size: 11 },
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
        cornerRadius: 5,
        displayColors: data.series.length > 1,
        callbacks: {
          title: (items: { raw: unknown }[]) => {
            const raw = items[0]?.raw as { x: number } | undefined;
            if (!raw) return "";
            const d = new Date(raw.x * 1000);
            if (minutes >= 1440) {
              return d.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              });
            }
            return d.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            });
          },
          label: (ctx: {
            dataset: { label?: string };
            datasetIndex: number;
            raw: unknown;
            parsed: { y: number | null };
          }) => {
            const v = ctx.parsed.y;
            if (v === null) return "";
            if (ctx.datasetIndex === data.series.length) {
              const raw = ctx.raw as { x: number };
              const item = eventItems.find((e) => e.x === raw.x);
              if (!item) return "";
              return ` ⚠ ${item.sevLabel}: ${fmtVal(item.actualValue, unitsLabel)}`;
            }
            const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : "";
            return `${label}${fmtVal(v, unitsLabel)}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "linear" as const,
        min: rangeFrom,
        max: nowSec,
        ticks: {
          maxTicksLimit: 6,
          color: tickColor,
          font: { size: 10 },
          maxRotation: 0,
          minRotation: 0,
          callback: (value: string | number) => formatTimestamp(Number(value), minutes),
        },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        title: {
          display: !!unitsLabel,
          text: unitsLabel,
          color: tickColor,
          font: { size: 9 },
          padding: { top: 0, bottom: 2 },
        },
        ticks: {
          color: tickColor,
          font: { size: 10 },
          padding: 6,
          maxTicksLimit: 5,
          callback: (value: number | string) =>
            typeof value === "number" ? fmtVal(value, unitsLabel) : value,
        },
        grid: { color: gridColor, drawTicks: false },
        border: { display: false },
      },
    },
  };

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        bgcolor: chartBg,
        borderRadius: 1.5,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        // Dim slightly while a background refresh is in flight
        opacity: refreshing ? 0.72 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      {/* Live indicator */}
      <Box
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 7,
          height: 7,
          borderRadius: "50%",
          bgcolor: refreshing ? "#FFC107" : "#22C55E",
          zIndex: 1,
          transition: "background-color 0.3s",
          ...(refreshing && {
            animation: "livePulse 0.8s ease-in-out infinite",
            "@keyframes livePulse": {
              "0%": { opacity: 1 },
              "50%": { opacity: 0.3 },
              "100%": { opacity: 1 },
            },
          }),
        }}
      />
      {/* Chart area */}
      <Box sx={{ flex: 1, minHeight: 0, p: "12px 8px 4px 8px" }}>
        <Line
          ref={chartRef}
          data={chartData}
          options={chartOptions}
          onDoubleClick={() => chartRef.current?.resetZoom()}
        />
      </Box>

      {/* Stats bar — time range + Last / Min / Avg / Max per series */}
      <Box
        sx={{
          borderTop: "1px solid",
          borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)",
          px: 1.5,
          py: 0.75,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
        }}
      >
        <Typography sx={{ fontSize: "0.65rem", color: "text.disabled", letterSpacing: "0.02em" }}>
          {formatRangeTime(rangeFrom)} → {formatRangeTime(nowSec)}
        </Typography>
        {data.series.map((s, idx) => {
          const st = seriesStats[idx];
          const color = CHART_COLORS[idx % CHART_COLORS.length];
          return (
            <Box
              key={s.itemid}
              sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 0 }}
            >
              <Box
                sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }}
              />
              {data.series.length > 1 && (
                <Typography
                  noWrap
                  sx={{ fontSize: "0.68rem", color: "text.secondary", minWidth: 0, flexShrink: 1 }}
                >
                  {s.name}
                </Typography>
              )}
              {(["Last", "Min", "Avg", "Max"] as const).map((label, i) => {
                const val = [st.last, st.min, st.avg, st.max][i];
                return (
                  <Box key={label} sx={{ display: "flex", alignItems: "baseline", gap: 0.4 }}>
                    <Typography
                      sx={{
                        fontSize: "0.62rem",
                        color: "text.disabled",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {label}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: label === "Last" ? color : "text.primary",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtVal(val, st.units)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

// ── Add Graph Dialog ──────────────────────────────────────────────────

const AddGraphDialog = ({
  open,
  onClose,
  onAdd,
  existingIds,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (graph: DashboardGraph) => void;
  existingIds: string[];
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [filterTeamId, setFilterTeamId] = useState<number | "">("");
  const [selectedHostId, setSelectedHostId] = useState("");
  const [graphSearch, setGraphSearch] = useState("");
  const [graphs, setGraphs] = useState<DashboardGraph[]>([]);
  const [loadingGraphs, setLoadingGraphs] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFilterTeamId("");
    setSelectedHostId("");
    setGraphSearch("");
    setGraphs([]);
    Promise.all([api.listHosts(), api.getTeamsOverview()]).then(([hostsRes, teamsRes]) => {
      setHosts(hostsRes.hosts);
      setTeams(teamsRes.teams);
    });
  }, [open]);

  // Filter host list by selected team
  const teamHostnames =
    filterTeamId !== "" ? (teams.find((t) => t.id === filterTeamId)?.hosts ?? []) : null;
  const visibleHosts = teamHostnames ? hosts.filter((h) => teamHostnames.includes(h.host)) : hosts;

  // Load graphs when host changes
  useEffect(() => {
    if (!selectedHostId) {
      setGraphs([]);
      return;
    }
    setLoadingGraphs(true);
    api
      .getDashboardGraphs(selectedHostId)
      .then((res) => setGraphs(res.graphs))
      .catch(() => setGraphs([]))
      .finally(() => setLoadingGraphs(false));
  }, [selectedHostId]);

  const filteredGraphs = graphs.filter((g) =>
    g.name.toLowerCase().includes(graphSearch.toLowerCase()),
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography fontWeight={700}>Add Graph</Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0 }}>
        {/* Step 1 — pick host */}
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Typography variant="overline" color="text.secondary">
            Step 1 — Select a host
          </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Filter by team</InputLabel>
            <Select
              label="Filter by team"
              value={filterTeamId}
              onChange={(e) => {
                setFilterTeamId(e.target.value as number | "");
                setSelectedHostId("");
                setGraphs([]);
              }}
            >
              <MenuItem value="">All teams</MenuItem>
              {teams.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Host *</InputLabel>
            <SearchableSelect
              label="Host *"
              value={selectedHostId}
              onChange={(e) => {
                setSelectedHostId(e.target.value);
                setGraphSearch("");
              }}
            >
              <MenuItem value="" disabled>
                Select a host…
              </MenuItem>
              {visibleHosts.map((h) => (
                <MenuItem key={h.hostid} value={h.hostid}>
                  {h.host}
                </MenuItem>
              ))}
            </SearchableSelect>
          </FormControl>
        </Box>

        {/* Step 2 — pick graph */}
        {selectedHostId && (
          <>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: "block", mb: 1 }}
              >
                Step 2 — Select a graph
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="Search graphs…"
                value={graphSearch}
                onChange={(e) => setGraphSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ShowChartOutlinedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Divider />
            {loadingGraphs ? (
              <Box sx={{ p: 2 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                  <Skeleton key={i} variant="text" height={48} sx={{ mb: 0.5 }} />
                ))}
              </Box>
            ) : filteredGraphs.length === 0 ? (
              <Box sx={{ py: 5, textAlign: "center" }}>
                <Typography color="text.secondary" variant="body2">
                  {graphSearch ? "No graphs match your search" : "No graphs found for this host"}
                </Typography>
              </Box>
            ) : (
              <List dense sx={{ maxHeight: 320, overflowY: "auto" }}>
                {filteredGraphs.map((g) => {
                  const added = existingIds.includes(g.graphid);
                  return (
                    <ListItem key={g.graphid} sx={{ opacity: added ? 0.45 : 1 }}>
                      <ListItemText
                        primary={g.name}
                        primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 500 }}
                      />
                      <ListItemSecondaryAction>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={added}
                          onClick={() => {
                            onAdd(g);
                            onClose();
                          }}
                          sx={{ fontSize: "0.72rem", minWidth: 60 }}
                        >
                          {added ? "Added" : "Add"}
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </>
        )}

        {!selectedHostId && (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <Typography color="text.disabled" variant="body2">
              Select a host above to see its graphs
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ── Graph config dialog ───────────────────────────────────────────────

const GraphConfigDialog = ({
  open,
  widget,
  onClose,
  onSave,
}: {
  open: boolean;
  widget: WidgetConfig;
  onClose: () => void;
  onSave: (updates: Partial<WidgetConfig>) => void;
}) => {
  const [title, setTitle] = useState(widget.customTitle ?? "");
  const [lineColor, setLineColor] = useState(widget.lineColor ?? "");

  // Host / graph swap
  const [hosts, setHosts] = useState<Host[]>([]);
  const [newHostId, setNewHostId] = useState("");
  const [newGraphs, setNewGraphs] = useState<DashboardGraph[]>([]);
  const [graphsLoading, setGraphsLoading] = useState(false);
  const [newGraphId, setNewGraphId] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(widget.customTitle ?? "");
      setLineColor(widget.lineColor ?? "");
      setNewHostId(widget.hostId ?? "");
      setNewGraphs([]);
      setNewGraphId("");
      api.listHosts().then((r) => setHosts(r.hosts)).catch(() => {});
    }
  }, [open, widget.customTitle, widget.lineColor, widget.hostId]);

  useEffect(() => {
    if (!newHostId) { setNewGraphs([]); setNewGraphId(""); return; }
    setGraphsLoading(true);
    setNewGraphId("");
    api.getDashboardGraphs(newHostId)
      .then((r) => setNewGraphs(r.graphs))
      .catch(() => setNewGraphs([]))
      .finally(() => setGraphsLoading(false));
  }, [newHostId]);

  const handleSave = () => {
    const updates: Partial<WidgetConfig> = {
      customTitle: title.trim() || undefined,
      lineColor: lineColor || undefined,
    };
    if (newGraphId) {
      const g = newGraphs.find((g) => g.graphid === newGraphId);
      if (g) {
        updates.graphid = g.graphid;
        updates.graphName = g.name;
        const host = g.hosts[0];
        if (host) { updates.hostId = host.hostid; updates.hostName = host.host; }
        // Reset custom title when swapping to a new graph
        if (!title.trim()) updates.customTitle = undefined;
      }
    }
    onSave(updates);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography fontWeight={700}>Configure Graph</Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Box>
            <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.5 }}>
              Current graph
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {widget.customTitle ?? widget.graphName}
            </Typography>
            {widget.hostName && (
              <Typography variant="caption" color="text.secondary">
                Host: {widget.hostName}
              </Typography>
            )}
          </Box>
          <TextField
            size="small"
            label="Custom title"
            placeholder={widget.graphName}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            helperText="Leave blank to use the graph name"
          />
          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: "text.secondary", fontSize: "0.78rem" }}>
              Accent color (first series)
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              {PRESET_COLORS.map((c) => (
                <Box
                  key={c}
                  onClick={() => setLineColor(lineColor === c ? "" : c)}
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    bgcolor: c,
                    cursor: "pointer",
                    border: lineColor === c ? "2px solid white" : "2px solid transparent",
                    outline: lineColor === c ? `2px solid ${c}` : "none",
                    transition: "transform 0.12s",
                    "&:hover": { transform: "scale(1.25)" },
                  }}
                />
              ))}
              {lineColor && (
                <Typography
                  variant="caption"
                  onClick={() => setLineColor("")}
                  sx={{ color: "text.disabled", cursor: "pointer", "&:hover": { color: "text.primary" } }}
                >
                  Reset
                </Typography>
              )}
            </Box>
          </Box>
          <Divider />
          <Box>
            <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600, fontSize: "0.8rem" }}>
              Change host / graph
            </Typography>
            <Stack spacing={1.5}>
              <FormControl size="small" fullWidth>
                <InputLabel>Host</InputLabel>
                <SearchableSelect
                  label="Host"
                  value={newHostId}
                  onChange={(e) => setNewHostId(e.target.value)}
                >
                  <MenuItem value="">
                    <Typography sx={{ color: "text.disabled", fontSize: "0.82rem" }}>
                      Select a host…
                    </Typography>
                  </MenuItem>
                  {hosts.map((h) => (
                    <MenuItem key={h.hostid} value={h.hostid}>
                      {h.host}
                    </MenuItem>
                  ))}
                </SearchableSelect>
              </FormControl>
              {newHostId && (
                <FormControl size="small" fullWidth>
                  <InputLabel>Graph</InputLabel>
                  <Select
                    label="Graph"
                    value={newGraphId}
                    onChange={(e) => setNewGraphId(e.target.value)}
                    disabled={graphsLoading}
                  >
                    {graphsLoading ? (
                      <MenuItem value="" disabled>Loading…</MenuItem>
                    ) : newGraphs.length === 0 ? (
                      <MenuItem value="" disabled>No graphs found for this host</MenuItem>
                    ) : (
                      newGraphs.map((g) => (
                        <MenuItem key={g.graphid} value={g.graphid}>
                          {g.name}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Widget card ───────────────────────────────────────────────────────

const WidgetCard = ({
  widget,
  onRemove,
  onUpdate,
  alertEvents = [],
}: {
  widget: WidgetConfig;
  onRemove: () => void;
  onUpdate: (updates: Partial<WidgetConfig>) => void;
  alertEvents?: AlertEvent[];
}) => {
  const periodOption = PERIOD_OPTIONS[widget.periodIdx] ?? PERIOD_OPTIONS[5];
  const [configOpen, setConfigOpen] = useState(false);
  const displayTitle = widget.customTitle ?? widget.graphName;

  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: 6 },
      }}
    >
      {/* Header row — drag zone is only the left side so controls remain clickable */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          bgcolor: "action.hover",
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
          px: 0.5,
        }}
      >
        {/* Draggable area */}
        <Box
          className="drag-handle"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flex: 1,
            minWidth: 0,
            py: 0.75,
            px: 1,
            cursor: "grab",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 14, color: "text.disabled", flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0, ml: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontSize: "0.8rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: "-0.01em",
              }}
              title={displayTitle}
            >
              {displayTitle}
            </Typography>
            {widget.hostName && (
              <Typography
                variant="caption"
                sx={{ fontSize: "0.65rem", color: "text.secondary", display: "block", lineHeight: 1 }}
              >
                {widget.hostName}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Controls — outside drag zone so clicks register */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0, pr: 0.5 }}>
          <Select
            variant="standard"
            value={widget.periodIdx}
            onChange={(e) => onUpdate({ periodIdx: Number(e.target.value) })}
            sx={{
              fontSize: "0.68rem",
              color: "text.secondary",
              "&:before, &:after": { display: "none" },
              "& .MuiSelect-select": { py: 0, pr: "18px !important", pl: 0.5 },
              "& .MuiSvgIcon-root": { fontSize: 14, right: 0 },
            }}
          >
            {PERIOD_OPTIONS.map((opt, i) => (
              <MenuItem key={opt.label} value={i} sx={{ fontSize: "0.72rem" }}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
          <Tooltip title="Configure graph">
            <IconButton
              size="small"
              onClick={() => setConfigOpen(true)}
              sx={{ color: "text.disabled", "&:hover": { color: "primary.light" }, p: 0.3 }}
            >
              <TuneIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            onClick={onRemove}
            sx={{
              color: "text.disabled",
              "&:hover": { color: "error.light" },
              p: 0.3,
            }}
          >
            <CloseIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, p: 1.5, overflow: "hidden" }}>
        <ChartJsGraph
          key={widget.graphid}
          graphid={widget.graphid}
          minutes={periodOption.minutes}
          alertEvents={alertEvents}
          lineColor={widget.lineColor}
          onPeriodChange={(delta) =>
            onUpdate({
              periodIdx: Math.max(0, Math.min(PERIOD_OPTIONS.length - 1, widget.periodIdx + delta)),
            })
          }
        />
      </Box>

      <GraphConfigDialog
        open={configOpen}
        widget={widget}
        onClose={() => setConfigOpen(false)}
        onSave={(updates) => onUpdate(updates)}
      />
    </Paper>
  );
};

// ── Tab panels ────────────────────────────────────────────────────────

const GraphsTab = () => {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saveScope, setSaveScope] = useState<"user" | "team">("user");
  const [dashboards, setDashboards] = useState<DashboardMeta[]>([]);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [allAlertEvents, setAllAlertEvents] = useState<AlertEvent[]>([]);
  const [newDashOpen, setNewDashOpen] = useState(false);
  const [newDashName, setNewDashName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dashBusy, setDashBusy] = useState(false);

  useEffect(() => {
    const fetchEvents = () => {
      api
        .getAlertEvents(500)
        .then((r) => setAllAlertEvents(r.events))
        .catch(() => {});
    };
    fetchEvents();
    const timer = setInterval(fetchEvents, 10_000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboards = useCallback((scope: "user" | "team", preferredPage?: string) => {
    return api.listDashboards(scope).then((res) => {
      const list = res.dashboards ?? [];
      setDashboards(list);
      const target =
        preferredPage && list.some((d) => d.page === preferredPage)
          ? preferredPage
          : (list[0]?.page ?? "dashboard");
      setCurrentPage(target);
      return api.getDashboardLayout(scope, target).then((res2) => {
        setWidgets(res2.widgets ?? []);
        setIsDirty(false);
      });
    });
  }, []);

  useEffect(() => {
    loadDashboards("user")
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [loadDashboards]);

  const currentDashboard = dashboards.find((d) => d.page === currentPage);
  const currentName = currentDashboard?.name ?? "Dashboard";

  const handleCreateDashboard = useCallback(async () => {
    const name = newDashName.trim();
    if (!name) return;
    setDashBusy(true);
    try {
      const res = await api.createDashboard(saveScope, name);
      await loadDashboards(saveScope, res.page);
      setNewDashOpen(false);
      setNewDashName("");
    } catch {
      // silently fail — user can retry
    } finally {
      setDashBusy(false);
    }
  }, [newDashName, saveScope, loadDashboards]);

  const handleRenameDashboard = useCallback(async () => {
    const name = renameValue.trim();
    if (!name) return;
    setDashBusy(true);
    try {
      await api.renameDashboard(saveScope, currentPage, name);
      await loadDashboards(saveScope, currentPage);
      setRenameOpen(false);
    } catch {
      // silently fail — user can retry
    } finally {
      setDashBusy(false);
    }
  }, [renameValue, saveScope, currentPage, loadDashboards]);

  const handleDeleteDashboard = useCallback(async () => {
    setDashBusy(true);
    try {
      await api.deleteDashboard(saveScope, currentPage);
      await loadDashboards(saveScope);
      setDeleteConfirmOpen(false);
    } catch {
      // silently fail — user can retry
    } finally {
      setDashBusy(false);
    }
  }, [saveScope, currentPage, loadDashboards]);

  const handleLayoutChange = useCallback(
    (layout: { i: string; x: number; y: number; w: number; h: number }[]) => {
      setWidgets((prev) => {
        const next = prev.map((w) => {
          const l = layout.find((item) => item.i === w.i);
          return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w;
        });
        const moved = next.some((w, i) => {
          const o = prev[i];
          return o && (w.x !== o.x || w.y !== o.y || w.w !== o.w || w.h !== o.h);
        });
        if (moved) setIsDirty(true);
        return next;
      });
    },
    [],
  );

  const addWidget = useCallback((graph: DashboardGraph) => {
    setWidgets((prev) => {
      const col = prev.length % 2 === 0 ? 0 : 6;
      const row = Math.floor(prev.length / 2) * 4;
      const widget: WidgetConfig = {
        i: `${graph.graphid}-${Date.now()}`,
        graphid: graph.graphid,
        graphName: graph.name,
        hostId: graph.hosts[0]?.hostid,
        hostName: graph.hosts[0]?.host,
        mode: "chartjs",
        periodIdx: 5,
        x: col,
        y: row,
        w: 6,
        h: 4,
      };
      return [...prev, widget];
    });
    setIsDirty(true);
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.i !== id));
    setIsDirty(true);
  }, []);

  const updateWidget = useCallback((id: string, updates: Partial<WidgetConfig>) => {
    setWidgets((prev) => prev.map((w) => (w.i === id ? { ...w, ...updates } : w)));
    setIsDirty(true);
  }, []);

  const saveLayout = useCallback(async () => {
    setSaving(true);
    try {
      await api.saveDashboardLayout(saveScope, widgets, currentPage);
      setIsDirty(false);
    } catch {
      // silently fail — user can retry
    } finally {
      setSaving(false);
    }
  }, [saveScope, widgets, currentPage]);

  const layout = widgets.map((w) => ({
    i: w.i,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
    minW: 2,
    minH: 3,
  }));

  const existingIds = widgets.map((w) => w.graphid);

  if (!loaded) {
    return (
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          <Skeleton key={i} variant="rectangular" height={320} sx={{ borderRadius: 1 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
          Graphs
        </Typography>
        {widgets.length > 0 && (
          <Chip
            label={widgets.length}
            size="small"
            sx={{ height: 18, fontSize: "0.68rem", minWidth: 24 }}
          />
        )}

        <Select
          size="small"
          value={currentPage}
          onChange={(e) => {
            const page = e.target.value as string;
            setCurrentPage(page);
            api
              .getDashboardLayout(saveScope, page)
              .then((res) => {
                setWidgets(res.widgets ?? []);
                setIsDirty(false);
              })
              .catch(() => {});
          }}
          sx={{
            fontSize: "0.72rem",
            height: 28,
            ml: 1,
            minWidth: 130,
            "& .MuiSelect-select": { py: 0, px: 1, lineHeight: "28px" },
          }}
        >
          {dashboards.map((d) => (
            <MenuItem key={d.page} value={d.page} sx={{ fontSize: "0.78rem" }}>
              {d.name}
            </MenuItem>
          ))}
        </Select>
        <Tooltip title="New dashboard">
          <IconButton
            size="small"
            onClick={() => {
              setNewDashName("");
              setNewDashOpen(true);
            }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Rename dashboard">
          <IconButton
            size="small"
            onClick={() => {
              setRenameValue(currentName);
              setRenameOpen(true);
            }}
          >
            <EditOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip
          title={dashboards.length <= 1 ? "At least one dashboard is required" : "Delete dashboard"}
        >
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={dashboards.length <= 1}
            >
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ flex: 1 }} />
        <Tooltip title="Add graph">
          <IconButton size="small" color="primary" onClick={() => setAddOpen(true)}>
            <AddIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
        <Select
          size="small"
          value={saveScope}
          onChange={(e) => {
            const newScope = e.target.value as "user" | "team";
            setSaveScope(newScope);
            loadDashboards(newScope).catch(() => {});
          }}
          sx={{
            fontSize: "0.72rem",
            height: 28,
            "& .MuiSelect-select": { py: 0, px: 1, lineHeight: "28px" },
          }}
        >
          <MenuItem value="user" sx={{ fontSize: "0.78rem" }}>
            Mine
          </MenuItem>
          <MenuItem value="team" sx={{ fontSize: "0.78rem" }}>
            Team
          </MenuItem>
        </Select>
        <Tooltip title={saving ? "Saving…" : isDirty ? "Save layout" : "Layout saved"}>
          <span>
            <IconButton
              size="small"
              color={isDirty ? "warning" : "default"}
              onClick={saveLayout}
              disabled={!isDirty || saving}
            >
              <SaveIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Empty state */}
      {widgets.length === 0 ? (
        <Box
          sx={{
            py: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <ShowChartOutlinedIcon sx={{ fontSize: 48, color: "text.disabled" }} />
          <Typography color="text.secondary" variant="body2">
            No graphs added yet
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
          >
            Add your first graph
          </Button>
        </Box>
      ) : (
        <GridLayout
          layout={layout}
          cols={12}
          rowHeight={80}
          draggableHandle=".drag-handle"
          onLayoutChange={handleLayoutChange}
          style={{ minHeight: 200 }}
        >
          {widgets.map((w) => (
            <div key={w.i}>
              <WidgetCard
                widget={w}
                onRemove={() => removeWidget(w.i)}
                onUpdate={(updates) => updateWidget(w.i, updates)}
                alertEvents={allAlertEvents}
              />
            </div>
          ))}
        </GridLayout>
      )}

      <AddGraphDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addWidget}
        existingIds={existingIds}
      />

      <Dialog open={newDashOpen} onClose={() => setNewDashOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New dashboard</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Dashboard name"
            value={newDashName}
            onChange={(e) => setNewDashName(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateDashboard();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDashOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateDashboard}
            disabled={!newDashName.trim() || dashBusy}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename dashboard</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Dashboard name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameDashboard();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleRenameDashboard}
            disabled={!renameValue.trim() || dashBusy}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete dashboard</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Delete "{currentName}" and all of its graphs? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteDashboard}
            disabled={dashBusy}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const HostMetricsTab = () => {
  const [hosts, setHosts] = useState<HostMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api
      .getHostsMetrics()
      .then((res) => {
        setHosts(res.hosts);
        setLastUpdated(new Date());
      })
      .catch(() => setHosts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 10_000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = hosts.filter((h) => h.hostname.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
        <TextField
          size="small"
          placeholder="Filter hosts…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <Tooltip title="Refresh now">
          <IconButton size="small" onClick={() => load(false)} disabled={loading}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        {lastUpdated && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.7rem" }}>
            Updated{" "}
            {lastUpdated.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })}
          </Typography>
        )}
        {!loading && (
          <Chip
            label={`${filtered.length} host${filtered.length !== 1 ? "s" : ""}`}
            size="small"
            sx={{ fontSize: "0.72rem" }}
          />
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Host</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 110 }}>CPU</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 110 }}>
                Memory
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 110 }}>
                Disk /
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                    <TableCell key={j}>
                      <Skeleton variant="text" height={20} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  {filter ? "No hosts match filter" : "No hosts found"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((h) => (
                <TableRow key={h.hostid} sx={{ "&:hover": { backgroundColor: "action.hover" } }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: "0.8rem", fontWeight: 500 }}>
                      {h.hostname}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <MetricBar value={h.cpu_util} label="CPU" />
                  </TableCell>
                  <TableCell>
                    <MetricBar value={h.mem_util} label="Memory" />
                  </TableCell>
                  <TableCell>
                    <MetricBar value={h.disk_util} label="Disk /" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

const RecentItemsTab = () => {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getRecentItems(50)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
          Most recently created monitoring items across all hosts
        </Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load} disabled={loading}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 160 }}>Host</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Item</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 200 }}>Key</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 110 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Last value
                  <Tooltip title="The most recently collected value for this item. Zabbix polls each item on its configured interval and stores the result — this is the latest reading, not an average.">
                    <InfoOutlinedIcon
                      sx={{ fontSize: 13, color: "text.disabled", cursor: "help" }}
                    />
                  </Tooltip>
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 90 }}>
                Updated
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 90 }}>
                Interval
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                    <TableCell key={j}>
                      <Skeleton variant="text" height={20} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  No items found
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.itemid} sx={{ "&:hover": { backgroundColor: "action.hover" } }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: "0.8rem", fontWeight: 500 }}>
                      {item.hostname}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                      {item.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: "0.68rem" }}
                    >
                      {VALUE_TYPE_LABELS[item.value_type] ?? item.value_type}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Tooltip title={item.key_} placement="top">
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: "0.72rem",
                          fontFamily: "monospace",
                          color: "text.secondary",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.key_}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: "0.8rem", fontWeight: 500 }}>
                      {item.lastvalue
                        ? `${item.lastvalue}${item.units ? ` ${item.units}` : ""}`
                        : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontSize: "0.75rem", color: "text.secondary" }}
                    >
                      {formatLastSeen(item.lastclock)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.delay}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.68rem" }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

// ── Main export ───────────────────────────────────────────────────────

export const Dashboard = () => {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <ShowChartOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
          <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -0.5 }}>
            Dashboard
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          Zabbix graphs, host metrics, and monitoring activity
        </Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="Graphs" sx={{ fontSize: "0.82rem", textTransform: "none", minHeight: 40 }} />
        <Tab
          label="Host Metrics"
          sx={{ fontSize: "0.82rem", textTransform: "none", minHeight: 40 }}
        />
        <Tab
          label="Recent Items"
          sx={{ fontSize: "0.82rem", textTransform: "none", minHeight: 40 }}
        />
      </Tabs>

      {tab === 0 && <GraphsTab />}
      {tab === 1 && <HostMetricsTab />}
      {tab === 2 && <RecentItemsTab />}
    </Box>
  );
};
