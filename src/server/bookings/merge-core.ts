import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Executor } from "@/db/client";
import { bookingEvents, bookingGuides, bookings, type BookingStatus } from "@/db/schema";
import { PAID_LIVE_STATUSES } from "@/domain/booking-status";
import { nextHost, type MergeCandidate } from "@/domain/merge";
import type { PriceSnapshot } from "@/domain/pricing";
import { notify } from "../notify";
import { recomputeGuideAck, reconcileStatusWithChecklist } from "../preparation/core";

// Shared-tour plumbing (12 BR-12-M1, M8–M10) used by merge actions, reschedule, cancel and
// the guide portal. A group is every booking whose merge_group_id is the host's id.

type BookingRow = typeof bookings.$inferSelect;

export const hostIdOf = (b: Pick<BookingRow, "id" | "mergeGroupId">) => b.mergeGroupId ?? b.id;
export const isMember = (b: Pick<BookingRow, "id" | "mergeGroupId">) => Boolean(b.mergeGroupId && b.mergeGroupId !== b.id);
export const isHostWithMembers = (b: Pick<BookingRow, "id" | "mergeGroupId">) => b.mergeGroupId === b.id;

export function toCandidate(b: BookingRow): MergeCandidate {
  return {
    id: b.id,
    status: b.status,
    tourDate: b.tourDate,
    slotId: b.slotId,
    slotStart: b.slotStart,
    languageId: b.languageId,
    people: b.people,
    maxPeoplePerGuide: (b.priceSnapshot as PriceSnapshot).package.maxPeoplePerGuide,
    mergeGroupId: b.mergeGroupId,
  };
}

/** Bookings served by `hostId`'s guides: the host first, then members in joining order. */
export async function loadGroup(ex: Executor, hostId: string): Promise<BookingRow[]> {
  const rows = await ex.select().from(bookings).where(eq(bookings.mergeGroupId, hostId)).orderBy(asc(bookings.mergedAt));
  if (rows.length) return [...rows.filter((r) => r.id === hostId), ...rows.filter((r) => r.id !== hostId)];
  const [host] = await ex.select().from(bookings).where(eq(bookings.id, hostId));
  return host ? [host] : [];
}

export async function activeAssignments(ex: Executor, bookingId: string) {
  return ex
    .select()
    .from(bookingGuides)
    .where(and(eq(bookingGuides.bookingId, bookingId), isNull(bookingGuides.releasedAt)));
}

/** BR-12-M10: re-derive "Konfirmasi guide" and Siap for every booking in a group. */
export async function recomputeGroup(tx: Executor, hostId: string, now: Date) {
  for (const b of await loadGroup(tx, hostId)) {
    if (!PAID_LIVE_STATUSES.includes(b.status as BookingStatus)) continue;
    await recomputeGuideAck(tx, b.id, now);
    await reconcileStatusWithChecklist(tx, b.id, now);
  }
}

/** Total people served by the host's guides. */
export const groupPeople = (group: Pick<BookingRow, "people">[]) => group.reduce((sum, b) => sum + b.people, 0);

/**
 * BR-12-M8 steps 3, 5, 6 / BR-12-M9: take a member out of its group without touching guides.
 * Dissolves the group when only the host remains.
 */
export async function detachMember(tx: Executor, member: BookingRow, actorUserId: string | null, now: Date) {
  const hostId = hostIdOf(member);
  await tx.update(bookings).set({ mergeGroupId: null, mergedAt: null }).where(eq(bookings.id, member.id));
  const remaining = await loadGroup(tx, hostId);
  if (remaining.length === 1 && remaining[0].mergeGroupId) {
    await tx.update(bookings).set({ mergeGroupId: null, mergedAt: null }).where(eq(bookings.id, hostId));
  }
  const at = now.toISOString();
  await tx.insert(bookingEvents).values([
    { bookingId: member.id, type: "merge_split", actorUserId, payload: { hostId }, at },
    { bookingId: hostId, type: "merge_split", actorUserId, payload: { bookingId: member.id, code: member.code }, at },
  ]);
  await notify.tourMerged(tx, hostId, { change: "split", code: member.code, people: member.people, total: groupPeople(remaining) });
}

/**
 * BR-12-M9: the host is leaving (cancelled). Its active guide rows move to the member that
 * joined first, which becomes the new host. Returns the new host id, or null if no member.
 */
export async function transferHost(tx: Executor, host: BookingRow, actorUserId: string | null, now: Date): Promise<string | null> {
  const members = (await loadGroup(tx, host.id)).filter((b) => b.id !== host.id);
  const heir = nextHost(members);
  await tx.update(bookings).set({ mergeGroupId: null, mergedAt: null }).where(eq(bookings.id, host.id));
  if (!heir) return null;
  const at = now.toISOString();
  const rows = await activeAssignments(tx, host.id);
  // Release first so the one-active-assignment-per-guide-and-slot index allows the move.
  await tx.update(bookingGuides).set({ releasedAt: at }).where(and(eq(bookingGuides.bookingId, host.id), isNull(bookingGuides.releasedAt)));
  if (rows.length) {
    await tx.insert(bookingGuides).values(
      rows.map((r) => ({
        bookingId: heir.id,
        guideId: r.guideId,
        tourDate: r.tourDate,
        slotId: r.slotId,
        assignedAt: r.assignedAt,
        notifiedAt: r.notifiedAt,
        shortNotice: r.shortNotice,
        acknowledgedAt: r.acknowledgedAt,
        acknowledgedBy: r.acknowledgedBy,
        ackNote: r.ackNote,
      })),
    );
  }
  const stillMembers = members.filter((m) => m.id !== heir.id);
  if (stillMembers.length) {
    await tx.update(bookings).set({ mergeGroupId: heir.id }).where(eq(bookings.mergeGroupId, host.id));
    await tx.update(bookings).set({ mergedAt: null }).where(eq(bookings.id, heir.id));
  } else {
    await tx.update(bookings).set({ mergeGroupId: null, mergedAt: null }).where(eq(bookings.id, heir.id));
  }
  await tx.insert(bookingEvents).values({ bookingId: heir.id, type: "merge_host_changed", actorUserId, payload: { from: host.id, fromCode: host.code }, at });
  await recomputeGroup(tx, heir.id, now);
  return heir.id;
}
