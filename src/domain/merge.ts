// Shared tours (12-perubahan-fase-2.md BR-12-M2..M4, M9). Pure.
import type { BookingStatus } from "@/db/schema";
import { wibToUtc } from "./time";

export type MergeCandidate = {
  id: string;
  status: BookingStatus;
  tourDate: string;
  slotId: string;
  slotStart: string;
  languageId: string;
  people: number;
  /** From the booking's price snapshot. */
  maxPeoplePerGuide: number;
  mergeGroupId: string | null;
};

export type MergeRefusal = "same_booking" | "different_schedule" | "status" | "started" | "already_merged";

/** BR-12-M2: statuses that may be merged; awaiting payment only while payment confirmation is on. */
export function mergeableStatuses(paymentConfirmation: boolean): readonly BookingStatus[] {
  return paymentConfirmation ? ["awaiting_payment", "confirmed", "ready"] : ["confirmed", "ready"];
}

/** BR-12-M2: can `joining` join the group hosted by `host`? Capacity is checked separately. */
export function mergeRefusal(host: MergeCandidate, joining: MergeCandidate, now: Date, paymentConfirmation: boolean): MergeRefusal | null {
  if (host.id === joining.id) return "same_booking";
  if (host.tourDate !== joining.tourDate || host.slotId !== joining.slotId || host.languageId !== joining.languageId) return "different_schedule";
  const allowed = mergeableStatuses(paymentConfirmation);
  if (!allowed.includes(host.status) || !allowed.includes(joining.status)) return "status";
  if (now >= wibToUtc(host.tourDate, host.slotStart)) return "started";
  if (joining.mergeGroupId) return "already_merged";
  return null;
}

/**
 * BR-12-M4: the group's guides × the smallest max-per-guide among its packages must cover
 * everyone. `group` is every booking that would be served, including the joining one.
 */
export function mergeCapacity(group: Pick<MergeCandidate, "people" | "maxPeoplePerGuide">[], guideCount: number) {
  const used = group.reduce((sum, b) => sum + b.people, 0);
  const perGuide = group.length ? Math.min(...group.map((b) => Math.max(1, b.maxPeoplePerGuide))) : 0;
  const max = guideCount * perGuide;
  return { used, max, fits: guideCount > 0 && used <= max, overBy: Math.max(0, used - max) };
}

/** BR-12-M9: when the host is cancelled, the member that joined first takes over its guides. */
export function nextHost<T extends { id: string; mergedAt: string | null }>(members: T[]): T | null {
  return [...members].sort((a, b) => (a.mergedAt ?? "").localeCompare(b.mergedAt ?? "") || a.id.localeCompare(b.id))[0] ?? null;
}
