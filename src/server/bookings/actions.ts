"use server";

import { and, eq, inArray, isNull, like, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Executor } from "@/db/client";
import {
  bookingAddons,
  bookingEvents,
  bookingGuides,
  bookings,
  CANCEL_REASONS,
  CHANNELS,
  customers,
  guides,
  languages,
  payments,
  slots,
} from "@/db/schema";
import { bookingCodePrefix, formatBookingCode } from "@/domain/booking-code";
import { canCancel, canComplete, canReschedule, TERMINAL_STATUSES } from "@/domain/booking-status";
import { isWithinBookingWindow, isSlotOpen } from "@/domain/availability";
import { computeHoldExpiry } from "@/domain/hold";
import { normalizePhone } from "@/domain/phone";
import { calculatePrice, type PriceSnapshot } from "@/domain/pricing";
import { addDays, daysBetween, eachDay, isValidDate, toWib, wibToUtc } from "@/domain/time";
import { t } from "@/i18n/id";
import { formatSlot } from "@/lib/format";
import { isCountryCode } from "@/lib/countries";
import { ActionError, defineAction, fieldError } from "../action";
import { issueFeedbackToken } from "../feedback/tokens";
import { notify } from "../notify";
import { recomputeGuideAck, reconcileStatusWithChecklist } from "../preparation/core";
import { loadPricingInputs } from "../pricing/queries";
import { getSettings } from "../settings";
import {
  availabilityForDate,
  loadActiveAssignments,
  loadActiveSlots,
  loadGuidesForAvailability,
  rankEligibleGuides,
} from "./availability";
import { expireHolds } from "./holds";

const sb = t.booking;
const sw = sb.wizard;

/* ---------------- helpers ---------------- */

function isGuideSlotClash(error: unknown): boolean {
  const messages: string[] = [];
  for (let e = error as { message?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    messages.push(String(e.message ?? ""));
    if (messages.length > 5) break;
  }
  return messages.some((m) => m.includes("UNIQUE constraint failed: booking_guides"));
}

async function nextBookingCode(tx: Executor, now: Date) {
  const prefix = bookingCodePrefix(now);
  const rows = await tx.select({ code: bookings.code }).from(bookings).where(like(bookings.code, `${prefix}%`));
  const max = rows.reduce((m, r) => Math.max(m, Number(r.code.slice(prefix.length)) || 0), 0);
  return formatBookingCode(now, max + 1); // BR-05-10
}

function reasonText(reason: { kind: "no_language_guides" } | { kind: "not_enough"; needed: number; available: number } | null, languageName: string) {
  if (!reason) return null;
  return reason.kind === "no_language_guides"
    ? sw.schedule.noLanguageGuides(languageName)
    : sw.schedule.notEnough(reason.needed, reason.available);
}

async function guideNames(ex: Executor, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await ex.select({ id: guides.id, name: guides.displayName }).from(guides).where(inArray(guides.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

type ScheduleInput = {
  languageId: string;
  people: number;
  packageId: string;
  date: string;
  slotId: string;
  guideIds: string[];
  addonIds: string[];
};

/**
 * Validates a schedule (BR-05-1, 05-3, 05-7, 05-18) and prices it. `current` relaxes the
 * active-only checks for values an existing booking already uses (reschedule).
 */
async function prepareSchedule(
  ex: Executor,
  input: ScheduleInput,
  opts: { now: Date; excludeBookingId?: string; current?: { languageId: string; packageId: string; slotId: string } },
) {
  const settings = await getSettings(ex);
  const nowWib = toWib(opts.now);
  if (!isWithinBookingWindow(input.date, nowWib.date, settings.booking_horizon_days)) throw fieldError("date", sw.outsideWindow);

  const [slot] = await ex.select().from(slots).where(eq(slots.id, input.slotId));
  if (!slot || (!slot.isActive && opts.current?.slotId !== slot.id)) throw fieldError("slotId", sw.slotGone);
  if (!isSlotOpen(input.date, slot.startTime, nowWib)) throw fieldError("slotId", sw.slotGone);

  const [language] = await ex.select().from(languages).where(eq(languages.id, input.languageId));
  if (!language || (!language.isActive && opts.current?.languageId !== language.id)) throw fieldError("languageId", t.errors.notFound);

  const pricing = await loadPricingInputs(ex, input.packageId);
  if (!pricing || (!pricing.packageIsActive && opts.current?.packageId !== input.packageId)) throw fieldError("packageId", t.errors.notFound);
  const activeAddonIds = new Set(pricing.addons.map((a) => a.id));
  if (input.addonIds.some((id) => !activeAddonIds.has(id))) throw fieldError("addonIds", t.errors.notFound);

  const snapshot = calculatePrice({
    date: input.date,
    people: input.people,
    pkg: pricing.pkg,
    selectedAddonIds: input.addonIds,
    addons: pricing.addons,
    rules: pricing.rules,
    holidays: pricing.holidays,
    now: opts.now,
  });

  // BR-05-7: exactly n distinct guides, each eligible for this date, slot and language.
  const guideIds = [...new Set(input.guideIds)];
  if (guideIds.length !== snapshot.guidesNeeded) throw fieldError("guideIds", sw.guides.pickExactly(snapshot.guidesNeeded));
  const availability = await availabilityForDate(ex, {
    date: input.date,
    languageId: input.languageId,
    guidesNeeded: snapshot.guidesNeeded,
    excludeBookingId: opts.excludeBookingId,
    now: opts.now,
  });
  const slotAvailability = availability.find((s) => s.slotId === slot.id);
  const notEligible = guideIds.filter((id) => !slotAvailability?.eligibleGuideIds.includes(id));
  if (notEligible.length) {
    const names = await guideNames(ex, notEligible);
    throw new ActionError("CONFLICT", sw.guideTaken([...names.values()].join(", ") || "Guide"), { refresh: true });
  }
  return { snapshot, slot, guideIds, settings };
}

/** "Jumlah orang 6 → 8; Paket Reguler → Premium" for the details-changed guide notice (09 §7). */
async function detailsSummary(
  ex: Executor,
  before: { people: number; languageId: string; priceSnapshot: unknown },
  after: { people: number; languageId: string },
  snapshot: PriceSnapshot,
) {
  const parts: string[] = [];
  if (before.people !== after.people) parts.push(`Jumlah orang ${before.people} → ${after.people}`);
  const beforePackage = (before.priceSnapshot as PriceSnapshot).package.name;
  if (beforePackage !== snapshot.package.name) parts.push(`Paket ${beforePackage} → ${snapshot.package.name}`);
  if (before.languageId !== after.languageId) {
    const rows = await ex.select({ id: languages.id, name: languages.nameId }).from(languages).where(inArray(languages.id, [before.languageId, after.languageId]));
    const name = (id: string) => rows.find((r) => r.id === id)?.name ?? "";
    parts.push(`Bahasa ${name(before.languageId)} → ${name(after.languageId)}`);
  }
  const beforeAddons = (before.priceSnapshot as PriceSnapshot).addons.filter((a) => !a.included).map((a) => a.name);
  const newAddons = snapshot.addons.filter((a) => !a.included && !beforeAddons.includes(a.name)).map((a) => a.name);
  if (newAddons.length) parts.push(`add-on: ${newAddons.join(", ")}`);
  return parts.length ? parts.join("; ") : `${after.people} orang · ${snapshot.package.name}`;
}

function addonRows(bookingId: string, snapshot: PriceSnapshot) {
  return snapshot.addons.map((a) => ({
    bookingId,
    addonId: a.id,
    quantity: a.quantity,
    unitPrice: a.unitPrice,
    amount: a.amount,
    included: a.included,
  }));
}

/* ---------------- lookups for the wizard ---------------- */

/** 05 §3.2 step 1: lookup on blur. Visits = completed/evaluated bookings (BR-05-20). */
export const findCustomerByPhone = defineAction(
  { roles: ["admin", "staff"], input: z.object({ phone: z.string() }) },
  async ({ phone }) => {
    const e164 = normalizePhone(phone);
    if (!e164) return { phone: null, customer: null };
    const customer = await db.query.customers.findFirst({ where: eq(customers.phoneE164, e164) });
    if (!customer) return { phone: e164, customer: null };
    const [stats] = await db
      .select({ visits: sql<number>`count(*)`, lastVisit: sql<string | null>`max(${bookings.tourDate})` })
      .from(bookings)
      .where(and(eq(bookings.customerId, customer.id), inArray(bookings.status, ["completed", "evaluated"])));
    return {
      phone: e164,
      customer: {
        id: customer.id,
        name: customer.name,
        nationality: customer.nationality,
        email: customer.email,
        notes: customer.notes,
        visits: Number(stats?.visits ?? 0),
        lastVisit: stats?.lastVisit ?? null,
      },
    };
  },
);

const scheduleQuery = z.object({
  date: z.string().refine(isValidDate),
  languageId: z.string().min(1),
  people: z.number().int().min(1).max(200),
  packageId: z.string().min(1),
  excludeBookingId: z.string().optional(),
});

/** BR-05-3 for the chosen date. */
export const checkAvailability = defineAction({ roles: ["admin", "staff"], input: scheduleQuery }, async (input) => {
  await expireHolds();
  const pricing = await loadPricingInputs(db, input.packageId);
  if (!pricing) throw new ActionError("NOT_FOUND", t.errors.notFound);
  const guidesNeeded = Math.ceil(input.people / pricing.pkg.maxPeoplePerGuide);
  const [language] = await db.select().from(languages).where(eq(languages.id, input.languageId));
  const result = await availabilityForDate(db, { ...input, guidesNeeded });
  return {
    guidesNeeded,
    slots: result.map((s) => ({
      slotId: s.slotId,
      label: formatSlot(s.startTime, s.endTime),
      startTime: s.startTime,
      available: s.available,
      eligibleCount: s.eligibleGuideIds.length,
      reasonText: reasonText(s.reason, language?.nameId ?? ""),
    })),
  };
});

/** BR-05-5: available slot counts for 7 days from the chosen date (clipped to the window). */
export const checkAvailabilityRange = defineAction({ roles: ["admin", "staff"], input: scheduleQuery }, async (input) => {
  const settings = await getSettings();
  const today = toWib(new Date()).date;
  const last = addDays(today, settings.booking_horizon_days);
  const end = addDays(input.date, 6) < last ? addDays(input.date, 6) : last;
  if (input.date > end) return [];
  const pricing = await loadPricingInputs(db, input.packageId);
  if (!pricing) throw new ActionError("NOT_FOUND", t.errors.notFound);
  const guidesNeeded = Math.ceil(input.people / pricing.pkg.maxPeoplePerGuide);
  const [guideRows, assignments, slotRows] = await Promise.all([
    loadGuidesForAvailability(db, input.date, end),
    loadActiveAssignments(db, input.date, end),
    loadActiveSlots(db),
  ]);
  const days = eachDay(input.date, end);
  const results = [];
  for (const date of days) {
    const result = await availabilityForDate(
      db,
      { date, languageId: input.languageId, guidesNeeded, excludeBookingId: input.excludeBookingId },
      { guides: guideRows, assignments, slots: slotRows },
    );
    results.push({ date, availableSlots: result.filter((s) => s.available).length });
  }
  return results;
});

/** BR-05-6 ranking for the selected slot. */
export const rankGuides = defineAction(
  { roles: ["admin", "staff"], input: scheduleQuery.extend({ slotId: z.string().min(1) }) },
  async (input) => {
    await expireHolds();
    const pricing = await loadPricingInputs(db, input.packageId);
    if (!pricing) throw new ActionError("NOT_FOUND", t.errors.notFound);
    const guidesNeeded = Math.ceil(input.people / pricing.pkg.maxPeoplePerGuide);
    return { guidesNeeded, candidates: await rankEligibleGuides(db, { ...input, guidesNeeded }) };
  },
);

/* ---------------- create (05 §3.2, BR-05-8..11) ---------------- */

const scheduleFields = {
  languageId: z.string().min(1, t.common.required),
  people: z.number().int().min(1).max(200),
  packageId: z.string().min(1, t.common.required),
  date: z.string().refine(isValidDate, t.common.required),
  slotId: z.string().min(1, t.common.required),
  guideIds: z.array(z.string()),
  addonIds: z.array(z.string()),
  specialNeeds: z.string().trim().max(500).optional().transform((v) => v || null),
};

export const createBooking = defineAction(
  {
    roles: ["admin", "staff"],
    input: z.object({
      customer: z.object({
        phone: z.string(),
        name: z.string().trim().min(2, t.users.nameLength).max(80, t.users.nameLength),
        nationality: z.string().refine(isCountryCode, t.common.required),
        email: z.union([z.literal(""), z.string().trim().email(t.users.emailInvalid)]).optional().transform((v) => v || null),
        notes: z.string().trim().max(500).optional().transform((v) => v || null),
      }),
      channel: z.enum(CHANNELS),
      ...scheduleFields,
      internalNotes: z.string().trim().max(500).optional().transform((v) => v || null),
      groupFrom: z.string().optional(),
    }),
  },
  async (input, me) => {
    const phone = normalizePhone(input.customer.phone);
    if (!phone) throw fieldError("customer.phone", sw.customer.phoneInvalid);
    await expireHolds();
    const now = new Date();

    try {
      return await db.transaction(async (tx) => {
        const { snapshot, slot, guideIds, settings } = await prepareSchedule(tx, input, { now });

        // BR-05-8: customer upsert on the normalised WhatsApp number.
        const existing = await tx.query.customers.findFirst({ where: eq(customers.phoneE164, phone) });
        const customerValues = {
          name: input.customer.name,
          nationality: input.customer.nationality.toUpperCase(),
          email: input.customer.email,
          notes: input.customer.notes,
        };
        let customerId: string;
        if (existing) {
          await tx.update(customers).set(customerValues).where(eq(customers.id, existing.id));
          customerId = existing.id;
        } else {
          [{ id: customerId }] = await tx.insert(customers).values({ ...customerValues, phoneE164: phone }).returning({ id: customers.id });
        }

        // BR-05-17: linked bookings share a group ref (the first booking's code).
        let groupRef: string | null = null;
        if (input.groupFrom) {
          const [source] = await tx.select().from(bookings).where(eq(bookings.id, input.groupFrom));
          if (source) {
            groupRef = source.groupRef ?? source.code;
            if (!source.groupRef) await tx.update(bookings).set({ groupRef }).where(eq(bookings.id, source.id));
          }
        }

        const code = await nextBookingCode(tx, now);
        const holdExpiresAt = computeHoldExpiry(now, settings.hold_expiry_hours, input.date, slot.startTime);
        const [{ id }] = await tx
          .insert(bookings)
          .values({
            code,
            customerId,
            channel: input.channel,
            createdBy: me.id,
            languageId: input.languageId,
            packageId: input.packageId,
            slotId: slot.id,
            slotStart: slot.startTime,
            slotEnd: slot.endTime,
            tourDate: input.date,
            people: input.people,
            guidesNeeded: snapshot.guidesNeeded,
            status: "awaiting_payment",
            priceSnapshot: snapshot,
            totalAmount: snapshot.total,
            holdExpiresAt: holdExpiresAt.toISOString(),
            specialNeeds: input.specialNeeds,
            internalNotes: input.internalNotes,
            groupRef,
          })
          .returning({ id: bookings.id });
        await tx.insert(bookingGuides).values(guideIds.map((guideId) => ({ bookingId: id, guideId, tourDate: input.date, slotId: slot.id })));
        if (snapshot.addons.length) await tx.insert(bookingAddons).values(addonRows(id, snapshot));
        await tx.insert(bookingEvents).values([
          { bookingId: id, type: "created", actorUserId: me.id, payload: { channel: input.channel } },
          ...guideIds.map((guideId) => ({ bookingId: id, type: "guide_assigned", actorUserId: me.id, payload: { guideId } })),
        ]);
        await notify.bookingCreated(tx, id);
        return { id, code };
      });
    } catch (error) {
      if (isGuideSlotClash(error)) throw new ActionError("CONFLICT", sw.guideTaken("Guide"), { refresh: true });
      throw error;
    }
  },
);

/* ---------------- reschedule (05 §3.4, BR-05-13, 07 BR-07-6) ---------------- */

export const rescheduleBooking = defineAction(
  {
    roles: ["admin", "staff"],
    input: z.object({ id: z.string(), ...scheduleFields, reason: z.string().trim().min(1, t.common.required).max(200) }),
  },
  async (input, me) => {
    await expireHolds();
    const now = new Date();
    const nowIso = now.toISOString();
    try {
      return await db.transaction(async (tx) => {
        const [booking] = await tx.select().from(bookings).where(eq(bookings.id, input.id));
        if (!booking) throw new ActionError("NOT_FOUND", t.errors.notFound);
        if (!canReschedule(booking, now)) throw new ActionError("INVALID_STATE", sb.reschedule.notAllowed);

        const { snapshot, slot, guideIds } = await prepareSchedule(tx, input, {
          now,
          excludeBookingId: booking.id,
          current: { languageId: booking.languageId, packageId: booking.packageId, slotId: booking.slotId },
        });
        const before = {
          tourDate: booking.tourDate,
          slotStart: booking.slotStart,
          slotEnd: booking.slotEnd,
          languageId: booking.languageId,
          people: booking.people,
          packageId: booking.packageId,
          total: booking.totalAmount,
        };
        const scheduleChanged = booking.tourDate !== input.date || booking.slotId !== slot.id;
        const current = await tx
          .select()
          .from(bookingGuides)
          .where(and(eq(bookingGuides.bookingId, booking.id), isNull(bookingGuides.releasedAt)));
        const kept = current.filter((c) => guideIds.includes(c.guideId));
        const released = current.filter((c) => !guideIds.includes(c.guideId));
        const added = guideIds.filter((id) => !current.some((c) => c.guideId === id));
        const paid = booking.status === "confirmed" || booking.status === "ready";

        // Release first so the unique index allows a guide to move slots.
        for (const r of released) await tx.update(bookingGuides).set({ releasedAt: nowIso }).where(eq(bookingGuides.id, r.id));

        // BR-07-6: schedule changes reset acknowledgements; notices are re-sent for paid bookings.
        const { notice_days } = await getSettings(tx);
        const shortNotice = daysBetween(toWib(now).date, input.date) < notice_days;
        for (const k of kept) {
          if (scheduleChanged) {
            await tx
              .update(bookingGuides)
              .set({
                tourDate: input.date,
                slotId: slot.id,
                acknowledgedAt: null,
                notifiedAt: paid ? nowIso : null,
                shortNotice: paid ? shortNotice : false,
              })
              .where(eq(bookingGuides.id, k.id));
          }
        }
        if (added.length) {
          await tx.insert(bookingGuides).values(
            added.map((guideId) => ({
              bookingId: booking.id,
              guideId,
              tourDate: input.date,
              slotId: slot.id,
              notifiedAt: paid ? nowIso : null,
              shortNotice: paid ? shortNotice : false,
            })),
          );
        }

        const holdExpiresAt =
          booking.status === "awaiting_payment" && booking.holdExpiresAt
            ? new Date(Math.min(Date.parse(booking.holdExpiresAt), wibToUtc(input.date, slot.startTime).getTime())).toISOString()
            : booking.holdExpiresAt;
        await tx
          .update(bookings)
          .set({
            languageId: input.languageId,
            packageId: input.packageId,
            slotId: slot.id,
            slotStart: slot.startTime,
            slotEnd: slot.endTime,
            tourDate: input.date,
            people: input.people,
            guidesNeeded: snapshot.guidesNeeded,
            priceSnapshot: snapshot,
            totalAmount: snapshot.total,
            specialNeeds: input.specialNeeds,
            holdExpiresAt,
          })
          .where(eq(bookings.id, booking.id));
        await tx.delete(bookingAddons).where(eq(bookingAddons.bookingId, booking.id));
        if (snapshot.addons.length) await tx.insert(bookingAddons).values(addonRows(booking.id, snapshot));

        await tx.insert(bookingEvents).values([
          {
            bookingId: booking.id,
            type: "rescheduled",
            actorUserId: me.id,
            payload: {
              reason: input.reason,
              before,
              after: {
                tourDate: input.date,
                slotStart: slot.startTime,
                slotEnd: slot.endTime,
                languageId: input.languageId,
                people: input.people,
                packageId: input.packageId,
                total: snapshot.total,
              },
            },
          },
          ...released.map((r) => ({ bookingId: booking.id, type: "guide_released", actorUserId: me.id, payload: { guideId: r.guideId } })),
          ...added.map((guideId) => ({ bookingId: booking.id, type: "guide_assigned", actorUserId: me.id, payload: { guideId } })),
        ]);

        // Notifications (05 §7, 07 §7).
        const priceDiff = snapshot.total - booking.totalAmount;
        const detailsChanged =
          booking.languageId !== input.languageId ||
          booking.people !== input.people ||
          booking.packageId !== input.packageId ||
          booking.totalAmount !== snapshot.total;
        const notifiedReleased = released.filter((r) => r.notifiedAt).map((r) => r.guideId);
        if (notifiedReleased.length) {
          await notify.guideReleased(tx, booking.id, notifiedReleased, { tourDate: booking.tourDate, slotStart: booking.slotStart, slotEnd: booking.slotEnd });
        }
        const keptNotified = paid ? kept.map((k) => k.guideId) : [];
        await notify.bookingRescheduled(tx, booking.id, {
          keptGuideIds: scheduleChanged || detailsChanged ? keptNotified : [],
          scheduleChanged,
          before: { tourDate: booking.tourDate, slotStart: booking.slotStart, slotEnd: booking.slotEnd },
          summary: await detailsSummary(tx, booking, input, snapshot),
          priceDiff: paid ? priceDiff : 0,
        });
        if (paid && added.length) await notify.guideAssigned(tx, booking.id, added);

        if (paid) {
          await recomputeGuideAck(tx, booking.id, now);
          await reconcileStatusWithChecklist(tx, booking.id, now);
        }
        const [paidRow] = await tx
          .select({ n: sql<number>`count(*)` })
          .from(payments)
          .where(and(eq(payments.bookingId, booking.id), isNull(payments.voidedAt)));
        return { id: booking.id, priceDiff, hasPayments: Number(paidRow?.n ?? 0) > 0 };
      });
    } catch (error) {
      if (isGuideSlotClash(error)) throw new ActionError("CONFLICT", sw.guideTaken("Guide"), { refresh: true });
      throw error;
    }
  },
);

/* ---------------- cancel (05 §3.5, BR-05-15, 06 BR-06-7) ---------------- */

export const cancelBooking = defineAction(
  {
    roles: ["admin", "staff"],
    input: z
      .object({
        id: z.string(),
        reason: z.enum(CANCEL_REASONS).refine((r) => r !== "expired"),
        detail: z.string().trim().max(200).optional().transform((v) => v || null),
        refundNote: z.string().trim().max(300).optional().transform((v) => v || null),
        refundAmount: z.number().int().min(1).optional().nullable(),
      })
      .refine((v) => v.reason !== "other" || v.detail, { message: t.common.required, path: ["detail"] }),
  },
  async (input, me) => {
    await expireHolds();
    const now = new Date();
    const nowIso = now.toISOString();
    await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, input.id));
      if (!booking) throw new ActionError("NOT_FOUND", t.errors.notFound);
      if (!canCancel(booking, now)) throw new ActionError("INVALID_STATE", sb.actions.notAvailable(t.bookingStatus[booking.status]));

      const validPayments = await tx.select().from(payments).where(and(eq(payments.bookingId, booking.id), isNull(payments.voidedAt)));
      const paid = validPayments.reduce((sum, p) => sum + p.amount, 0);
      if (input.refundAmount && input.refundAmount > paid) throw fieldError("refundAmount", sb.cancel.refundTooLarge);

      const assigned = await tx
        .select()
        .from(bookingGuides)
        .where(and(eq(bookingGuides.bookingId, booking.id), isNull(bookingGuides.releasedAt)));
      await tx.update(bookingGuides).set({ releasedAt: nowIso }).where(and(eq(bookingGuides.bookingId, booking.id), isNull(bookingGuides.releasedAt)));
      await tx
        .update(bookings)
        .set({
          status: "cancelled",
          cancelReason: input.reason,
          cancelDetail: input.detail,
          refundNote: input.refundNote,
          cancelledAt: nowIso,
          cancelledBy: me.id,
          holdExpiresAt: null,
        })
        .where(eq(bookings.id, booking.id));
      await tx.insert(bookingEvents).values([
        { bookingId: booking.id, type: "status_changed", actorUserId: me.id, payload: { from: booking.status, to: "cancelled" } },
        { bookingId: booking.id, type: "cancelled", actorUserId: me.id, payload: { reason: input.reason, detail: input.detail } },
      ]);
      if (input.refundAmount) {
        const original = validPayments.find((p) => p.kind === "payment");
        await tx.insert(payments).values({
          bookingId: booking.id,
          kind: "adjustment",
          method: original?.method ?? "bank_transfer",
          amount: -input.refundAmount,
          paidAt: nowIso,
          note: input.refundNote ?? sb.cancel.refundDefaultNote,
          recordedBy: me.id,
        });
        await tx.insert(bookingEvents).values({ bookingId: booking.id, type: "adjustment_recorded", actorUserId: me.id, payload: { amount: -input.refundAmount } });
      }
      const reasonLabel = input.reason === "other" && input.detail ? input.detail : t.cancelReasons[input.reason];
      await notify.bookingCancelled(
        tx,
        booking.id,
        assigned.filter((a) => a.notifiedAt).map((a) => a.guideId),
        reasonLabel,
        input.refundAmount ?? null,
      );
    });
    return null;
  },
);

/* ---------------- complete / no-show (BR-05-14) ---------------- */

export const completeBooking = defineAction(
  {
    roles: ["admin", "staff", "guide"],
    input: z.object({ id: z.string(), outcome: z.enum(["completed", "no_show"]), note: z.string().trim().max(200).optional() }),
  },
  async (input, me) => {
    const now = new Date();
    return db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, input.id));
      if (!booking) throw new ActionError("NOT_FOUND", t.errors.notFound);
      if (me.role === "guide") {
        const [assigned] = await tx
          .select({ id: bookingGuides.id })
          .from(bookingGuides)
          .where(and(eq(bookingGuides.bookingId, booking.id), eq(bookingGuides.guideId, me.guideId ?? ""), isNull(bookingGuides.releasedAt)));
        if (!assigned) throw new ActionError("NOT_FOUND", t.errors.notFound);
      }
      if (booking.status === "completed" || booking.status === "no_show" || booking.status === "evaluated") {
        const [by] = booking.completedBy ? await tx.select({ name: guides.displayName }).from(guides).where(eq(guides.userId, booking.completedBy)) : [];
        throw new ActionError("INVALID_STATE", `Tur ini sudah ditandai ${t.bookingStatus[booking.status]}${by ? ` oleh ${by.name}` : ""}.`);
      }
      if (!canComplete(booking, now)) throw new ActionError("INVALID_STATE", sb.actions.notAvailable(t.bookingStatus[booking.status]));

      const changed = await tx
        .update(bookings)
        .set({ status: input.outcome, completedAt: now.toISOString(), completedBy: me.id })
        .where(and(eq(bookings.id, booking.id), inArray(bookings.status, ["confirmed", "ready"])))
        .returning({ id: bookings.id });
      if (changed.length === 0) throw new ActionError("INVALID_STATE", sb.actions.notAvailable(t.bookingStatus[booking.status]));
      await tx.insert(bookingEvents).values({
        bookingId: booking.id,
        type: "status_changed",
        actorUserId: me.id,
        payload: { from: booking.status, to: input.outcome, ...(input.note ? { note: input.note } : {}) },
      });
      if (input.outcome === "completed") await issueFeedbackToken(tx, booking.id, now);
      return { status: input.outcome };
    });
  },
);

/* ---------------- notes (BR-05-16) ---------------- */

export const updateBookingNotes = defineAction(
  {
    roles: ["admin", "staff"],
    input: z.object({
      id: z.string(),
      field: z.enum(["specialNeeds", "internalNotes"]),
      value: z.string().trim().max(500),
    }),
  },
  async (input, me) => {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.id));
    if (!booking) throw new ActionError("NOT_FOUND", t.errors.notFound);
    if (TERMINAL_STATUSES.includes(booking.status)) throw new ActionError("INVALID_STATE", sb.actions.notAvailable(t.bookingStatus[booking.status]));
    const value = input.value || null;
    await db.transaction(async (tx) => {
      await tx.update(bookings).set({ [input.field]: value }).where(eq(bookings.id, booking.id));
      await tx.insert(bookingEvents).values({
        bookingId: booking.id,
        type: "notes_updated",
        actorUserId: me.id,
        payload: { field: input.field, before: booking[input.field], after: value },
      });
    });
    return null;
  },
);

/* ---------------- customers (05 §3.7) ---------------- */

export const updateCustomer = defineAction(
  {
    roles: ["admin", "staff"],
    input: z.object({
      id: z.string(),
      name: z.string().trim().min(2, t.users.nameLength).max(80, t.users.nameLength),
      phone: z.string(),
      nationality: z.string().refine(isCountryCode, t.common.required),
      email: z.union([z.literal(""), z.string().trim().email(t.users.emailInvalid)]).transform((v) => v || null),
      notes: z.string().trim().max(500).transform((v) => v || null),
    }),
  },
  async (input) => {
    const phone = normalizePhone(input.phone);
    if (!phone) throw fieldError("phone", sw.customer.phoneInvalid);
    const clash = await db.query.customers.findFirst({ where: and(eq(customers.phoneE164, phone), ne(customers.id, input.id)) });
    if (clash) throw fieldError("phone", t.customers.phoneTaken(clash.name));
    await db
      .update(customers)
      .set({ name: input.name, phoneE164: phone, nationality: input.nationality.toUpperCase(), email: input.email, notes: input.notes })
      .where(eq(customers.id, input.id));
    return null;
  },
);
