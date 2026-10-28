import "server-only";
import { and, asc, eq, exists, gte, inArray, isNotNull, isNull, lt, lte, ne, sql, type SQL } from "drizzle-orm";
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
  payments,
  slots,
  users,
  type BookingStatus,
  type Channel,
} from "@/db/schema";
import { isGuideWorking } from "@/domain/availability";
import { bucketStart, bucketsFor, leadTimeBucket, ratio, trailingMonths, type LeadTime, type Period } from "@/domain/metrics";
import { addDays, daysBetween, eachDay, toWib, wibToUtc } from "@/domain/time";
import { formatSlot } from "@/lib/format";

export type ReportFilters = { channels: Channel[]; languageIds: string[]; packageIds: string[]; guideIds: string[] };

const DONE: BookingStatus[] = ["completed", "evaluated"];
const BOOKED: BookingStatus[] = ["confirmed", "ready", "completed", "evaluated", "no_show"];

/** WIB calendar bounds as UTC ISO strings, end exclusive. */
function instantRange(p: Period) {
  return { from: wibToUtc(p.from).toISOString(), to: wibToUtc(addDays(p.to, 1)).toISOString() };
}

/** A merged booking is served by its shared tour host's guides (12 BR-12-M12). */
const servedBy = sql`coalesce(${bookings.mergeGroupId}, ${bookings.id})`;

/** BR-11-2: filters apply to the booking; Tour Guide = at least one non-released assignment. */
function bookingFilters(f: ReportFilters): SQL[] {
  const out: SQL[] = [];
  if (f.channels.length) out.push(inArray(bookings.channel, f.channels));
  if (f.languageIds.length) out.push(inArray(bookings.languageId, f.languageIds));
  if (f.packageIds.length) out.push(inArray(bookings.packageId, f.packageIds));
  if (f.guideIds.length) {
    out.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(bookingGuides)
          .where(and(eq(bookingGuides.bookingId, servedBy), inArray(bookingGuides.guideId, f.guideIds), isNull(bookingGuides.releasedAt))),
      ),
    );
  }
  return out;
}

const inPeriod = (p: Period) => and(gte(bookings.tourDate, p.from), lte(bookings.tourDate, p.to));

/* ---------------- headline numbers (§3.2) ---------------- */

async function bookingCounts(p: Period, f: ReportFilters) {
  const rows = await db
    .select({ status: bookings.status, n: sql<number>`count(*)` })
    .from(bookings)
    .where(and(inPeriod(p), ...bookingFilters(f)))
    .groupBy(bookings.status);
  const cancelled = Number(rows.find((r) => r.status === "cancelled")?.n ?? 0);
  const total = rows.reduce((s, r) => s + Number(r.n), 0);
  return { bookings: total - cancelled, cancelled, all: total, byStatus: rows.map((r) => ({ status: r.status, n: Number(r.n) })) };
}

/** BR-11-3 / BR-06-9 */
async function revenue(p: Period, f: ReportFilters) {
  const range = instantRange(p);
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .where(and(isNull(payments.voidedAt), gte(payments.paidAt, range.from), lt(payments.paidAt, range.to), ...bookingFilters(f)));
  return Number(row.total);
}

/** Guides with availability inputs for the period (current working days, approved leave). */
async function guidesForPeriod(p: Period, f: ReportFilters) {
  const [rows, langs, days, leaves] = await Promise.all([
    db.select().from(guides),
    db.select().from(guideLanguages),
    db.select().from(guideWorkingDays),
    db.select().from(guideLeaves).where(and(eq(guideLeaves.status, "approved"), lte(guideLeaves.startDate, p.to), gte(guideLeaves.endDate, p.from))),
  ]);
  return rows
    .map((g) => ({
      id: g.id,
      displayName: g.displayName,
      isActive: g.isActive,
      languageIds: langs.filter((l) => l.guideId === g.id).map((l) => l.languageId),
      weekdays: days.filter((d) => d.guideId === g.id).map((d) => d.weekday),
      approvedLeaves: leaves.filter((l) => l.guideId === g.id).map((l) => ({ startDate: l.startDate, endDate: l.endDate })),
    }))
    .filter((g) => (f.guideIds.length ? f.guideIds.includes(g.id) : true))
    .filter((g) => (f.languageIds.length ? g.languageIds.some((l) => f.languageIds.includes(l)) : true));
}

/** BR-11-4, overall and per guide. */
async function utilisation(p: Period, f: ReportFilters) {
  // All three in one round trip; booked counts are narrowed to the period's guides afterwards.
  const [guideRows, [{ n: slotCount }], booked] = await Promise.all([
    guidesForPeriod(p, f),
    db.select({ n: sql<number>`count(*)` }).from(slots).where(eq(slots.isActive, true)),
    db
      .select({ guideId: bookingGuides.guideId, n: sql<number>`count(*)` })
      .from(bookingGuides)
      .innerJoin(bookings, eq(bookings.id, bookingGuides.bookingId))
      .where(and(isNull(bookingGuides.releasedAt), inArray(bookings.status, BOOKED), inPeriod(p), ...bookingFilters({ ...f, guideIds: [] })))
      .groupBy(bookingGuides.guideId),
  ]);
  const days = eachDay(p.from, p.to);
  const availableByGuide = new Map<string, number>();
  for (const g of guideRows) {
    availableByGuide.set(g.id, days.filter((d) => isGuideWorking(g, d)).length * Number(slotCount));
  }
  const bookedByGuide = new Map(booked.filter((b) => availableByGuide.has(b.guideId)).map((b) => [b.guideId, Number(b.n)]));
  const totalBooked = [...bookedByGuide.values()].reduce((s, n) => s + n, 0);
  const totalAvailable = [...availableByGuide.values()].reduce((s, n) => s + n, 0);
  return { overall: ratio(totalBooked, totalAvailable), bookedByGuide, availableByGuide, activeGuides: guideRows.filter((g) => g.isActive).length };
}

async function ratingAverage(p: Period, f: ReportFilters) {
  const range = instantRange(p);
  const [row] = await db
    .select({ avg: sql<number | null>`avg(${feedback.overallRating})`, n: sql<number>`count(*)` })
    .from(feedback)
    .innerJoin(bookings, eq(bookings.id, feedback.bookingId))
    .where(and(isNotNull(feedback.submittedAt), gte(feedback.submittedAt, range.from), lt(feedback.submittedAt, range.to), ...bookingFilters(f)));
  return { avg: row.avg === null ? null : Number(row.avg), count: Number(row.n) };
}

/**
 * BR-11-5, in one query: lifetime completed tours of each customer who completed one in the period.
 * Every such customer has a row (their in-period tour counts), so the rows are the denominator.
 */
async function returningShare(p: Period, f: ReportFilters) {
  const inPeriodCustomers = db
    .selectDistinct({ customerId: bookings.customerId })
    .from(bookings)
    .where(and(inPeriod(p), inArray(bookings.status, DONE), ...bookingFilters(f)));
  const lifetime = await db
    .select({ customerId: bookings.customerId, n: sql<number>`count(*)` })
    .from(bookings)
    .where(and(inArray(bookings.customerId, inPeriodCustomers), inArray(bookings.status, DONE), lte(bookings.tourDate, p.to)))
    .groupBy(bookings.customerId);
  if (lifetime.length === 0) return null;
  return lifetime.filter((r) => Number(r.n) >= 2).length / lifetime.length;
}

/** BR-07-10, overall and per guide. */
async function noticeCompliance(p: Period, f: ReportFilters) {
  const rows = await db
    .select({ guideId: bookingGuides.guideId, shortNotice: bookingGuides.shortNotice })
    .from(bookingGuides)
    .innerJoin(bookings, eq(bookings.id, bookingGuides.bookingId))
    .where(and(isNull(bookingGuides.releasedAt), inArray(bookings.status, ["completed", "evaluated", "no_show"]), inPeriod(p), ...bookingFilters(f)));
  const perGuide = new Map<string, { ok: number; total: number }>();
  for (const r of rows) {
    const entry = perGuide.get(r.guideId) ?? { ok: 0, total: 0 };
    entry.total++;
    if (!r.shortNotice) entry.ok++;
    perGuide.set(r.guideId, entry);
  }
  return { overall: ratio(rows.filter((r) => !r.shortNotice).length, rows.length), perGuide };
}

export async function getReportSummary(p: Period, f: ReportFilters) {
  const [counts, rev, util, rating, returning, notice] = await Promise.all([
    bookingCounts(p, f),
    revenue(p, f),
    utilisation(p, f),
    ratingAverage(p, f),
    returningShare(p, f),
    noticeCompliance(p, f),
  ]);
  return {
    bookings: counts.bookings,
    cancelled: counts.cancelled,
    cancelledShare: ratio(counts.cancelled, counts.all),
    byStatus: counts.byStatus,
    revenue: rev,
    utilisation: util.overall,
    activeGuides: util.activeGuides,
    rating: rating.avg,
    ratingCount: rating.count,
    returning,
    notice: notice.overall,
  };
}

export type ReportSummary = Awaited<ReturnType<typeof getReportSummary>>;

/* ---------------- breakdowns (§3.2 charts) ---------------- */

export type Dimension = "channel" | "staff" | "language" | "slot" | "package";
/** `code` is the language code (`en`), set for the language dimension only. */
export type BreakdownRow = { key: string; label: string; count: number; inactive: boolean; code?: string };

export async function getBookingsBreakdown(p: Period, f: ReportFilters, dimension: Dimension): Promise<BreakdownRow[]> {
  const where = and(inPeriod(p), ne(bookings.status, "cancelled"), ...bookingFilters(f));
  if (dimension === "channel") {
    const rows = await db.select({ key: bookings.channel, n: sql<number>`count(*)` }).from(bookings).where(where).groupBy(bookings.channel);
    return rows.map((r) => ({ key: r.key, label: r.key, count: Number(r.n), inactive: false }));
  }
  if (dimension === "staff") {
    const rows = await db
      .select({ key: users.id, label: users.name, active: users.isActive, n: sql<number>`count(*)` })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.createdBy))
      .where(where)
      .groupBy(users.id);
    return rows.map((r) => ({ key: r.key, label: r.label, count: Number(r.n), inactive: !r.active })).sort((a, b) => b.count - a.count);
  }
  if (dimension === "language") {
    const rows = await db
      .select({ key: languages.id, label: languages.nameId, code: languages.code, n: sql<number>`count(*)` })
      .from(bookings)
      .innerJoin(languages, eq(languages.id, bookings.languageId))
      .where(where)
      .groupBy(languages.id);
    return rows.map((r) => ({ key: r.key, label: r.label, code: r.code, count: Number(r.n), inactive: false })).sort((a, b) => b.count - a.count);
  }
  if (dimension === "package") {
    const rows = await db
      .select({ key: packages.id, label: packages.name, active: packages.isActive, n: sql<number>`count(*)` })
      .from(bookings)
      .innerJoin(packages, eq(packages.id, bookings.packageId))
      .where(where)
      .groupBy(packages.id);
    return rows.map((r) => ({ key: r.key, label: r.label, count: Number(r.n), inactive: !r.active })).sort((a, b) => b.count - a.count);
  }
  const rows = await db
    .select({ start: bookings.slotStart, end: bookings.slotEnd, n: sql<number>`count(*)` })
    .from(bookings)
    .where(where)
    .groupBy(bookings.slotStart, bookings.slotEnd)
    .orderBy(asc(bookings.slotStart));
  return rows.map((r) => ({ key: `${r.start}-${r.end}`, label: formatSlot(r.start, r.end), count: Number(r.n), inactive: false }));
}

/** Ringkasan "Lead time order": non-cancelled bookings by how far ahead of the tour they were created. */
export async function getLeadTime(p: Period, f: ReportFilters): Promise<Record<LeadTime, number>> {
  const rows = await db
    .select({ createdAt: bookings.createdAt, tourDate: bookings.tourDate })
    .from(bookings)
    .where(and(inPeriod(p), ne(bookings.status, "cancelled"), ...bookingFilters(f)));
  const out = { h3: 0, h2: 0, h1: 0 };
  for (const r of rows) out[leadTimeBucket(toWib(new Date(r.createdAt)).date, r.tourDate)]++;
  return out;
}

export const TREND_MONTHS = 7;

/** Ringkasan "Tren order & revenue": monthly orders (by tour date) and revenue (BR-11-3) for the trailing months. */
export async function getOrderRevenueTrend(p: Period, f: ReportFilters) {
  const span = trailingMonths(p, TREND_MONTHS);
  const range = instantRange(span);
  const [orders, paid] = await Promise.all([
    db
      .select({ tourDate: bookings.tourDate })
      .from(bookings)
      .where(and(inPeriod(span), ne(bookings.status, "cancelled"), ...bookingFilters(f))),
    db
      .select({ paidAt: payments.paidAt, amount: payments.amount })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(and(isNull(payments.voidedAt), gte(payments.paidAt, range.from), lt(payments.paidAt, range.to), ...bookingFilters(f))),
  ]);
  const buckets = bucketsFor(span, "month").map((start) => ({ bucket: start, orders: 0, revenue: 0 }));
  const index = new Map(buckets.map((b, i) => [b.bucket, i]));
  const at = (date: string) => buckets[index.get(bucketStart(date, "month")) ?? -1];
  for (const o of orders) {
    const b = at(o.tourDate);
    if (b) b.orders++;
  }
  for (const r of paid) {
    const b = at(toWib(new Date(r.paidAt)).date);
    if (b) b.revenue += r.amount;
  }
  return buckets;
}

/** BR-11-6 "Penjualan per staf". */
export async function getStaffSales(p: Period, f: ReportFilters) {
  const range = instantRange(p);
  const [counts, rev, staff] = await Promise.all([
    db
      .select({ userId: bookings.createdBy, status: bookings.status, n: sql<number>`count(*)`, value: sql<number>`sum(${bookings.totalAmount})` })
      .from(bookings)
      .where(and(inPeriod(p), ...bookingFilters(f)))
      .groupBy(bookings.createdBy, bookings.status),
    db
      .select({ userId: bookings.createdBy, total: sql<number>`sum(${payments.amount})` })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(and(isNull(payments.voidedAt), gte(payments.paidAt, range.from), lt(payments.paidAt, range.to), ...bookingFilters(f)))
      .groupBy(bookings.createdBy),
    db.select({ id: users.id, name: users.name, channel: users.defaultChannel, active: users.isActive }).from(users).where(inArray(users.role, ["admin", "staff"])),
  ]);
  return staff
    .map((s) => {
      const mine = counts.filter((c) => c.userId === s.id);
      const live = mine.filter((c) => c.status !== "cancelled");
      const bookingsCount = live.reduce((sum, c) => sum + Number(c.n), 0);
      const value = live.reduce((sum, c) => sum + Number(c.value ?? 0), 0);
      return {
        id: s.id,
        name: s.name,
        inactive: !s.active,
        defaultChannel: s.channel,
        bookings: bookingsCount,
        cancelled: Number(mine.find((c) => c.status === "cancelled")?.n ?? 0),
        revenue: Number(rev.find((r) => r.userId === s.id)?.total ?? 0),
        averageValue: bookingsCount ? Math.round(value / bookingsCount) : 0,
      };
    })
    .filter((s) => s.bookings > 0 || s.cancelled > 0 || s.revenue !== 0)
    .sort((a, b) => b.revenue - a.revenue);
}

/** §3.2 tab "Tour Guide". */
export async function getGuidePerformance(p: Period, f: ReportFilters) {
  const range = instantRange(p);
  const [util, notice, guideRows, tours, ratings, leaves, languageRows] = await Promise.all([
    utilisation(p, f),
    noticeCompliance(p, f),
    guidesForPeriod(p, f),
    db
      .select({ guideId: bookingGuides.guideId, status: bookings.status, n: sql<number>`count(*)` })
      .from(bookingGuides)
      .innerJoin(bookings, eq(servedBy, bookingGuides.bookingId))
      .where(and(isNull(bookingGuides.releasedAt), inArray(bookings.status, ["completed", "evaluated", "no_show"]), inPeriod(p), ...bookingFilters({ ...f, guideIds: [] })))
      .groupBy(bookingGuides.guideId, bookings.status),
    db
      .select({ guideId: feedbackGuideRatings.guideId, rating: feedbackGuideRatings.rating, source: feedback.source })
      .from(feedbackGuideRatings)
      .innerJoin(feedback, eq(feedback.id, feedbackGuideRatings.feedbackId))
      .innerJoin(bookings, eq(bookings.id, feedback.bookingId))
      .where(and(isNotNull(feedback.submittedAt), gte(feedback.submittedAt, range.from), lt(feedback.submittedAt, range.to), ...bookingFilters({ ...f, guideIds: [] }))),
    db.select().from(guideLeaves).where(and(eq(guideLeaves.status, "approved"), lte(guideLeaves.startDate, p.to), gte(guideLeaves.endDate, p.from))),
    db.select({ id: languages.id, code: languages.code }).from(languages),
  ]);
  return guideRows
    .map((g) => {
      const mine = ratings.filter((r) => r.guideId === g.id);
      const done = tours.filter((x) => x.guideId === g.id && x.status !== "no_show").reduce((s, x) => s + Number(x.n), 0);
      const noShow = Number(tours.find((x) => x.guideId === g.id && x.status === "no_show")?.n ?? 0);
      const n = notice.perGuide.get(g.id);
      const leaveDays = leaves
        .filter((l) => l.guideId === g.id)
        .reduce((s, l) => s + daysBetween(l.startDate > p.from ? l.startDate : p.from, l.endDate < p.to ? l.endDate : p.to) + 1, 0);
      return {
        id: g.id,
        name: g.displayName,
        inactive: !g.isActive,
        languages: g.languageIds.map((id) => languageRows.find((l) => l.id === id)?.code ?? "").filter(Boolean),
        tours: done,
        noShows: noShow,
        rating: mine.length ? mine.reduce((s, r) => s + r.rating, 0) / mine.length : null,
        ratingCount: mine.length,
        byGuide: mine.filter((r) => r.source === "guide").length,
        utilisation: ratio(util.bookedByGuide.get(g.id) ?? 0, util.availableByGuide.get(g.id) ?? 0),
        notice: n ? ratio(n.ok, n.total) : null,
        leaveDays,
      };
    })
    .filter((g) => !g.inactive || g.tours > 0 || g.noShows > 0)
    .sort((a, b) => b.tours - a.tours || a.name.localeCompare(b.name, "id"));
}

/** §3.2 tab "Ulasan" with the revisit distribution and response rate (BR-11-7). */
export async function getFeedbackReport(
  p: Period,
  f: ReportFilters,
  tab: { lowOnly?: boolean; withComment?: boolean; source?: "tourist" | "staff" | "guide" } = {},
) {
  const range = instantRange(p);
  const rows = await db
    .select({
      feedbackId: feedback.id,
      bookingId: bookings.id,
      code: bookings.code,
      submittedAt: feedback.submittedAt,
      overall: feedback.overallRating,
      comment: feedback.comment,
      wouldRevisit: feedback.wouldRevisit,
      consent: feedback.contactConsent,
      source: feedback.source,
      customerName: customers.name,
      nationality: customers.nationality,
    })
    .from(feedback)
    .innerJoin(bookings, eq(bookings.id, feedback.bookingId))
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(and(isNotNull(feedback.submittedAt), gte(feedback.submittedAt, range.from), lt(feedback.submittedAt, range.to), ...bookingFilters(f)))
    .orderBy(sql`${feedback.submittedAt} desc`);
  const ids = rows.map((r) => r.feedbackId);
  const guideRatings = ids.length
    ? await db
        .select({ feedbackId: feedbackGuideRatings.feedbackId, name: guides.displayName, rating: feedbackGuideRatings.rating })
        .from(feedbackGuideRatings)
        .innerJoin(guides, eq(guides.id, feedbackGuideRatings.guideId))
        .where(inArray(feedbackGuideRatings.feedbackId, ids))
    : [];
  const all = rows.map((r) => ({ ...r, guides: guideRatings.filter((g) => g.feedbackId === r.feedbackId) }));

  const revisit = { yes: 0, maybe: 0, no: 0 };
  for (const r of all) if (r.wouldRevisit) revisit[r.wouldRevisit]++;
  const [{ completed }] = await db
    .select({ completed: sql<number>`count(*)` })
    .from(bookings)
    .where(and(inArray(bookings.status, DONE), gte(bookings.completedAt, range.from), lt(bookings.completedAt, range.to), ...bookingFilters(f)));

  const filtered = all.filter(
    (r) =>
      (!tab.lowOnly || r.guides.some((g) => g.rating <= 2)) &&
      (!tab.withComment || Boolean(r.comment)) &&
      (!tab.source || r.source === tab.source),
  );
  return { rows: filtered, revisit, total: all.length, responseRate: ratio(all.length, Number(completed)) };
}

export async function reportFilterOptions() {
  const [langs, pkgs, guideRows] = await Promise.all([
    db.select({ id: languages.id, name: languages.nameId }).from(languages).orderBy(asc(languages.sortOrder)),
    db.select({ id: packages.id, name: packages.name }).from(packages).orderBy(asc(packages.sortOrder)),
    db.select({ id: guides.id, name: guides.displayName }).from(guides).orderBy(asc(guides.displayName)),
  ]);
  return { languages: langs, packages: pkgs, guides: guideRows };
}
