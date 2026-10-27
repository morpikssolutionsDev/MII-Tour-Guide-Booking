// Demo notifications (09-notifikasi.md) for the bell and the outbox, rendered with the real
// templates from the seeded data. Covers the last 14 days; older traffic is left out.
import { eq } from "drizzle-orm";
import * as s from "../src/db/schema";
import type { PriceSnapshot } from "../src/domain/pricing";
import { daysBetween } from "../src/domain/time";
import { t } from "../src/i18n/id";
import * as tpl from "../src/server/notify/templates";
import { db } from "./db";

type Row = typeof s.notifications.$inferInsert;
const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString();
const plusMinutes = (at: string, minutes: number) => new Date(Date.parse(at) + minutes * 60_000).toISOString();

export async function seedNotifications(now: Date, opts: { paymentInstructions: string; lowRatingThreshold: number; paymentConfirmation: boolean }) {
  const since = iso(new Date(now.getTime() - 14 * DAY));
  const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const [bookingRows, assignments, paymentRows, feedbackRows, ratingRows, userRows, leaveRows] = await Promise.all([
    db
      .select({
        booking: s.bookings,
        customerName: s.customers.name,
        customerPhone: s.customers.phoneE164,
        languageId: s.languages.nameId,
        languageEn: s.languages.nameEn,
        packageName: s.packages.name,
      })
      .from(s.bookings)
      .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
      .innerJoin(s.languages, eq(s.languages.id, s.bookings.languageId))
      .innerJoin(s.packages, eq(s.packages.id, s.bookings.packageId)),
    db
      .select({ bg: s.bookingGuides, name: s.guides.displayName, userId: s.guides.userId, userName: s.users.name })
      .from(s.bookingGuides)
      .innerJoin(s.guides, eq(s.guides.id, s.bookingGuides.guideId))
      .innerJoin(s.users, eq(s.users.id, s.guides.userId)),
    db.select().from(s.payments),
    db.select().from(s.feedback),
    db.select({ r: s.feedbackGuideRatings, name: s.guides.displayName }).from(s.feedbackGuideRatings).innerJoin(s.guides, eq(s.guides.id, s.feedbackGuideRatings.guideId)),
    db.select().from(s.users),
    db
      .select({ leave: s.guideLeaves, guideName: s.guides.displayName })
      .from(s.guideLeaves)
      .innerJoin(s.guides, eq(s.guides.id, s.guideLeaves.guideId)),
  ]);
  const admins = userRows.filter((u) => u.role === "admin");
  const rows: Row[] = [];

  // Older items are already read; recent ones stay unread so the bell has something to show.
  const readAt = (createdAt: string, ackAt?: string | null) =>
    ackAt ?? (Date.parse(createdAt) < now.getTime() - 2 * DAY ? plusMinutes(createdAt, 45) : null);

  for (const row of bookingRows) {
    const b = row.booking;
    const mine = assignments.filter((a) => a.bg.bookingId === b.id);
    const snapshot = b.priceSnapshot as PriceSnapshot;
    const facts: tpl.BookingFacts = {
      bookingId: b.id,
      code: b.code,
      customerName: row.customerName,
      tourDate: b.tourDate,
      slotStart: b.slotStart,
      slotEnd: b.slotEnd,
      languageId: row.languageId,
      languageEn: row.languageEn,
      people: b.people,
      packageName: snapshot.package.name ?? row.packageName,
      guidesNeeded: b.guidesNeeded,
      guideNames: mine.filter((a) => !a.bg.releasedAt).map((a) => a.name),
      facilities: snapshot.facilities ?? [],
      total: b.totalAmount,
      holdExpiresAt: b.holdExpiresAt,
    };
    const wa = (eventKey: string, r: tpl.Rendered, at: string, dedupeKey: string | null = null, context: Record<string, unknown> = {}): Row => ({
      eventKey,
      channel: "whatsapp_mock",
      locale: "en",
      recipientPhone: row.customerPhone,
      recipientName: row.customerName,
      bookingId: b.id,
      title: r.title,
      body: r.body,
      context: { ...facts, ...context },
      dedupeKey,
      createdAt: at,
    });
    const inApp = (eventKey: string, user: { id: string; name: string }, r: tpl.Rendered, at: string, read: string | null, dedupeKey: string | null = null, context: Record<string, unknown> = {}): Row => ({
      eventKey,
      channel: "in_app",
      locale: "id",
      recipientUserId: user.id,
      recipientName: user.name,
      bookingId: b.id,
      title: r.title,
      body: r.body,
      link: r.link ?? null,
      context,
      dedupeKey,
      readAt: read,
      createdAt: at,
    });

    if (b.createdAt! >= since) {
      rows.push(
        wa(
          "booking_created",
          opts.paymentConfirmation
            ? tpl.waBookingCreated({ ...facts, holdExpiresAt: b.holdExpiresAt ?? plusMinutes(b.createdAt!, 24 * 60) }, opts.paymentInstructions)
            : tpl.waBookingConfirmed(facts), // 12 BR-12-P9
          b.createdAt!,
        ),
      );
    }

    for (const p of paymentRows.filter((x) => x.bookingId === b.id && x.kind === "payment" && x.paidAt >= since)) {
      // A system payment is part of the creation message (12 BR-12-P9).
      if (p.method !== "system") rows.push(wa("payment_confirmed", tpl.waPaymentConfirmed(facts), p.paidAt, `payment_confirmed:${p.id}`));
      for (const a of mine.filter((x) => x.bg.notifiedAt)) {
        const variant = a.bg.shortNotice ? "short" : "normal";
        rows.push(
          inApp("guide_assigned", { id: a.userId, name: a.userName }, tpl.inAppGuideAssigned(facts, variant), a.bg.notifiedAt!, readAt(a.bg.notifiedAt!, a.bg.acknowledgedAt), null, {
            variant,
            guideId: a.bg.guideId,
          }),
        );
      }
    }

    if (b.status === "cancelled" && b.cancelledAt && b.cancelledAt >= since) {
      if (b.cancelReason === "expired") {
        rows.push(wa("hold_expired", tpl.waHoldExpired(facts), b.cancelledAt, `hold_expired:${b.id}:tourist`));
        const creator = userRows.find((u) => u.id === b.createdBy)!;
        rows.push(inApp("hold_expired", creator, tpl.inAppHoldExpired(facts), b.cancelledAt, readAt(b.cancelledAt), `hold_expired:${b.id}:${creator.id}`));
      } else {
        const refund = paymentRows.find((x) => x.bookingId === b.id && x.kind === "adjustment");
        rows.push(wa("booking_cancelled", tpl.waBookingCancelled(facts, refund ? -refund.amount : null), b.cancelledAt));
        const reason = t.cancelReasons[b.cancelReason as keyof typeof t.cancelReasons] ?? "";
        for (const a of mine.filter((x) => x.bg.notifiedAt)) {
          rows.push(inApp("booking_cancelled", { id: a.userId, name: a.userName }, tpl.inAppBookingCancelled(facts, reason), b.cancelledAt, readAt(b.cancelledAt)));
        }
      }
    }

    const fb = feedbackRows.find((f) => f.bookingId === b.id);
    if (fb && fb.createdAt! >= since) {
      const url = `${baseUrl}/ulasan/${fb.token}`;
      rows.push(wa("feedback_request", tpl.waFeedbackRequest(facts, url, fb.tokenExpiresAt), fb.createdAt!, `feedback_request:${fb.id}:${fb.token.slice(0, 12)}`, { url }));
      if (fb.submittedAt) {
        for (const r of ratingRows.filter((x) => x.r.feedbackId === fb.id && x.r.rating <= opts.lowRatingThreshold)) {
          for (const admin of admins) {
            rows.push(
              inApp("low_rating_alert", admin, tpl.inAppLowRating(facts, r.name, r.r.rating, fb.comment), fb.submittedAt, readAt(fb.submittedAt), `low_rating_alert:${fb.id}:${admin.id}`, {
                rating: r.r.rating,
              }),
            );
          }
        }
      }
    }
  }

  for (const { leave, guideName } of leaveRows) {
    const facts: tpl.LeaveFacts = {
      guideName,
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason,
      days: daysBetween(leave.startDate, leave.endDate) + 1,
    };
    for (const admin of admins) {
      const r = tpl.inAppLeaveRequested(facts);
      rows.push({
        eventKey: "leave_requested",
        channel: "in_app",
        locale: "id",
        recipientUserId: admin.id,
        recipientName: admin.name,
        leaveId: leave.id,
        title: r.title,
        body: r.body,
        link: r.link ?? null,
        readAt: leave.status === "pending" ? null : leave.decidedAt,
        createdAt: leave.createdAt!,
      });
    }
    if (leave.status !== "pending" && leave.decidedAt) {
      const guideUser = userRows.find((u) => u.id === leave.requestedBy)!;
      const r = tpl.inAppLeaveDecided(facts, leave.status === "approved", leave.decisionNote);
      rows.push({
        eventKey: "leave_decided",
        channel: "in_app",
        locale: "id",
        recipientUserId: guideUser.id,
        recipientName: guideUser.name,
        leaveId: leave.id,
        title: r.title,
        body: r.body,
        link: r.link ?? null,
        readAt: plusMinutes(leave.decidedAt, 30),
        createdAt: leave.decidedAt,
      });
    }
  }

  rows.sort((a, b) => a.createdAt!.localeCompare(b.createdAt!));
  for (let i = 0; i < rows.length; i += 100) await db.insert(s.notifications).values(rows.slice(i, i + 100));
  return rows.length;
}
