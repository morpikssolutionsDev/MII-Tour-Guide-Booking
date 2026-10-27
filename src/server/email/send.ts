import "server-only";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { smtpConfig } from "@/lib/flags";
import { loadBookingEmailFacts, sampleBookingEmailFacts, type BookingEmailFacts } from "./facts";
import { getEmailSettings } from "./settings";
import { bookingCreatedEmail, type RenderedEmail } from "./templates";
import { buildBookingXlsx } from "./xlsx";

// 12 BR-12-E2..E10: team email over SMTP, one message and one Outbox row per recipient.

const TIMEOUT_MS = 10_000;
const baseUrl = () => process.env.APP_BASE_URL ?? "http://localhost:3000";

/** BR-12-E2: event registry; a new event is one entry. */
const EVENTS = {
  booking_created: (f: BookingEmailFacts) => bookingCreatedEmail(f, baseUrl()),
  email_test: (f: BookingEmailFacts) => bookingCreatedEmail(f, baseUrl(), { test: true }),
} satisfies Record<string, (f: BookingEmailFacts) => RenderedEmail>;

export type EmailEventKey = keyof typeof EVENTS;

function transport() {
  const c = smtpConfig();
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: c.user ? { user: c.user, pass: c.password } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
}

/** BR-12-E10: SMTP errors without credentials, at most 500 characters. */
function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const { password } = smtpConfig();
  return (password ? message.replaceAll(password, "***") : message).slice(0, 500);
}

type Prepared = { eventKey: EmailEventKey; facts: BookingEmailFacts; email: RenderedEmail; attachment: { filename: string; content: Buffer } };

async function prepare(eventKey: EmailEventKey, facts: BookingEmailFacts): Promise<Prepared> {
  return { eventKey, facts, email: EVENTS[eventKey](facts), attachment: await buildBookingXlsx(facts) };
}

async function deliver(p: Prepared, rowId: string, to: string) {
  try {
    await transport().sendMail({
      from: smtpConfig().from,
      to,
      subject: p.email.subject,
      text: p.email.text,
      html: p.email.html,
      attachments: [{ filename: p.attachment.filename, content: p.attachment.content }],
    });
    await db.update(notifications).set({ deliveryStatus: "terkirim", sentAt: new Date().toISOString(), error: null }).where(eq(notifications.id, rowId));
    return { email: to, ok: true as const };
  } catch (error) {
    const message = errorText(error);
    await db.update(notifications).set({ deliveryStatus: "gagal", error: message }).where(eq(notifications.id, rowId));
    return { email: to, ok: false as const, error: message };
  }
}

/** Logs a `pending` Outbox row per recipient (BR-12-E4), then sends each one. */
async function sendTo(p: Prepared, recipients: string[], bookingId: string | null) {
  const rows = await db
    .insert(notifications)
    .values(
      recipients.map((to) => ({
        eventKey: p.eventKey,
        channel: "email" as const,
        locale: "id" as const,
        recipientName: to,
        recipientEmail: to,
        bookingId,
        title: p.email.subject,
        body: p.email.text,
        context: { code: p.facts.code },
        deliveryStatus: "pending" as const,
        attachmentName: p.attachment.filename,
      })),
    )
    .returning({ id: notifications.id, to: notifications.recipientEmail });
  return Promise.all(rows.map((r) => deliver(p, r.id, r.to!)));
}

/**
 * BR-12-E2/E3: called with `after()` once a booking has been committed. Never throws: a mail
 * failure must not affect the booking.
 */
export async function sendBookingEmail(eventKey: "booking_created", bookingId: string) {
  try {
    const settings = await getEmailSettings();
    if (!settings.email_enabled || settings.email_recipients.length === 0 || !smtpConfig().configured) return;
    const facts = await loadBookingEmailFacts(db, bookingId);
    if (!facts) return;
    await sendTo(await prepare(eventKey, facts), settings.email_recipients, bookingId);
  } catch (error) {
    console.error("[email] booking email failed", errorText(error));
  }
}

/** BR-12-E7: sample booking email + xlsx to the given recipients. */
export async function sendTestEmails(recipients: string[]) {
  return sendTo(await prepare("email_test", sampleBookingEmailFacts()), recipients, null);
}

/** BR-12-E8: rebuild from the booking's current data and retry the same Outbox row. */
export async function resendEmailRow(rowId: string) {
  const [row] = await db.select().from(notifications).where(eq(notifications.id, rowId));
  if (!row || row.channel !== "email" || !row.recipientEmail) return null;
  const eventKey = (row.eventKey in EVENTS ? row.eventKey : "booking_created") as EmailEventKey;
  const facts = row.bookingId ? await loadBookingEmailFacts(db, row.bookingId) : sampleBookingEmailFacts();
  if (!facts) return null;
  const p = await prepare(eventKey, facts);
  await db
    .update(notifications)
    .set({ title: p.email.subject, body: p.email.text, attachmentName: p.attachment.filename, deliveryStatus: "pending", error: null })
    .where(eq(notifications.id, rowId));
  return deliver(p, rowId, row.recipientEmail);
}
