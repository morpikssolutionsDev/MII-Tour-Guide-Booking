import "server-only";
import { toCsv } from "@/domain/metrics";
import { toWib, wibToday } from "@/domain/time";
import { t } from "@/i18n/id";
import { getBookingsBreakdown, getFeedbackReport, getGuidePerformance, getReportSummary, getRevenueTrend, getStaffSales, type Dimension } from "./queries";
import { resolveFeedbackTab, resolveFilters, resolvePeriod, type Search } from "./params";

const r = t.reports;

/** Export keys (11 BR-11-10) mapped to the file stem `laporan-{tabel}`. */
export const CSV_KEYS = ["kanal", "staf", "bahasa", "slot", "tren", "status", "penjualan-staf", "kinerja-guide", "ulasan"] as const;
export type CsvKey = (typeof CSV_KEYS)[number];

const DIMENSIONS: Partial<Record<CsvKey, Dimension>> = { kanal: "channel", staf: "staff", bahasa: "language", slot: "slot" };
const decimal = (v: number | null, digits = 2) => (v === null ? "" : Number(v.toFixed(digits)));

/** BR-11-10: full result under the current filters; money plain, dates ISO, ratios as decimals. */
export async function buildReportCsv(key: CsvKey, search: Search): Promise<{ filename: string; body: string }> {
  const { period } = resolvePeriod(search, wibToday());
  const filters = resolveFilters(search);
  const filename = `laporan-${key}-${period.from.replaceAll("-", "")}-${period.to.replaceAll("-", "")}.csv`;

  const dimension = DIMENSIONS[key];
  if (dimension) {
    const rows = await getBookingsBreakdown(period, filters, dimension);
    const label = (row: (typeof rows)[number]) =>
      dimension === "channel" ? t.channels[row.key as keyof typeof t.channels] : row.inactive ? `${row.label} ${t.common.inactiveSuffix}` : row.label;
    const head = { channel: r.filters.channel, staff: r.staffSales.cols.staff, language: r.filters.language, slot: "Slot" }[dimension];
    return { filename, body: toCsv([head, r.charts.count], rows.map((row) => [label(row), row.count])) };
  }

  switch (key) {
    case "tren": {
      const { buckets } = await getRevenueTrend(period, filters);
      return {
        filename,
        body: toCsv(
          ["Periode", t.channels.sales, t.channels.call_center, t.channels.on_the_spot, r.charts.amount],
          buckets.map((b) => [b.bucket, b.sales, b.call_center, b.on_the_spot, b.total]),
        ),
      };
    }
    case "status": {
      const summary = await getReportSummary(period, filters);
      return { filename, body: toCsv([t.common.status, r.charts.count], summary.byStatus.map((s) => [t.bookingStatus[s.status], s.n])) };
    }
    case "penjualan-staf": {
      const rows = await getStaffSales(period, filters);
      const c = r.staffSales.cols;
      return {
        filename,
        body: toCsv(
          [c.staff, c.channel, c.bookings, c.cancelled, c.revenue, c.average],
          rows.map((s) => [
            s.inactive ? `${s.name} ${t.common.inactiveSuffix}` : s.name,
            s.defaultChannel ? t.channels[s.defaultChannel] : "",
            s.bookings,
            s.cancelled,
            s.revenue,
            s.averageValue,
          ]),
        ),
      };
    }
    case "kinerja-guide": {
      const rows = await getGuidePerformance(period, filters);
      const c = r.guides.cols;
      return {
        filename,
        body: toCsv(
          [c.guide, t.guides.colLanguages, c.tours, c.noShows, c.rating, "Jumlah rating", c.byGuide, c.utilisation, c.notice, c.leave],
          rows.map((g) => [
            g.name,
            g.languages.map((l) => l.toUpperCase()).join(" "),
            g.tours,
            g.noShows,
            decimal(g.rating, 1),
            g.ratingCount,
            g.byGuide,
            decimal(g.utilisation),
            decimal(g.notice),
            g.leaveDays,
          ]),
        ),
      };
    }
    case "ulasan": {
      const { rows } = await getFeedbackReport(period, filters, resolveFeedbackTab(search));
      const c = r.feedback.cols;
      return {
        filename,
        body: toCsv(
          [c.date, c.code, c.customer, "Kewarganegaraan", c.guides, c.overall, c.revisit, c.consent, c.source, c.comment],
          rows.map((f) => [
            f.submittedAt ? toWib(new Date(f.submittedAt)).date : "",
            f.code,
            f.customerName,
            f.nationality,
            f.guides.map((g) => `${g.name} (${g.rating})`).join("; "),
            f.overall,
            f.wouldRevisit ? t.feedback.revisitAnswers[f.wouldRevisit] : "",
            f.consent ? t.common.yes : t.common.no,
            f.source ? r.feedback.sources[f.source] : "",
            f.comment ?? "",
          ]),
        ),
      };
    }
    default:
      throw new Error(`Unknown report key ${key}`);
  }
}
