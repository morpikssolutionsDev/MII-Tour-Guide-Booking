import "server-only";
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bookingChecklistItems,
  bookingGuides,
  bookings,
  customers,
  feedback,
  feedbackGuideRatings,
  guideLeaves,
  guides,
  guideWorkingDays,
  languages,
  payments,
  type BookingStatus,
} from "@/db/schema";
import { isGuideWorking } from "@/domain/availability";
import { addDays, wibToday } from "@/domain/time";
import { expireHolds } from "@/server/bookings/holds";
import { findLiveConflicts } from "@/server/bookings/conflicts";
import type { Role } from "@/db/schema";

const BOOKED: BookingStatus[] = ["confirmed", "ready", "completed", "evaluated", "no_show"];
const WIDGET_ROWS = 5;

/** 11 §3.1 Beranda. Ignores Laporan filters and always uses "now" in WIB (BR-11-8). */
export async function getDashboard(role: Role, now: Date = new Date()) {
  await expireHolds(now);
  const today = wibToday(now);
  const [tours, expiring, guidesToday, notAcked, prep, leave, balance, latestFeedback] = await Promise.all([
    toursToday(today),
    expiringSoon(now),
    guidesOnDuty(today),
    unacknowledged(today),
    prepIncomplete(today),
    role === "admin" ? pendingLeave() : Promise.resolve(null),
    balanceMismatch(),
    recentFeedback(),
  ]);
  return { today, tours, expiring, guides: guidesToday, notAcked, prep, leave, balance, feedback: latestFeedback };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

async function guideNamesFor(bookingIds: string[]) {
  if (bookingIds.length === 0) return new Map<string, string[]>();
  const rows = await db
    .select({ bookingId: bookingGuides.bookingId, name: guides.displayName })
    .from(bookingGuides)
    .innerJoin(guides, eq(guides.id, bookingGuides.guideId))
    .where(and(inArray(bookingGuides.bookingId, bookingIds), isNull(bookingGuides.releasedAt)));
  const out = new Map<string, string[]>();
  for (const r of rows) out.set(r.bookingId, [...(out.get(r.bookingId) ?? []), r.name]);
  return out;
}

/** Widget 1 + KPI "Tur hari ini". */
async function toursToday(today: string) {
  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      slotStart: bookings.slotStart,
      slotEnd: bookings.slotEnd,
      people: bookings.people,
      customerName: customers.name,
      languageCode: languages.code,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(languages, eq(languages.id, bookings.languageId))
    .where(and(eq(bookings.tourDate, today), inArray(bookings.status, BOOKED)))
    .orderBy(asc(bookings.slotStart), asc(bookings.code));
  const names = await guideNamesFor(rows.map((r) => r.id));
  return {
    total: rows.length,
    done: rows.filter((r) => r.status === "completed" || r.status === "evaluated").length,
    rows: rows.map((r) => ({ ...r, guideNames: names.get(r.id) ?? [] })),
  };
}

/** Widget 2: holds expiring within 6 hours, soonest first. */
async function expiringSoon(now: Date) {
  const limit = new Date(now.getTime() + 6 * 3_600_000).toISOString();
  const [rows, [awaiting]] = await Promise.all([
    db
      .select({ id: bookings.id, code: bookings.code, holdExpiresAt: bookings.holdExpiresAt, total: bookings.totalAmount, customerName: customers.name })
      .from(bookings)
      .innerJoin(customers, eq(customers.id, bookings.customerId))
      .where(and(eq(bookings.status, "awaiting_payment"), gt(bookings.holdExpiresAt, now.toISOString()), lte(bookings.holdExpiresAt, limit)))
      .orderBy(asc(bookings.holdExpiresAt)),
    db.select({ n: count() }).from(bookings).where(eq(bookings.status, "awaiting_payment")),
  ]);
  return { awaiting: awaiting.n, count: rows.length, rows: rows.slice(0, WIDGET_ROWS) };
}

/** KPI "Guide bertugas hari ini": busy / working, plus guides on leave. */
async function guidesOnDuty(today: string) {
  const [rows, days, leaves, busy] = await Promise.all([
    db.select({ id: guides.id, isActive: guides.isActive }).from(guides).where(eq(guides.isActive, true)),
    db.select().from(guideWorkingDays),
    db
      .select({ guideId: guideLeaves.guideId, startDate: guideLeaves.startDate, endDate: guideLeaves.endDate })
      .from(guideLeaves)
      .where(and(eq(guideLeaves.status, "approved"), lte(guideLeaves.startDate, today), gte(guideLeaves.endDate, today))),
    db
      .selectDistinct({ guideId: bookingGuides.guideId })
      .from(bookingGuides)
      .innerJoin(bookings, eq(bookings.id, bookingGuides.bookingId))
      .where(and(eq(bookingGuides.tourDate, today), isNull(bookingGuides.releasedAt), notInArray(bookings.status, ["cancelled"]))),
  ]);
  const working = rows.filter((g) =>
    isGuideWorking(
      {
        id: g.id,
        displayName: "",
        languageIds: [],
        isActive: g.isActive,
        weekdays: days.filter((d) => d.guideId === g.id).map((d) => d.weekday),
        approvedLeaves: leaves.filter((l) => l.guideId === g.id),
      },
      today,
    ),
  ).length;
  const onLeave = new Set(leaves.map((l) => l.guideId)).size;
  return { busy: busy.length, working, onLeave };
}

/** Widget 4 + KPI "Belum konfirmasi": notified, unacknowledged, tour ≤ today + 7, oldest notice first. */
async function unacknowledged(today: string) {
  const rows = await db
    .select({
      bookingId: bookings.id,
      code: bookings.code,
      tourDate: bookings.tourDate,
      guideId: guides.id,
      guideName: guides.displayName,
      notifiedAt: bookingGuides.notifiedAt,
      shortNotice: bookingGuides.shortNotice,
    })
    .from(bookingGuides)
    .innerJoin(bookings, eq(bookings.id, bookingGuides.bookingId))
    .innerJoin(guides, eq(guides.id, bookingGuides.guideId))
    .where(
      and(
        isNull(bookingGuides.releasedAt),
        isNotNull(bookingGuides.notifiedAt),
        isNull(bookingGuides.acknowledgedAt),
        inArray(bookings.status, ["confirmed", "ready"]),
        gte(bookings.tourDate, today),
        lte(bookings.tourDate, addDays(today, 7)),
      ),
    )
    .orderBy(asc(bookingGuides.notifiedAt));
  const nearest = rows.reduce<string | null>((min, r) => (min === null || r.tourDate < min ? r.tourDate : min), null);
  return { count: rows.length, nearest, rows: rows.slice(0, WIDGET_ROWS) };
}

/** Widget 3: confirmed, tour ≤ today + 2, checklist incomplete. */
async function prepIncomplete(today: string) {
  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      tourDate: bookings.tourDate,
      slotStart: bookings.slotStart,
      slotEnd: bookings.slotEnd,
      total: sql<number>`count(${bookingChecklistItems.id})`,
      done: sql<number>`count(${bookingChecklistItems.checkedAt})`,
    })
    .from(bookings)
    .innerJoin(bookingChecklistItems, eq(bookingChecklistItems.bookingId, bookings.id))
    .where(and(eq(bookings.status, "confirmed"), gte(bookings.tourDate, today), lte(bookings.tourDate, addDays(today, 2))))
    .groupBy(bookings.id)
    .having(sql`count(${bookingChecklistItems.checkedAt}) < count(${bookingChecklistItems.id})`)
    .orderBy(asc(bookings.tourDate), asc(bookings.slotStart));
  return { count: rows.length, rows: rows.slice(0, WIDGET_ROWS).map((r) => ({ ...r, total: Number(r.total), done: Number(r.done) })) };
}

/** Widget 5 (admin only): pending leave with live-booking conflicts. */
async function pendingLeave() {
  const rows = await db
    .select({ id: guideLeaves.id, guideId: guideLeaves.guideId, startDate: guideLeaves.startDate, endDate: guideLeaves.endDate, guideName: guides.displayName })
    .from(guideLeaves)
    .innerJoin(guides, eq(guides.id, guideLeaves.guideId))
    .where(eq(guideLeaves.status, "pending"))
    .orderBy(asc(guideLeaves.createdAt));
  const shown = rows.slice(0, WIDGET_ROWS);
  const conflicts = await Promise.all(shown.map((r) => findLiveConflicts({ guideId: r.guideId, from: r.startDate, to: r.endDate })));
  return { count: rows.length, rows: shown.map((r, i) => ({ ...r, conflicts: conflicts[i].length })) };
}

/** Widget 6: settled bookings whose valid payments differ from the total. */
async function balanceMismatch() {
  const paid = sql<number>`coalesce(sum(case when ${payments.voidedAt} is null then ${payments.amount} else 0 end), 0)`;
  const rows = await db
    .select({ id: bookings.id, code: bookings.code, total: bookings.totalAmount, paid })
    .from(bookings)
    .leftJoin(payments, eq(payments.bookingId, bookings.id))
    .where(notInArray(bookings.status, ["awaiting_payment", "cancelled"]))
    .groupBy(bookings.id)
    .having(sql`${paid} <> ${bookings.totalAmount}`)
    .orderBy(desc(bookings.tourDate));
  return { count: rows.length, rows: rows.slice(0, WIDGET_ROWS).map((r) => ({ ...r, balance: r.total - Number(r.paid) })) };
}

/** Widget 7: the last 5 submitted feedback entries. */
async function recentFeedback() {
  const rows = await db
    .select({ id: feedback.id, bookingId: feedback.bookingId, code: bookings.code, overall: feedback.overallRating, comment: feedback.comment, submittedAt: feedback.submittedAt })
    .from(feedback)
    .innerJoin(bookings, eq(bookings.id, feedback.bookingId))
    .where(isNotNull(feedback.submittedAt))
    .orderBy(desc(feedback.submittedAt))
    .limit(WIDGET_ROWS);
  const ratings = rows.length
    ? await db
        .select({ feedbackId: feedbackGuideRatings.feedbackId, name: guides.displayName, rating: feedbackGuideRatings.rating })
        .from(feedbackGuideRatings)
        .innerJoin(guides, eq(guides.id, feedbackGuideRatings.guideId))
        .where(inArray(feedbackGuideRatings.feedbackId, rows.map((r) => r.id)))
    : [];
  return rows.map((r) => ({ ...r, guides: ratings.filter((g) => g.feedbackId === r.id) }));
}
