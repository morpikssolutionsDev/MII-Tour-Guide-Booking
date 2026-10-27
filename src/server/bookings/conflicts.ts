import "server-only";
import { and, asc, eq, gte, inArray, isNull, lte, type SQL } from "drizzle-orm";
import { db, type Executor } from "@/db/client";
import { bookingGuides, bookings, customers } from "@/db/schema";
import { LIVE_STATUSES } from "@/domain/booking-status";
import { isoWeekday, toWib, wibToUtc } from "@/domain/time";
import { syncHolds } from "./holds";

/** A booking shown in conflict lists (02 BR-02-4..8, 04 BR-04-2/3). */
export type BookingRef = {
  id: string;
  code: string;
  tourDate: string;
  slotStart: string;
  slotEnd: string;
  status: (typeof LIVE_STATUSES)[number];
  customerName: string;
};

/**
 * Future live bookings (awaiting payment with an open hold, confirmed, ready) whose slot has
 * not started, optionally narrowed by slot, language, guide, weekday or date range.
 * Runs lazy hold expiry first so expired holds never count as conflicts.
 */
export async function findLiveConflicts(
  filters: {
    slotId?: string;
    languageId?: string;
    guideId?: string;
    weekday?: number;
    from?: string;
    to?: string;
  },
  ex: Executor = db,
): Promise<BookingRef[]> {
  await syncHolds();
  const now = new Date();
  const today = toWib(now).date;
  const conditions: SQL[] = [inArray(bookings.status, [...LIVE_STATUSES]), gte(bookings.tourDate, filters.from && filters.from > today ? filters.from : today)];
  if (filters.to) conditions.push(lte(bookings.tourDate, filters.to));
  if (filters.slotId) conditions.push(eq(bookings.slotId, filters.slotId));
  if (filters.languageId) conditions.push(eq(bookings.languageId, filters.languageId));

  const base = ex
    .select({
      id: bookings.id,
      code: bookings.code,
      tourDate: bookings.tourDate,
      slotStart: bookings.slotStart,
      slotEnd: bookings.slotEnd,
      status: bookings.status,
      customerName: customers.name,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId));

  const rows = filters.guideId
    ? await base
        .innerJoin(bookingGuides, eq(bookingGuides.bookingId, bookings.id))
        .where(and(...conditions, eq(bookingGuides.guideId, filters.guideId), isNull(bookingGuides.releasedAt)))
        .orderBy(asc(bookings.tourDate), asc(bookings.slotStart))
    : await base.where(and(...conditions)).orderBy(asc(bookings.tourDate), asc(bookings.slotStart));

  return rows
    .filter((r) => wibToUtc(r.tourDate, r.slotStart) > now)
    .filter((r) => filters.weekday === undefined || isoWeekday(r.tourDate) === filters.weekday) as BookingRef[];
}
