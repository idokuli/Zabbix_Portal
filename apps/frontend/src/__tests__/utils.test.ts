import { fmtTs, generateId } from "../app/utils";

describe("fmtTs", () => {
  it("returns a non-empty string for a unix timestamp", () => {
    const result = fmtTs(1700000000);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("—");
  });

  it("returns em-dash for falsy value", () => {
    expect(fmtTs(0)).toBe("—");
  });

  it("includes year in formatted output", () => {
    // 1700000000 = Nov 2023; en-US short format shows 2-digit year ("23")
    const result = fmtTs(1700000000);
    expect(result).toMatch(/23/);
  });
});

describe("generateId", () => {
  it("returns a non-empty string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique values on each call", () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateId()));
    expect(ids.size).toBe(10);
  });
});
