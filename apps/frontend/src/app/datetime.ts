/**
 * Canonical date/time formatting for the whole portal.
 *
 *   Date  →  DD/MM/YYYY   (e.g. 30/07/2026)
 *   Time  →  HH:MM:SS     (24-hour, e.g. 19:34:54)
 *
 * Every timestamp shown anywhere in the UI must go through this module. Before it
 * existed the same formatting was reimplemented in ~8 places with `toLocaleString`
 * and friends, which rendered US-style `7/30/2026, 7:34 PM` and drifted apart
 * between screens.
 *
 * Why the components are assembled by hand instead of `Intl.DateTimeFormat`:
 * `toLocale*` output depends on the *viewer's* locale, so the same build renders
 * differently for different operators — exactly the inconsistency this replaces.
 * Padding the parts ourselves pins the format everywhere, for everyone.
 *
 * All values are rendered in the viewer's local timezone (Zabbix `clock` values are
 * UTC epochs; the Date object converts on read), which matches what operators expect
 * when comparing the portal against their own clock.
 */

/** Anything the API hands us for a moment in time. */
export type TimeInput =
  | Date
  /** Unix epoch in **seconds** — Zabbix's convention (`clock`, `lastclock`, `fired_at`). */
  | number
  /** ISO-8601 string — Postgres timestamps (`ack_time`, `created_at`). */
  | string
  | null
  | undefined;

/** Shown when a timestamp is missing, zero, or unparseable. */
export const EMPTY_TIME = "—";

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * Normalise any accepted input to a Date, or null when there is nothing to show.
 * A numeric 0 is treated as "no value": Zabbix uses 0 for "never collected"
 * rather than meaning 1970.
 */
const toDate = (value: TimeInput): Date | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "number") {
    if (value === 0) {
      return null;
    }
    d = new Date(value * 1000); // epoch seconds → ms
  } else {
    d = new Date(value);
  }
  return Number.isNaN(d.getTime()) ? null : d;
};

/** `30/07/2026` */
export const formatDate = (value: TimeInput, fallback = EMPTY_TIME): string => {
  const d = toDate(value);
  if (!d) {
    return fallback;
  }
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** `19:34:54` */
export const formatTime = (value: TimeInput, fallback = EMPTY_TIME): string => {
  const d = toDate(value);
  if (!d) {
    return fallback;
  }
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * `19:34` — hours and minutes only. Reserved for dense chart axes, where a seconds
 * field on every tick collides with its neighbours and adds no information at those
 * zoom levels. Use `formatTime` everywhere else.
 */
export const formatTimeShort = (value: TimeInput, fallback = EMPTY_TIME): string => {
  const d = toDate(value);
  if (!d) {
    return fallback;
  }
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** `30/07/2026 19:34:54` — the default for any discrete timestamp in the UI. */
export const formatDateTime = (value: TimeInput, fallback = EMPTY_TIME): string => {
  const d = toDate(value);
  if (!d) {
    return fallback;
  }
  return `${formatDate(d)} ${formatTime(d)}`;
};

/**
 * `30/07 19:34` — day and month without the year, minutes without seconds.
 * For multi-day chart axes only, where the full form does not fit.
 */
export const formatDateTimeCompact = (value: TimeInput, fallback = EMPTY_TIME): string => {
  const d = toDate(value);
  if (!d) {
    return fallback;
  }
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${formatTimeShort(d)}`;
};

/**
 * Chart-axis tick label, chosen by how much time the axis spans.
 *
 *   ≤ 5 min    → 19:34:54  (seconds matter at this zoom)
 *   < 24 h     → 19:34
 *   ≥ 24 h     → 30/07 19:34
 *
 * Granularity varies but the format never does: always DD/MM and 24-hour.
 */
export const formatAxisTick = (value: TimeInput, spanMinutes?: number): string => {
  if (spanMinutes !== undefined && spanMinutes <= 5) {
    return formatTime(value);
  }
  if (spanMinutes !== undefined && spanMinutes >= 1440) {
    return formatDateTimeCompact(value);
  }
  return formatTimeShort(value);
};
