"use client";
import { Box, Chip, Skeleton, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { Chart as ChartJS } from "chart.js";
import { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import { type AlertEvent, api, type GraphData, type Problem } from "../../app/api";
import { formatDateTime, formatTime } from "../../app/datetime";
import { formatSizeValue, isByteUnit } from "../../app/utils";
import { formatRangeTime, formatTimestamp, PERIOD_OPTIONS } from "./shared";

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

type DashEventItem = {
  x: number;
  y: number;
  color: string;
  sevLabel: string;
  actualValue: number;
};

type DashProblemItem = { x: number; y: number; color: string; sevLabel: string; name: string };

const fmtVal = (v: number | null, units: string): string => {
  if (v === null) {
    return "—";
  }
  if (isByteUnit(units)) {
    return formatSizeValue(v, units);
  }
  const abs = Math.abs(v);
  const u = units && units !== "%" ? ` ${units}` : "";
  if (abs >= 1_000_000) {
    return `${(v / 1_000_000).toFixed(2)}M${u}`;
  }
  if (abs >= 1_000) {
    return `${(v / 1_000).toFixed(1)}K${u}`;
  }
  return `${v % 1 === 0 ? v : v.toFixed(2)}${u}`;
};

// Map alert events to nearest data point per series using clock proximity.
// Clock-keyed so results stay accurate after scale format changes.
const buildEventItems = (
  data: GraphData,
  alertEvents: AlertEvent[],
  rangeFrom: number,
  nowSec: number,
): DashEventItem[] => {
  const clockMap = new Map<number, DashEventItem & { severity: number }>();
  for (const e of alertEvents) {
    if (!data.series.some((s) => s.itemid === e.item_id)) {
      continue;
    }
    if (e.fired_at < rangeFrom || e.fired_at > nowSec) {
      continue;
    }
    const matchingSeries = data.series.find((s) => s.itemid === e.item_id);
    if (!matchingSeries || matchingSeries.points.length === 0) {
      continue;
    }
    const nearest = matchingSeries.points.reduce((best, p) =>
      Math.abs(p.clock - e.fired_at) < Math.abs(best.clock - e.fired_at) ? p : best,
    );
    const existing = clockMap.get(nearest.clock);
    if (!existing || e.severity > existing.severity) {
      clockMap.set(nearest.clock, {
        x: e.fired_at,
        y: nearest.value,
        color: ALERT_SEV_COLORS[e.severity] ?? "#F44336",
        sevLabel: ALERT_SEV_LABELS[e.severity] ?? "Alert",
        actualValue: e.actual_value,
        severity: e.severity,
      });
    }
  }
  return [...clockMap.values()];
};

// Native Zabbix problems aren't tied to a single item, so anchor them to
// the graph's primary (first) series — matched by clock proximity.
const buildProblemItems = (
  data: GraphData,
  problems: Problem[],
  rangeFrom: number,
  nowSec: number,
): DashProblemItem[] => {
  const primarySeries = data.series[0];
  if (!primarySeries || primarySeries.points.length === 0) {
    return [];
  }
  const clockMap = new Map<number, DashProblemItem & { severity: number }>();
  for (const p of problems) {
    if (p.clock < rangeFrom || p.clock > nowSec) {
      continue;
    }
    const nearest = primarySeries.points.reduce((best, pt) =>
      Math.abs(pt.clock - p.clock) < Math.abs(best.clock - p.clock) ? pt : best,
    );
    const existing = clockMap.get(nearest.clock);
    if (!existing || p.severity > existing.severity) {
      clockMap.set(nearest.clock, {
        x: p.clock,
        y: nearest.value,
        color: ALERT_SEV_COLORS[p.severity] ?? "#F44336",
        sevLabel: p.severity_name,
        name: p.name,
        severity: p.severity,
      });
    }
  }
  return [...clockMap.values()];
};

const formatDashTooltipTitle = (items: { raw: unknown }[], minutes: number): string => {
  const raw = items[0]?.raw as { x: number } | undefined;
  if (!raw) {
    return "";
  }
  // Tooltips show the precise moment a point was sampled, so always include seconds.
  return minutes >= 1440 ? formatDateTime(raw.x) : formatTime(raw.x);
};

const computeSeriesStats = (series: GraphData["series"]) =>
  series.map((s) => {
    const vals = s.points.map((p) => p.value);
    if (vals.length === 0) {
      return { last: null, min: null, avg: null, max: null, units: s.units };
    }
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const last = vals[vals.length - 1];
    return { last, min, avg, max, units: s.units || "" };
  });

const NoDashDataFallback = ({
  minutes,
  chartBg,
  onPeriodChange,
}: {
  minutes: number;
  chartBg: string;
  onPeriodChange?: (delta: number) => void;
}) => {
  const currentIdx = PERIOD_OPTIONS.findIndex((o) => o.minutes === minutes);
  const largerOptions = currentIdx >= 0 ? PERIOD_OPTIONS.slice(currentIdx + 1) : [];
  return (
    <Box
      sx={{
        height: "100%",
        bgcolor: chartBg,
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
      <Typography
        sx={{ fontSize: "0.75rem", color: "text.disabled", textAlign: "center", maxWidth: 240 }}
      >
        No recordings in this window. Try a wider range to find when data was last collected.
      </Typography>
      {largerOptions.length > 0 && onPeriodChange && (
        <Box
          sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", justifyContent: "center", mt: 0.5 }}
        >
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
};

const buildDashChartDatasets = ({
  series,
  lineColor,
  sparsePoints,
  eventItems,
  problemItems,
}: {
  series: GraphData["series"];
  lineColor: string | undefined;
  sparsePoints: boolean;
  eventItems: DashEventItem[];
  problemItems: DashProblemItem[];
}) => [
  ...series.map((s, idx) => {
    const color = idx === 0 && lineColor ? lineColor : CHART_COLORS[idx % CHART_COLORS.length];
    const pts = s.points.map((p) => ({ x: p.clock, y: p.value }));
    return {
      label: s.name,
      data: pts,
      borderColor: color,
      backgroundColor: (context: GradientCtx) => {
        const { ctx: c, chartArea } = context.chart;
        if (!chartArea) {
          return `${color}30`;
        }
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
  ...(problemItems.length > 0
    ? [
        {
          label: "Problem",
          data: problemItems,
          borderColor: "transparent",
          backgroundColor: "transparent",
          pointStyle: "triangle" as const,
          pointRadius: 8,
          pointHoverRadius: 10,
          pointBackgroundColor: problemItems.map((p) => p.color),
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          showLine: false,
          fill: false,
          spanGaps: false,
        },
      ]
    : []),
];

type SeriesStat = {
  last: number | null;
  min: number | null;
  avg: number | null;
  max: number | null;
  units: string;
};

const SeriesStatRow = ({
  series,
  stat,
  color,
  multiSeries,
}: {
  series: GraphData["series"][number];
  stat: SeriesStat;
  color: string;
  multiSeries: boolean;
}) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 0 }}>
    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
    {multiSeries && (
      <Typography
        noWrap
        sx={{ fontSize: "0.68rem", color: "text.secondary", minWidth: 0, flexShrink: 1 }}
      >
        {series.name}
      </Typography>
    )}
    {(["Last", "Min", "Avg", "Max"] as const).map((label, i) => {
      const val = [stat.last, stat.min, stat.avg, stat.max][i];
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
            {fmtVal(val ?? null, stat.units)}
          </Typography>
        </Box>
      );
    })}
  </Box>
);

const SeriesStatsBar = ({
  series,
  seriesStats,
  rangeFrom,
  nowSec,
  isDark,
}: {
  series: GraphData["series"];
  seriesStats: SeriesStat[];
  rangeFrom: number;
  nowSec: number;
  isDark: boolean;
}) => (
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
    {series.map((s, idx) => (
      <SeriesStatRow
        key={s.itemid}
        series={s}
        stat={seriesStats[idx] as SeriesStat}
        color={CHART_COLORS[idx % CHART_COLORS.length] as string}
        multiSeries={series.length > 1}
      />
    ))}
  </Box>
);

const formatDashTooltipLabel = (
  ctx: { dataset: { label?: string }; raw: unknown; parsed: { y: number | null } },
  eventItems: DashEventItem[],
  problemItems: DashProblemItem[],
  unitsLabel: string,
): string => {
  const v = ctx.parsed.y;
  if (v === null) {
    return "";
  }
  const raw = ctx.raw as { x: number };
  if (ctx.dataset.label === "Alert fired") {
    const item = eventItems.find((e) => e.x === raw.x);
    return item ? ` ⚠ ${item.sevLabel}: ${fmtVal(item.actualValue, unitsLabel)}` : "";
  }
  if (ctx.dataset.label === "Problem") {
    const item = problemItems.find((p) => p.x === raw.x);
    return item ? ` ⛔ ${item.sevLabel}: ${item.name}` : "";
  }
  const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : "";
  return `${label}${fmtVal(v, unitsLabel)}`;
};

// Renders a Chart.js line chart from graph history data
export const ChartJsGraph = ({
  graphid,
  minutes,
  alertEvents = [],
  problems = [],
  lineColor,
  onPeriodChange,
}: {
  graphid: string;
  minutes: number;
  alertEvents?: AlertEvent[];
  problems?: Problem[];
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
          if (isNewGraph) {
            setError(true);
            setLoading(false);
          } else {
            setRefreshing(false);
          }
        }
      });

    const timer = setInterval(() => {
      setRefreshing(true);
      api
        .getDashboardGraphData(graphid, minutes)
        .then((res) => {
          if (!cancelled) {
            setData(res);
            setRefreshing(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRefreshing(false);
          }
        });
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [graphid, minutes]);

  // Reset visual zoom whenever the period selector changes (component stays alive, no remount)
  // biome-ignore lint/correctness/useExhaustiveDependencies: minutes is a deliberate re-run trigger, not read in the body
  useEffect(() => {
    chartRef.current?.resetZoom();
  }, [minutes]);

  if (loading) {
    return <Skeleton variant="rectangular" width="100%" height="100%" sx={{}} />;
  }

  if (error) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed",
          borderColor: "divider",
        }}
      >
        <Typography color="text.secondary" variant="body2">
          Failed to load data
        </Typography>
      </Box>
    );
  }

  const noRecordings =
    !data || data.series.length === 0 || data.series.every((s) => s.points.length === 0);

  if (noRecordings) {
    return (
      <NoDashDataFallback minutes={minutes} chartBg={chartBg} onPeriodChange={onPeriodChange} />
    );
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const rangeFrom = nowSec - minutes * 60;

  // Compute per-series stats (last, min, avg, max)
  const seriesStats = computeSeriesStats(data.series);

  const unitsLabel = seriesStats[0]?.units || "";

  const maxPoints = Math.max(...data.series.map((s) => s.points.length), 0);
  const sparsePoints = maxPoints <= 20;

  const eventItems = buildEventItems(data, alertEvents, rangeFrom, nowSec);
  const problemItems = buildProblemItems(data, problems, rangeFrom, nowSec);

  const chartData = {
    datasets: buildDashChartDatasets({
      series: data.series,
      lineColor,
      sparsePoints,
      eventItems,
      problemItems,
    }),
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
          onZoomComplete: ({ chart }: { chart: ChartJS }) => {
            if (!onPeriodChange) {
              return;
            }
            const xScale = chart.scales.x;
            const visibleMinutes = (xScale.max - xScale.min) / 60;
            const currentIdx = PERIOD_OPTIONS.findIndex((o) => o.minutes === minutes);
            let closestIdx = 0;
            let closestDiff = Number.POSITIVE_INFINITY;
            PERIOD_OPTIONS.forEach((opt, i) => {
              const diff = Math.abs(opt.minutes - visibleMinutes);
              if (diff < closestDiff) {
                closestDiff = diff;
                closestIdx = i;
              }
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
          title: (items: { raw: unknown }[]) => formatDashTooltipTitle(items, minutes),
          label: (ctx: {
            dataset: { label?: string };
            raw: unknown;
            parsed: { y: number | null };
          }) => formatDashTooltipLabel(ctx, eventItems, problemItems, unitsLabel),
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
      <SeriesStatsBar
        series={data.series}
        seriesStats={seriesStats}
        rangeFrom={rangeFrom}
        nowSec={nowSec}
        isDark={isDark}
      />
    </Box>
  );
};
