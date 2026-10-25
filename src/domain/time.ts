// Time helpers pinned to Asia/Jakarta (WIB, UTC+7, no daylight saving).
// Dates are `YYYY-MM-DD` strings and times `HH:mm` strings, both in WIB.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toWib(at: Date): { date: string; time: string } {
  const shifted = new Date(at.getTime() + WIB_OFFSET_MS).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

export function wibToday(now: Date = new Date()): string {
  return toWib(now).date;
}

/** The UTC instant of a WIB date + time. */
export function wibToUtc(date: string, time = "00:00"): Date {
  return new Date(`${date}T${time}:00+07:00`);
}

export function addDays(date: string, days: number): string {
  const d = new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/** Calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** ISO weekday: 1 = Senin (Monday) … 7 = Minggu (Sunday). */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Monday–Sunday range of the ISO week containing `date`. */
export function isoWeekRange(date: string): { start: string; end: string } {
  const start = addDays(date, 1 - isoWeekday(date));
  return { start, end: addDays(start, 6) };
}

export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
