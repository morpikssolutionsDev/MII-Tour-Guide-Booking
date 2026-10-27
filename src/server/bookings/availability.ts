import "server-only";
import { and, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import type { Executor } from "@/db/client";
import { bookingGuides, bookings, guideLanguages, guideLeaves, guides, guideWorkingDays, languages, slots } from "@/db/schema";
import { rankCandidates } from "@/domain/allocation";
import {
  evaluateSlots,
  type AssignmentForAvailability,
  type GuideForAvailability,
  type SlotAvailability,
} from "@/domain/availability";
import { LIVE_STATUSES } from "@/domain/booking-status";
import { isoWeekRange, toWib } from "@/domain/time";
import { guideRatingStats } from "../guides/queries";

/** Guides with their availability inputs (BR-02-1) for a date range. */
export async function loadGuidesForAvailability(ex: Executor, from: string, to: string): Promise<(GuideForAvailability & { fullName: string; photoUrl: string | null })[]> {
  const [rows, langs, days, leaves] = await Promise.all([
    ex.select().from(guides),
    ex.select().from(guideLanguages),
    ex.select().from(guideWorkingDays),
    ex
      .select()
      .from(guideLeaves)
      .where(and(eq(guideLeaves.status, "approved"), lte(guideLeaves.startDate, to), gte(guideLeaves.endDate, from))),
  ]);
  return rows.map((g) => ({
    id: g.id,
    displayName: g.displayName,
    fullName: g.fullName,
    photoUrl: g.photoUrl,
    isActive: g.isActive,
    languageIds: langs.filter((l) => l.guideId === g.id).map((l) => l.languageId),
    weekdays: days.filter((d) => d.guideId === g.id).map((d) => d.weekday),
    approvedLeaves: leaves.filter((l) => l.guideId === g.id).map((l) => ({ startDate: l.startDate, endDate: l.endDate })),
  }));
}

/**
 * BR-05-2 active assignments: not released, on a live booking. Expired holds are already
 * cancelled (or confirmed) by syncHolds(), which callers run first.
 */
export async function loadActiveAssignments(ex: Executor, from: string, to: string): Promise<(AssignmentForAvailability & { tourDate: string })[]> {
  return ex
    .select({ guideId: bookingGuides.guideId, slotId: bookingGuides.slotId, bookingId: bookingGuides.bookingId, tourDate: bookingGuides.tourDate })
    .from(bookingGuides)
    .innerJoin(bookings, eq(bookings.id, bookingGuides.bookingId))
    .where(
      and(
        isNull(bookingGuides.releasedAt),
        inArray(bookings.status, [...LIVE_STATUSES]),
        gte(bookingGuides.tourDate, from),
        lte(bookingGuides.tourDate, to),
      ),
    );
}

export async function loadActiveSlots(ex: Executor) {
  return ex.select({ id: slots.id, startTime: slots.startTime, endTime: slots.endTime }).from(slots).where(eq(slots.isActive, true));
}

export type SlotAvailabilityView = SlotAvailability & { reasonText: string | null };

/** BR-05-3 for a single date. */
export async function availabilityForDate(
  ex: Executor,
  input: { date: string; languageId: string; guidesNeeded: number; excludeBookingId?: string; now?: Date },
  preloaded?: {
    guides: Awaited<ReturnType<typeof loadGuidesForAvailability>>;
    assignments: Awaited<ReturnType<typeof loadActiveAssignments>>;
    slots: Awaited<ReturnType<typeof loadActiveSlots>>;
  },
): Promise<SlotAvailability[]> {
  const [guideRows, assignments, slotRows] = preloaded
    ? [preloaded.guides, preloaded.assignments, preloaded.slots]
    : await Promise.all([
        loadGuidesForAvailability(ex, input.date, input.date),
        loadActiveAssignments(ex, input.date, input.date),
        loadActiveSlots(ex),
      ]);
  return evaluateSlots({
    date: input.date,
    nowWib: toWib(input.now ?? new Date()),
    languageId: input.languageId,
    guidesNeeded: input.guidesNeeded,
    slots: slotRows,
    guides: guideRows,
    assignments: assignments.filter((a) => a.tourDate === input.date),
    excludeBookingId: input.excludeBookingId,
  });
}

/** Weekly load per guide for the ISO week of `date` (BR-05-6), excluding one booking. */
export async function weekLoads(ex: Executor, date: string, excludeBookingId?: string) {
  const { start, end } = isoWeekRange(date);
  const rows = await ex
    .select({ guideId: bookingGuides.guideId })
    .from(bookingGuides)
    .innerJoin(bookings, eq(bookings.id, bookingGuides.bookingId))
    .where(
      and(
        isNull(bookingGuides.releasedAt),
        inArray(bookings.status, ["awaiting_payment", "confirmed", "ready", "completed", "evaluated", "no_show"]),
        gte(bookings.tourDate, start),
        lte(bookings.tourDate, end),
        excludeBookingId ? ne(bookings.id, excludeBookingId) : undefined,
      ),
    );
  const loads = new Map<string, number>();
  for (const r of rows) loads.set(r.guideId, (loads.get(r.guideId) ?? 0) + 1);
  return loads;
}

/** Ranked eligible guides for one slot (BR-05-6), with display data for GuideCard. */
export async function rankEligibleGuides(
  ex: Executor,
  input: { date: string; slotId: string; languageId: string; guidesNeeded: number; excludeBookingId?: string },
) {
  const [guideRows, assignments, slotRows, loads, ratings, languageRows] = await Promise.all([
    loadGuidesForAvailability(ex, input.date, input.date),
    loadActiveAssignments(ex, input.date, input.date),
    loadActiveSlots(ex),
    weekLoads(ex, input.date, input.excludeBookingId),
    guideRatingStats(ex),
    ex.select({ id: languages.id, code: languages.code }).from(languages),
  ]);
  const slot = (
    await availabilityForDate(ex, { ...input, guidesNeeded: 1 }, { guides: guideRows, assignments, slots: slotRows })
  ).find((s) => s.slotId === input.slotId);
  const eligible = slot?.eligibleGuideIds ?? [];
  const codeById = new Map(languageRows.map((l) => [l.id, l.code]));
  const ranked = rankCandidates(
    eligible.map((guideId) => {
      const g = guideRows.find((x) => x.id === guideId)!;
      const r = ratings.get(guideId);
      return {
        guideId,
        displayName: g.displayName,
        fullName: g.fullName,
        photoUrl: g.photoUrl,
        languageCodes: g.languageIds.map((id) => codeById.get(id) ?? "").filter(Boolean),
        weekLoad: loads.get(guideId) ?? 0,
        avgRating: r?.avg ?? null,
        ratingCount: r?.count ?? 0,
      };
    }),
  );
  return ranked.map((c, i) => ({ ...c, recommended: i < input.guidesNeeded }));
}

export type GuideCandidateView = Awaited<ReturnType<typeof rankEligibleGuides>>[number];
