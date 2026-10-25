import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings, customers, feedback, languages } from "@/db/schema";
import { firstName, formatDateLongEn, formatSlotEn } from "@/lib/format";
import { ratedGuides } from "./core";

export type PublicFeedbackForm =
  | { state: "invalid" | "expired" | "used" | "locked" }
  | {
      state: "open";
      tour: { dateEn: string; slotEn: string; languageEn: string; firstName: string; guides: { id: string; displayName: string; fullName: string; photoUrl: string | null }[] };
    };

/** 10 §6 getPublicFeedbackForm: no booking data for invalid, expired or used tokens (BR-10-2). */
export async function getPublicFeedbackForm(token: string): Promise<PublicFeedbackForm> {
  if (!token || token.length < 20 || token.length > 100) return { state: "invalid" };
  const [row] = await db.select().from(feedback).where(eq(feedback.token, token));
  if (!row) return { state: "invalid" };
  if (row.submittedAt) return { state: "used" };
  if (row.invalidAttempts >= 5) return { state: "locked" };
  if (Date.parse(row.tokenExpiresAt) <= Date.now()) return { state: "expired" };
  const [b] = await db
    .select({ booking: bookings, customerName: customers.name, languageEn: languages.nameEn })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(languages, eq(languages.id, bookings.languageId))
    .where(eq(bookings.id, row.bookingId));
  if (!b || b.booking.status !== "completed") return { state: "invalid" };
  return {
    state: "open",
    tour: {
      dateEn: formatDateLongEn(b.booking.tourDate),
      slotEn: formatSlotEn(b.booking.slotStart, b.booking.slotEnd),
      languageEn: b.languageEn,
      firstName: firstName(b.customerName),
      guides: await ratedGuides(db, b.booking.id),
    },
  };
}
