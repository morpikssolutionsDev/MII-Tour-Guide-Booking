import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Executor } from "@/db/client";
import { feedback } from "@/db/schema";
import { notify } from "../notify";
import { getSettings } from "../settings";

export function newFeedbackToken(): string {
  return randomBytes(32).toString("base64url"); // ≥128-bit (overview §8.7)
}

export function feedbackUrl(token: string): string {
  const base = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/ulasan/${token}`;
}

/**
 * 10 BR-10-1 / BR-10-7: create (or replace) the pending feedback row for a completed
 * booking and send the tourist the link.
 */
export async function issueFeedbackToken(tx: Executor, bookingId: string, now: Date) {
  const { feedback_link_days } = await getSettings(tx);
  const token = newFeedbackToken();
  const tokenExpiresAt = new Date(now.getTime() + feedback_link_days * 86_400_000).toISOString();
  const [existing] = await tx.select({ id: feedback.id }).from(feedback).where(eq(feedback.bookingId, bookingId));
  let feedbackId: string;
  if (existing) {
    await tx.update(feedback).set({ token, tokenExpiresAt, invalidAttempts: 0 }).where(eq(feedback.id, existing.id));
    feedbackId = existing.id;
  } else {
    [{ id: feedbackId }] = await tx.insert(feedback).values({ bookingId, token, tokenExpiresAt }).returning({ id: feedback.id });
  }
  // The dedupe key is per token, so a regenerated link sends a fresh message.
  await notify.feedbackRequest(tx, bookingId, `${feedbackId}:${token.slice(0, 12)}`, feedbackUrl(token), tokenExpiresAt);
  return { token, tokenExpiresAt };
}
