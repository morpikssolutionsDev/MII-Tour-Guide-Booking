import "server-only";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { bookingEvents, bookingGuides, bookings } from "@/db/schema";
import { isPaymentConfirmationEnabled } from "@/lib/flags";
import { notify } from "../notify";
import { confirmPaidBooking } from "../payments/core";

/**
 * Runs before every booking read: hold expiry while payment confirmation is on (05 BR-05-11),
 * otherwise confirmation of any booking still waiting for payment (12 BR-12-P4).
 */
export async function syncHolds(now: Date = new Date()): Promise<number> {
  return isPaymentConfirmationEnabled() ? expireHolds(now) : confirmPendingBookings(now);
}

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

/**
 * 12 BR-12-P4: with payment confirmation off, every booking still `awaiting_payment` (created
 * before the switch) is confirmed with a system payment instead of expiring. Same concurrency
 * guard as expireHolds.
 */
export async function confirmPendingBookings(now: Date = new Date()): Promise<number> {
  const nowIso = now.toISOString();
  const pending = await db
    .select({ id: bookings.id, total: bookings.totalAmount })
    .from(bookings)
    .where(eq(bookings.status, "awaiting_payment"));

  let confirmed = 0;
  for (const b of pending) {
    await db.transaction(async (tx) => {
      const changed = await tx
        .update(bookings)
        .set({ status: "confirmed", holdExpiresAt: null })
        .where(and(eq(bookings.id, b.id), eq(bookings.status, "awaiting_payment")))
        .returning({ id: bookings.id });
      if (changed.length === 0) return;
      const paymentId = await confirmPaidBooking(
        tx,
        { bookingId: b.id, method: "system", amount: b.total, paidAt: nowIso, recordedBy: null, from: "awaiting_payment" },
        now,
      );
      // These tourists were sent payment instructions earlier; tell them it is settled.
      await notify.paymentConfirmed(tx, b.id, paymentId);
      confirmed++;
    });
  }
  return confirmed;
}
