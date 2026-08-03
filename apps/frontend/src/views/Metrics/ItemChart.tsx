"use client";
import { Box, Chip, Skeleton, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  CategoryScale,
  Chart as ChartJS,
  Tooltip as ChartTooltip,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
} from "chart.js";
import ZoomPlugin from "chartjs-plugin-zoom";
import { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import { type AlertEvent, api, type HistoryPoint, type ItemHistory } from "../../app/api";
import { formatDateTimeCompact, formatTime, formatTimeShort } from "../../app/datetime";
import { formatSizeValue } from "../../app/utils";
import { formatTimestamp, PERIOD_OPTIONS, SEVERITY_CONFIG } from "./shared";

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

const metricsGlowPlugin = {
  id: "metricsGlow",
  beforeDatasetDraw: (
    chart: { ctx: CanvasRenderingContext2D; data: { datasets: { borderColor?: unknown }[] } },
    args: { index: number },
  ) => {
    const color = chart.data.datasets[args.index]?.borderColor;
    if (typeof color !== "string") {
      return;
    }
    chart.ctx.save();
    chart.ctx.shadowBlur = 14;
    chart.ctx.shadowColor = color;
  },
  afterDatasetDraw: (chart: { ctx: CanvasRenderingContext2D }) => {
    chart.ctx.restore();
  },
};

type ChartEventItem = {
  firedAt: number;
  y: number;
  color: string;
  sevLabel: string;
  actualValue: number;
  severity: number;
};

const buildEventItems = (
  alertEvents: AlertEvent[],
  data: ItemHistory,
  rangeFrom: number,
  nowSec: number,
): ChartEventItem[] => {
  const clockMap = new Map<number, ChartEventItem>();
  for (const e of alertEvents) {
    if (e.fired_at < rangeFrom || e.fired_at > nowSec) {
      continue;
    }
    const nearest = data.history.reduce((best, p) =>
      Math.abs(p.clock - e.fired_at) < Math.abs(best.clock - e.fired_at) ? p : best,
    );
    const existing = clockMap.get(nearest.clock);
    if (!existing || e.severity > existing.severity) {
      clockMap.set(nearest.clock, {
        firedAt: e.fired_at,
        y: nearest.value,
        color: SEVERITY_CONFIG.find((s) => s.severity === e.severity)?.color ?? "#E9695C",
        sevLabel: SEVERITY_CONFIG.find((s) => s.severity === e.severity)?.label ?? "Alert",
        actualValue: e.actual_value,
        severity: e.severity,
      });
    }
  }
  return [...clockMap.values()];
};

const findClosestPeriodIndex = (visibleMinutes: number): number => {
  let closestIdx = 0;
  let closestDiff = Number.POSITIVE_INFINITY;
  PERIOD_OPTIONS.forEach((opt, i) => {
    const diff = Math.abs(opt.minutes - visibleMinutes);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIdx = i;
    }
  });
  return closestIdx;
};

const buildLineGradient = (
  context: {
    chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } };
  },
  lineColor: string,
) => {
  const { ctx: c, chartArea } = context.chart;
  if (!chartArea) {
    return `${lineColor}26`;
  }
  const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, `${lineColor}66`);
  g.addColorStop(0.5, `${lineColor}1A`);
  g.addColorStop(1, `${lineColor}00`);
  return g;
};

const buildChartData = (
  itemName: string,
  historyPoints: HistoryPoint[],
  lineColor: string,
  sparsePoints: boolean,
  eventItems: ChartEventItem[],
) => ({
  datasets: [
    {
      label: itemName,
      data: historyPoints.map((p) => ({ x: p.clock, y: p.value })),
      borderColor: lineColor,
      backgroundColor: (context: {
        chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } };
      }) => buildLineGradient(context, lineColor),
      borderWidth: sparsePoints ? 2.5 : 2,
      pointRadius: sparsePoints ? 4 : 2,
      pointBackgroundColor: lineColor,
      pointBorderColor: "#fff",
      pointBorderWidth: sparsePoints ? 1.5 : 1,
      pointHoverRadius: 7,
      pointHoverBackgroundColor: lineColor,
      pointHoverBorderColor: "#fff",
      pointHoverBorderWidth: 2,
      tension: 0.35,
      fill: true,
      spanGaps: true,
    },
    ...(eventItems.length > 0
      ? [
          {
            label: "Alert fired",
            data: eventItems.map((e) => ({ x: e.firedAt, y: e.y })),
            borderColor: "transparent",
            backgroundColor: "transparent",
            pointStyle: "circle" as const,
            pointRadius: 8,
            pointHoverRadius: 12,
            pointHitRadius: 16,
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
});

const handleZoomComplete = (
  chart: ChartJS,
  minutes: number,
  onPeriodChange: ((delta: number) => void) | undefined,
) => {
  if (!onPeriodChange) {
    return;
  }
  const xScale = chart.scales.x;
  const visibleMinutes = (xScale.max - xScale.min) / 60;
  const currentIdx = PERIOD_OPTIONS.findIndex((o) => o.minutes === minutes);
  const closestIdx = findClosestPeriodIndex(visibleMinutes);
  if (currentIdx !== -1 && closestIdx !== currentIdx) {
    onPeriodChange(closestIdx - currentIdx);
  }
};

const buildChartOptions = ({
  rangeFrom,
  nowSec,
  minutes,
  isDark,
  tickColor,
  gridColor,
  eventItems,
  dataUnits,
  onPeriodChange,
}: {
  rangeFrom: number;
  nowSec: number;
  minutes: number;
  isDark: boolean;
  tickColor: string;
  gridColor: string;
  eventItems: ChartEventItem[];
  dataUnits: string | undefined;
  onPeriodChange: ((delta: number) => void) | undefined;
}) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 250 } as const,
  interaction: { mode: "nearest" as const, intersect: false, axis: "xy" as const },
  plugins: {
    legend: { display: false },
    zoom: {
      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        mode: "x" as const,
        onZoomComplete: ({ chart }: { chart: ChartJS }) =>
          handleZoomComplete(chart, minutes, onPeriodChange),
      },
      pan: { enabled: true, mode: "x" as const },
    },
    tooltip: {
      backgroundColor: isDark ? "rgba(5,15,30,0.97)" : "rgba(255,255,255,0.97)",
      borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
      borderWidth: 1,
      padding: 12,
      bodyFont: { size: 11 },
      bodyColor: isDark ? "#E2E4E8" : "#1C2128",
      cornerRadius: 6,
      callbacks: {
        title: formatTooltipTitle,
        label: (ctx: { datasetIndex: number; raw: unknown; parsed: { y: number | null } }) =>
          formatTooltipLabel(ctx, eventItems, dataUnits),
      },
    },
  },
  scales: {
    x: {
      type: "linear" as const,
      min: rangeFrom,
      max: nowSec,
      ticks: {
        maxTicksLimit: 5,
        color: tickColor,
        font: { size: 10 },
        maxRotation: 0,
        minRotation: 0,
        callback: (value: string | number) => formatTimestamp(Number(value), minutes),
      },
      grid: { color: gridColor, drawTicks: false },
      border: { display: false },
    },
    y: {
      title: {
        display: !!dataUnits,
        text: dataUnits ?? "",
        color: tickColor,
        font: { size: 9 },
        padding: { top: 0, bottom: 2 },
      },
      ticks: { color: tickColor, font: { size: 10 }, padding: 6, maxTicksLimit: 5 },
      grid: { color: gridColor, drawTicks: false },
      border: { display: false },
    },
  },
});

const fetchItemHistorySafely = (
  itemid: string,
  minutes: number,
  isCancelled: () => boolean,
  onSuccess: (res: ItemHistory) => void,
  onError: () => void,
) => {
  api
    .getItemHistory(itemid, minutes)
    .then((res) => {
      if (!isCancelled()) {
        onSuccess(res);
      }
    })
    .catch(() => {
      if (!isCancelled()) {
        onError();
      }
    });
};

const formatTooltipTitle = (items: { raw: unknown }[]) => {
  const raw = items[0]?.raw as { x: number } | undefined;
  if (!raw) {
    return "";
  }
  return formatTime(raw.x);
};

const formatTooltipLabel = (
  ctx: { datasetIndex: number; raw: unknown; parsed: { y: number | null } },
  eventItems: ChartEventItem[],
  units: string | undefined,
) => {
  if (ctx.parsed.y == null) {
    return "";
  }
  const scaled = (v: number) => (units && units !== "%" ? formatSizeValue(v, units) : v);
  if (ctx.datasetIndex === 1) {
    const raw = ctx.raw as { x: number };
    const item = eventItems.find((e) => e.firedAt === raw.x);
    if (!item) {
      return "";
    }
    return ` ⚠ ${item.sevLabel}: ${scaled(item.actualValue)}`;
  }
  return ` ${scaled(ctx.parsed.y)}`;
};

const NoDataFallback = ({
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
        minHeight: 180,
        bgcolor: chartBg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        p: 3,
        position: "relative",
      }}
    >
      <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "text.secondary" }}>
        No data in the last {PERIOD_OPTIONS[currentIdx]?.label ?? `${minutes} min`}
      </Typography>
      <Typography
        sx={{ fontSize: "0.75rem", color: "text.disabled", textAlign: "center", maxWidth: 260 }}
      >
        This metric has no recordings in this window. Try a wider range to find when data was last
        collected.
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

const formatRangeBound = (clock: number, spanMinutes: number): string =>
  spanMinutes >= 1440 ? formatDateTimeCompact(clock) : formatTimeShort(clock);

export const ItemChart = ({
  itemid,
  minutes,
  alertEvents = [],
  lineColor = "#1BA7F5",
  onPeriodChange,
}: {
  itemid: string;
  minutes: number;
  alertEvents?: AlertEvent[];
  lineColor?: string;
  onPeriodChange?: (delta: number) => void;
}) => {
  const { palette } = useTheme();
  const isDark = palette.mode === "dark";
  const chartBg = isDark ? "#101216" : "#F5F6F8";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const tickColor = isDark ? "#8C939E" : "#59616C";

  // biome-ignore lint/suspicious/noExplicitAny: chartjs-plugin-zoom resetZoom ref
  const chartRef = useRef<any>(null);

  const prevItemIdRef = useRef<string>("");
  const [data, setData] = useState<ItemHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const isNewItem = prevItemIdRef.current !== itemid;
    prevItemIdRef.current = itemid;

    if (isNewItem) {
      setLoading(true);
      setData(null);
      setRefreshing(false);
    } else {
      setRefreshing(true);
    }

    fetchItemHistorySafely(
      itemid,
      minutes,
      () => cancelled,
      (res) => {
        setData(res);
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        if (isNewItem) {
          setData(null);
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      },
    );

    const timer = setInterval(() => {
      setRefreshing(true);
      fetchItemHistorySafely(
        itemid,
        minutes,
        () => cancelled,
        (res) => {
          setData(res);
          setRefreshing(false);
        },
        () => setRefreshing(false),
      );
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [itemid, minutes]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: minutes is a deliberate re-run trigger, not read in the body
  useEffect(() => {
    chartRef.current?.resetZoom();
  }, [minutes]);

  if (loading) {
    return <Skeleton variant="rectangular" width="100%" height={180} sx={{}} />;
  }

  const noRecordings = !data || data.history.length === 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const rangeFrom = nowSec - minutes * 60;

  if (noRecordings) {
    return <NoDataFallback minutes={minutes} chartBg={chartBg} onPeriodChange={onPeriodChange} />;
  }

  const historyPoints = data.history;
  const sparsePoints = !noRecordings && data.history.length <= 20;

  const eventItems: ChartEventItem[] = noRecordings
    ? []
    : buildEventItems(alertEvents, data, rangeFrom, nowSec);

  const chartData = buildChartData(
    data?.item_name ?? "",
    historyPoints,
    lineColor,
    sparsePoints,
    eventItems,
  );

  const chartOptions = buildChartOptions({
    rangeFrom,
    nowSec,
    minutes,
    isDark,
    tickColor,
    gridColor,
    eventItems,
    dataUnits: data?.units,
    onPeriodChange,
  });

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 180,
        bgcolor: chartBg,
        opacity: refreshing ? 0.72 : 1,
        transition: "opacity 0.2s ease",
        p: "14px 10px 8px 10px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {data?.hostname && (
        <Typography
          variant="caption"
          sx={{
            position: "absolute",
            top: 7,
            left: 10,
            fontSize: "0.65rem",
            fontWeight: 600,
            color: tickColor,
            opacity: 0.85,
            zIndex: 1,
            userSelect: "none",
            letterSpacing: 0,
          }}
        >
          {data.hostname}
        </Typography>
      )}
      <Typography
        variant="caption"
        sx={{
          position: "absolute",
          top: data?.hostname ? 20 : 7,
          left: 10,
          fontSize: "0.58rem",
          color: tickColor,
          opacity: 0.65,
          zIndex: 1,
          letterSpacing: 0,
          userSelect: "none",
        }}
      >
        {formatRangeBound(rangeFrom, minutes)}
        {" → "}
        {formatRangeBound(nowSec, minutes)}
      </Typography>
      <Box
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 7,
          height: 7,
          borderRadius: "50%",
          bgcolor: refreshing ? "#DBA243" : "#2EA043",
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
      <Line
        ref={chartRef}
        data={chartData}
        options={chartOptions}
        plugins={[metricsGlowPlugin]}
        onDoubleClick={() => chartRef.current?.resetZoom()}
      />
    </Box>
  );
};
