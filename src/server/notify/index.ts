import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Executor } from "@/db/client";
import {
  bookingEvents,
  bookingGuides,
  bookings,
  customers,
  guideLeaves,
  guides,
  languages,
  notifications,
  packages,
  users,
} from "@/db/schema";
import type { PriceSnapshot } from "@/domain/pricing";
import { daysBetween } from "@/domain/time";
import { getSettings } from "../settings";
import * as tpl from "./templates";

// 09-notifikasi.md: the single entry point for every message. Rows are written inside the
// caller's transaction (BR-09-1) and in-app rows only go to active users (BR-09-3).

type NotificationRow = typeof notifications.$inferInsert;

async function insertRows(ex: Executor, rows: NotificationRow[]) {
  for (const row of rows) {
    await ex.insert(notifications).values(row).onConflictDoNothing({ target: notifications.dedupeKey }); // BR-09-4
  }
}

async function logOnBooking(ex: Executor, bookingId: string, eventKey: string, recipients: number) {
  if (recipients === 0) return;
  await ex.insert(bookingEvents).values({ bookingId, type: "notification_sent", payload: { eventKey, recipients } });
}

/** Facts for booking templates; guide names are the current (non-released) assignments. */
export async function loadBookingFacts(ex: Executor, bookingId: string) {
  const [row] = await ex
    .select({
      booking: bookings,
      customerName: customers.name,
      customerPhone: customers.phoneE164,
      languageId: languages.nameId,
      languageEn: languages.nameEn,
      packageName: packages.name,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(languages, eq(languages.id, bookings.languageId))
    .innerJoin(packages, eq(packages.id, bookings.packageId))
    .where(eq(bookings.id, bookingId));
  if (!row) throw new Error(`Booking ${bookingId} not found`);
  const assigned = await ex
    .select({ guideId: guides.id, name: guides.displayName })
    .from(bookingGuides)
    .innerJoin(guides, eq(guides.id, bookingGuides.guideId))
    .where(and(eq(bookingGuides.bookingId, bookingId), isNull(bookingGuides.releasedAt)));
  const snapshot = row.booking.priceSnapshot as PriceSnapshot;
  const facts: tpl.BookingFacts = {
    bookingId,
    code: row.booking.code,
    customerName: row.customerName,
    tourDate: row.booking.tourDate,
    slotStart: row.booking.slotStart,
    slotEnd: row.booking.slotEnd,
    languageId: row.languageId,
    languageEn: row.languageEn,
    people: row.booking.people,
    packageName: snapshot.package.name ?? row.packageName,
    guidesNeeded: row.booking.guidesNeeded,
    guideNames: assigned.map((g) => g.name),
    facilities: snapshot.facilities ?? [],
    total: row.booking.totalAmount,
    holdExpiresAt: row.booking.holdExpiresAt,
  };
  return { facts, booking: row.booking, customerPhone: row.customerPhone };
}

function whatsapp(
  eventKey: string,
  b: Awaited<ReturnType<typeof loadBookingFacts>>,
  rendered: tpl.Rendered,
  dedupeKey?: string,
  context: Record<string, unknown> = {},
): NotificationRow {
  return {
    eventKey,
    channel: "whatsapp_mock",
    locale: "en",
    recipientPhone: b.customerPhone,
    recipientName: b.facts.customerName,
    bookingId: b.facts.bookingId,
    title: rendered.title,
    body: rendered.body,
    context: { ...b.facts, ...context },
    dedupeKey: dedupeKey ?? null,
  };
}

function inApp(
  eventKey: string,
  recipient: { id: string; name: string },
  rendered: tpl.Rendered,
  refs: { bookingId?: string; leaveId?: string },
  context: Record<string, unknown> = {},
  dedupeKey?: string,
): NotificationRow {
  return {
    eventKey,
    channel: "in_app",
    locale: "id",
    recipientUserId: recipient.id,
    recipientName: recipient.name,
    bookingId: refs.bookingId ?? null,
    leaveId: refs.leaveId ?? null,
    title: rendered.title,
    body: rendered.body,
    link: rendered.link ?? null,
    context,
    dedupeKey: dedupeKey ?? null,
  };
}

/** Active login users behind guide profiles. */
async function guideUsers(ex: Executor, guideIds: string[]) {
  if (guideIds.length === 0) return [];
  return ex
    .select({ guideId: guides.id, id: users.id, name: users.name })
    .from(guides)
    .innerJoin(users, eq(users.id, guides.userId))
    .where(and(inArray(guides.id, guideIds), eq(users.isActive, true)));
}

async function activeAdmins(ex: Executor) {
  return ex
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)));
}

async function activeUser(ex: Executor, id: string | null) {
  if (!id) return null;
  const [u] = await ex
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.id, id), eq(users.isActive, true)));
  return u ?? null;
}

async function loadLeave(ex: Executor, leaveId: string) {
  const [row] = await ex
    .select({ leave: guideLeaves, guideName: guides.displayName, guideId: guides.id })
    .from(guideLeaves)
    .innerJoin(guides, eq(guides.id, guideLeaves.guideId))
    .where(eq(guideLeaves.id, leaveId));
  if (!row) throw new Error(`Leave ${leaveId} not found`);
  const facts: tpl.LeaveFacts = {
    guideName: row.guideName,
    startDate: row.leave.startDate,
    endDate: row.leave.endDate,
    reason: row.leave.reason,
    days: daysBetween(row.leave.startDate, row.leave.endDate) + 1,
  };
  return { facts, leave: row.leave, guideId: row.guideId };
}

export const notify = {
  /** 05: tourist gets details, total, hold deadline and payment instructions. */
  async bookingCreated(ex: Executor, bookingId: string) {
    const b = await loadBookingFacts(ex, bookingId);
    const { payment_instructions_en } = await getSettings(ex);
    await insertRows(ex, [whatsapp("booking_created", b, tpl.waBookingCreated(b.facts, payment_instructions_en))]);
    await logOnBooking(ex, bookingId, "booking_created", 1);
  },

  /** 06 BR-06-2 */
  async paymentConfirmed(ex: Executor, bookingId: string, paymentId: string) {
    const b = await loadBookingFacts(ex, bookingId);
    await insertRows(ex, [whatsapp("payment_confirmed", b, tpl.waPaymentConfirmed(b.facts), `payment_confirmed:${paymentId}`)]);
    await logOnBooking(ex, bookingId, "payment_confirmed", 1);
  },

  /** 07 BR-07-2 / BR-07-7. The short-notice variant follows booking_guides.short_notice. */
  async guideAssigned(ex: Executor, bookingId: string, guideIds: string[], reminder = false) {
    const b = await loadBookingFacts(ex, bookingId);
    const flags = await ex
      .select({ guideId: bookingGuides.guideId, shortNotice: bookingGuides.shortNotice })
      .from(bookingGuides)
      .where(and(eq(bookingGuides.bookingId, bookingId), isNull(bookingGuides.releasedAt)));
    const recipients = await guideUsers(ex, guideIds);
    await insertRows(
      ex,
      recipients.map((r) => {
        const short = flags.find((f) => f.guideId === r.guideId)?.shortNotice ?? false;
        const variant = reminder ? "reminder" : short ? "short" : "normal";
        return inApp("guide_assigned", r, tpl.inAppGuideAssigned(b.facts, variant), { bookingId }, { variant, guideId: r.guideId });
      }),
    );
    await logOnBooking(ex, bookingId, "guide_assigned", recipients.length);
  },

  /** 05 BR-05-13 / 07 BR-07-6 */
  async bookingRescheduled(
    ex: Executor,
    bookingId: string,
    opts: {
      keptGuideIds: string[];
      scheduleChanged: boolean;
      before: { tourDate: string; slotStart: string; slotEnd: string };
      summary: string;
      priceDiff: number;
    },
  ) {
    const b = await loadBookingFacts(ex, bookingId);
    const rows: NotificationRow[] = [
      whatsapp(
        "booking_rescheduled",
        b,
        tpl.waBookingRescheduled(b.facts, {
          confirmed: b.booking.status === "confirmed" || b.booking.status === "ready",
          awaitingPayment: b.booking.status === "awaiting_payment",
          priceDiff: opts.priceDiff,
        }),
      ),
    ];
    const recipients = await guideUsers(ex, opts.keptGuideIds);
    for (const r of recipients) {
      const rendered = opts.scheduleChanged
        ? tpl.inAppGuideRescheduled(b.facts, { scheduleChanged: true, before: opts.before })
        : tpl.inAppGuideRescheduled(b.facts, { scheduleChanged: false, summary: opts.summary });
      rows.push(inApp("booking_rescheduled", r, rendered, { bookingId }));
    }
    await insertRows(ex, rows);
    await logOnBooking(ex, bookingId, "booking_rescheduled", rows.length);
  },

  async guideReleased(ex: Executor, bookingId: string, guideIds: string[], before: { tourDate: string; slotStart: string; slotEnd: string }) {
    const b = await loadBookingFacts(ex, bookingId);
    const recipients = await guideUsers(ex, guideIds);
    await insertRows(
      ex,
      recipients.map((r) => inApp("guide_released", r, tpl.inAppGuideReleased({ code: b.facts.code, ...before }), { bookingId })),
    );
    await logOnBooking(ex, bookingId, "guide_released", recipients.length);
  },

  /** 05 BR-05-15: tourist plus guides that had been notified. */
  async bookingCancelled(ex: Executor, bookingId: string, notifiedGuideIds: string[], reasonLabel: string, refundAmount: number | null) {
    const b = await loadBookingFacts(ex, bookingId);
    const rows: NotificationRow[] = [whatsapp("booking_cancelled", b, tpl.waBookingCancelled(b.facts, refundAmount))];
    // Released guides are no longer in facts.guideNames; name them explicitly.
    for (const r of await guideUsers(ex, notifiedGuideIds)) {
      rows.push(inApp("booking_cancelled", r, tpl.inAppBookingCancelled(b.facts, reasonLabel), { bookingId }));
    }
    await insertRows(ex, rows);
    await logOnBooking(ex, bookingId, "booking_cancelled", rows.length);
  },

  /** 05 BR-05-11: tourist plus the creating staff user, deduplicated. */
  async holdExpired(ex: Executor, bookingId: string) {
    const b = await loadBookingFacts(ex, bookingId);
    const rows: NotificationRow[] = [
      whatsapp("hold_expired", b, tpl.waHoldExpired(b.facts), `hold_expired:${bookingId}:tourist`),
    ];
    const creator = await activeUser(ex, b.booking.createdBy);
    if (creator) {
      rows.push(inApp("hold_expired", creator, tpl.inAppHoldExpired(b.facts), { bookingId }, {}, `hold_expired:${bookingId}:${creator.id}`));
    }
    await insertRows(ex, rows);
    await logOnBooking(ex, bookingId, "hold_expired", rows.length);
  },

  /** 10 BR-10-1 / BR-10-7 */
  async feedbackRequest(ex: Executor, bookingId: string, tokenId: string, url: string, expiresAt: string) {
    const b = await loadBookingFacts(ex, bookingId);
    await insertRows(ex, [
      whatsapp("feedback_request", b, tpl.waFeedbackRequest(b.facts, url, expiresAt), `feedback_request:${tokenId}`, { url }),
    ]);
    await logOnBooking(ex, bookingId, "feedback_request", 1);
  },

  /** 10 BR-10-5 */
  async lowRatingAlert(ex: Executor, bookingId: string, feedbackId: string, guideName: string, rating: number, comment: string | null) {
    const b = await loadBookingFacts(ex, bookingId);
    const admins = await activeAdmins(ex);
    await insertRows(
      ex,
      admins.map((a) =>
        inApp("low_rating_alert", a, tpl.inAppLowRating(b.facts, guideName, rating, comment), { bookingId }, { rating }, `low_rating_alert:${feedbackId}:${a.id}`),
      ),
    );
    await logOnBooking(ex, bookingId, "low_rating_alert", admins.length);
  },

  async leaveRequested(ex: Executor, leaveId: string) {
    const l = await loadLeave(ex, leaveId);
    const admins = await activeAdmins(ex);
    await insertRows(ex, admins.map((a) => inApp("leave_requested", a, tpl.inAppLeaveRequested(l.facts), { leaveId })));
  },

  async leaveDecided(ex: Executor, leaveId: string) {
    const l = await loadLeave(ex, leaveId);
    const [r] = await guideUsers(ex, [l.guideId]);
    if (!r) return;
    const approved = l.leave.status === "approved";
    await insertRows(ex, [inApp("leave_decided", r, tpl.inAppLeaveDecided(l.facts, approved, l.leave.decisionNote), { leaveId })]);
  },

  async leaveAddedByAdmin(ex: Executor, leaveId: string) {
    const l = await loadLeave(ex, leaveId);
    const [r] = await guideUsers(ex, [l.guideId]);
    if (r) await insertRows(ex, [inApp("leave_added_by_admin", r, tpl.inAppLeaveAddedByAdmin(l.facts), { leaveId })]);
  },

  async leaveCancelledByAdmin(ex: Executor, leaveId: string) {
    const l = await loadLeave(ex, leaveId);
    const [r] = await guideUsers(ex, [l.guideId]);
    if (r) await insertRows(ex, [inApp("leave_cancelled_by_admin", r, tpl.inAppLeaveCancelledByAdmin(l.facts), { leaveId })]);
  },
};
