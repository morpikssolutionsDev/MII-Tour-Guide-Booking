// Payment hold (05 BR-05-11). Pure.
import { wibToUtc } from "./time";

/** min(created + hold hours, tour date + slot start): payment must happen before the tour. */
export function computeHoldExpiry(createdAt: Date, holdHours: number, tourDate: string, slotStart: string): Date {
  const byHours = createdAt.getTime() + holdHours * 60 * 60 * 1000;
  const bySlot = wibToUtc(tourDate, slotStart).getTime();
  return new Date(Math.min(byHours, bySlot));
}

export function isHoldExpired(holdExpiresAt: string | null, now: Date): boolean {
  return holdExpiresAt !== null && Date.parse(holdExpiresAt) <= now.getTime();
}
