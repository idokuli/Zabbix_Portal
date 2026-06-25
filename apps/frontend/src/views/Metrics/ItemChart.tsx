"use client";
import { Box, Chip, Skeleton, Typography } from "@mui/material";
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
import { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import { type AlertEvent, type ItemHistory, api } from "../../app/api";
import { PERIOD_OPTIONS, SEVERITY_CONFIG, formatTimestamp } from "./shared";

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
    if (typeof color !== "string") return;
    chart.ctx.save();
    chart.ctx.shadowBlur = 14;
    chart.ctx.shadowColor = color;
  },
  afterDatasetDraw: (chart: { ctx: CanvasRenderingContext2D }) => {
    chart.ctx.restore();
  },
};

const formatRangeBound = (clock: number, spanMinutes: number): string => {
  const d = new Date(clock * 1000);
  if (spanMinutes >= 1440) {
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
  const chartBg = isDark ? "#0D1B2A" : "#F1F5F9";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const tickColor = isDark ? "#94A3B8" : "#334155";

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

    api
      .getItemHistory(itemid, minutes)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
          setRefreshing(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (isNewItem) {
            setData(null);
            setLoading(false);
          } else setRefreshing(false);
        }
      });

    const timer = setInterval(() => {
      setRefreshing(true);
      api
        .getItemHistory(itemid, minutes)
        .then((res) => {
          if (!cancelled) {
            setData(res);
            setRefreshing(false);
          }
        })
        .catch(() => {
          if (!cancelled) setRefreshing(false);
        });
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

  if (loading)
    return <Skeleton variant="rectangular" width="100%" height={180} sx={{ borderRadius: 1 }} />;

  const noRecordings = !data || data.history.length === 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const rangeFrom = nowSec - minutes * 60;

  if (noRecordings) {
    const currentIdx = PERIOD_OPTIONS.findIndex((o) => o.minutes === minutes);
    const largerOptions = currentIdx >= 0 ? PERIOD_OPTIONS.slice(currentIdx + 1) : [];
    return (
      <Box
        sx={{
          height: "100%",
          minHeight: 180,
          bgcolor: chartBg,
          borderRadius: 1.5,
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
  }

  const historyPoints = data.history;
  const sparsePoints = !noRecordings && data.history.length <= 20;

  type EventItem = {
    firedAt: number;
    y: number;
    color: string;
    sevLabel: string;
    actualValue: number;
    severity: number;
  };
  const eventItems: EventItem[] = [];
  if (!noRecordings) {
    const clockMap = new Map<number, EventItem>();
    for (const e of alertEvents) {
      if (e.fired_at < rangeFrom || e.fired_at > nowSec) continue;
      const nearest = data.history.reduce((best, p) =>
        Math.abs(p.clock - e.fired_at) < Math.abs(best.clock - e.fired_at) ? p : best,
      );
      const existing = clockMap.get(nearest.clock);
      if (!existing || e.severity > existing.severity) {
        clockMap.set(nearest.clock, {
          firedAt: e.fired_at,
          y: nearest.value,
          color: SEVERITY_CONFIG.find((s) => s.severity === e.severity)?.color ?? "#F44336",
          sevLabel: SEVERITY_CONFIG.find((s) => s.severity === e.severity)?.label ?? "Alert",
          actualValue: e.actual_value,
          severity: e.severity,
        });
      }
    }
    eventItems.push(...clockMap.values());
  }

  const chartData = {
    datasets: [
      {
        label: data?.item_name ?? "",
        data: historyPoints.map((p) => ({ x: p.clock, y: p.value })),
        borderColor: lineColor,
        backgroundColor: (context: {
          chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } };
        }) => {
          const { ctx: c, chartArea } = context.chart;
          if (!chartArea) return `${lineColor}26`;
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, `${lineColor}66`);
          g.addColorStop(0.5, `${lineColor}1A`);
          g.addColorStop(1, `${lineColor}00`);
          return g;
        },
        borderWidth: sparsePoints ? 2.5 : 2,
        pointRadius: sparsePoints ? 4 : 0,
        pointBackgroundColor: lineColor,
        pointBorderColor: "#fff",
        pointBorderWidth: sparsePoints ? 1.5 : 0,
        pointHoverRadius: sparsePoints ? 6 : 5,
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
          onZoomComplete: ({ chart }: { chart: ChartJS }) => {
            if (!onPeriodChange) return;
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
        backgroundColor: isDark ? "rgba(5,15,30,0.97)" : "rgba(255,255,255,0.97)",
        borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
        borderWidth: 1,
        padding: 12,
        bodyFont: { size: 11 },
        bodyColor: isDark ? "#F1F5F9" : "#1E293B",
        cornerRadius: 6,
        callbacks: {
          title: (items: { raw: unknown }[]) => {
            const raw = items[0]?.raw as { x: number } | undefined;
            if (!raw) return "";
            return new Date(raw.x * 1000).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            });
          },
          label: (ctx: { datasetIndex: number; raw: unknown; parsed: { y: number | null } }) => {
            if (ctx.parsed.y == null) return "";
            if (ctx.datasetIndex === 1) {
              const raw = ctx.raw as { x: number };
              const item = eventItems.find((e) => e.firedAt === raw.x);
              if (!item) return "";
              return ` ⚠ ${item.sevLabel}: ${item.actualValue}${data?.units && data.units !== "%" ? ` ${data.units}` : ""}`;
            }
            return ` ${ctx.parsed.y}${data?.units && data.units !== "%" ? ` ${data.units}` : ""}`;
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
          display: !!data?.units,
          text: data?.units ?? "",
          color: tickColor,
          font: { size: 9 },
          padding: { top: 0, bottom: 2 },
        },
        ticks: { color: tickColor, font: { size: 10 }, padding: 6, maxTicksLimit: 5 },
        grid: { color: gridColor, drawTicks: false },
        border: { display: false },
      },
    },
  };

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 180,
        bgcolor: chartBg,
        opacity: refreshing ? 0.72 : 1,
        transition: "opacity 0.2s ease",
        borderRadius: 1.5,
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
