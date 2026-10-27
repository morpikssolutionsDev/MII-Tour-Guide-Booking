// Demo data for 12-perubahan-fase-2.md: shared tours (merge), force-confirmed guides and team
// email rows in the Outbox. Runs after the bookings are inserted; deterministic for a given seed.
import { and, eq, gt, inArray, isNotNull, isNull } from "drizzle-orm";
import * as s from "../src/db/schema";
import type { PriceSnapshot } from "../src/domain/pricing";
import { db } from "./db";

type Booking = typeof s.bookings.$inferSelect;
const iso = (d: Date) => d.toISOString();
const minutesBefore = (d: Date, m: number) => new Date(d.getTime() - m * 60_000);
const maxPerGuide = (b: Booking) => (b.priceSnapshot as PriceSnapshot).package.maxPeoplePerGuide;

/** BR-12-M10 + BR-07-5: a booking's "Konfirmasi guide" follows its host; Siap follows the checklist. */
async function syncChecklist(bookingId: string, hostId: string, now: Date) {
  const assigned = await db
    .select({ ack: s.bookingGuides.acknowledgedAt })
    .from(s.bookingGuides)
    .where(and(eq(s.bookingGuides.bookingId, hostId), isNull(s.bookingGuides.releasedAt)));
  const allAcked = assigned.length > 0 && assigned.every((a) => a.ack);
  await db
    .update(s.bookingChecklistItems)
    .set({ checkedAt: allAcked ? iso(now) : null, checkedBy: null })
    .where(and(eq(s.bookingChecklistItems.bookingId, bookingId), eq(s.bookingChecklistItems.systemKey, "guide_ack")));
  const items = await db.select({ checked: s.bookingChecklistItems.checkedAt }).from(s.bookingChecklistItems).where(eq(s.bookingChecklistItems.bookingId, bookingId));
  const ready = items.length > 0 && items.every((i) => i.checked);
  await db
    .update(s.bookings)
    .set({ status: ready ? "ready" : "confirmed" })
    .where(and(eq(s.bookings.id, bookingId), inArray(s.bookings.status, ["confirmed", "ready"])));
}

export async function seedPhase2(now: Date, today: string, adminId: string) {
  const upcoming = await db
    .select()
    .from(s.bookings)
    .where(and(gt(s.bookings.tourDate, today), inArray(s.bookings.status, ["confirmed", "ready"])))
    .orderBy(s.bookings.tourDate, s.bookings.slotStart, s.bookings.code);

  /* ---- shared tours: up to 2 pairs with the same date, slot and language that fit (BR-12-M4) ---- */
  const guideCount = async (id: string) =>
    (await db.select({ id: s.bookingGuides.id }).from(s.bookingGuides).where(and(eq(s.bookingGuides.bookingId, id), isNull(s.bookingGuides.releasedAt)))).length;
  const used = new Set<string>();
  let merged = 0;
  for (const host of upcoming) {
    if (merged >= 2) break;
    if (used.has(host.id)) continue;
    const guides = await guideCount(host.id);
    const member = upcoming.find(
      (b) =>
        b.id !== host.id &&
        !used.has(b.id) &&
        b.tourDate === host.tourDate &&
        b.slotId === host.slotId &&
        b.languageId === host.languageId &&
        host.people + b.people <= guides * Math.min(maxPerGuide(host), maxPerGuide(b)),
    );
    if (!member) continue;
    used.add(host.id).add(member.id);
    const at = minutesBefore(now, 60 * (24 + merged * 5));
    await db.update(s.bookings).set({ mergeGroupId: host.id, mergedAt: iso(at) }).where(inArray(s.bookings.id, [host.id, member.id]));
    const released = await db
      .update(s.bookingGuides)
      .set({ releasedAt: iso(at) })
      .where(and(eq(s.bookingGuides.bookingId, member.id), isNull(s.bookingGuides.releasedAt)))
      .returning({ guideId: s.bookingGuides.guideId });
    await db.insert(s.bookingEvents).values([
      { bookingId: member.id, type: "merged", actorUserId: adminId, payload: { hostId: host.id, hostCode: host.code, releasedGuideIds: released.map((r) => r.guideId) }, at: iso(at) },
      { bookingId: host.id, type: "merge_joined", actorUserId: adminId, payload: { bookingId: member.id, code: member.code, people: member.people }, at: iso(at) },
      ...released.map((r) => ({ bookingId: member.id, type: "guide_released", actorUserId: adminId, payload: { guideId: r.guideId }, at: iso(at) })),
    ]);
    await syncChecklist(member.id, host.id, now);
    merged++;
  }

  /* ---- force-confirmed assignments (BR-12-F2) ---- */
  const pending = await db
    .select({ bg: s.bookingGuides, booking: s.bookings })
    .from(s.bookingGuides)
    .innerJoin(s.bookings, eq(s.bookings.id, s.bookingGuides.bookingId))
    .where(
      and(
        isNull(s.bookingGuides.releasedAt),
        isNotNull(s.bookingGuides.notifiedAt),
        isNull(s.bookingGuides.acknowledgedAt),
        gt(s.bookings.tourDate, today),
        inArray(s.bookings.status, ["confirmed", "ready"]),
      ),
    )
    .orderBy(s.bookings.tourDate)
    .limit(2);
  const reasons = ["Dikonfirmasi lewat telepon", "HP guide rusak, konfirmasi via WhatsApp kantor"];
  for (const [i, { bg, booking }] of pending.entries()) {
    const at = minutesBefore(now, 90 + i * 30);
    await db
      .update(s.bookingGuides)
      .set({ acknowledgedAt: iso(at), acknowledgedBy: adminId, ackNote: reasons[i] })
      .where(eq(s.bookingGuides.id, bg.id));
    await db.insert(s.bookingEvents).values({
      bookingId: booking.id,
      type: "guide_acknowledged",
      actorUserId: adminId,
      payload: { guideId: bg.guideId, by: adminId, forced: true, reason: reasons[i] },
      at: iso(at),
    });
    const group = booking.mergeGroupId ? await db.select({ id: s.bookings.id }).from(s.bookings).where(eq(s.bookings.mergeGroupId, booking.mergeGroupId)) : [{ id: booking.id }];
    for (const b of group) await syncChecklist(b.id, booking.mergeGroupId ?? booking.id, now);
  }

  /* ---- team email history (BR-12-E4): the latest bookings, one row per recipient ---- */
  const recipients = ["ops@tmii.test", "manajer@tmii.test"];
  await db.insert(s.settings).values([
    { key: "email_enabled", value: false, updatedBy: adminId },
    { key: "email_recipients", value: recipients, updatedBy: adminId },
  ]);
  const recent = await db
    .select({ id: s.bookings.id, code: s.bookings.code, tourDate: s.bookings.tourDate, slotStart: s.bookings.slotStart, slotEnd: s.bookings.slotEnd, createdAt: s.bookings.createdAt })
    .from(s.bookings)
    .orderBy(s.bookings.createdAt)
    .limit(1000);
  const latest = recent.slice(-5);
  const rows: (typeof s.notifications.$inferInsert)[] = [];
  for (const [i, b] of latest.entries()) {
    for (const to of recipients) {
      const failed = i === latest.length - 1 && to === recipients[1];
      const sent = new Date(Date.parse(b.createdAt) + 4000);
      rows.push({
        eventKey: "booking_created",
        channel: "email",
        locale: "id",
        recipientName: to,
        recipientEmail: to,
        bookingId: b.id,
        title: `Pemesanan baru ${b.code} · ${b.tourDate} ${b.slotStart.replace(":", ".")}–${b.slotEnd.replace(":", ".")}`,
        body: `Pemesanan baru ${b.code}\n\nRincian lengkap ada di lampiran.`,
        context: { code: b.code },
        deliveryStatus: failed ? "gagal" : "terkirim",
        error: failed ? "Connection timeout" : null,
        sentAt: failed ? null : iso(sent),
        attachmentName: `pemesanan-${b.code}.xlsx`,
        createdAt: iso(sent),
      });
    }
  }
  if (rows.length) await db.insert(s.notifications).values(rows);
  return { merged, forced: pending.length, emails: rows.length };
}
