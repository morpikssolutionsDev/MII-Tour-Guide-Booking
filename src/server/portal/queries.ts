import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bookingGuides,
  bookings,
  customers,
  feedback,
  feedbackGuideRatings,
  guideLanguages,
  guideLeaves,
  guides,
  guideWorkingDays,
  languages,
  packages,
  notifications,
  type BookingStatus,
} from "@/db/schema";
import type { PriceSnapshot } from "@/domain/pricing";
import { addDays, toWib, wibToUtc } from "@/domain/time";
import { expireHolds } from "../bookings/holds";
import { feedbackUrl } from "../feedback/tokens";
import { briefingForPackage } from "../settings-queries";

// 08-portal-guide.md: every query is scoped to the session's guide (BR-08-1) and returns
// GuideTourView-shaped data without prices, payments, internal notes or channel (BR-08-3).

const VISIBLE: BookingStatus[] = ["confirmed", "ready", "completed", "evaluated", "no_show", "cancelled"];

export type TourCardView = {
  bookingId: string;
  code: string;
  tourDate: string;
  slotStart: string;
  slotEnd: string;
  status: BookingStatus;
  customerName: string;
  nationality: string;
  languageCode: string;
  languageName: string;
  people: number;
  packageName: string;
  coGuides: string[];
  acknowledged: boolean;
  shortNotice: boolean;
  /** Display-only "Berlangsung" (BR-08-6). */
  ongoing: boolean;
  started: boolean;
};

/** Assignments visible to the guide: active, or released after being notified (BR-08-1/2). */
async function guideTourRows(guideId: string, range: { from?: string; to?: string; ids?: string[] }) {
  return db
    .select({
      assignment: bookingGuides,
      booking: bookings,
      customerName: customers.name,
      nationality: customers.nationality,
      languageCode: languages.code,
      languageName: languages.nameId,
      packageName: packages.name,
    })
    .from(bookingGuides)
    .innerJoin(bookings, eq(bookings.id, bookingGuides.bookingId))
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(languages, eq(languages.id, bookings.languageId))
    .innerJoin(packages, eq(packages.id, bookings.packageId))
    .where(
      and(
        eq(bookingGuides.guideId, guideId),
        or(isNull(bookingGuides.releasedAt), isNotNull(bookingGuides.notifiedAt)),
        inArray(bookings.status, VISIBLE),
        range.from ? gte(bookings.tourDate, range.from) : undefined,
        range.to ? lte(bookings.tourDate, range.to) : undefined,
        range.ids ? inArray(bookings.id, range.ids) : undefined,
      ),
    )
    .orderBy(asc(bookings.tourDate), asc(bookings.slotStart));
}

async function toCards(guideId: string, rows: Awaited<ReturnType<typeof guideTourRows>>, now: Date): Promise<TourCardView[]> {
  // A cancelled booking is visible only when this guide had been notified (BR-08-2).
  const visible = rows.filter((r) => r.booking.status !== "cancelled" || r.assignment.notifiedAt);
  // Released assignments only show when the booking itself was cancelled (history).
  const relevant = visible.filter((r) => !r.assignment.releasedAt || r.booking.status === "cancelled");
  const ids = [...new Set(relevant.map((r) => r.booking.id))];
  const others = ids.length
    ? await db
        .select({ bookingId: bookingGuides.bookingId, name: guides.displayName })
        .from(bookingGuides)
        .innerJoin(guides, eq(guides.id, bookingGuides.guideId))
        .where(and(inArray(bookingGuides.bookingId, ids), isNull(bookingGuides.releasedAt), ne(bookingGuides.guideId, guideId)))
    : [];
  const seen = new Set<string>();
  return relevant
    .filter((r) => (seen.has(r.booking.id) ? false : (seen.add(r.booking.id), true)))
    .map((r) => {
      const start = wibToUtc(r.booking.tourDate, r.booking.slotStart);
      const end = wibToUtc(r.booking.tourDate, r.booking.slotEnd);
      const paid = r.booking.status === "confirmed" || r.booking.status === "ready";
      return {
        bookingId: r.booking.id,
        code: r.booking.code,
        tourDate: r.booking.tourDate,
        slotStart: r.booking.slotStart,
        slotEnd: r.booking.slotEnd,
        status: r.booking.status,
        customerName: r.customerName,
        nationality: r.nationality,
        languageCode: r.languageCode,
        languageName: r.languageName,
        people: r.booking.people,
        packageName: (r.booking.priceSnapshot as PriceSnapshot).package.name ?? r.packageName,
        coGuides: others.filter((o) => o.bookingId === r.booking.id).map((o) => o.name),
        acknowledged: Boolean(r.assignment.acknowledgedAt),
        shortNotice: r.assignment.shortNotice,
        ongoing: paid && now >= start && now < end,
        started: now >= start,
      };
    });
}

/** 08 §3.1 Hari Ini. */
export async function getGuideToday(guideId: string) {
  await expireHolds();
  const now = new Date();
  const today = toWib(now).date;
  const upcomingRows = await guideTourRows(guideId, { from: today });
  const cards = await toCards(guideId, upcomingRows, now);
  const needsConfirm = cards.filter((c) => (c.status === "confirmed" || c.status === "ready") && !c.acknowledged && !c.started);
  const todayTours = cards.filter((c) => c.tourDate === today && c.status !== "cancelled");
  const next = cards.find((c) => c.tourDate > today && (c.status === "confirmed" || c.status === "ready")) ?? null;
  return { today, needsConfirm, todayTours, next };
}

/** 08 §3.2 Jadwal: upcoming (from tomorrow), a calendar month, or the last 90 days. */
export async function listGuideTours(guideId: string, view: "mendatang" | "kalender" | "riwayat", month?: string) {
  await expireHolds();
  const now = new Date();
  const today = toWib(now).date;
  let from: string;
  let to: string;
  if (view === "riwayat") {
    from = addDays(today, -90);
    to = today;
  } else if (view === "kalender") {
    const m = month && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
    from = `${m}-01`;
    to = addDays(`${m}-01`, 41);
  } else {
    from = addDays(today, 1);
    to = addDays(today, 120);
  }
  const cards = await toCards(guideId, await guideTourRows(guideId, { from, to }), now);
  const leaves = await db
    .select({ startDate: guideLeaves.startDate, endDate: guideLeaves.endDate })
    .from(guideLeaves)
    .where(and(eq(guideLeaves.guideId, guideId), eq(guideLeaves.status, "approved"), lte(guideLeaves.startDate, to), gte(guideLeaves.endDate, from)));

  if (view === "riwayat") {
    const past = cards.filter((c) => ["completed", "evaluated", "no_show", "cancelled"].includes(c.status));
    const ratings = past.length
      ? await db
          .select({ bookingId: feedback.bookingId, rating: feedbackGuideRatings.rating })
          .from(feedbackGuideRatings)
          .innerJoin(feedback, eq(feedback.id, feedbackGuideRatings.feedbackId))
          .where(and(eq(feedbackGuideRatings.guideId, guideId), inArray(feedback.bookingId, past.map((c) => c.bookingId))))
      : [];
    return { cards: past.reverse().map((c) => ({ ...c, rating: ratings.find((r) => r.bookingId === c.bookingId)?.rating ?? null })), leaves, from, to };
  }
  return { cards: cards.map((c) => ({ ...c, rating: null as number | null })), leaves, from, to };
}

/** 08 §3.3 tour detail (GuideTourView). Null when the guide may not see it (→ 404, BR-08-1). */
export async function getGuideTour(guideId: string, bookingId: string) {
  await expireHolds();
  const now = new Date();
  const rows = await guideTourRows(guideId, { ids: [bookingId] });
  const own = rows[0];
  if (!own) return null;
  const isReleased = Boolean(own.assignment.releasedAt);
  if (own.booking.status === "cancelled" && !own.assignment.notifiedAt) return null;
  if (isReleased && own.booking.status !== "cancelled") return null;
  const b = own.booking;
  const snapshot = b.priceSnapshot as PriceSnapshot;

  const [customer, team, briefing, fb] = await Promise.all([
    db.query.customers.findFirst({ where: eq(customers.id, b.customerId), columns: { name: true, nationality: true, phoneE164: true } }),
    db
      .select({ guideId: guides.id, name: guides.displayName, phone: guides.phoneE164, acknowledgedAt: bookingGuides.acknowledgedAt })
      .from(bookingGuides)
      .innerJoin(guides, eq(guides.id, bookingGuides.guideId))
      .where(and(eq(bookingGuides.bookingId, b.id), isNull(bookingGuides.releasedAt), ne(bookingGuides.guideId, guideId))),
    briefingForPackage(b.packageId),
    db.select().from(feedback).where(eq(feedback.bookingId, b.id)),
  ]);
  const feedbackRow = fb[0] ?? null;
  const ownRating = feedbackRow?.submittedAt
    ? (await db
        .select({ rating: feedbackGuideRatings.rating })
        .from(feedbackGuideRatings)
        .where(and(eq(feedbackGuideRatings.feedbackId, feedbackRow.id), eq(feedbackGuideRatings.guideId, guideId))))[0]?.rating ?? null
    : null;
  const feedbackRequest = feedbackRow && !feedbackRow.submittedAt
    ? (await db
        .select({ body: notifications.body })
        .from(notifications)
        .where(and(eq(notifications.bookingId, b.id), eq(notifications.eventKey, "feedback_request")))
        .orderBy(desc(notifications.createdAt))
        .limit(1))[0]?.body ?? null
    : null;
  const start = wibToUtc(b.tourDate, b.slotStart);
  const end = wibToUtc(b.tourDate, b.slotEnd);
  const paid = b.status === "confirmed" || b.status === "ready";

  return {
    bookingId: b.id,
    code: b.code,
    tourDate: b.tourDate,
    slotStart: b.slotStart,
    slotEnd: b.slotEnd,
    status: b.status,
    cancelledAt: b.cancelledAt,
    shortNotice: own.assignment.shortNotice,
    acknowledgedAt: own.assignment.acknowledgedAt,
    isReleased,
    started: now >= start,
    ongoing: paid && now >= start && now < end,
    customer: { name: customer?.name ?? "", nationality: customer?.nationality ?? "", phone: customer?.phoneE164 ?? "" },
    people: b.people,
    languageName: own.languageName,
    languageCode: own.languageCode,
    packageName: snapshot.package.name,
    facilities: snapshot.facilities,
    addonNames: snapshot.addons.map((a) => a.name),
    specialNeeds: b.specialNeeds,
    team,
    briefing,
    feedback: feedbackRow
      ? {
          submitted: Boolean(feedbackRow.submittedAt),
          ownRating,
          comment: feedbackRow.submittedAt ? feedbackRow.comment : null,
          url: feedbackRow.submittedAt ? null : feedbackUrl(feedbackRow.token),
          expiresAt: feedbackRow.tokenExpiresAt,
          expired: Date.parse(feedbackRow.tokenExpiresAt) <= now.getTime(),
          whatsappText: feedbackRequest,
        }
      : null,
    // The fallback form rates every assigned guide, this guide included (BR-10-3).
    guidesToRate: isReleased ? [] : [{ id: guideId, name: (await db.query.guides.findFirst({ where: eq(guides.id, guideId), columns: { displayName: true } }))?.displayName ?? "" }, ...team.map((g) => ({ id: g.guideId, name: g.name }))],
  };
}

export type GuideTourDetail = NonNullable<Awaited<ReturnType<typeof getGuideTour>>>;

export async function getGuideProfile(guideId: string) {
  const guide = await db.query.guides.findFirst({ where: eq(guides.id, guideId) });
  if (!guide) return null;
  const [langs, days] = await Promise.all([
    db
      .select({ code: languages.code, name: languages.nameId })
      .from(guideLanguages)
      .innerJoin(languages, eq(languages.id, guideLanguages.languageId))
      .where(eq(guideLanguages.guideId, guideId)),
    db.select({ weekday: guideWorkingDays.weekday }).from(guideWorkingDays).where(eq(guideWorkingDays.guideId, guideId)),
  ]);
  return { guide, languages: langs, weekdays: days.map((d) => d.weekday).sort() };
}

export async function listOwnLeaves(guideId: string) {
  return db.select().from(guideLeaves).where(eq(guideLeaves.guideId, guideId)).orderBy(desc(guideLeaves.createdAt));
}
