import { describe, expect, it } from "vitest";
import { rankCandidates, recommendedIds } from "./allocation";
import { evaluateSlots, isGuideWorking, isWithinBookingWindow, type GuideForAvailability } from "./availability";
import { canCancel, canComplete, canReschedule, canTransition, statusForChecklist } from "./booking-status";
import { computeHoldExpiry, isHoldExpired } from "./hold";

const SATURDAY = "2026-11-07";
const slots = [
  { id: "s1", startTime: "09:00", endTime: "12:00" },
  { id: "s2", startTime: "12:00", endTime: "15:00" },
  { id: "s3", startTime: "16:00", endTime: "19:00" },
];
const guide = (id: string, languageIds: string[], over: Partial<GuideForAvailability> = {}): GuideForAvailability => ({
  id,
  displayName: id,
  isActive: true,
  languageIds,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  approvedLeaves: [],
  ...over,
});
const guides = [
  guide("a1", ["en", "ar"]),
  guide("a2", ["en", "ar"]),
  guide("a3", ["en", "ar"]),
  guide("r1", ["en", "ru"]),
  guide("e1", ["en"]),
];
const earlier = { date: "2026-11-01", time: "08:00" };

describe("guide working (BR-02-1)", () => {
  it("respects working days and approved leave only", () => {
    const weekdaysOnly = guide("x", ["en"], { weekdays: [1, 2, 3, 4, 5] });
    expect(isGuideWorking(weekdaysOnly, SATURDAY)).toBe(false);
    const onLeave = guide("y", ["en"], { approvedLeaves: [{ startDate: "2026-11-06", endDate: "2026-11-08" }] });
    expect(isGuideWorking(onLeave, SATURDAY)).toBe(false);
    expect(isGuideWorking(guide("z", ["en"], { isActive: false }), SATURDAY)).toBe(false);
  });
});

describe("slot availability (BR-05-3)", () => {
  it("AC1: 3 Arabic guides free, 12 people need 2 → every slot available", () => {
    const result = evaluateSlots({ date: SATURDAY, nowWib: earlier, languageId: "ar", guidesNeeded: 2, slots, guides, assignments: [] });
    expect(result.every((s) => s.available && s.eligibleGuideIds.length === 3)).toBe(true);
  });

  it("AC2: two Arabic guides already hold 09:00 → not enough there", () => {
    const assignments = [
      { guideId: "a1", slotId: "s1", bookingId: "b1" },
      { guideId: "a2", slotId: "s1", bookingId: "b1" },
    ];
    const result = evaluateSlots({ date: SATURDAY, nowWib: earlier, languageId: "ar", guidesNeeded: 2, slots, guides, assignments });
    expect(result[0]).toMatchObject({ available: false, reason: { kind: "not_enough", needed: 2, available: 1 } });
    expect(result[1].available).toBe(true);
  });

  it("AC3: today's started slots are hidden", () => {
    const result = evaluateSlots({
      date: SATURDAY,
      nowWib: { date: SATURDAY, time: "12:30" },
      languageId: "en",
      guidesNeeded: 1,
      slots,
      guides,
      assignments: [],
    });
    expect(result.map((s) => s.slotId)).toEqual(["s3"]);
  });

  it("reports when no guide speaks the language that day", () => {
    const result = evaluateSlots({ date: SATURDAY, nowWib: earlier, languageId: "zh", guidesNeeded: 1, slots, guides, assignments: [] });
    expect(result[0].reason).toEqual({ kind: "no_language_guides" });
  });

  it("BR-05-4: a booking's own assignments count as free when rescheduling", () => {
    const assignments = [{ guideId: "r1", slotId: "s1", bookingId: "mine" }];
    const result = evaluateSlots({
      date: SATURDAY,
      nowWib: earlier,
      languageId: "ru",
      guidesNeeded: 1,
      slots,
      guides,
      assignments,
      excludeBookingId: "mine",
    });
    expect(result[0].available).toBe(true);
  });

  it("BR-05-1: the booking window is today … today + horizon", () => {
    expect(isWithinBookingWindow("2026-11-01", "2026-11-01", 90)).toBe(true);
    expect(isWithinBookingWindow("2026-10-31", "2026-11-01", 90)).toBe(false);
    expect(isWithinBookingWindow("2027-01-31", "2026-11-01", 90)).toBe(false);
  });
});

describe("allocation ranking (BR-05-6)", () => {
  it("AC4: lightest load, then rating (unrated last), then name", () => {
    const ranked = rankCandidates([
      { guideId: "A", displayName: "A", weekLoad: 2, avgRating: 4.9, ratingCount: 10 },
      { guideId: "B", displayName: "B", weekLoad: 0, avgRating: 4.5, ratingCount: 3 },
      { guideId: "C", displayName: "C", weekLoad: 0, avgRating: null, ratingCount: 0 },
    ]);
    expect(ranked.map((c) => c.guideId)).toEqual(["B", "C", "A"]);
    expect(recommendedIds(ranked, 2)).toEqual(["B", "C"]);
  });
});

describe("status rules", () => {
  const booking = { status: "confirmed" as const, tourDate: SATURDAY, slotStart: "09:00", slotEnd: "12:00" };
  const beforeStart = new Date("2026-11-07T01:59:00Z"); // 08:59 WIB
  const during = new Date("2026-11-07T02:10:00Z"); // 09:10 WIB
  const afterEnd = new Date("2026-11-07T05:00:00Z"); // 12:00 WIB

  it("Selesai only after the slot starts; reschedule only before (AC 05-10)", () => {
    expect(canComplete(booking, beforeStart)).toBe(false);
    expect(canComplete(booking, during)).toBe(true);
    expect(canReschedule(booking, during)).toBe(false);
    expect(canCancel(booking, during)).toBe(true);
    expect(canCancel(booking, afterEnd)).toBe(false);
  });

  it("follows the state diagram", () => {
    expect(canTransition("awaiting_payment", "confirmed")).toBe(true);
    expect(canTransition("awaiting_payment", "completed")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });

  it("BR-07-5: checklist drives Siap ↔ Terkonfirmasi for paid bookings only", () => {
    expect(statusForChecklist("confirmed", true)).toBe("ready");
    expect(statusForChecklist("ready", false)).toBe("confirmed");
    expect(statusForChecklist("completed", false)).toBe("completed");
  });
});

describe("hold (BR-05-11)", () => {
  it("is 24 h unless the slot starts sooner", () => {
    const created = new Date("2026-11-01T01:00:00Z");
    expect(computeHoldExpiry(created, 24, "2026-11-07", "09:00").toISOString()).toBe("2026-11-02T01:00:00.000Z");
    // same-day booking at 11:40 WIB for the 12:00 slot
    const sameDay = new Date("2026-11-07T04:40:00Z");
    expect(computeHoldExpiry(sameDay, 24, "2026-11-07", "12:00").toISOString()).toBe("2026-11-07T05:00:00.000Z");
  });

  it("expires exactly at the boundary", () => {
    expect(isHoldExpired("2026-11-02T01:00:00.000Z", new Date("2026-11-02T00:59:59Z"))).toBe(false);
    expect(isHoldExpired("2026-11-02T01:00:00.000Z", new Date("2026-11-02T01:00:00Z"))).toBe(true);
    expect(isHoldExpired(null, new Date())).toBe(false);
  });
});
