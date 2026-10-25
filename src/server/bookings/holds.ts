import "server-only";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { bookingEvents, bookingGuides, bookings } from "@/db/schema";
import { notify } from "../notify";

/**
 * Lazy hold expiry (05 BR-05-11): overdue `awaiting_payment` bookings become `cancelled`
 * ("Kedaluwarsa otomatis"), release their guides and notify. Idempotent and safe under
 * concurrent calls: only the request whose conditional UPDATE changes the row acts on it.
 */
export async function expireHolds(now: Date = new Date()): Promise<number> {
  const nowIso = now.toISOString();
  const due = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.status, "awaiting_payment"), lte(bookings.holdExpiresAt, nowIso)));

  let expired = 0;
  for (const { id } of due) {
    await db.transaction(async (tx) => {
      const changed = await tx
        .update(bookings)
        .set({ status: "cancelled", cancelReason: "expired", cancelledAt: nowIso, cancelledBy: null })
        .where(and(eq(bookings.id, id), eq(bookings.status, "awaiting_payment")))
        .returning({ id: bookings.id });
      if (changed.length === 0) return;
      await tx
        .update(bookingGuides)
        .set({ releasedAt: nowIso })
        .where(and(eq(bookingGuides.bookingId, id), isNull(bookingGuides.releasedAt)));
      await tx.insert(bookingEvents).values([
        { bookingId: id, type: "status_changed", payload: { from: "awaiting_payment", to: "cancelled", cause: "hold_expired" }, at: nowIso },
        { bookingId: id, type: "hold_expired", payload: {}, at: nowIso },
      ]);
      await notify.holdExpired(tx, id);
      expired++;
    });
  }
  return expired;
}
