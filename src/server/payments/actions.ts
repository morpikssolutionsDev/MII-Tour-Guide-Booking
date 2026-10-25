"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { bookingEvents, bookings, payments, PAYMENT_METHODS } from "@/db/schema";
import { canVoidPayment } from "@/domain/booking-status";
import { computeHoldExpiry, isHoldExpired } from "@/domain/hold";
import { isValidDate, isValidTime, wibToUtc } from "@/domain/time";
import { t } from "@/i18n/id";
import { ActionError, defineAction, fieldError } from "../action";
import { expireHolds } from "../bookings/holds";
import { notify } from "../notify";
import { copyChecklistIfMissing, notifyUnnotifiedGuides, reconcileStatusWithChecklist } from "../preparation/core";
import { getSettings } from "../settings";
import { IMAGE_TYPES, storeFile, UploadError } from "../storage";

const sp = t.payment;

const paidAtFields = {
  paidDate: z.string().refine(isValidDate, t.common.required),
  paidTime: z.string().refine(isValidTime, t.common.required),
};
const proofFields = {
  proofFile: z.instanceof(File).optional(),
  reference: z.string().trim().max(60).optional().transform((v) => v || null),
};

/** WIB date + time → ISO, not in the future and not before `notBefore` (06 §3.2). */
function resolvePaidAt(paidDate: string, paidTime: string, notBefore: string) {
  const at = wibToUtc(paidDate, paidTime);
  if (at.getTime() > Date.now() + 5 * 60_000) throw fieldError("paidDate", sp.errors.future);
  // Compare at minute precision: the form has no seconds.
  if (at.getTime() < Date.parse(notBefore) - 60_000) throw fieldError("paidDate", sp.errors.beforeBooking);
  return at.toISOString();
}

/** BR-06-4: non-cash needs a proof image or a reference. */
async function storeProof(bookingId: string, method: (typeof PAYMENT_METHODS)[number], proofFile: File | undefined, reference: string | null) {
  const hasFile = proofFile && proofFile.size > 0;
  if (method !== "cash" && !hasFile && !reference) throw fieldError("reference", sp.errors.proofRequired);
  if (!hasFile) return { proofUrl: null, proofName: null };
  try {
    const stored = await storeFile(proofFile, `payments/${bookingId}`, {
      types: IMAGE_TYPES,
      maxBytes: 5 * 1024 * 1024,
      typeMessage: sp.errors.proofType,
      sizeMessage: sp.errors.proofSize,
    });
    return { proofUrl: stored.url, proofName: stored.name };
  } catch (error) {
    if (error instanceof UploadError) throw fieldError("proofFile", error.message);
    throw error;
  }
}

/** 06 §3.2 "Tandai Lunas" (BR-06-1..5). */
export const confirmPayment = defineAction(
  {
    roles: ["admin", "staff"],
    input: z.object({
      bookingId: z.string(),
      method: z.enum(PAYMENT_METHODS),
      amount: z.number().int().min(1),
      ...paidAtFields,
      ...proofFields,
      note: z.string().trim().max(300).optional().transform((v) => v || null),
      mismatchAcknowledged: z.boolean(),
    }),
  },
  async (input, me) => {
    await expireHolds();
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId));
    if (!booking) throw new ActionError("NOT_FOUND", t.errors.notFound);
    // BR-06-3: an expired hold is already cancelled; tell staff to start again.
    if (booking.status === "cancelled" && booking.cancelReason === "expired") throw new ActionError("INVALID_STATE", t.booking.expired, { expired: true });
    if (booking.status !== "awaiting_payment" || isHoldExpired(booking.holdExpiresAt, new Date())) {
      throw new ActionError("INVALID_STATE", t.booking.actions.notAvailable(t.bookingStatus[booking.status]));
    }
    const mismatch = input.amount !== booking.totalAmount;
    if (mismatch && !input.mismatchAcknowledged) throw fieldError("amount", sp.errors.mismatchAck); // BR-06-5
    const paidAt = resolvePaidAt(input.paidDate, input.paidTime, booking.createdAt);
    const proof = await storeProof(booking.id, input.method, input.proofFile, input.reference);

    const now = new Date();
    await db.transaction(async (tx) => {
      const changed = await tx
        .update(bookings)
        .set({ status: "confirmed", holdExpiresAt: null })
        .where(and(eq(bookings.id, booking.id), eq(bookings.status, "awaiting_payment")))
        .returning({ id: bookings.id });
      if (changed.length === 0) throw new ActionError("INVALID_STATE", t.booking.actions.notAvailable(t.bookingStatus[booking.status]));
      const [{ id: paymentId }] = await tx
        .insert(payments)
        .values({
          bookingId: booking.id,
          kind: "payment",
          method: input.method,
          amount: input.amount,
          paidAt,
          reference: input.reference,
          ...proof,
          note: input.note,
          recordedBy: me.id,
        })
        .returning({ id: payments.id });
      await tx.insert(bookingEvents).values([
        { bookingId: booking.id, type: "payment_confirmed", actorUserId: me.id, payload: { method: input.method, amount: input.amount, reference: input.reference, mismatch } },
        { bookingId: booking.id, type: "status_changed", actorUserId: me.id, payload: { from: "awaiting_payment", to: "confirmed" } },
      ]);
      await copyChecklistIfMissing(tx, booking.id); // BR-07-1
      await notifyUnnotifiedGuides(tx, booking.id, now); // BR-07-2
      await notify.paymentConfirmed(tx, booking.id, paymentId);
      // A re-confirmation (after an undo) may already have a complete checklist.
      await reconcileStatusWithChecklist(tx, booking.id, now);
    });
    return null;
  },
);

/** 06 §3.3 adjustments (BR-06-6). */
export const recordAdjustment = defineAction(
  {
    roles: ["admin", "staff"],
    input: z.object({
      bookingId: z.string(),
      direction: z.enum(["charge", "refund"]),
      amount: z.number().int().min(1),
      method: z.enum(PAYMENT_METHODS),
      ...paidAtFields,
      ...proofFields,
      note: z.string().trim().min(1, t.common.required).max(300),
    }),
  },
  async (input, me) => {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId));
    if (!booking) throw new ActionError("NOT_FOUND", t.errors.notFound);
    const [{ n }] = await db
      .select({ n: count() })
      .from(payments)
      .where(and(eq(payments.bookingId, booking.id), eq(payments.kind, "payment"), isNull(payments.voidedAt)));
    if (booking.status === "awaiting_payment" || n === 0) throw new ActionError("INVALID_STATE", sp.errors.noPayment);
    const paidAt = resolvePaidAt(input.paidDate, input.paidTime, booking.createdAt);
    const proof = await storeProof(booking.id, input.method, input.proofFile, input.reference);
    const amount = input.direction === "refund" ? -input.amount : input.amount;
    await db.transaction(async (tx) => {
      await tx.insert(payments).values({
        bookingId: booking.id,
        kind: "adjustment",
        method: input.method,
        amount,
        paidAt,
        reference: input.reference,
        ...proof,
        note: input.note,
        recordedBy: me.id,
      });
      await tx.insert(bookingEvents).values({ bookingId: booking.id, type: "adjustment_recorded", actorUserId: me.id, payload: { amount } });
    });
    return null;
  },
);

/** 06 §3.4 "Batalkan Tandai Lunas" — admin only (BR-06-8). */
export const voidPayment = defineAction(
  { roles: ["admin"], input: z.object({ paymentId: z.string(), reason: z.string().trim().min(1, t.common.required).max(200) }) },
  async (input, me) => {
    const [payment] = await db.select().from(payments).where(eq(payments.id, input.paymentId));
    if (!payment || payment.kind !== "payment" || payment.voidedAt) throw new ActionError("NOT_FOUND", t.errors.notFound);
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, payment.bookingId));
    const now = new Date();
    if (!booking || !canVoidPayment(booking, now)) throw new ActionError("INVALID_STATE", sp.errors.voidAfterStart);
    const [{ n }] = await db
      .select({ n: count() })
      .from(payments)
      .where(and(eq(payments.bookingId, booking.id), eq(payments.kind, "adjustment")));
    if (n > 0) throw new ActionError("INVALID_STATE", sp.errors.voidWithAdjustments);
    const { hold_expiry_hours } = await getSettings();
    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({ voidedAt: now.toISOString(), voidedBy: me.id, voidReason: input.reason })
        .where(eq(payments.id, payment.id));
      await tx
        .update(bookings)
        .set({
          status: "awaiting_payment",
          holdExpiresAt: computeHoldExpiry(now, hold_expiry_hours, booking.tourDate, booking.slotStart).toISOString(),
        })
        .where(eq(bookings.id, booking.id));
      await tx.insert(bookingEvents).values([
        { bookingId: booking.id, type: "payment_voided", actorUserId: me.id, payload: { reason: input.reason, amount: payment.amount } },
        { bookingId: booking.id, type: "status_changed", actorUserId: me.id, payload: { from: booking.status, to: "awaiting_payment" } },
      ]);
    });
    return null;
  },
);
