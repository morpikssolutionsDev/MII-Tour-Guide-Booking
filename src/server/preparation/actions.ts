"use server";

import { and, desc, eq, gte, isNull, like } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { bookingChecklistItems, bookingEvents, bookingGuides, bookings, guides, notifications } from "@/db/schema";
import { PAID_LIVE_STATUSES } from "@/domain/booking-status";
import { wibToUtc } from "@/domain/time";
import { t } from "@/i18n/id";
import { ActionError, defineAction } from "../action";
import { notify } from "../notify";
import { hostIdOf, recomputeGroup } from "../bookings/merge-core";
import { reconcileStatusWithChecklist } from "./core";

const sp = t.preparation;

/** BR-07-8: manual items, admin/staff, only while Terkonfirmasi or Siap. */
export const setChecklistItem = defineAction(
  { roles: ["admin", "staff"], input: z.object({ itemId: z.string(), checked: z.boolean() }) },
  async (input, me) => {
    const [item] = await db.select().from(bookingChecklistItems).where(eq(bookingChecklistItems.id, input.itemId));
    if (!item) throw new ActionError("NOT_FOUND", t.errors.notFound);
    if (item.systemKey) throw new ActionError("FORBIDDEN", sp.systemReadOnly);
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, item.bookingId));
    if (!booking || !PAID_LIVE_STATUSES.includes(booking.status)) throw new ActionError("INVALID_STATE", sp.readOnly);
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(bookingChecklistItems)
        .set(input.checked ? { checkedAt: now.toISOString(), checkedBy: me.id } : { checkedAt: null, checkedBy: null })
        .where(eq(bookingChecklistItems.id, item.id));
      await tx.insert(bookingEvents).values({
        bookingId: booking.id,
        type: input.checked ? "checklist_ticked" : "checklist_unticked",
        actorUserId: me.id,
        payload: { label: item.label },
      });
      await reconcileStatusWithChecklist(tx, booking.id, now); // BR-07-5
    });
    return null;
  },
);

/** BR-07-3 "Saya siap" (guide portal). Idempotent; not after the slot starts. */
export const acknowledgeAssignment = defineAction({ roles: ["guide"], input: z.object({ bookingId: z.string() }) }, async (input, me) => {
  const now = new Date();
  await db.transaction(async (tx) => {
    const [requested] = await tx.select().from(bookings).where(eq(bookings.id, input.bookingId));
    // A shared tour is acknowledged once, on its host (12 BR-12-M10).
    const [booking] = requested ? await tx.select().from(bookings).where(eq(bookings.id, hostIdOf(requested))) : [];
    const [assignment] = booking
      ? await tx
          .select()
          .from(bookingGuides)
          .where(and(eq(bookingGuides.bookingId, booking.id), eq(bookingGuides.guideId, me.guideId ?? ""), isNull(bookingGuides.releasedAt)))
      : [];
    if (!booking || !assignment) throw new ActionError("NOT_FOUND", t.errors.notFound);
    if (!PAID_LIVE_STATUSES.includes(booking.status)) throw new ActionError("INVALID_STATE", t.booking.actions.notAvailable(t.bookingStatus[booking.status]));
    if (now >= wibToUtc(booking.tourDate, booking.slotStart)) throw new ActionError("INVALID_STATE", sp.tourStarted);
    if (assignment.acknowledgedAt) return;
    await tx.update(bookingGuides).set({ acknowledgedAt: now.toISOString() }).where(eq(bookingGuides.id, assignment.id));
    await tx.insert(bookingEvents).values({ bookingId: booking.id, type: "guide_acknowledged", actorUserId: me.id, payload: { guideId: assignment.guideId } });
    await recomputeGroup(tx, booking.id, now); // BR-07-4, BR-07-5 for the whole shared tour
  });
  return null;
});

/**
 * 12 BR-12-F1–F5: admin confirms a notified assignment on the guide's behalf, with a reason.
 * Same effect as "Saya siap"; idempotent; no undo.
 */
export const forceAcknowledge = defineAction(
  {
    roles: ["admin"],
    input: z.object({
      bookingId: z.string(),
      guideId: z.string(),
      reason: z.string().trim().min(5, sp.forceAck.reasonLength).max(200, sp.forceAck.reasonLength),
    }),
  },
  async (input, me) => {
    const now = new Date();
    await db.transaction(async (tx) => {
      const [requested] = await tx.select().from(bookings).where(eq(bookings.id, input.bookingId));
      // BR-12-F1: for a member, the host's assignment is the one confirmed.
      const [booking] = requested ? await tx.select().from(bookings).where(eq(bookings.id, hostIdOf(requested))) : [];
      const [assignment] = booking
        ? await tx
            .select()
            .from(bookingGuides)
            .where(and(eq(bookingGuides.bookingId, booking.id), eq(bookingGuides.guideId, input.guideId), isNull(bookingGuides.releasedAt)))
        : [];
      if (!booking || !assignment) throw new ActionError("NOT_FOUND", t.errors.notFound);
      if (!PAID_LIVE_STATUSES.includes(booking.status)) throw new ActionError("INVALID_STATE", t.booking.actions.notAvailable(t.bookingStatus[booking.status]));
      if (now >= wibToUtc(booking.tourDate, booking.slotStart)) throw new ActionError("INVALID_STATE", sp.tourStarted);
      if (!assignment.notifiedAt) throw new ActionError("INVALID_STATE", sp.forceAck.notNotified);
      if (assignment.acknowledgedAt) return;
      await tx
        .update(bookingGuides)
        .set({ acknowledgedAt: now.toISOString(), acknowledgedBy: me.id, ackNote: input.reason })
        .where(eq(bookingGuides.id, assignment.id));
      await tx.insert(bookingEvents).values({
        bookingId: booking.id,
        type: "guide_acknowledged",
        actorUserId: me.id,
        payload: { guideId: assignment.guideId, by: me.id, forced: true, reason: input.reason },
      });
      await recomputeGroup(tx, booking.id, now); // BR-07-4, BR-07-5 (BR-12-M10)
      await notify.guideAckForced(tx, booking.id, assignment.guideId, me.name, input.reason);
    });
    return null;
  },
);

/** BR-07-7: reminder; rate-limited to once per 10 minutes per guide and booking. */
export const resendGuideNotice = defineAction(
  { roles: ["admin", "staff"], input: z.object({ bookingId: z.string(), guideId: z.string() }) },
  async (input) => {
    const [assignment] = await db
      .select({ id: bookingGuides.id, userId: guides.userId })
      .from(bookingGuides)
      .innerJoin(guides, eq(guides.id, bookingGuides.guideId))
      .innerJoin(bookings, eq(bookings.id, bookingGuides.bookingId))
      .where(and(eq(bookingGuides.bookingId, input.bookingId), eq(bookingGuides.guideId, input.guideId), isNull(bookingGuides.releasedAt)));
    if (!assignment) throw new ActionError("NOT_FOUND", t.errors.notFound);
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const [recent] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.bookingId, input.bookingId),
          eq(notifications.recipientUserId, assignment.userId),
          eq(notifications.eventKey, "guide_assigned"),
          like(notifications.context, '%"variant":"reminder"%'),
          gte(notifications.createdAt, since),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(1);
    if (recent) throw new ActionError("CONFLICT", sp.resentRecently);
    await db.transaction(async (tx) => notify.guideAssigned(tx, input.bookingId, [input.guideId], true));
    return null;
  },
);
