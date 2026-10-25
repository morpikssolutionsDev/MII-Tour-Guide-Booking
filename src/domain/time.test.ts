import { describe, expect, it } from "vitest";
import { formatBookingCode } from "./booking-code";
import { normalizePhone } from "./phone";
import {
  addDays,
  daysBetween,
  isoWeekRange,
  isoWeekday,
  isValidDate,
  toWib,
  wibToUtc,
} from "./time";

describe("WIB time", () => {
  it("converts a UTC instant to the WIB calendar date and time", () => {
    // 18:30 UTC is 01:30 the next day in Jakarta
    expect(toWib(new Date("2026-10-24T18:30:00Z"))).toEqual({ date: "2026-10-25", time: "01:30" });
  });

  it("builds the UTC instant of a WIB slot start", () => {
    expect(wibToUtc("2026-11-07", "09:00").toISOString()).toBe("2026-11-07T02:00:00.000Z");
  });

  it("does day arithmetic across month ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(daysBetween("2026-10-25", "2026-10-27")).toBe(2);
  });

  it("uses ISO weekdays with Monday = 1 and Sunday = 7", () => {
    expect(isoWeekday("2026-10-26")).toBe(1);
    expect(isoWeekday("2026-10-25")).toBe(7);
    expect(isoWeekRange("2026-10-25")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
  });

  it("validates calendar dates", () => {
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2028-02-29")).toBe(true);
  });
});

describe("booking code", () => {
  it("uses the WIB creation date and a padded daily sequence", () => {
    expect(formatBookingCode(new Date("2026-10-24T18:00:00Z"), 4)).toBe("TG-261025-004");
    expect(formatBookingCode(new Date("2026-10-25T03:00:00Z"), 1000)).toBe("TG-261025-1000");
  });
});

describe("phone normalisation", () => {
  it("reads local Indonesian numbers and keeps international ones", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("+6281234567890");
    expect(normalizePhone("+966 50 123 4567")).toBe("+966501234567");
    expect(normalizePhone("12")).toBeNull();
  });
});
