import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { Executor } from "@/db/client";
import { bookingEvents, bookingGuides, bookings, customers, feedback, feedbackGuideRatings, guides } from "@/db/schema";
import { notify } from "../notify";
import { getSettings } from "../settings";

export type FeedbackInput = {
  overall: number;
  guideRatings: { guideId: string; rating: number }[];
  comment: string | null;
  wouldRevisit: "yes" | "maybe" | "no";
  consent: boolean;
};

/** Guides that must be rated: the booking's non-released assignments (10 §8). */
export async function ratedGuides(ex: Executor, bookingId: string) {
  return ex
    .select({ id: guides.id, displayName: guides.displayName, photoUrl: guides.photoUrl, fullName: guides.fullName })
    .from(bookingGuides)
    .innerJoin(guides, eq(guides.id, bookingGuides.guideId))
    .where(and(eq(bookingGuides.bookingId, bookingId), isNull(bookingGuides.releasedAt)));
}

/** Exactly one 1–5 rating per assigned guide (BR-10-3). */
export function ratingsMatch(expected: string[], given: { guideId: string; rating: number }[]) {
  const ids = given.map((g) => g.guideId);
  return (
    ids.length === expected.length &&
    new Set(ids).size === ids.length &&
    expected.every((id) => ids.includes(id)) &&
    given.every((g) => Number.isInteger(g.rating) && g.rating >= 1 && g.rating <= 5)
  );
}

/**
 * BR-10-3..6: fill the pending feedback, rate guides, move the booking to Dievaluasi,
 * alert admins on a low rating and record contact consent. Returns false when the
 * feedback was already submitted (single-use).
 */
export async function applyFeedback(
  tx: Executor,
  feedbackId: string,
  bookingId: string,
  input: FeedbackInput,
  source: "tourist" | "staff" | "guide",
  enteredBy: string | null,
  now: Date,
): Promise<boolean> {
  const nowIso = now.toISOString();
  const changed = await tx
    .update(feedback)
    .set({
      submittedAt: nowIso,
      source,
      enteredBy,
      overallRating: input.overall,
      comment: input.comment,
      wouldRevisit: input.wouldRevisit,
      contactConsent: input.consent,
    })
    .where(and(eq(feedback.id, feedbackId), isNull(feedback.submittedAt)))
    .returning({ id: feedback.id });
  if (changed.length === 0) return false;

  await tx.insert(feedbackGuideRatings).values(input.guideRatings.map((r) => ({ feedbackId, guideId: r.guideId, rating: r.rating })));
  await tx.update(bookings).set({ status: "evaluated" }).where(and(eq(bookings.id, bookingId), eq(bookings.status, "completed")));
  await tx.insert(bookingEvents).values([
    { bookingId, type: "feedback_received", actorUserId: enteredBy, payload: { source, overall: input.overall }, at: nowIso },
    { bookingId, type: "status_changed", actorUserId: enteredBy, payload: { from: "completed", to: "evaluated" }, at: nowIso },
  ]);

  // BR-10-5: alert on any guide rating at or below the threshold, naming the lowest.
  const { low_rating_threshold } = await getSettings(tx);
  const lowest = [...input.guideRatings].sort((a, b) => a.rating - b.rating)[0];
  if (lowest && lowest.rating <= low_rating_threshold) {
    const [g] = await tx.select({ name: guides.displayName }).from(guides).where(eq(guides.id, lowest.guideId));
    await notify.lowRatingAlert(tx, bookingId, feedbackId, g?.name ?? "Guide", lowest.rating, input.comment);
  }

  // BR-10-6: consent is recorded, never revoked by a later "no".
  if (input.consent) {
    const [booking] = await tx.select({ customerId: bookings.customerId }).from(bookings).where(eq(bookings.id, bookingId));
    await tx.update(customers).set({ marketingConsent: true, marketingConsentAt: nowIso }).where(eq(customers.id, booking.customerId));
  }
  return true;
}
