"use server";

import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { bookingGuides, bookings, feedback } from "@/db/schema";
import { t } from "@/i18n/id";
import { ActionError, defineAction } from "../action";
import { applyFeedback, ratedGuides, ratingsMatch } from "./core";
import { issueFeedbackToken } from "./tokens";

const feedbackFields = {
  overall: z.number().int().min(1).max(5),
  guideRatings: z.array(z.object({ guideId: z.string(), rating: z.number().int().min(1).max(5) })).min(1),
  comment: z.string().trim().max(1000).optional().transform((v) => v || null),
  wouldRevisit: z.enum(["yes", "maybe", "no"]),
  consent: z.boolean(),
};

/** BR-10-4: staff, admin, or an assigned guide enters feedback on the tourist's behalf. */
export const submitFeedbackByStaff = defineAction(
  { roles: ["admin", "staff", "guide"], input: z.object({ bookingId: z.string(), ...feedbackFields }) },
  async (input, me) => {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId));
    if (!booking) throw new ActionError("NOT_FOUND", t.errors.notFound);
    if (me.role === "guide") {
      const [assigned] = await db
        .select({ id: bookingGuides.id })
        .from(bookingGuides)
        .where(and(eq(bookingGuides.bookingId, booking.id), eq(bookingGuides.guideId, me.guideId ?? ""), isNull(bookingGuides.releasedAt)));
      if (!assigned) throw new ActionError("NOT_FOUND", t.errors.notFound);
    }
    if (booking.status !== "completed") throw new ActionError("INVALID_STATE", t.feedback.notAvailable);
    const expected = (await ratedGuides(db, booking.id)).map((g) => g.id);
    if (!ratingsMatch(expected, input.guideRatings)) throw new ActionError("VALIDATION", t.feedback.ratingRequired);

    const now = new Date();
    const ok = await db.transaction(async (tx) => {
      let [row] = await tx.select().from(feedback).where(eq(feedback.bookingId, booking.id));
      if (!row) {
        // Normally created at completion; tolerate a missing row.
        await issueFeedbackToken(tx, booking.id, now);
        [row] = await tx.select().from(feedback).where(eq(feedback.bookingId, booking.id));
      }
      return applyFeedback(tx, row.id, booking.id, input, me.role === "guide" ? "guide" : "staff", me.id, now);
    });
    if (!ok) throw new ActionError("INVALID_STATE", t.feedback.notAvailable);
    return null;
  },
);

/** BR-10-7: replace an expired (or unused) link and resend it. */
export const regenerateFeedbackLink = defineAction(
  { roles: ["admin", "staff"], input: z.object({ bookingId: z.string() }) },
  async ({ bookingId }) => {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!booking || booking.status !== "completed") throw new ActionError("INVALID_STATE", t.feedback.notAvailable);
    const [row] = await db.select().from(feedback).where(eq(feedback.bookingId, bookingId));
    if (row?.submittedAt) throw new ActionError("INVALID_STATE", t.feedback.notAvailable);
    await db.transaction(async (tx) => issueFeedbackToken(tx, bookingId, new Date()));
    return null;
  },
);

/* ---------------- public submission (10 §3.1) ---------------- */

export type PublicFeedbackResult = { ok: true } | { ok: false; state: "invalid" | "expired" | "used" | "locked" | "error" };

const publicSchema = z.object({ token: z.string().min(20).max(100), ...feedbackFields });
const MAX_INVALID_ATTEMPTS = 5;

/**
 * Public, no login (BR-10-3, BR-10-10). Unknown, expired and used tokens reveal no data;
 * a token is locked after 5 invalid submissions.
 */
export async function submitPublicFeedback(raw: unknown): Promise<PublicFeedbackResult> {
  // Same-origin check (BR-10-10); server actions already require POST.
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (origin && host && new URL(origin).host !== host) return { ok: false, state: "error" };
  if (JSON.stringify(raw ?? "").length > 8 * 1024) return { ok: false, state: "error" };

  const token = typeof raw === "object" && raw && "token" in raw ? String((raw as { token: unknown }).token) : "";
  const [row] = token ? await db.select().from(feedback).where(eq(feedback.token, token)) : [];
  if (!row) return { ok: false, state: "invalid" };
  if (row.submittedAt) return { ok: false, state: "used" };
  if (row.invalidAttempts >= MAX_INVALID_ATTEMPTS) return { ok: false, state: "locked" };
  if (Date.parse(row.tokenExpiresAt) <= Date.now()) return { ok: false, state: "expired" };
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, row.bookingId));
  if (!booking || booking.status !== "completed") return { ok: false, state: "invalid" };

  const parsed = publicSchema.safeParse(raw);
  const expected = (await ratedGuides(db, booking.id)).map((g) => g.id);
  if (!parsed.success || !ratingsMatch(expected, parsed.data.guideRatings)) {
    await db.update(feedback).set({ invalidAttempts: row.invalidAttempts + 1 }).where(eq(feedback.id, row.id));
    return { ok: false, state: "error" };
  }
  const ok = await db.transaction(async (tx) => applyFeedback(tx, row.id, booking.id, parsed.data, "tourist", null, new Date()));
  return ok ? { ok: true } : { ok: false, state: "used" };
}
