import "server-only";
import { and, count, desc, eq, gte, isNull, like, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings, notifications, users } from "@/db/schema";
import { wibToUtc } from "@/domain/time";

export const OUTBOX_PAGE = 50;

export type OutboxFilters = {
  q?: string;
  channel?: "in_app" | "whatsapp_mock";
  eventKey?: string;
  from?: string;
  to?: string;
  page?: number;
};

/** 09 §3.2 admin Outbox. Dates are WIB calendar days. */
export async function listOutbox(filters: OutboxFilters) {
  const conditions: SQL[] = [];
  if (filters.q) {
    const qq = `%${filters.q}%`;
    conditions.push(or(like(notifications.recipientName, qq), like(notifications.recipientPhone, qq), like(bookings.code, qq))!);
  }
  if (filters.channel) conditions.push(eq(notifications.channel, filters.channel));
  if (filters.eventKey) conditions.push(eq(notifications.eventKey, filters.eventKey));
  if (filters.from) conditions.push(gte(notifications.createdAt, wibToUtc(filters.from).toISOString()));
  if (filters.to) conditions.push(lte(notifications.createdAt, wibToUtc(filters.to, "23:59").toISOString()));
  const where = conditions.length ? and(...conditions) : undefined;
  const page = Math.max(1, filters.page ?? 1);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        notification: notifications,
        bookingCode: bookings.code,
        recipientRole: users.role,
      })
      .from(notifications)
      .leftJoin(bookings, eq(bookings.id, notifications.bookingId))
      .leftJoin(users, eq(users.id, notifications.recipientUserId))
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(OUTBOX_PAGE)
      .offset((page - 1) * OUTBOX_PAGE),
    db.select({ total: count() }).from(notifications).leftJoin(bookings, eq(bookings.id, notifications.bookingId)).where(where),
  ]);
  return { rows: rows.map((r) => ({ ...r.notification, bookingCode: r.bookingCode, recipientRole: r.recipientRole })), total, page };
}

export type OutboxRow = Awaited<ReturnType<typeof listOutbox>>["rows"][number];

export async function unreadCountFor(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        isNull(notifications.readAt),
        gte(notifications.createdAt, new Date(Date.now() - 30 * 86_400_000).toISOString()),
      ),
    );
  return row.n;
}
