import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Executor } from "@/db/client";
import { bookingChecklistItems, bookingEvents, bookingGuides, bookings, checklistTemplateItems } from "@/db/schema";
import { statusForChecklist } from "@/domain/booking-status";
import { daysBetween, toWib } from "@/domain/time";
import { notify } from "../notify";
import { getSettings } from "../settings";

// 07-persiapan.md: transaction-aware building blocks shared by payment (06),
// reschedule (05), acknowledgement (08) and the checklist UI (07).

/** BR-07-1 / BR-04-5: copy the template on the first confirmation only. */
export async function copyChecklistIfMissing(tx: Executor, bookingId: string) {
  const existing = await tx.select({ id: bookingChecklistItems.id }).from(bookingChecklistItems).where(eq(bookingChecklistItems.bookingId, bookingId));
  if (existing.length) return;
  const template = await tx.select().from(checklistTemplateItems).orderBy(asc(checklistTemplateItems.sortOrder));
  if (template.length === 0) return;
  await tx.insert(bookingChecklistItems).values(
    template.map((item) => ({
      bookingId,
      systemKey: item.systemKey,
      label: item.label,
      description: item.description,
      sortOrder: item.sortOrder,
    })),
  );
}

/**
 * BR-07-2: notify every active assignment not yet notified for its current schedule,
 * flagging notices given with fewer than `notice_days` days ("di bawah H-2").
 */
export async function notifyUnnotifiedGuides(tx: Executor, bookingId: string, now: Date) {
  const [booking] = await tx.select({ tourDate: bookings.tourDate }).from(bookings).where(eq(bookings.id, bookingId));
  const pending = await tx
    .select({ id: bookingGuides.id, guideId: bookingGuides.guideId })
    .from(bookingGuides)
    .where(and(eq(bookingGuides.bookingId, bookingId), isNull(bookingGuides.releasedAt), isNull(bookingGuides.notifiedAt)));
  if (pending.length === 0) return [];
  const { notice_days } = await getSettings(tx);
  const shortNotice = daysBetween(toWib(now).date, booking.tourDate) < notice_days;
  for (const row of pending) {
    await tx.update(bookingGuides).set({ notifiedAt: now.toISOString(), shortNotice }).where(eq(bookingGuides.id, row.id));
  }
  await notify.guideAssigned(tx, bookingId, pending.map((p) => p.guideId));
  return pending.map((p) => p.guideId);
}

/** BR-07-4: the system item is checked iff every active assignment acknowledged. */
export async function recomputeGuideAck(tx: Executor, bookingId: string, now: Date) {
  const [item] = await tx
    .select()
    .from(bookingChecklistItems)
    .where(and(eq(bookingChecklistItems.bookingId, bookingId), eq(bookingChecklistItems.systemKey, "guide_ack")));
  if (!item) return;
  const assigned = await tx
    .select({ acknowledgedAt: bookingGuides.acknowledgedAt })
    .from(bookingGuides)
    .where(and(eq(bookingGuides.bookingId, bookingId), isNull(bookingGuides.releasedAt)));
  const allAcked = assigned.length > 0 && assigned.every((a) => a.acknowledgedAt);
  if (allAcked && !item.checkedAt) {
    await tx.update(bookingChecklistItems).set({ checkedAt: now.toISOString(), checkedBy: null }).where(eq(bookingChecklistItems.id, item.id));
    await tx.insert(bookingEvents).values({ bookingId, type: "checklist_ticked", payload: { label: item.label, system: true }, at: now.toISOString() });
  } else if (!allAcked && item.checkedAt) {
    await tx.update(bookingChecklistItems).set({ checkedAt: null, checkedBy: null }).where(eq(bookingChecklistItems.id, item.id));
    await tx.insert(bookingEvents).values({ bookingId, type: "checklist_unticked", payload: { label: item.label, system: true }, at: now.toISOString() });
  }
}

/** BR-07-5: paid bookings are Siap exactly when every checklist item is checked. */
export async function reconcileStatusWithChecklist(tx: Executor, bookingId: string, now: Date) {
  const [booking] = await tx.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, bookingId));
  const items = await tx.select({ checkedAt: bookingChecklistItems.checkedAt }).from(bookingChecklistItems).where(eq(bookingChecklistItems.bookingId, bookingId));
  const allChecked = items.length > 0 && items.every((i) => i.checkedAt);
  const next = statusForChecklist(booking.status, allChecked);
  if (next === booking.status) return booking.status;
  await tx.update(bookings).set({ status: next }).where(eq(bookings.id, bookingId));
  await tx.insert(bookingEvents).values({
    bookingId,
    type: "status_changed",
    payload: { from: booking.status, to: next, cause: "checklist" },
    at: now.toISOString(),
  });
  return next;
}
