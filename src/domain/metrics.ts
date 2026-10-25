// Report maths (11-beranda-laporan.md §5). Pure.
import { addDays, daysBetween, isoWeekRange } from "./time";

export type Period = { from: string; to: string };

/** BR-11-1: the previous period of equal length immediately before. */
export function previousPeriod(p: Period): Period {
  const length = daysBetween(p.from, p.to) + 1;
  const to = addDays(p.from, -1);
  return { from: addDays(to, -(length - 1)), to };
}

/** Relative change, or null when the previous value is 0 (shown as "—", §8). */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

/** BR-11-4: booked ÷ available, or null when nothing was available. */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export type Granularity = "day" | "week" | "month";

/** §3.2 trend: ≤ 31 days daily, ≤ 120 days weekly (ISO), otherwise monthly. */
export function granularityFor(p: Period): Granularity {
  const days = daysBetween(p.from, p.to) + 1;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

export function bucketStart(date: string, g: Granularity): string {
  if (g === "day") return date;
  if (g === "week") return isoWeekRange(date).start;
  return `${date.slice(0, 7)}-01`;
}

/** Every bucket start in the period, so empty buckets still appear on the chart. */
export function bucketsFor(p: Period, g: Granularity): string[] {
  const out: string[] = [];
  let cursor = bucketStart(p.from, g);
  while (cursor <= p.to) {
    out.push(cursor);
    if (g === "day") cursor = addDays(cursor, 1);
    else if (g === "week") cursor = addDays(cursor, 7);
    else {
      const [y, m] = cursor.split("-").map(Number);
      cursor = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    }
  }
  return out;
}

/** BR-11-10 CSV: UTF-8 with BOM, comma separated, RFC 4180 quoting. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
