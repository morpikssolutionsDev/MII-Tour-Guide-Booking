"use server";

import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { bookingEvents, bookingGuides, bookings, customers, guides, packages } from "@/db/schema";
import { PAID_LIVE_STATUSES } from "@/domain/booking-status";
import { mergeCapacity, mergeRefusal, mergeableStatuses } from "@/domain/merge";
import { daysBetween, toWib, wibToUtc } from "@/domain/time";
import { t } from "@/i18n/id";
import { isPaymentConfirmationEnabled } from "@/lib/flags";
import { ActionError, defineAction } from "../action";
import { notify } from "../notify";
import { recomputeGuideAck, reconcileStatusWithChecklist } from "../preparation/core";
import { getSettings } from "../settings";
import { rankEligibleGuides } from "./availability";
import { syncHolds } from "./holds";
import { activeAssignments, detachMember, groupPeople, hostIdOf, isMember, loadGroup, toCandidate } from "./merge-core";

// 12-perubahan-fase-2.md §3.1, BR-12-M1..M8 (admin only).

const sm = t.merge;

async function loadBooking(id: string) {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
  if (!b) throw new ActionError("NOT_FOUND", t.errors.notFound);
  return b;
}

/** Candidates for "Gabungkan pemesanan": same date, slot and language, with the capacity check. */
export const listMergeCandidates = defineAction({ roles: ["admin"], input: z.object({ hostId: z.string() }) }, async (input) => {
  await syncHolds();
  const now = new Date();
  const paymentConfirmation = isPaymentConfirmationEnabled();
  const requested = await loadBooking(input.hostId);
  const hostId = hostIdOf(requested);
  const group = await loadGroup(db, hostId);
  const host = group[0];
  const guideCount = (await activeAssignments(db, hostId)).length;
  const capacity = mergeCapacity(group.map(toCandidate), guideCount);

  const rows = await db
    .select({ booking: bookings, customerName: customers.name, nationality: customers.nationality, packageName: packages.name })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(packages, eq(packages.id, bookings.packageId))
    .where(
      and(
        eq(bookings.tourDate, host.tourDate),
        eq(bookings.slotId, host.slotId),
        eq(bookings.languageId, host.languageId),
        inArray(bookings.status, [...mergeableStatuses(paymentConfirmation)]),
        isNull(bookings.mergeGroupId),
        ne(bookings.id, hostId),
      ),
    );
  const releasing = rows.length
    ? await db
        .select({ bookingId: bookingGuides.bookingId, name: guides.displayName })
        .from(bookingGuides)
        .innerJoin(guides, eq(guides.id, bookingGuides.guideId))
        .where(and(inArray(bookingGuides.bookingId, rows.map((r) => r.booking.id)), isNull(bookingGuides.releasedAt)))
    : [];

  return {
    host: { id: host.id, code: host.code, tourDate: host.tourDate, slotStart: host.slotStart, slotEnd: host.slotEnd },
    capacity: { used: capacity.used, max: capacity.max, guides: guideCount },
    candidates: rows
      .filter((r) => mergeRefusal(toCandidate(host), toCandidate(r.booking), now, paymentConfirmation) === null)
      .map((r) => {
        const fit = mergeCapacity([...group, r.booking].map(toCandidate), guideCount);
        return {
          id: r.booking.id,
          code: r.booking.code,
          customerName: r.customerName,
          nationality: r.nationality,
          people: r.booking.people,
          packageName: r.packageName,
          status: r.booking.status,
          releasesGuides: releasing.filter((g) => g.bookingId === r.booking.id).map((g) => g.name),
          fits: fit.fits,
          overBy: fit.overBy,
        };
      })
      .sort((a, b) => Number(b.fits) - Number(a.fits) || a.code.localeCompare(b.code)),
  };
});

/** BR-12-M6: `bookingId` joins the shared tour hosted by `hostId` (or by its host). */
export const mergeBooking = defineAction(
  { roles: ["admin"], input: z.object({ hostId: z.string(), bookingId: z.string() }) },
  async (input, me) => {
    await syncHolds();
    const now = new Date();
    const paymentConfirmation = isPaymentConfirmationEnabled();
    return db.transaction(async (tx) => {
      const [requested] = await tx.select().from(bookings).where(eq(bookings.id, input.hostId));
      const [joining] = await tx.select().from(bookings).where(eq(bookings.id, input.bookingId));
      if (!requested || !joining) throw new ActionError("NOT_FOUND", t.errors.notFound);
      const hostId = hostIdOf(requested);
      const group = await loadGroup(tx, hostId);
      const host = group[0];

      const refusal = mergeRefusal(toCandidate(host), toCandidate(joining), now, paymentConfirmation);
      if (refusal) throw new ActionError("INVALID_STATE", sm.refusal[refusal]);
      const hostGuides = await activeAssignments(tx, hostId);
      const capacity = mergeCapacity([...group, joining].map(toCandidate), hostGuides.length);
      if (!capacity.fits) throw new ActionError("VALIDATION", sm.capacity(capacity.used, capacity.max));

      const at = now.toISOString();
      if (!host.mergeGroupId) await tx.update(bookings).set({ mergeGroupId: hostId, mergedAt: at }).where(eq(bookings.id, hostId));
      await tx.update(bookings).set({ mergeGroupId: hostId, mergedAt: at }).where(eq(bookings.id, joining.id));

      // BR-12-M6 step 2: the joining booking's own guides are freed.
      const released = await activeAssignments(tx, joining.id);
      await tx.update(bookingGuides).set({ releasedAt: at }).where(and(eq(bookingGuides.bookingId, joining.id), isNull(bookingGuides.releasedAt)));
      await tx.insert(bookingEvents).values([
        { bookingId: joining.id, type: "merged", actorUserId: me.id, payload: { hostId, hostCode: host.code, releasedGuideIds: released.map((r) => r.guideId) }, at },
        { bookingId: hostId, type: "merge_joined", actorUserId: me.id, payload: { bookingId: joining.id, code: joining.code, people: joining.people }, at },
        ...released.map((r) => ({ bookingId: joining.id, type: "guide_released", actorUserId: me.id, payload: { guideId: r.guideId }, at })),
      ]);

      // BR-12-M10: the joining booking now follows the host's acknowledgements.
      if (PAID_LIVE_STATUSES.includes(joining.status)) {
        await recomputeGuideAck(tx, joining.id, now);
        await reconcileStatusWithChecklist(tx, joining.id, now);
      }

      // BR-12-M7: released guides that knew about the tour, and the host's guides. No tourist message.
      const notifiedReleased = released.filter((r) => r.notifiedAt).map((r) => r.guideId);
      if (notifiedReleased.length) {
        await notify.guideReleased(tx, joining.id, notifiedReleased, { tourDate: joining.tourDate, slotStart: joining.slotStart, slotEnd: joining.slotEnd });
      }
      const total = groupPeople([...group, joining]);
      await notify.tourMerged(tx, hostId, { change: "merged", code: joining.code, people: joining.people, total });
      return { groupId: hostId, totalPeople: total };
    });
  },
);

/** BR-12-M8 "Pisahkan": the member gets its own guides again, or nothing changes. */
export const splitBooking = defineAction({ roles: ["admin"], input: z.object({ bookingId: z.string() }) }, async (input, me) => {
  await syncHolds();
  const now = new Date();
  const member = await loadBooking(input.bookingId);
  if (!isMember(member)) throw new ActionError("INVALID_STATE", sm.notMember);
  if (now >= wibToUtc(member.tourDate, member.slotStart)) throw new ActionError("INVALID_STATE", sm.refusal.started);

  return db.transaction(async (tx) => {
    const ranked = await rankEligibleGuides(tx, {
      date: member.tourDate,
      slotId: member.slotId,
      languageId: member.languageId,
      guidesNeeded: member.guidesNeeded,
    });
    if (ranked.length < member.guidesNeeded) throw new ActionError("CONFLICT", sm.noGuides(member.code));
    const picked = ranked.slice(0, member.guidesNeeded).map((g) => g.guideId);

    await detachMember(tx, member, me.id, now);
    const paid = PAID_LIVE_STATUSES.includes(member.status);
    const { notice_days } = await getSettings(tx);
    const shortNotice = daysBetween(toWib(now).date, member.tourDate) < notice_days;
    await tx.insert(bookingGuides).values(
      picked.map((guideId) => ({
        bookingId: member.id,
        guideId,
        tourDate: member.tourDate,
        slotId: member.slotId,
        notifiedAt: paid ? now.toISOString() : null,
        shortNotice: paid ? shortNotice : false,
      })),
    );
    await tx.insert(bookingEvents).values(picked.map((guideId) => ({ bookingId: member.id, type: "guide_assigned", actorUserId: me.id, payload: { guideId } })));
    if (paid) {
      await notify.guideAssigned(tx, member.id, picked);
      await recomputeGuideAck(tx, member.id, now);
      await reconcileStatusWithChecklist(tx, member.id, now);
    }
    return { guideIds: picked };
  });
});
