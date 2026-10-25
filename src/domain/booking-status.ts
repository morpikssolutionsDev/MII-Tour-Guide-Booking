// Booking lifecycle rules (overview §7, 05 BR-05-12..15, 06 BR-06-8, 07 BR-07-5). Pure.
import type { BookingStatus } from "@/db/schema";
import { wibToUtc } from "./time";

export const LIVE_STATUSES: readonly BookingStatus[] = ["awaiting_payment", "confirmed", "ready"];
export const PAID_LIVE_STATUSES: readonly BookingStatus[] = ["confirmed", "ready"];
export const DONE_STATUSES: readonly BookingStatus[] = ["completed", "evaluated"];
export const TERMINAL_STATUSES: readonly BookingStatus[] = ["evaluated", "no_show", "cancelled"];

const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  awaiting_payment: ["confirmed", "cancelled"],
  confirmed: ["ready", "awaiting_payment", "cancelled", "completed", "no_show"],
  ready: ["confirmed", "awaiting_payment", "cancelled", "completed", "no_show"],
  completed: ["evaluated"],
  evaluated: [],
  no_show: [],
  cancelled: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

type Timed = { status: BookingStatus; tourDate: string; slotStart: string; slotEnd: string };

const started = (b: Timed, now: Date) => now >= wibToUtc(b.tourDate, b.slotStart);
const ended = (b: Timed, now: Date) => now >= wibToUtc(b.tourDate, b.slotEnd);

export const canConfirmPayment = (b: Timed) => b.status === "awaiting_payment";

/** BR-05-13: before the current slot starts. */
export const canReschedule = (b: Timed, now: Date) => LIVE_STATUSES.includes(b.status) && !started(b, now);

/** BR-05-15: until the slot ends. */
export const canCancel = (b: Timed, now: Date) => LIVE_STATUSES.includes(b.status) && !ended(b, now);

/** BR-05-14: Selesai / Tidak Hadir once the slot has started. */
export const canComplete = (b: Timed, now: Date) => PAID_LIVE_STATUSES.includes(b.status) && started(b, now);

/** BR-06-8: admin undo before the tour starts. */
export const canVoidPayment = (b: Timed, now: Date) => PAID_LIVE_STATUSES.includes(b.status) && !started(b, now);

/** Display-only "Berlangsung" between slot start and end (08 BR-08-6). */
export const isOngoing = (b: Timed, now: Date) => PAID_LIVE_STATUSES.includes(b.status) && started(b, now) && !ended(b, now);

/** BR-07-5: the status a paid booking should have for its checklist state. */
export function statusForChecklist(status: BookingStatus, allChecked: boolean): BookingStatus {
  if (!PAID_LIVE_STATUSES.includes(status)) return status;
  return allChecked ? "ready" : "confirmed";
}
