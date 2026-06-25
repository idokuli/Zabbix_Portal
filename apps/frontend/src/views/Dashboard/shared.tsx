"use client";

export const PERIOD_OPTIONS = [
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

export const formatTimestamp = (clock: number, minutes?: number) => {
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

export const formatRangeTime = (clock: number) =>
  new Date(clock * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export const formatLastSeen = (clock: number | null) => {
  if (!clock) return "—";
  const diff = Math.floor(Date.now() / 1000) - clock;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};
