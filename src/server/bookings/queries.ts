import "server-only";
import { and, asc, count, desc, eq, exists, gte, inArray, isNotNull, isNull, like, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  BOOKING_STATUSES,
  bookingChecklistItems,
  bookingEvents,
  bookingGuides,
  bookings,
  CHANNELS,
  customers,
  feedback,
  feedbackGuideRatings,
  guideLanguages,
  guideLeaves,
  guides,
  guideWorkingDays,
  languages,
  notifications,
  packages,
  payments,
  slots,
  users,
  type BookingStatus,
  type Channel,
} from "@/db/schema";
import { LIVE_STATUSES } from "@/domain/booking-status";
import type { PriceSnapshot } from "@/domain/pricing";
import { addDays, wibToday } from "@/domain/time";
import { briefingForPackage } from "../settings-queries";
import { syncHolds } from "./holds";

export const BOOKING_VIEWS = ["mendatang", "menunggu-pembayaran", "perlu-persiapan", "hari-ini", "semua"] as const;
export type BookingView = (typeof BOOKING_VIEWS)[number];

export type BookingFilters = {
  view: BookingView;
  q?: string;
  statuses?: BookingStatus[];
  from?: string;
  to?: string;
  channel?: Channel;
  languageId?: string;
  guideId?: string;
  createdBy?: string;
  page?: number;
};

export const PAGE_SIZE = 20;

const checklistIncomplete = exists(
  db
    .select({ one: sql`1` })
    .from(bookingChecklistItems)
    .where(and(eq(bookingChecklistItems.bookingId, bookings.id), isNull(bookingChecklistItems.checkedAt))),
);

/** 05 §3.1 list. Runs lazy expiry first (BR-05-11). */
export async function listBookings(filters: BookingFilters) {
  await syncHolds();
  const today = wibToday();
  const conditions: SQL[] = [];
  let order = [asc(bookings.tourDate), asc(bookings.slotStart)];

  switch (filters.view) {
    case "mendatang":
      conditions.push(inArray(bookings.status, [...LIVE_STATUSES]), gte(bookings.tourDate, today));
      break;
    case "menunggu-pembayaran":
      conditions.push(eq(bookings.status, "awaiting_payment"));
      order = [asc(bookings.holdExpiresAt)];
      break;
    case "perlu-persiapan":
      conditions.push(eq(bookings.status, "confirmed"), gte(bookings.tourDate, today), lte(bookings.tourDate, addDays(today, 7)), checklistIncomplete);
      break;
    case "hari-ini":
      conditions.push(eq(bookings.tourDate, today));
      break;
    case "semua":
      order = [desc(bookings.createdAt)];
      break;
  }
  if (filters.q) {
    const q = `%${filters.q}%`;
    conditions.push(or(like(bookings.code, q), like(customers.name, q), like(customers.phoneE164, `%${filters.q.replace(/\D/g, "") || "~"}%`))!);
  }
  if (filters.statuses?.length) conditions.push(inArray(bookings.status, filters.statuses));
  if (filters.from) conditions.push(gte(bookings.tourDate, filters.from));
  if (filters.to) conditions.push(lte(bookings.tourDate, filters.to));
  if (filters.channel) conditions.push(eq(bookings.channel, filters.channel));
  if (filters.languageId) conditions.push(eq(bookings.languageId, filters.languageId));
  if (filters.createdBy) conditions.push(eq(bookings.createdBy, filters.createdBy));
  if (filters.guideId) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(bookingGuides)
          .where(and(eq(bookingGuides.bookingId, bookings.id), eq(bookingGuides.guideId, filters.guideId), isNull(bookingGuides.releasedAt))),
      ),
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const page = Math.max(1, filters.page ?? 1);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: bookings.id,
        code: bookings.code,
        groupRef: bookings.groupRef,
        mergeGroupId: bookings.mergeGroupId,
        status: bookings.status,
        channel: bookings.channel,
        tourDate: bookings.tourDate,
        slotStart: bookings.slotStart,
        slotEnd: bookings.slotEnd,
        people: bookings.people,
        totalAmount: bookings.totalAmount,
        holdExpiresAt: bookings.holdExpiresAt,
        customerId: customers.id,
        customerName: customers.name,
        nationality: customers.nationality,
        languageCode: languages.code,
        languageName: languages.nameId,
      })
      .from(bookings)
      .innerJoin(customers, eq(customers.id, bookings.customerId))
      .innerJoin(languages, eq(languages.id, bookings.languageId))
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(bookings)
      .innerJoin(customers, eq(customers.id, bookings.customerId))
      .where(where),
  ]);

  const ids = rows.map((r) => r.id);
  // Shared tours (12 BR-12-M1): members show the host's guides.
  const guideOwnerIds = [...new Set(rows.map((r) => r.mergeGroupId ?? r.id))];
  const groupIds = [...new Set(rows.map((r) => r.mergeGroupId).filter(Boolean))] as string[];
  const customerIds = [...new Set(rows.map((r) => r.customerId))];
  const [assigned, visits, progress, groupCodes] = await Promise.all([
    guideOwnerIds.length
      ? db
          .select({ bookingId: bookingGuides.bookingId, name: guides.displayName })
          .from(bookingGuides)
          .innerJoin(guides, eq(guides.id, bookingGuides.guideId))
          .where(and(inArray(bookingGuides.bookingId, guideOwnerIds), isNull(bookingGuides.releasedAt)))
      : [],
    customerVisitCounts(customerIds),
    ids.length
      ? db
          .select({ bookingId: bookingChecklistItems.bookingId, total: count(), done: sql<number>`sum(case when ${bookingChecklistItems.checkedAt} is not null then 1 else 0 end)` })
          .from(bookingChecklistItems)
          .where(inArray(bookingChecklistItems.bookingId, ids))
          .groupBy(bookingChecklistItems.bookingId)
      : [],
    groupIds.length
      ? db.select({ id: bookings.id, code: bookings.code, groupId: bookings.mergeGroupId }).from(bookings).where(inArray(bookings.mergeGroupId, groupIds))
      : [],
  ]);

  return {
    total,
    page,
    rows: rows.map((r) => ({
      ...r,
      guideNames: assigned.filter((a) => a.bookingId === (r.mergeGroupId ?? r.id)).map((a) => a.name),
      mergedWith: r.mergeGroupId ? groupCodes.filter((g) => g.groupId === r.mergeGroupId && g.id !== r.id).map((g) => g.code) : [],
      visits: visits.get(r.customerId) ?? 0,
      checklist: progress.find((p) => p.bookingId === r.id) ?? null,
    })),
  };
}

export type BookingListRow = Awaited<ReturnType<typeof listBookings>>["rows"][number];

/** Completed visits per customer (BR-05-20). */
export async function customerVisitCounts(customerIds: string[]) {
  if (customerIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ customerId: bookings.customerId, n: count() })
    .from(bookings)
    .where(and(inArray(bookings.customerId, customerIds), inArray(bookings.status, ["completed", "evaluated"])))
    .groupBy(bookings.customerId);
  return new Map(rows.map((r) => [r.customerId, r.n]));
}

/** Everything the booking detail page shows (05 §3.3 + 06/07/09/10 sections). */
export async function getBookingDetail(id: string) {
  await syncHolds();
  const [row] = await db
    .select({
      booking: bookings,
      customer: customers,
      languageName: languages.nameId,
      languageCode: languages.code,
      packageName: packages.name,
      createdByName: users.name,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(languages, eq(languages.id, bookings.languageId))
    .innerJoin(packages, eq(packages.id, bookings.packageId))
    .innerJoin(users, eq(users.id, bookings.createdBy))
    .where(eq(bookings.id, id));
  if (!row) return null;
  const b = row.booking;
  const guidesOf = b.mergeGroupId ?? b.id;

  const [assigned, paymentRows, checklist, events, messages, fb, linked, visits, briefing] = await Promise.all([
    db
      .select({
        assignment: bookingGuides,
        guide: { id: guides.id, displayName: guides.displayName, fullName: guides.fullName, phoneE164: guides.phoneE164, photoUrl: guides.photoUrl },
      })
      .from(bookingGuides)
      .innerJoin(guides, eq(guides.id, bookingGuides.guideId))
      .where(and(eq(bookingGuides.bookingId, guidesOf), isNull(bookingGuides.releasedAt))),
    db
      .select({ payment: payments, recordedByName: users.name })
      .from(payments)
      .leftJoin(users, eq(users.id, payments.recordedBy))
      .where(eq(payments.bookingId, id))
      .orderBy(desc(payments.paidAt), desc(payments.createdAt)),
    db
      .select({ item: bookingChecklistItems, checkedByName: users.name })
      .from(bookingChecklistItems)
      .leftJoin(users, eq(users.id, bookingChecklistItems.checkedBy))
      .where(eq(bookingChecklistItems.bookingId, id))
      .orderBy(asc(bookingChecklistItems.sortOrder)),
    db
      .select({ event: bookingEvents, actorName: users.name })
      .from(bookingEvents)
      .leftJoin(users, eq(users.id, bookingEvents.actorUserId))
      .where(eq(bookingEvents.bookingId, id))
      .orderBy(desc(bookingEvents.at)),
    db.select().from(notifications).where(eq(notifications.bookingId, id)).orderBy(desc(notifications.createdAt)),
    db.select().from(feedback).where(eq(feedback.bookingId, id)),
    b.groupRef
      ? db
          .select({ id: bookings.id, code: bookings.code, status: bookings.status })
          .from(bookings)
          .where(and(eq(bookings.groupRef, b.groupRef), sql`${bookings.id} <> ${id}`))
      : [],
    customerVisitCounts([b.customerId]),
    briefingForPackage(b.packageId),
  ]);

  const voidedByIds = paymentRows.map((p) => p.payment.voidedBy).filter(Boolean) as string[];
  const voidedBy = voidedByIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, voidedByIds)) : [];
  const ackByIds = assigned.map((a) => a.assignment.acknowledgedBy).filter(Boolean) as string[];
  const ackBy = ackByIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ackByIds)) : [];
  const guideIdsInEvents = new Set<string>();
  for (const e of events) {
    const payload = e.event.payload as { guideId?: string };
    if (payload?.guideId) guideIdsInEvents.add(payload.guideId);
  }
  const eventGuides = guideIdsInEvents.size
    ? await db.select({ id: guides.id, name: guides.displayName }).from(guides).where(inArray(guides.id, [...guideIdsInEvents]))
    : [];
  const feedbackRow = fb[0] ?? null;
  const ratings = feedbackRow
    ? await db
        .select({ guideId: feedbackGuideRatings.guideId, rating: feedbackGuideRatings.rating, name: guides.displayName })
        .from(feedbackGuideRatings)
        .innerJoin(guides, eq(guides.id, feedbackGuideRatings.guideId))
        .where(eq(feedbackGuideRatings.feedbackId, feedbackRow.id))
    : [];
  const enteredByName = feedbackRow?.enteredBy
    ? (await db.select({ name: users.name }).from(users).where(eq(users.id, feedbackRow.enteredBy)))[0]?.name ?? null
    : null;

  const validPayments = paymentRows.filter((p) => !p.payment.voidedAt);
  const paid = validPayments.reduce((sum, p) => sum + p.payment.amount, 0);

  return {
    booking: b,
    snapshot: b.priceSnapshot as PriceSnapshot,
    customer: row.customer,
    visits: visits.get(b.customerId) ?? 0,
    languageName: row.languageName,
    languageCode: row.languageCode,
    packageName: row.packageName,
    createdByName: row.createdByName,
    guides: assigned.map((a) => ({
      ...a.guide,
      ...a.assignment,
      assignmentId: a.assignment.id,
      acknowledgedByName: ackBy.find((u) => u.id === a.assignment.acknowledgedBy)?.name ?? null,
    })),
    payments: paymentRows.map((p) => ({
      ...p.payment,
      recordedByName: p.recordedByName,
      voidedByName: voidedBy.find((v) => v.id === p.payment.voidedBy)?.name ?? null,
    })),
    paymentSummary: { total: b.totalAmount, paid, balance: b.totalAmount - paid, hasPayment: validPayments.some((p) => p.payment.kind === "payment") },
    checklist: checklist.map((c) => ({ ...c.item, checkedByName: c.checkedByName })),
    events: events.map((e) => ({
      ...e.event,
      actorName: e.actorName,
      guideName: eventGuides.find((g) => g.id === (e.event.payload as { guideId?: string })?.guideId)?.name ?? null,
    })),
    messages,
    feedback: feedbackRow ? { ...feedbackRow, ratings, enteredByName } : null,
    linked,
    briefing,
    group: await sharedTour(b),
  };
}

/** 12 §3.1 "Tur gabungan": every booking served by the same guides, host first. */
async function sharedTour(b: { id: string; mergeGroupId: string | null }) {
  if (!b.mergeGroupId) return null;
  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      people: bookings.people,
      mergedAt: bookings.mergedAt,
      tourDate: bookings.tourDate,
      slotStart: bookings.slotStart,
      customerName: customers.name,
      nationality: customers.nationality,
      packageName: packages.name,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(packages, eq(packages.id, bookings.packageId))
    .where(eq(bookings.mergeGroupId, b.mergeGroupId))
    .orderBy(asc(bookings.mergedAt));
  const hostId = b.mergeGroupId;
  const members = [...rows.filter((r) => r.id === hostId), ...rows.filter((r) => r.id !== hostId)].map((r) => ({ ...r, isHost: r.id === hostId }));
  return {
    hostId,
    hostCode: members.find((m) => m.isHost)?.code ?? "",
    totalPeople: members.reduce((sum, m) => sum + m.people, 0),
    members,
  };
}

export type BookingDetail = NonNullable<Awaited<ReturnType<typeof getBookingDetail>>>;

/** 05 §3.6 Papan Jadwal for one date. */
export async function getScheduleBoard(date: string, opts: { includeInactive?: boolean } = {}) {
  await syncHolds();
  const [slotRows, guideRows, langs, days, leaves, dayBookings] = await Promise.all([
    db.select().from(slots).orderBy(asc(slots.startTime)),
    db.select().from(guides).orderBy(asc(guides.displayName)),
    db
      .select({ guideId: guideLanguages.guideId, languageId: languages.id, code: languages.code })
      .from(guideLanguages)
      .innerJoin(languages, eq(languages.id, guideLanguages.languageId)),
    db.select().from(guideWorkingDays),
    db
      .select()
      .from(guideLeaves)
      .where(and(eq(guideLeaves.status, "approved"), lte(guideLeaves.startDate, date), gte(guideLeaves.endDate, date))),
    db
      .select({
        guideId: bookingGuides.guideId,
        slotId: bookingGuides.slotId,
        bookingId: bookings.id,
        code: bookings.code,
        status: bookings.status,
        people: bookings.people,
        customerName: customers.name,
        mergeGroupId: bookings.mergeGroupId,
      })
      .from(bookingGuides)
      .innerJoin(bookings, eq(bookings.id, bookingGuides.bookingId))
      .innerJoin(customers, eq(customers.id, bookings.customerId))
      .where(and(eq(bookingGuides.tourDate, date), isNull(bookingGuides.releasedAt), sql`${bookings.status} <> 'cancelled'`)),
  ]);
  // 12 §3.2: a shared tour sits in the host's cells once, as "{kode} +n" with the summed people.
  const hostIds = [...new Set(dayBookings.filter((b) => b.mergeGroupId === b.bookingId).map((b) => b.bookingId))];
  const groupTotals = hostIds.length
    ? await db
        .select({ hostId: bookings.mergeGroupId, n: count(), people: sql<number>`sum(${bookings.people})` })
        .from(bookings)
        .where(and(inArray(bookings.mergeGroupId, hostIds), sql`${bookings.status} <> 'cancelled'`))
        .groupBy(bookings.mergeGroupId)
    : [];
  const guidesWithBookings = new Set(dayBookings.map((b) => b.guideId));
  const slotsWithBookings = new Set(dayBookings.map((b) => b.slotId));
  return {
    slots: slotRows.filter((s) => s.isActive || slotsWithBookings.has(s.id)),
    guides: guideRows
      .filter((g) => g.isActive || opts.includeInactive || guidesWithBookings.has(g.id))
      .map((g) => ({
        id: g.id,
        displayName: g.displayName,
        photoUrl: g.photoUrl,
        fullName: g.fullName,
        isActive: g.isActive,
        languages: langs.filter((l) => l.guideId === g.id).map((l) => ({ id: l.languageId, code: l.code })),
        weekdays: days.filter((d) => d.guideId === g.id).map((d) => d.weekday),
        onLeave: leaves.some((l) => l.guideId === g.id),
      })),
    bookings: dayBookings.map(({ mergeGroupId, ...b }) => {
      const group = mergeGroupId ? groupTotals.find((g) => g.hostId === b.bookingId) : undefined;
      return group && group.n > 1 ? { ...b, code: `${b.code} +${group.n - 1}`, people: Number(group.people) } : b;
    }),
  };
}

/* ---------------- customers (05 §3.7) ---------------- */

export async function listCustomers(filters: { q?: string; nationality?: string; page?: number }) {
  const conditions: SQL[] = [];
  if (filters.q) conditions.push(or(like(customers.name, `%${filters.q}%`), like(customers.phoneE164, `%${filters.q.replace(/\D/g, "") || "~"}%`))!);
  if (filters.nationality) conditions.push(eq(customers.nationality, filters.nationality));
  const where = conditions.length ? and(...conditions) : undefined;
  const page = Math.max(1, filters.page ?? 1);
  const visitsSql = sql<number>`(select count(*) from bookings b where b.customer_id = ${customers.id} and b.status in ('completed','evaluated'))`;
  const lastSql = sql<string | null>`(select max(b.tour_date) from bookings b where b.customer_id = ${customers.id} and b.status in ('completed','evaluated'))`;
  const [rows, [{ total }], nationalities] = await Promise.all([
    db
      .select({ customer: customers, visits: visitsSql, lastVisit: lastSql })
      .from(customers)
      .where(where)
      .orderBy(asc(customers.name))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(customers).where(where),
    db.selectDistinct({ code: customers.nationality }).from(customers),
  ]);
  return { rows: rows.map((r) => ({ ...r.customer, visits: Number(r.visits), lastVisit: r.lastVisit })), total, page, nationalities: nationalities.map((n) => n.code) };
}

export async function getCustomerDetail(id: string) {
  const customer = await db.query.customers.findFirst({ where: eq(customers.id, id) });
  if (!customer) return null;
  const [history, ratings] = await Promise.all([
    db
      .select({
        id: bookings.id,
        code: bookings.code,
        tourDate: bookings.tourDate,
        slotStart: bookings.slotStart,
        slotEnd: bookings.slotEnd,
        status: bookings.status,
        people: bookings.people,
        totalAmount: bookings.totalAmount,
        languageName: languages.nameId,
      })
      .from(bookings)
      .innerJoin(languages, eq(languages.id, bookings.languageId))
      .where(eq(bookings.customerId, id))
      .orderBy(desc(bookings.tourDate)),
    db
      .select({ bookingId: feedback.bookingId, code: bookings.code, overall: feedback.overallRating, comment: feedback.comment, submittedAt: feedback.submittedAt })
      .from(feedback)
      .innerJoin(bookings, eq(bookings.id, feedback.bookingId))
      .where(and(eq(bookings.customerId, id), isNotNull(feedback.submittedAt)))
      .orderBy(desc(feedback.submittedAt)),
  ]);
  return { customer, history, ratings, visits: history.filter((h) => h.status === "completed" || h.status === "evaluated").length };
}

/* ---------------- filter options ---------------- */

export async function bookingFilterOptions() {
  const [langs, guideRows, staff] = await Promise.all([
    db.select({ id: languages.id, name: languages.nameId }).from(languages).orderBy(asc(languages.sortOrder)),
    db.select({ id: guides.id, name: guides.displayName }).from(guides).orderBy(asc(guides.displayName)),
    db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.role, ["admin", "staff"])).orderBy(asc(users.name)),
  ]);
  return { languages: langs, guides: guideRows, staff, statuses: BOOKING_STATUSES, channels: CHANNELS };
}
