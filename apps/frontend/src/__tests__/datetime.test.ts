import {
  EMPTY_TIME,
  formatAxisTick,
  formatDate,
  formatDateTime,
  formatDateTimeCompact,
  formatTime,
  formatTimeShort,
} from "../app/datetime";

// 2026-07-05 09:07:03 local time — single-digit day, month, hour, minute and second,
// so any missing zero-padding shows up immediately.
const PADDED = new Date(2026, 6, 5, 9, 7, 3);
// 2026-12-30 19:34:54 local — two-digit everything, and an afternoon hour that would
// come back as "7:34 PM" if a 12-hour clock ever slipped in.
const EVENING = new Date(2026, 11, 30, 19, 34, 54);

describe("formatDate — DD/MM/YYYY", () => {
  it("zero-pads day and month", () => {
    expect(formatDate(PADDED)).toBe("05/07/2026");
  });

  it("puts day before month (not the US order)", () => {
    expect(formatDate(EVENING)).toBe("30/12/2026");
  });
});

describe("formatTime — HH:MM:SS on a 24-hour clock", () => {
  it("zero-pads hour, minute and second", () => {
    expect(formatTime(PADDED)).toBe("09:07:03");
  });

  it("uses 24-hour hours with no AM/PM", () => {
    expect(formatTime(EVENING)).toBe("19:34:54");
  });

  it("renders midnight as 00, never 12 AM", () => {
    expect(formatTime(new Date(2026, 0, 1, 0, 0, 0))).toBe("00:00:00");
  });
});

describe("formatDateTime", () => {
  it("joins both canonical formats", () => {
    expect(formatDateTime(EVENING)).toBe("30/12/2026 19:34:54");
  });
});

describe("input handling", () => {
  it("treats a number as Unix epoch SECONDS (the Zabbix convention)", () => {
    const epochSeconds = Math.floor(EVENING.getTime() / 1000);
    expect(formatDateTime(epochSeconds)).toBe("30/12/2026 19:34:54");
  });

  it("parses ISO strings from Postgres timestamps", () => {
    expect(formatDateTime(EVENING.toISOString())).toBe("30/12/2026 19:34:54");
  });

  it("returns the placeholder for null, undefined and empty string", () => {
    expect(formatDateTime(null)).toBe(EMPTY_TIME);
    expect(formatDateTime(undefined)).toBe(EMPTY_TIME);
    expect(formatDateTime("")).toBe(EMPTY_TIME);
  });

  it("treats epoch 0 as 'no value' rather than 1970 — Zabbix uses 0 for never-collected", () => {
    expect(formatDateTime(0)).toBe(EMPTY_TIME);
    expect(formatDate(0)).toBe(EMPTY_TIME);
  });

  it("returns the placeholder for an unparseable string", () => {
    expect(formatDateTime("not a date")).toBe(EMPTY_TIME);
  });

  it("honours a caller-supplied fallback", () => {
    expect(formatDateTime(null, "Never")).toBe("Never");
    expect(formatDateTime(0, "Never collected")).toBe("Never collected");
  });
});

describe("compact forms", () => {
  it("formatTimeShort drops seconds", () => {
    expect(formatTimeShort(EVENING)).toBe("19:34");
  });

  it("formatDateTimeCompact drops the year and seconds", () => {
    expect(formatDateTimeCompact(EVENING)).toBe("30/12 19:34");
  });
});

describe("formatAxisTick — granularity varies, format does not", () => {
  it("shows seconds when the axis spans 5 minutes or less", () => {
    expect(formatAxisTick(EVENING, 5)).toBe("19:34:54");
  });

  it("shows HH:MM for intraday spans", () => {
    expect(formatAxisTick(EVENING, 360)).toBe("19:34");
  });

  it("shows DD/MM HH:MM once the span reaches a day", () => {
    expect(formatAxisTick(EVENING, 1440)).toBe("30/12 19:34");
  });

  it("defaults to HH:MM when no span is given", () => {
    expect(formatAxisTick(EVENING)).toBe("19:34");
  });
});
