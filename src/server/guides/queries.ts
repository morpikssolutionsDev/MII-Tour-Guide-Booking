import "server-only";
import { and, asc, avg, count, desc, eq, gte, inArray, isNotNull, isNull, like, lte, or, type SQL } from "drizzle-orm";
import { db, type Executor } from "@/db/client";
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
  users,
} from "@/db/schema";
import { addDays, wibToday } from "@/domain/time";

/** BR-02-10: average of the guide's own ratings over submitted feedback. */
export async function guideRatingStats(ex: Executor = db, guideIds?: string[]) {
  const rows = await ex
    .select({ guideId: feedbackGuideRatings.guideId, avg: avg(feedbackGuideRatings.rating), n: count() })
    .from(feedbackGuideRatings)
    .innerJoin(feedback, eq(feedback.id, feedbackGuideRatings.feedbackId))
    .where(and(isNotNull(feedback.submittedAt), guideIds ? inArray(feedbackGuideRatings.guideId, guideIds) : undefined))
    .groupBy(feedbackGuideRatings.guideId);
  return new Map(rows.map((r) => [r.guideId, { avg: r.avg === null ? null : Number(r.avg), count: r.n }]));
}

async function languagesByGuide(guideIds: string[]) {
  if (guideIds.length === 0) return new Map<string, { id: string; code: string; nameId: string; isActive: boolean }[]>();
  const rows = await db
    .select({ guideId: guideLanguages.guideId, id: languages.id, code: languages.code, nameId: languages.nameId, isActive: languages.isActive })
    .from(guideLanguages)
    .innerJoin(languages, eq(languages.id, guideLanguages.languageId))
    .where(inArray(guideLanguages.guideId, guideIds))
    .orderBy(asc(languages.sortOrder));
  const map = new Map<string, { id: string; code: string; nameId: string; isActive: boolean }[]>();
  for (const { guideId, ...l } of rows) map.set(guideId, [...(map.get(guideId) ?? []), l]);
  return map;
}

async function weekdaysByGuide(guideIds: string[]) {
  if (guideIds.length === 0) return new Map<string, number[]>();
  const rows = await db.select().from(guideWorkingDays).where(inArray(guideWorkingDays.guideId, guideIds));
  const map = new Map<string, number[]>();
  for (const r of rows) map.set(r.guideId, [...(map.get(r.guideId) ?? []), r.weekday].sort());
  return map;
}

export type GuideFilters = { q?: string; languageId?: string; status?: "active" | "inactive" | "all" };

/** 02 §3.1 list. */
export async function listGuides(filters: GuideFilters = {}) {
  const conditions: SQL[] = [];
  if (filters.q) conditions.push(or(like(guides.fullName, `%${filters.q}%`), like(guides.displayName, `%${filters.q}%`))!);
  const status = filters.status ?? "active";
  if (status !== "all") conditions.push(eq(guides.isActive, status === "active"));
  if (filters.languageId) {
    const ids = await db.select({ id: guideLanguages.guideId }).from(guideLanguages).where(eq(guideLanguages.languageId, filters.languageId));
    conditions.push(inArray(guides.id, ids.map((r) => r.id)));
  }
  const rows = await db.select().from(guides).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(guides.displayName));
  const ids = rows.map((g) => g.id);
  const today = wibToday();

  const [langs, days, ratings, leaves, tours] = await Promise.all([
    languagesByGuide(ids),
    weekdaysByGuide(ids),
    guideRatingStats(db, ids),
    ids.length
      ? db
          .select()
          .from(guideLeaves)
          .where(and(inArray(guideLeaves.guideId, ids), inArray(guideLeaves.status, ["approved", "pending"]), gte(guideLeaves.endDate, today)))
          .orderBy(asc(guideLeaves.startDate))
      : [],
    ids.length
      ? db
          .select({ guideId: bookingGuides.guideId, n: count() })
          .from(bookingGuides)
          .innerJoin(bookings, eq(bookings.id, bookingGuides.bookingId))
          .where(
            and(
              inArray(bookingGuides.guideId, ids),
              isNull(bookingGuides.releasedAt),
              inArray(bookings.status, ["completed", "evaluated"]),
              gte(bookings.tourDate, addDays(today, -30)),
              lte(bookings.tourDate, today),
            ),
          )
          .groupBy(bookingGuides.guideId)
      : [],
  ]);
  const toursById = new Map(tours.map((t) => [t.guideId, t.n]));

  return rows.map((g) => ({
    ...g,
    languages: langs.get(g.id) ?? [],
    weekdays: days.get(g.id) ?? [],
    rating: ratings.get(g.id) ?? { avg: null, count: 0 },
    nextLeave: leaves.find((l) => l.guideId === g.id && l.status === "approved") ?? null,
    hasPendingLeave: leaves.some((l) => l.guideId === g.id && l.status === "pending"),
    tours30: toursById.get(g.id) ?? 0,
  }));
}

export type GuideListItem = Awaited<ReturnType<typeof listGuides>>[number];

/** 02 §3.2 detail. */
export async function getGuideDetail(id: string) {
  const guide = await db.query.guides.findFirst({ where: eq(guides.id, id) });
  if (!guide) return null;
  const today = wibToday();
  const [user, langs, days, ratings, leaves, upcoming, perf] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, guide.userId), columns: { email: true, isActive: true, lastLoginAt: true } }),
    languagesByGuide([id]),
    weekdaysByGuide([id]),
    guideRatingStats(db, [id]),
    db.select().from(guideLeaves).where(eq(guideLeaves.guideId, id)).orderBy(desc(guideLeaves.startDate)),
    db
      .select({
        id: bookings.id,
        code: bookings.code,
        tourDate: bookings.tourDate,
        slotStart: bookings.slotStart,
        slotEnd: bookings.slotEnd,
        status: bookings.status,
        people: bookings.people,
        customerName: customers.name,
      })
      .from(bookingGuides)
      .innerJoin(bookings, eq(bookings.id, bookingGuides.bookingId))
      .innerJoin(customers, eq(customers.id, bookings.customerId))
      .where(
        and(
          eq(bookingGuides.guideId, id),
          isNull(bookingGuides.releasedAt),
          inArray(bookings.status, ["awaiting_payment", "confirmed", "ready"]),
          gte(bookings.tourDate, today),
          lte(bookings.tourDate, addDays(today, 14)),
        ),
      )
      .orderBy(asc(bookings.tourDate), asc(bookings.slotStart)),
    db
      .select({ status: bookings.status, tourDate: bookings.tourDate })
      .from(bookingGuides)
      .innerJoin(bookings, eq(bookings.id, bookingGuides.bookingId))
      .where(
        and(
          eq(bookingGuides.guideId, id),
          isNull(bookingGuides.releasedAt),
          inArray(bookings.status, ["completed", "evaluated", "no_show"]),
          gte(bookings.tourDate, addDays(today, -90)),
          lte(bookings.tourDate, today),
        ),
      ),
  ]);
  const done = perf.filter((p) => p.status !== "no_show");
  return {
    guide,
    email: user?.email ?? "",
    languages: langs.get(id) ?? [],
    weekdays: days.get(id) ?? [],
    rating: ratings.get(id) ?? { avg: null, count: 0 },
    leaves,
    upcoming,
    performance: {
      tours30: done.filter((p) => p.tourDate >= addDays(today, -30)).length,
      tours90: done.length,
      noShow90: perf.length - done.length,
    },
  };
}

export type GuideDetail = NonNullable<Awaited<ReturnType<typeof getGuideDetail>>>;

/** 02 §3.4: leave requests with guide names. */
export async function listLeaveRequests(tab: "pending" | "history") {
  return db
    .select({ leave: guideLeaves, guideName: guides.displayName, guideFullName: guides.fullName })
    .from(guideLeaves)
    .innerJoin(guides, eq(guides.id, guideLeaves.guideId))
    .where(tab === "pending" ? eq(guideLeaves.status, "pending") : inArray(guideLeaves.status, ["approved", "rejected", "cancelled"]))
    .orderBy(tab === "pending" ? asc(guideLeaves.createdAt) : desc(guideLeaves.updatedAt))
    .limit(tab === "pending" ? 200 : 100);
}

export async function countPendingLeave() {
  const [row] = await db.select({ n: count() }).from(guideLeaves).where(eq(guideLeaves.status, "pending"));
  return row.n;
}

export async function listActiveLanguages() {
  return db.select().from(languages).where(eq(languages.isActive, true)).orderBy(asc(languages.sortOrder));
}
