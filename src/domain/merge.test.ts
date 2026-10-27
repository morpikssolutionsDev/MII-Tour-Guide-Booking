import { describe, expect, it } from "vitest";
import { mergeCapacity, mergeRefusal, nextHost, type MergeCandidate } from "./merge";

const BEFORE = new Date("2026-11-05T01:00:00Z"); // 08:00 WIB, before the 09:00 slot
const booking = (id: string, over: Partial<MergeCandidate> = {}): MergeCandidate => ({
  id,
  status: "confirmed",
  tourDate: "2026-11-05",
  slotId: "s1",
  slotStart: "09:00",
  languageId: "en",
  people: 10,
  maxPeoplePerGuide: 20,
  mergeGroupId: null,
  ...over,
});

describe("mergeCapacity (BR-12-M4)", () => {
  it("fits within guides × max per guide", () => {
    expect(mergeCapacity([booking("a", { people: 12 }), booking("b", { people: 15 })], 2)).toEqual({ used: 27, max: 40, fits: true, overBy: 0 });
  });
  it("uses the smallest max per guide across different packages", () => {
    const r = mergeCapacity([booking("a", { people: 12 }), booking("b", { people: 15, maxPeoplePerGuide: 10 })], 2);
    expect(r).toEqual({ used: 27, max: 20, fits: false, overBy: 7 });
  });
  it("accepts an exact fit and refuses one over", () => {
    expect(mergeCapacity([booking("a", { people: 15 }), booking("b", { people: 5 })], 1).fits).toBe(true);
    expect(mergeCapacity([booking("a", { people: 15 }), booking("b", { people: 6 })], 1).fits).toBe(false);
  });
  it("never fits without guides", () => {
    expect(mergeCapacity([booking("a", { people: 1 })], 0).fits).toBe(false);
  });
});

describe("mergeRefusal (BR-12-M2)", () => {
  it("allows same date, slot and language before the slot starts", () => {
    expect(mergeRefusal(booking("a"), booking("b"), BEFORE, false)).toBeNull();
  });
  it("refuses a different slot, date or language", () => {
    expect(mergeRefusal(booking("a"), booking("b", { slotId: "s2" }), BEFORE, false)).toBe("different_schedule");
    expect(mergeRefusal(booking("a"), booking("b", { tourDate: "2026-11-06" }), BEFORE, false)).toBe("different_schedule");
    expect(mergeRefusal(booking("a"), booking("b", { languageId: "ar" }), BEFORE, false)).toBe("different_schedule");
  });
  it("refuses the same booking and bookings already in a group", () => {
    expect(mergeRefusal(booking("a"), booking("a"), BEFORE, false)).toBe("same_booking");
    expect(mergeRefusal(booking("a"), booking("b", { mergeGroupId: "x" }), BEFORE, false)).toBe("already_merged");
  });
  it("refuses once the slot has started", () => {
    expect(mergeRefusal(booking("a"), booking("b"), new Date("2026-11-05T02:00:00Z"), false)).toBe("started");
  });
  it("allows awaiting payment only while payment confirmation is on", () => {
    expect(mergeRefusal(booking("a"), booking("b", { status: "awaiting_payment" }), BEFORE, false)).toBe("status");
    expect(mergeRefusal(booking("a"), booking("b", { status: "awaiting_payment" }), BEFORE, true)).toBeNull();
    expect(mergeRefusal(booking("a"), booking("b", { status: "completed" }), BEFORE, true)).toBe("status");
  });
});

describe("nextHost (BR-12-M9)", () => {
  it("picks the member that joined first", () => {
    expect(nextHost([{ id: "c", mergedAt: "2026-11-01T03:00:00Z" }, { id: "b", mergedAt: "2026-11-01T02:00:00Z" }])?.id).toBe("b");
  });
  it("returns null for an empty group", () => {
    expect(nextHost([])).toBeNull();
  });
});
