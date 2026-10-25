import { CHANNELS, type Channel } from "@/db/schema";
import type { Period } from "@/domain/metrics";
import { addDays, daysBetween, isValidDate } from "@/domain/time";
import type { ReportFilters } from "./queries";

export const PERIOD_PRESETS = ["7", "30", "90", "bulan-ini", "bulan-lalu", "kustom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined) => one(v).split(",").filter(Boolean);

/** 11 §3.2 "Periode": presets or a custom range of at most 366 days (default 30 days). */
export function resolvePeriod(search: Search, today: string): { preset: PeriodPreset; period: Period; error: string | null } {
  const preset = (PERIOD_PRESETS as readonly string[]).includes(one(search.periode)) ? (one(search.periode) as PeriodPreset) : "30";
  const month = today.slice(0, 7);
  switch (preset) {
    case "7":
      return { preset, period: { from: addDays(today, -6), to: today }, error: null };
    case "90":
      return { preset, period: { from: addDays(today, -89), to: today }, error: null };
    case "bulan-ini":
      return { preset, period: { from: `${month}-01`, to: addDays(addDays(`${month}-01`, 31).slice(0, 7) + "-01", -1) }, error: null };
    case "bulan-lalu": {
      const lastDay = addDays(`${month}-01`, -1);
      return { preset, period: { from: `${lastDay.slice(0, 7)}-01`, to: lastDay }, error: null };
    }
    case "kustom": {
      const from = one(search.dari);
      const to = one(search.sampai);
      if (!isValidDate(from) || !isValidDate(to) || to < from) return { preset, period: { from: addDays(today, -29), to: today }, error: null };
      if (daysBetween(from, to) + 1 > 366) return { preset, period: { from: addDays(to, -365), to }, error: "Rentang maksimal 366 hari." };
      return { preset, period: { from, to }, error: null };
    }
    default:
      return { preset: "30", period: { from: addDays(today, -29), to: today }, error: null };
  }
}

export function resolveFilters(search: Search): ReportFilters {
  return {
    channels: list(search.kanal).filter((c): c is Channel => (CHANNELS as readonly string[]).includes(c)),
    languageIds: list(search.bahasa),
    packageIds: list(search.paket),
    guideIds: list(search.guide),
  };
}

export const FEEDBACK_SOURCES = ["tourist", "staff", "guide"] as const;

/** Tab "Ulasan" filters: `rendah=1`, `komentar=1`, `sumber=`. */
export function resolveFeedbackTab(search: Search) {
  const source = one(search.sumber);
  return {
    lowOnly: one(search.rendah) === "1",
    withComment: one(search.komentar) === "1",
    source: (FEEDBACK_SOURCES as readonly string[]).includes(source) ? (source as (typeof FEEDBACK_SOURCES)[number]) : undefined,
  };
}
