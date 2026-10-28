import {
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  CalendarClock,
  ChartColumn,
  ChartColumnIncreasing,
  ChartNoAxesColumnIncreasing,
  CircleDollarSign,
  Clock,
  Download,
  Headset,
  Landmark,
  Languages,
  MapPin,
  Package,
  Star,
  Sun,
  Sunrise,
  Sunset,
  Target,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { OrderRevenueChart } from "@/components/reports/charts";
import type { Channel } from "@/db/schema";
import { delta, previousPeriod, type Period } from "@/domain/metrics";
import { t } from "@/i18n/id";
import { formatDateTime, formatNumber, formatPercent, formatRating, formatRupiah, formatRupiahShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CsvKey } from "@/server/reports/csv";
import {
  getBookingsBreakdown,
  getGuidePerformance,
  getLeadTime,
  getOrderRevenueTrend,
  getReportSummary,
  TREND_MONTHS,
  type BreakdownRow,
  type ReportFilters,
} from "@/server/reports/queries";

const r = t.reports;
const s = r.summary;

/** Proposed share of orders placed at least three days ahead. */
const LEAD_TIME_TARGET = 0.85;
const GUIDE_ROWS = 8;

const TONES = {
  blue: { box: "bg-danau-500/10", fg: "text-danau-600" },
  green: { box: "bg-rimba-500/10", fg: "text-rimba-600" },
  orange: { box: "bg-senja-500/10", fg: "text-senja-600" },
  purple: { box: "bg-chart-3/10", fg: "text-chart-3" },
  red: { box: "bg-merah-500/10", fg: "text-merah-600" },
} as const;

const CHANNEL_ICONS: Record<Channel, LucideIcon> = { call_center: Headset, sales: BriefcaseBusiness, on_the_spot: MapPin };

// Bar colours per card, in rank order (follows the agreed Ringkasan mock-up).
const CHANNEL_COLORS = ["var(--color-chart-1)", "var(--color-danau-500)", "var(--color-senja-500)"];
const PACKAGE_COLORS = ["var(--color-merah-500)", "var(--color-senja-500)", "var(--color-chart-1)", "var(--color-rimba-500)", "var(--color-chart-3)", "var(--color-chart-4)"];
const SLOT_COLORS = ["var(--color-merah-500)", "var(--color-senja-500)", "var(--color-chart-1)", "var(--color-rimba-500)"];
const LANGUAGE_COLORS = ["var(--color-chart-1)", "var(--color-senja-500)", "var(--color-rimba-500)", "var(--color-chart-3)", "var(--color-merah-500)", "var(--color-chart-4)"];
const LEAD_TIME = [
  { key: "h3", color: "var(--color-rimba-500)" },
  { key: "h2", color: "var(--color-senja-500)" },
  { key: "h1", color: "var(--color-merah-500)" },
] as const;

const share = (n: number, total: number) => (total > 0 ? n / total : 0);
const pct = (v: number | null) => (v === null ? t.common.none : formatPercent(v));
const relDelta = (cur: number | null, prev: number | null) => (cur === null || prev === null ? null : delta(cur, prev));
const colorAt = (palette: string[], i: number) => palette[i % palette.length];

function slotIcon(key: string): LucideIcon {
  const hour = Number(key.slice(0, 2));
  if (hour < 12) return Sunrise;
  if (hour < 15) return Sun;
  return Sunset;
}

type Props = { period: Period; filters: ReportFilters; csv: (key: CsvKey) => string; guidesHref: string };

/** 11 §3.2 tab "Ringkasan". */
export async function SummaryTab({ period, filters, csv, guidesHref }: Props) {
  const [cur, prev, lead, prevLead, byChannel, byPackage, byLanguage, bySlot, guides, trend] = await Promise.all([
    getReportSummary(period, filters),
    getReportSummary(previousPeriod(period), filters),
    getLeadTime(period, filters),
    getLeadTime(previousPeriod(period), filters),
    getBookingsBreakdown(period, filters, "channel"),
    getBookingsBreakdown(period, filters, "package"),
    getBookingsBreakdown(period, filters, "language"),
    getBookingsBreakdown(period, filters, "slot"),
    getGuidePerformance(period, filters),
    getOrderRevenueTrend(period, filters),
  ]);
  const leadTotal = lead.h1 + lead.h2 + lead.h3;
  const prevLeadTotal = prevLead.h1 + prevLead.h2 + prevLead.h3;
  const earlyShare = leadTotal ? lead.h3 / leadTotal : null;
  const k = s.kpi;

  return (
    <div className="space-y-4">
      <p className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span className="size-2 rounded-full bg-rimba-500" aria-hidden />
        {s.updatedAt(formatDateTime(new Date().toISOString()))}
      </p>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 xl:grid-cols-5">
        <Kpi tone="blue" icon={Users} decor={ChartColumn} label={k.orders} value={formatNumber(cur.bookings)} delta={delta(cur.bookings, prev.bookings)} />
        <Kpi
          tone="green"
          icon={CircleDollarSign}
          decor={ChartColumnIncreasing}
          label={k.revenue}
          value={Math.abs(cur.revenue) >= 1_000_000 ? formatRupiahShort(cur.revenue) : formatRupiah(cur.revenue)}
          valueTitle={formatRupiah(cur.revenue)}
          valueClassName={cur.revenue < 0 ? "text-merah-700" : undefined}
          delta={delta(cur.revenue, prev.revenue)}
        />
        <Kpi
          tone="orange"
          icon={CalendarClock}
          decor={Target}
          label={k.leadTime}
          value={pct(earlyShare)}
          sub={k.leadTimeTarget(formatPercent(LEAD_TIME_TARGET))}
          delta={relDelta(earlyShare, prevLeadTotal ? prevLead.h3 / prevLeadTotal : null)}
        />
        <Kpi
          tone="purple"
          icon={Star}
          decor={ChartNoAxesColumnIncreasing}
          label={k.rating}
          value={cur.rating === null ? t.common.none : `${formatRating(cur.rating)} / 5`}
          sub={k.ratingCount(cur.ratingCount)}
          delta={relDelta(cur.rating, prev.rating)}
        />
        <Kpi
          tone="red"
          icon={UserRound}
          decor={ChartColumn}
          label={k.utilisation}
          value={pct(cur.utilisation)}
          sub={k.activeGuides(cur.activeGuides)}
          delta={relDelta(cur.utilisation, prev.utilisation)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel icon={ChartColumn} title={s.channel} csvHref={csv("kanal")}>
          <MeterList
            rows={byChannel.map((row) => ({ ...row, label: t.channels[row.key as Channel] })).sort((a, b) => b.count - a.count)}
            colors={CHANNEL_COLORS}
            leading={(row) => {
              const Icon = CHANNEL_ICONS[row.key as Channel];
              return <Icon className="size-5 shrink-0 text-chart-1" aria-hidden />;
            }}
          />
        </Panel>

        <Panel icon={Clock} title={s.leadTime.title} csvHref={csv("lead-time")}>
          <LeadTimeBar counts={lead} total={leadTotal} />
        </Panel>

        <Panel icon={Package} title={s.packages.title} hint={s.packages.hint} csvHref={csv("paket")} className="md:col-span-2 xl:col-span-1">
          <MeterList
            rows={byPackage}
            colors={PACKAGE_COLORS}
            showShare={false}
            leading={(_, color) => (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md" style={{ background: `color-mix(in oklab, ${color} 14%, transparent)` }}>
                <Landmark className="size-4" style={{ color }} aria-hidden />
              </span>
            )}
          />
          {byPackage.length > 0 && (
            <p className="mt-3 text-right text-xs text-muted-foreground">{s.packages.total(formatNumber(byPackage.reduce((sum, row) => sum + row.count, 0)))}</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        {/* xl: the guide table spans both rows; slot + language sit side by side with the trend under them. */}
        <Panel icon={UserRound} title={s.guides.title} csvHref={csv("kinerja-guide")} className="md:col-span-2 xl:col-span-6 xl:row-span-2">
          <GuideTable rows={guides} moreHref={guidesHref} />
        </Panel>

        <Panel icon={Clock} title={s.slot} csvHref={csv("slot")} className="xl:col-span-3">
          <MeterList
            rows={bySlot}
            colors={SLOT_COLORS}
            leading={(row) => {
              const Icon = slotIcon(row.key);
              return <Icon className="size-5 shrink-0 text-senja-500" aria-hidden />;
            }}
          />
        </Panel>

        <Panel icon={Languages} title={s.language} csvHref={csv("bahasa")} className="xl:col-span-3">
          <MeterList
            rows={byLanguage}
            colors={LANGUAGE_COLORS}
            leading={(row, color) => (
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase"
                style={{ background: `color-mix(in oklab, ${color} 14%, transparent)`, color }}
                aria-hidden
              >
                {row.code}
              </span>
            )}
          />
        </Panel>

        <Panel icon={TrendingUp} title={s.trend.title} hint={s.trend.months(TREND_MONTHS)} csvHref={csv("tren")} className="md:col-span-2 xl:col-span-6">
          {trend.every((b) => b.orders === 0 && b.revenue === 0) ? <Empty /> : <OrderRevenueChart buckets={trend} />}
        </Panel>
      </div>
    </div>
  );
}

/**
 * Sized by its own width (container query): narrow tiles put the icon beside the label and give the
 * value the full width; from 18rem the icon moves to its own column as in the mock-up.
 */
function Kpi({
  tone,
  icon: Icon,
  decor: Decor,
  label,
  value,
  valueTitle,
  valueClassName,
  sub,
  delta,
}: {
  tone: keyof typeof TONES;
  icon: LucideIcon;
  decor: LucideIcon;
  label: string;
  value: string;
  valueTitle?: string;
  valueClassName?: string;
  sub?: string;
  delta: number | null;
}) {
  return (
    <div className="@container min-w-[220px] snap-start rounded-lg border bg-card p-4 shadow-card md:min-w-0">
      <div className="grid h-full grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_auto_1fr] items-center gap-x-3 @2xs:items-start">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl @2xs:row-span-3", TONES[tone].box, TONES[tone].fg)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <p className="text-sm leading-snug font-semibold">{label}</p>
        <p className={cn("col-span-2 mt-2 text-2xl font-bold whitespace-nowrap tabular @2xs:col-span-1 @2xs:mt-0.5", valueClassName)} title={valueTitle}>
          {value}
        </p>
        <div className="col-span-2 mt-1 flex h-full items-end justify-between gap-2 @2xs:col-span-1">
          <div className="min-w-0 self-start">
            <DeltaLine delta={delta} />
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <Decor className={cn("size-8 shrink-0 opacity-20", TONES[tone].fg)} aria-hidden />
        </div>
      </div>
    </div>
  );
}

/** Direction is carried by the arrow icon and the sign, never by colour alone. */
function DeltaLine({ delta }: { delta: number | null }) {
  const Arrow = delta === null ? null : delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : null;
  const tone = delta === null || delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-rimba-600" : "text-merah-700";
  return (
    <p className="text-xs text-muted-foreground">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold whitespace-nowrap tabular", tone)}>
        {Arrow && <Arrow className="size-3.5" aria-hidden />}
        {delta === null ? t.common.none : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatPercent(Math.abs(delta))}`}
      </span>{" "}
      {s.vsPrevious}
    </p>
  );
}

function Panel({
  icon: Icon,
  title,
  hint,
  csvHref,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  csvHref: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-lg border bg-card p-4 shadow-card", className)}>
      <div className="mb-4 flex items-start gap-2">
        <Icon className="mt-0.5 size-5 shrink-0 text-chart-1" aria-hidden />
        <h2 className="mr-auto font-semibold">
          {title} {hint && <span className="text-sm font-normal text-muted-foreground">{hint}</span>}
        </h2>
        <a
          href={csvHref}
          download
          title={r.charts.download}
          aria-label={`${r.charts.download}: ${title}`}
          className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Download className="size-4" aria-hidden />
        </a>
      </div>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-muted-foreground">{r.charts.empty}</p>;
}

/**
 * Labelled horizontal meters: leading icon, label, bar scaled to the largest value, count and share.
 * One grid for all rows: the label column fits the widest label (up to 10rem), the bar takes the rest,
 * and the numbers keep a fixed column so they never leave the card. Below 16rem of card width the bar
 * moves under its label instead of squeezing it.
 */
function MeterList({
  rows,
  colors,
  leading,
  showShare = true,
}: {
  rows: BreakdownRow[];
  colors: string[];
  leading: (row: BreakdownRow, color: string) => ReactNode;
  showShare?: boolean;
}) {
  if (rows.length === 0) return <Empty />;
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(...rows.map((row) => row.count));
  return (
    <div className="@container">
      <ul className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-x-2 gap-y-3 @3xs:grid-cols-[fit-content(10rem)_minmax(1.5rem,1fr)_2.5rem]">
        {rows.map((row, i) => {
          const color = colorAt(colors, i);
          return (
            <li key={row.key} className="col-span-2 grid grid-cols-subgrid items-center gap-y-1.5 @3xs:col-span-3">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                {leading(row, color)}
                <span className="min-w-0 truncate" title={row.label}>
                  {row.label}
                  {row.inactive && <span className="text-muted-foreground"> {t.common.inactiveSuffix}</span>}
                </span>
              </span>
              <span className="order-last col-span-2 h-3 overflow-hidden rounded-full bg-kabut-100 @3xs:order-none @3xs:col-span-1 @3xs:h-4" aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${(row.count / max) * 100}%`, background: color }} />
              </span>
              <span className="text-right leading-tight">
                <span className="block text-sm font-bold tabular">{formatNumber(row.count)}</span>
                {showShare && <span className="block text-[11px] text-muted-foreground tabular">{formatPercent(share(row.count, total))}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LeadTimeBar({ counts, total }: { counts: Record<"h3" | "h2" | "h1", number>; total: number }) {
  if (total === 0) return <Empty />;
  const segs = LEAD_TIME.map((seg) => ({ ...seg, label: s.leadTime[seg.key], n: counts[seg.key], ratio: share(counts[seg.key], total) }));
  return (
    <div className="space-y-4">
      <div className="flex h-12 gap-0.5 overflow-hidden rounded-md" role="img" aria-label={segs.map((seg) => `${seg.label} ${formatPercent(seg.ratio)}`).join(", ")}>
        {segs.map((seg) =>
          seg.n > 0 ? (
            <span key={seg.key} className="flex items-center justify-center text-sm font-semibold text-white" style={{ width: `${seg.ratio * 100}%`, background: seg.color }}>
              {seg.ratio >= 0.08 && formatPercent(seg.ratio)}
            </span>
          ) : null,
        )}
      </div>
      <ul className="grid grid-cols-3 divide-x">
        {segs.map((seg) => (
          <li key={seg.key} className="px-3 first:pl-0 last:pr-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: seg.color }} aria-hidden />
              {seg.label}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{s.leadTime.orders(seg.n)}</p>
            <p className="mt-1 text-xl font-bold tabular">{formatPercent(seg.ratio)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

type GuideRow = Awaited<ReturnType<typeof getGuidePerformance>>[number];

/** Top guides by tours; the full sortable table lives on the "Tour Guide" tab. */
function GuideTable({ rows, moreHref }: { rows: GuideRow[]; moreHref: string }) {
  if (rows.length === 0) return <Empty />;
  const c = r.guides.cols;
  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-2 font-medium">{c.guide}</th>
              <th scope="col" className="px-1.5 py-2 font-medium">{t.guides.colLanguages}</th>
              <th scope="col" className="px-1.5 py-2 text-right font-medium">{c.tours}</th>
              <th scope="col" className="px-1.5 py-2 font-medium">{s.guides.rating}</th>
              <th scope="col" className="px-1.5 py-2 text-right font-medium" title={s.guides.briefingHint}>{s.guides.briefing}</th>
              <th scope="col" className="py-2 pl-2 font-medium">{c.utilisation}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.slice(0, GUIDE_ROWS).map((g) => (
              <tr key={g.id}>
                <td className="py-2 pr-2">
                  <Link href={`/tour-guide/${g.id}`} className="flex items-center gap-2 font-medium hover:underline">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-danau-500/10 text-danau-600">
                      <UserRound className="size-4" aria-hidden />
                    </span>
                    <span className="truncate">{g.name}</span>
                  </Link>
                </td>
                <td className="px-1.5 py-2 whitespace-nowrap text-muted-foreground">{g.languages.map((l) => l.toUpperCase()).join(", ")}</td>
                <td className="px-1.5 py-2 text-right tabular">{formatNumber(g.tours)}</td>
                <td className="px-1.5 py-2 whitespace-nowrap">
                  {g.rating === null ? (
                    t.common.none
                  ) : (
                    <span className="inline-flex items-center gap-1 tabular">
                      <Star className="size-3.5 fill-senja-500 text-senja-500" aria-hidden />
                      {formatRating(g.rating)}
                    </span>
                  )}
                </td>
                <td className="px-1.5 py-2 text-right tabular">{pct(g.notice)}</td>
                <td className="py-2 pl-2">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 min-w-10 flex-1 overflow-hidden rounded-full bg-kabut-100" aria-hidden>
                      <span className="block h-full rounded-full bg-rimba-500" style={{ width: `${Math.min(1, g.utilisation ?? 0) * 100}%` }} />
                    </span>
                    <span className="w-9 text-right text-xs tabular">{pct(g.utilisation)}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > GUIDE_ROWS && (
        <Link href={moreHref} className="mt-3 block text-right text-xs font-medium text-danau-700 hover:underline">
          {s.guides.more(rows.length)}
        </Link>
      )}
    </>
  );
}
