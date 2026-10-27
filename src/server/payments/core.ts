import "server-only";
import type { Executor } from "@/db/client";
import { bookingEvents, payments, type PaymentMethod } from "@/db/schema";
import { copyChecklistIfMissing, notifyUnnotifiedGuides, reconcileStatusWithChecklist } from "../preparation/core";

type PaidBooking = {
  bookingId: string;
  method: PaymentMethod;
  amount: number;
  paidAt: string;
  reference?: string | null;
  proofUrl?: string | null;
  proofName?: string | null;
  note?: string | null;
  /** NULL = recorded by the system (12 BR-12-P3). */
  recordedBy: string | null;
  /** Status before confirmation; null when the booking was created already confirmed. */
  from: "awaiting_payment" | null;
  mismatch?: boolean;
};

/**
 * Side-effects of a booking becoming paid (06 BR-06-2, 12 BR-12-P3): the payment row, events,
 * checklist copy (BR-07-1) and guide notices (BR-07-2). The caller has already set the booking
 * status to `confirmed`. Returns the payment id.
 */
export async function confirmPaidBooking(tx: Executor, p: PaidBooking, now: Date): Promise<string> {
  const [{ id: paymentId }] = await tx
    .insert(payments)
    .values({
      bookingId: p.bookingId,
      kind: "payment",
      method: p.method,
      amount: p.amount,
      paidAt: p.paidAt,
      reference: p.reference ?? null,
      proofUrl: p.proofUrl ?? null,
      proofName: p.proofName ?? null,
      note: p.note ?? null,
      recordedBy: p.recordedBy,
    })
    .returning({ id: payments.id });
  // Events take their insert time, so they follow "created" when a booking is paid at creation.
  await tx.insert(bookingEvents).values([
    {
      bookingId: p.bookingId,
      type: "payment_confirmed",
      actorUserId: p.recordedBy,
      payload: p.recordedBy
        ? { method: p.method, amount: p.amount, reference: p.reference ?? null, mismatch: p.mismatch ?? false }
        : { method: p.method, amount: p.amount, by: "system" },
    },
    {
      bookingId: p.bookingId,
      type: "status_changed",
      actorUserId: p.recordedBy,
      payload: p.recordedBy ? { from: p.from, to: "confirmed" } : { from: p.from, to: "confirmed", cause: "system_payment" },
    },
  ]);
  await copyChecklistIfMissing(tx, p.bookingId); // BR-07-1
  await notifyUnnotifiedGuides(tx, p.bookingId, now); // BR-07-2
  // A re-confirmation (after an undo) may already have a complete checklist.
  await reconcileStatusWithChecklist(tx, p.bookingId, now);
  return paymentId;
}
