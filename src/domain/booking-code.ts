import { toWib } from "./time";

/** `TG-YYMMDD-` for the WIB creation date (05 BR-05-10). */
export function bookingCodePrefix(createdAt: Date): string {
  const { date } = toWib(createdAt);
  return `TG-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-`;
}

/** Daily sequence padded to 3 digits; widens naturally past 999. */
export function formatBookingCode(createdAt: Date, sequence: number): string {
  return bookingCodePrefix(createdAt) + String(sequence).padStart(3, "0");
}
