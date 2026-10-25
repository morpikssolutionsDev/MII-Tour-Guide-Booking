// Display formatting (design-system §12, overview §8.1). Indonesian unless the name says En.
import { daysBetween, toWib, wibToday } from "@/domain/time";

const number = new Intl.NumberFormat("id-ID");
const decimal1 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const dateLong = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateShortDay = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateCompact = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});
const dayMonth = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
const dateLongEn = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const regionId = new Intl.DisplayNames(["id"], { type: "region" });
const regionEn = new Intl.DisplayNames(["en"], { type: "region" });

const asUtcDate = (date: string) => new Date(`${date}T00:00:00Z`);

/** `Rp 1.950.000`; negatives as `−Rp 50.000`. */
export function formatRupiah(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  return `${sign}Rp ${number.format(Math.abs(amount))}`;
}

/** `Rp 12,4 jt` for KPI tiles over a million. */
export function formatRupiahShort(amount: number): string {
  if (Math.abs(amount) < 1_000_000) return formatRupiah(amount);
  const sign = amount < 0 ? "−" : "";
  return `${sign}Rp ${decimal1.format(Math.abs(amount) / 1_000_000)} jt`;
}

export function formatNumber(value: number): string {
  return number.format(value);
}

export function formatRating(value: number): string {
  return decimal1.format(value);
}

export function formatPercent(ratio: number): string {
  return `${number.format(Math.round(ratio * 100))}%`;
}

/** `Minggu, 25 Okt 2026` */
export function formatDateLong(date: string): string {
  return dateLong.format(asUtcDate(date));
}

/** `Min, 25 Okt 2026` */
export function formatDateMedium(date: string): string {
  return dateShortDay.format(asUtcDate(date));
}

/** `25/10/2026` */
export function formatDateCompact(date: string): string {
  return dateCompact.format(asUtcDate(date));
}

/** `25 Okt` */
export function formatDayMonth(date: string): string {
  return dayMonth.format(asUtcDate(date));
}

/** `Oktober 2026` */
export function formatMonthYear(date: string): string {
  return monthYear.format(asUtcDate(date));
}

/** `09:00` → `09.00` */
export function formatTime(time: string): string {
  return time.replace(":", ".");
}

/** `09.00–12.00` */
export function formatSlot(start: string, end: string): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

/** ISO timestamp → `25 Okt 2026, 14.20` (WIB). */
export function formatDateTime(iso: string): string {
  const { date, time } = toWib(new Date(iso));
  return `${dayMonth.format(asUtcDate(date))} ${date.slice(0, 4)}, ${formatTime(time)}`;
}

/** ISO timestamp → `14.20` (WIB). */
export function formatClock(iso: string): string {
  return formatTime(toWib(new Date(iso)).time);
}

/** `baru saja`, `5 menit lalu`, `3 jam lalu`, `kemarin`, `4 hari lalu`, or a date. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  if (diffMs < 0) return `dalam ${formatDuration(-diffMs)}`;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = daysBetween(toWib(new Date(iso)).date, wibToday(now));
  if (days <= 1) return "kemarin";
  if (days < 7) return `${days} hari lalu`;
  return formatDateTime(iso);
}

/** Milliseconds → `3 j 20 m` / `45 m`. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) return `${Math.floor(hours / 24)} hr ${hours % 24} j`;
  if (hours > 0) return `${hours} j ${minutes} m`;
  return `${minutes} m`;
}

export function countryNameId(code: string): string {
  try {
    return regionId.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function countryNameEn(code: string): string {
  try {
    return regionEn.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/* ---------- English (tourist-facing) ---------- */

/** `Sunday, 25 October 2026` */
export function formatDateLongEn(date: string): string {
  return dateLongEn.format(asUtcDate(date));
}

/** `09:00–12:00` */
export function formatSlotEn(start: string, end: string): string {
  return `${start}–${end}`;
}

/** ISO timestamp → `Sunday, 25 October 2026, 14:20 WIB`. */
export function formatDateTimeEn(iso: string): string {
  const { date, time } = toWib(new Date(iso));
  return `${formatDateLongEn(date)}, ${time} WIB`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
