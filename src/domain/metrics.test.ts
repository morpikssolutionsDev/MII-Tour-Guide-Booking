import { describe, expect, it } from "vitest";
import { bucketsFor, delta, granularityFor, previousPeriod, ratio, toCsv } from "./metrics";

describe("report metrics (11 §5)", () => {
  it("previous period has the same length, immediately before", () => {
    expect(previousPeriod({ from: "2026-10-01", to: "2026-10-31" })).toEqual({ from: "2026-08-31", to: "2026-09-30" });
    expect(previousPeriod({ from: "2026-10-25", to: "2026-10-25" })).toEqual({ from: "2026-10-24", to: "2026-10-24" });
  });

  it("AC11: delta is null when the previous period is 0", () => {
    expect(delta(5, 0)).toBeNull();
    expect(delta(12, 10)).toBeCloseTo(0.2);
  });

  it("AC6: utilisation = booked ÷ available (6 of 24 → 25%)", () => {
    expect(ratio(6, 3 * 8)).toBe(0.25);
    expect(ratio(1, 0)).toBeNull();
  });

  it("AC10: 90 days → weekly buckets; 31 → daily; a year → monthly", () => {
    expect(granularityFor({ from: "2026-08-01", to: "2026-10-29" })).toBe("week");
    expect(granularityFor({ from: "2026-10-01", to: "2026-10-31" })).toBe("day");
    expect(granularityFor({ from: "2026-01-01", to: "2026-12-31" })).toBe("month");
    expect(bucketsFor({ from: "2026-10-28", to: "2026-11-10" }, "week")).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(bucketsFor({ from: "2026-11-15", to: "2027-01-02" }, "month")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
  });

  it("AC9: CSV has a BOM, quotes commas/quotes, keeps plain numbers", () => {
    const csv = toCsv(["Tour Guide", "Pendapatan"], [["Rina, \"R\"", 1950000]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Rina, ""R""",1950000');
  });
});
