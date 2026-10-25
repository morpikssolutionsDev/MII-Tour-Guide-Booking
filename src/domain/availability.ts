// Real-time availability (05-pemesanan.md BR-05-1..5, 02-tour-guide.md BR-02-1). Pure.
import { addDays, isoWeekday, timeToMinutes } from "./time";

export type GuideForAvailability = {
  id: string;
  displayName: string;
  isActive: boolean;
  languageIds: string[];
  weekdays: number[];
  /** Approved leave only; pending/rejected/cancelled never block (BR-02-1). */
  approvedLeaves: { startDate: string; endDate: string }[];
};

export type SlotForAvailability = { id: string; startTime: string; endTime: string };

/** An active assignment (BR-05-2) on the date being checked. */
export type AssignmentForAvailability = { guideId: string; slotId: string; bookingId: string };

export type SlotUnavailableReason =
  | { kind: "no_language_guides" }
  | { kind: "not_enough"; needed: number; available: number };

export type SlotAvailability = {
  slotId: string;
  startTime: string;
  endTime: string;
  eligibleGuideIds: string[];
  available: boolean;
  reason: SlotUnavailableReason | null;
};

/** BR-02-1: active, scheduled to work that weekday, and not on approved leave. */
export function isGuideWorking(guide: GuideForAvailability, date: string): boolean {
  if (!guide.isActive) return false;
  if (!guide.weekdays.includes(isoWeekday(date))) return false;
  return !guide.approvedLeaves.some((leave) => leave.startDate <= date && date <= leave.endDate);
}

/** BR-05-1: today … today + horizon (inclusive). */
export function isWithinBookingWindow(date: string, today: string, horizonDays: number): boolean {
  return date >= today && date <= addDays(today, horizonDays);
}

/** BR-05-3: slots of `today` that have already started are hidden. */
export function isSlotOpen(date: string, slotStart: string, nowWib: { date: string; time: string }): boolean {
  if (date > nowWib.date) return true;
  if (date < nowWib.date) return false;
  return timeToMinutes(slotStart) > timeToMinutes(nowWib.time);
}

export function evaluateSlots(input: {
  date: string;
  nowWib: { date: string; time: string };
  languageId: string;
  guidesNeeded: number;
  slots: SlotForAvailability[];
  guides: GuideForAvailability[];
  assignments: AssignmentForAvailability[];
  /** BR-05-4: when rescheduling, this booking's own assignments count as free. */
  excludeBookingId?: string;
}): SlotAvailability[] {
  const speakers = input.guides.filter(
    (g) => g.languageIds.includes(input.languageId) && isGuideWorking(g, input.date),
  );
  const busy = new Set(
    input.assignments
      .filter((a) => a.bookingId !== input.excludeBookingId)
      .map((a) => `${a.guideId}:${a.slotId}`),
  );

  return [...input.slots]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .filter((slot) => isSlotOpen(input.date, slot.startTime, input.nowWib))
    .map((slot) => {
      const eligibleGuideIds = speakers.filter((g) => !busy.has(`${g.id}:${slot.id}`)).map((g) => g.id);
      const available = eligibleGuideIds.length >= input.guidesNeeded;
      let reason: SlotUnavailableReason | null = null;
      if (!available) {
        reason =
          speakers.length === 0
            ? { kind: "no_language_guides" }
            : { kind: "not_enough", needed: input.guidesNeeded, available: eligibleGuideIds.length };
      }
      return { slotId: slot.id, startTime: slot.startTime, endTime: slot.endTime, eligibleGuideIds, available, reason };
    });
}
