import { AlertTriangle, BadgeCheck, CalendarCheck, Download, Repeat, Star, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChannelBadge, StatusBadge } from "@/components/common/badges";
import { ExpandableText } from "@/components/common/expandable-text";
import { FilterChips, ToggleChip } from "@/components/common/filter-bar";
import { HeaderBand, PageContainer } from "@/components/common/page-header";
import { StarsDisplay } from "@/components/common/star-rating";
import { UrlTabs } from "@/components/common/url-tabs";
import { BreakdownChart, ChartCard, RevisitBar, TrendCard } from "@/components/reports/charts";
import { KpiTile } from "@/components/reports/kpi-tile";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { delta, previousPeriod, type Period } from "@/domain/metrics";
import { toWib, wibToday } from "@/domain/time";
import { t } from "@/i18n/id";
import { formatDateMedium, formatNumber, formatPercent, formatRating, formatRupiah, formatRupiahShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CsvKey } from "@/server/reports/csv";
import { FEEDBACK_SOURCES, resolveFeedbackTab, resolveFilters, resolvePeriod, type Search } from "@/server/reports/params";
import {
  getBookingsBreakdown,
  getFeedbackReport,
  getGuidePerformance,
  getReportSummary,
  getRevenueTrend,
  getStaffSales,
  reportFilterOptions,
  type ReportFilters as Filters,
} from "@/server/reports/queries";
import { getSettings } from "@/server/settings";
import { requireRole } from "@/server/session";
import { GuideTable } from "./guide-table";
import { ReportFilters } from "./report-filters";

export const metadata: Metadata = { title: t.reports.title };

const r = t.reports;
const TABS = ["ringkasan", "tour-guide", "ulasan"] as const;
type Tab = (typeof TABS)[number];

/** 11 §3.2 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole("admin", "staff");
  const search = await searchParams;
  const today = wibToday();
  const { period, error } = resolvePeriod(search, today);
  const filters = resolveFilters(search);
  const tab: Tab = (TABS as readonly string[]).includes(String(search.tab)) ? (search.tab as Tab) : "ringkasan";
  const options = await reportFilterOptions();

  // CSV links carry the same filters as the page (BR-11-10).
  const query = new URLSearchParams(
    Object.entries(search).filter((e): e is [string, string] => typeof e[1] === "string" && e[0] !== "tab"),
  ).toString();
  const csv = (key: CsvKey) => `/laporan/export/${key}${query ? `?${query}` : ""}`;

  return (
    <>
      <HeaderBand compact>
        <h1 className="text-2xl font-bold md:text-3xl">{r.title}</h1>
        <p className="mt-1 text-sm text-white/85">
          {formatDateMedium(period.from)} – {formatDateMedium(period.to)}
          {period.to > today && <span className="block text-xs text-white/75">{r.charts.future}</span>}
        </p>
      </HeaderBand>
      <PageContainer className="space-y-5">
        <div className="md:sticky md:top-16 md:z-20 md:-mx-1 md:bg-background/95 md:px-1 md:py-2 md:backdrop-blur">
          <ReportFilters options={options} />
          {error && <p className="mt-2 text-sm font-medium text-merah-700">{error}</p>}
        </div>
        <UrlTabs active={tab} tabs={TABS.map((v) => ({ value: v, label: r.tabs[v] }))} />
        {tab === "ringkasan" && <SummaryTab period={period} filters={filters} csv={csv} />}
        {tab === "tour-guide" && <GuideTab period={period} filters={filters} csv={csv} />}
        {tab === "ulasan" && <FeedbackTab period={period} filters={filters} search={search} csv={csv} />}
      </PageContainer>
    </>
  );
}

type TabProps = { period: Period; filters: Filters; csv: (key: CsvKey) => string };

function CsvButton({ href }: { href: string }) {
  return (
    <Button variant="secondary" size="sm" asChild>
      <a href={href} download>
        <Download />
        {r.charts.download}
      </a>
    </Button>
  );
}

function Card({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card p-4 shadow-card", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const relDelta = (cur: number | null, prev: number | null) => (cur === null || prev === null ? null : delta(cur, prev));
const pct = (v: number | null) => (v === null ? t.common.none : formatPercent(v));

async function SummaryTab({ period, filters, csv }: TabProps) {
  const [cur, prev, byChannel, byStaff, byLanguage, bySlot, trend, staffSales] = await Promise.all([
    getReportSummary(period, filters),
    getReportSummary(previousPeriod(period), filters),
    getBookingsBreakdown(period, filters, "channel"),
    getBookingsBreakdown(period, filters, "staff"),
    getBookingsBreakdown(period, filters, "language"),
    getBookingsBreakdown(period, filters, "slot"),
    getRevenueTrend(period, filters),
    getStaffSales(period, filters),
  ]);
  const k = r.kpi;
  const breakdown = (rows: typeof byChannel, channel = false) =>
    rows.map((row) => ({
      label: channel ? t.channels[row.key as keyof typeof t.channels] : row.inactive ? `${row.label} ${t.common.inactiveSuffix}` : row.label,
      count: row.count,
    }));
  const charts = [
    { key: "kanal", title: r.charts.channel, data: breakdown(byChannel, true), head: r.filters.channel },
    { key: "staf", title: r.charts.staff, data: breakdown(byStaff), head: r.staffSales.cols.staff },
    { key: "bahasa", title: r.charts.language, data: breakdown(byLanguage), head: r.filters.language },
    { key: "slot", title: r.charts.slot, data: breakdown(bySlot), head: "Slot", vertical: true },
  ] as const;
  const sc = r.staffSales.cols;

  return (
    <div className="space-y-5">
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        <KpiTile
          className="snap-start"
          label={k.bookings}
          icon={CalendarCheck}
          value={formatNumber(cur.bookings)}
          delta={delta(cur.bookings, prev.bookings)}
          sub={k.cancelled(cur.cancelled, pct(cur.cancelledShare ?? 0))}
        />
        <KpiTile
          className="snap-start"
          label={k.revenue}
          icon={Wallet}
          value={Math.abs(cur.revenue) >= 1_000_000 ? formatRupiahShort(cur.revenue) : formatRupiah(cur.revenue)}
          valueTitle={formatRupiah(cur.revenue)}
          valueTone={cur.revenue < 0 ? "danger" : undefined}
          delta={delta(cur.revenue, prev.revenue)}
        />
        <KpiTile className="snap-start" label={k.utilisation} icon={Users} value={pct(cur.utilisation)} delta={relDelta(cur.utilisation, prev.utilisation)} />
        <KpiTile
          className="snap-start"
          label={k.rating}
          icon={Star}
          value={cur.rating === null ? t.common.none : `★ ${formatRating(cur.rating)}`}
          sub={k.ratingCount(cur.ratingCount)}
          delta={relDelta(cur.rating, prev.rating)}
        />
        <KpiTile className="snap-start" label={k.returning} icon={Repeat} value={pct(cur.returning)} delta={relDelta(cur.returning, prev.returning)} />
        <KpiTile className="snap-start" label={k.notice} icon={BadgeCheck} value={pct(cur.notice)} delta={relDelta(cur.notice, prev.notice)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {charts.map((c) => (
          <ChartCard
            key={c.key}
            title={c.title}
            csvHref={csv(c.key)}
            empty={c.data.length === 0}
            table={{ header: [c.head, r.charts.count], rows: c.data.map((d) => [d.label, formatNumber(d.count)]) }}
          >
            <BreakdownChart data={c.data} layout={"vertical" in c ? "vertical" : "horizontal"} />
          </ChartCard>
        ))}
      </div>

      <TrendCard buckets={trend.buckets} granularity={trend.granularity} csvHref={csv("tren")} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card title={r.charts.status} action={<CsvButton href={csv("status")} />}>
          {cur.byStatus.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{r.charts.empty}</p>
          ) : (
            <ul className="divide-y">
              {cur.byStatus
                .toSorted((a, b) => b.n - a.n)
                .map((s) => (
                  <li key={s.status} className="flex items-center justify-between py-2">
                    <StatusBadge status={s.status} />
                    <span className="font-semibold tabular">{formatNumber(s.n)}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card title={r.staffSales.title} action={<CsvButton href={csv("penjualan-staf")} />}>
          {staffSales.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{r.charts.empty}</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">{sc.staff}</TableHead>
                      <TableHead scope="col">{sc.channel}</TableHead>
                      <TableHead scope="col" className="text-right">{sc.bookings}</TableHead>
                      <TableHead scope="col" className="text-right">{sc.cancelled}</TableHead>
                      <TableHead scope="col" className="text-right">{sc.revenue}</TableHead>
                      <TableHead scope="col" className="text-right">{sc.average}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffSales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {s.name}
                          {s.inactive && <span className="text-muted-foreground"> {t.common.inactiveSuffix}</span>}
                        </TableCell>
                        <TableCell>{s.defaultChannel ? <ChannelBadge channel={s.defaultChannel} /> : t.common.none}</TableCell>
                        <TableCell className="text-right tabular">{formatNumber(s.bookings)}</TableCell>
                        <TableCell className="text-right tabular">{formatNumber(s.cancelled)}</TableCell>
                        <TableCell className={cn("text-right tabular", s.revenue < 0 && "text-merah-700")}>{formatRupiah(s.revenue)}</TableCell>
                        <TableCell className="text-right tabular">{formatRupiah(s.averageValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="space-y-2 md:hidden">
                {staffSales.map((s) => (
                  <li key={s.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {s.name}
                        {s.inactive && <span className="text-muted-foreground"> {t.common.inactiveSuffix}</span>}
                      </span>
                      <span className="font-semibold tabular">{formatRupiah(s.revenue)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sc.bookings} {s.bookings} · {sc.cancelled} {s.cancelled} · {sc.average} {formatRupiah(s.averageValue)}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

async function GuideTab({ period, filters, csv }: TabProps) {
  const rows = await getGuidePerformance(period, filters);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{r.guides.title}</h2>
        <CsvButton href={csv("kinerja-guide")} />
      </div>
      {rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{r.charts.empty}</p> : <GuideTable rows={rows} />}
    </div>
  );
}

async function FeedbackTab({ period, filters, search, csv }: TabProps & { search: Search }) {
  const [report, settings] = await Promise.all([getFeedbackReport(period, filters, resolveFeedbackTab(search)), getSettings()]);
  const fc = r.feedback.cols;
  const chips = r.feedback.chips;
  const low = (f: (typeof report.rows)[number]) => f.guides.some((g) => g.rating <= settings.low_rating_threshold);
  const date = (iso: string | null) => (iso ? formatDateMedium(toWib(new Date(iso)).date) : t.common.none);

  return (
    <div className="space-y-4">
      <Card title={r.feedback.revisit} action={<span className="text-sm text-muted-foreground">{r.feedback.responseRate(pct(report.responseRate))}</span>}>
        {report.total === 0 ? <p className="text-sm text-muted-foreground">{r.charts.empty}</p> : <RevisitBar {...report.revisit} />}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <ToggleChip param="rendah" label={chips.low} />
          <ToggleChip param="komentar" label={chips.comment} />
        </div>
        <FilterChips
          param="sumber"
          allLabel={chips.all}
          options={FEEDBACK_SOURCES.map((s) => ({ value: s, label: chips[s] }))}
          className="md:mx-0 md:px-0"
        />
        <span className="ml-auto">
          <CsvButton href={csv("ulasan")} />
        </span>
      </div>

      {report.rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{r.charts.empty}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border bg-card shadow-card md:block">
            <Table>
              <TableHeader className="bg-surface-muted">
                <TableRow>
                  <TableHead scope="col">{fc.date}</TableHead>
                  <TableHead scope="col">{fc.code}</TableHead>
                  <TableHead scope="col">{fc.customer}</TableHead>
                  <TableHead scope="col">{fc.guides}</TableHead>
                  <TableHead scope="col">{fc.overall}</TableHead>
                  <TableHead scope="col">{fc.revisit}</TableHead>
                  <TableHead scope="col">{fc.consent}</TableHead>
                  <TableHead scope="col">{fc.source}</TableHead>
                  <TableHead scope="col" className="min-w-56">{fc.comment}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((f) => (
                  <TableRow key={f.feedbackId} className={cn(low(f) && "shadow-[inset_3px_0_0_var(--color-merah-600)]")}>
                    <TableCell className="whitespace-nowrap">{date(f.submittedAt)}</TableCell>
                    <TableCell>
                      <Link href={`/pemesanan/${f.bookingId}`} className="font-medium text-danau-700 tabular hover:underline">
                        {f.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {f.customerName} <span className="text-xs text-muted-foreground">{f.nationality}</span>
                    </TableCell>
                    <TableCell>
                      <GuideRatings guides={f.guides} threshold={settings.low_rating_threshold} />
                    </TableCell>
                    <TableCell>{f.overall ? <StarsDisplay value={f.overall} /> : t.common.none}</TableCell>
                    <TableCell>{f.wouldRevisit ? t.feedback.revisitAnswers[f.wouldRevisit] : t.common.none}</TableCell>
                    <TableCell>{f.consent ? "✓" : t.common.none}</TableCell>
                    <TableCell>{f.source ? r.feedback.sources[f.source] : t.common.none}</TableCell>
                    <TableCell className="text-sm">{f.comment ? <ExpandableText text={f.comment} /> : t.common.none}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {report.rows.map((f) => (
              <li key={f.feedbackId} className={cn("rounded-lg border bg-card p-4 shadow-card", low(f) && "border-l-4 border-l-merah-600")}>
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/pemesanan/${f.bookingId}`} className="font-semibold text-danau-700 tabular">
                    {f.code}
                  </Link>
                  <span className="text-xs text-muted-foreground">{date(f.submittedAt)}</span>
                </div>
                <p className="text-sm">
                  {f.customerName} <span className="text-xs text-muted-foreground">{f.nationality}</span> · {f.source ? r.feedback.sources[f.source] : t.common.none}
                </p>
                {f.overall && <StarsDisplay value={f.overall} className="mt-1" />}
                <div className="mt-1">
                  <GuideRatings guides={f.guides} threshold={settings.low_rating_threshold} />
                </div>
                {f.comment && <ExpandableText text={f.comment} className="mt-2 text-sm" />}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function GuideRatings({ guides, threshold }: { guides: { name: string; rating: number }[]; threshold: number }) {
  if (guides.length === 0) return <>{t.common.none}</>;
  return (
    <ul className="space-y-0.5 text-sm">
      {guides.map((g) => (
        <li key={g.name} className={cn("flex items-center gap-1 whitespace-nowrap", g.rating <= threshold && "font-medium text-merah-700")}>
          {g.rating <= threshold && <AlertTriangle className="size-3.5" aria-label="Rating rendah" />}
          {g.name} <span className="tabular">★ {g.rating}</span>
        </li>
      ))}
    </ul>
  );
}
