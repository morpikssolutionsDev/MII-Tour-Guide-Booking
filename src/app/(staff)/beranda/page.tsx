import { AlertTriangle, ArrowRight, CalendarCheck, Clock, UserCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ShortNoticeBadge, StatusBadge } from "@/components/common/badges";
import { HeaderBand, PageContainer } from "@/components/common/page-header";
import { StarsDisplay } from "@/components/common/star-rating";
import { KpiTile } from "@/components/reports/kpi-tile";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { toWib } from "@/domain/time";
import { t } from "@/i18n/id";
import { firstName, formatDateLong, formatDateMedium, formatDayMonth, formatDuration, formatRelative, formatRupiah, formatSlot } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDashboard, type Dashboard } from "@/server/dashboard/queries";
import { getSettings } from "@/server/settings";
import { requireRole } from "@/server/session";
import { MarkPaidButton, ResendButton } from "./widget-actions";

export const metadata: Metadata = { title: t.nav.beranda };

const d = t.dashboard;

/** 11 §3.1 */
export default async function BerandaPage() {
  const me = await requireRole("admin", "staff");
  const now = new Date();
  const [data, settings] = await Promise.all([getDashboard(me.role, now), getSettings()]);
  const wib = toWib(now);
  const k = d.kpi;

  return (
    <>
      <AutoRefresh />
      <HeaderBand>
        <p className="text-sm font-medium text-white/80">{formatDateLong(data.today)}</p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">
          {t.greeting(Number(wib.time.slice(0, 2)))}, {firstName(me.name)}
        </h1>
        <p className="mt-1 text-sm text-white/85">{d.summary(data.tours.total, data.expiring.awaiting)}</p>
      </HeaderBand>
      <PageContainer className="relative -mt-12 space-y-5 pt-0 md:-mt-14 md:pt-0">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile label={k.toursToday} icon={CalendarCheck} value={String(data.tours.total)} sub={k.toursDone(data.tours.done)} />
          <KpiTile
            label={k.awaiting}
            icon={Clock}
            value={String(data.expiring.awaiting)}
            sub={k.expiringSoon(data.expiring.count)}
            tone={data.expiring.count > 0 ? "warning" : undefined}
          />
          <KpiTile label={k.guidesOnDuty} icon={Users} value={`${data.guides.busy}/${data.guides.working}`} sub={k.onLeave(data.guides.onLeave)} />
          <KpiTile
            label={k.notAcked}
            icon={UserCheck}
            value={String(data.notAcked.count)}
            sub={data.notAcked.nearest ? k.nearest(formatDayMonth(data.notAcked.nearest)) : undefined}
            tone={data.notAcked.count > 0 ? "warning" : undefined}
          />
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <TodayWidget data={data} nowTime={wib.time} />
          <Widget title={d.widgets.expiring} count={data.expiring.count} href="/pemesanan?view=menunggu-pembayaran" empty={d.empty.expiring}>
            {data.expiring.rows.map((b) => (
              <Row key={b.id} href={`/pemesanan/${b.id}`} action={<MarkPaidButton bookingId={b.id} code={b.code} total={b.total} />}>
                <p className="font-medium tabular">
                  {b.code} <span className="font-normal text-muted-foreground">· {b.customerName}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-senja-800">{t.booking.expiresIn(formatDuration(Date.parse(b.holdExpiresAt!) - now.getTime()))}</span> ·{" "}
                  <span className="tabular">{formatRupiah(b.total)}</span>
                </p>
              </Row>
            ))}
          </Widget>
          <Widget title={d.widgets.prep} count={data.prep.count} href="/pemesanan?view=perlu-persiapan" empty={d.empty.prep}>
            {data.prep.rows.map((b) => (
              <Row key={b.id} href={`/pemesanan/${b.id}`}>
                <p className="font-medium tabular">{b.code}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateMedium(b.tourDate)} · {formatSlot(b.slotStart, b.slotEnd)} · <span className="font-medium text-foreground tabular">{b.done}/{b.total}</span>
                </p>
              </Row>
            ))}
          </Widget>
          <Widget title={d.widgets.notAcked} count={data.notAcked.count} empty={d.empty.notAcked}>
            {data.notAcked.rows.map((a) => (
              <Row key={`${a.bookingId}-${a.guideId}`} href={`/pemesanan/${a.bookingId}`} action={<ResendButton bookingId={a.bookingId} guideId={a.guideId} />}>
                <p className="font-medium">
                  {a.guideName} <span className="font-normal text-muted-foreground tabular">· {a.code}</span>
                </p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  {formatDateMedium(a.tourDate)} · {d.notifiedAgo(formatRelative(a.notifiedAt!, now))}
                  {a.shortNotice && <ShortNoticeBadge />}
                </p>
              </Row>
            ))}
          </Widget>
          {data.leave && (
            <Widget title={d.widgets.leave} count={data.leave.count} href="/tour-guide/cuti" empty={d.empty.leave}>
              {data.leave.rows.map((l) => (
                <Row key={l.id} href="/tour-guide/cuti" actionLabel={d.review}>
                  <p className="font-medium">{l.guideName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDayMonth(l.startDate)} – {formatDateMedium(l.endDate)}
                    {l.conflicts > 0 && <span className="font-medium text-merah-700"> · {d.conflictsCount(l.conflicts)}</span>}
                  </p>
                </Row>
              ))}
            </Widget>
          )}
          <Widget title={d.widgets.balance} count={data.balance.count} empty={d.empty.balance}>
            {data.balance.rows.map((b) => (
              <Row key={b.id} href={`/pemesanan/${b.id}`}>
                <p className="font-medium tabular">{b.code}</p>
                <p className={cn("text-sm font-medium", b.balance > 0 ? "text-senja-800" : "text-danau-700")}>
                  {b.balance > 0 ? t.payment.underpaid(formatRupiah(b.balance)) : t.payment.overpaid(formatRupiah(-b.balance))}
                </p>
              </Row>
            ))}
          </Widget>
          <Widget title={d.widgets.feedback} href="/laporan?tab=ulasan" empty={d.empty.feedback} count={data.feedback.length} hideCount>
            {data.feedback.map((f) => {
              const low = f.guides.some((g) => g.rating <= settings.low_rating_threshold);
              return (
                <Row key={f.id} href={`/pemesanan/${f.bookingId}`} className={cn(low && "border-l-4 border-l-merah-600 pl-3")}>
                  <div className="flex flex-wrap items-center gap-2">
                    {low && <AlertTriangle className="size-4 text-merah-700" aria-label="Rating rendah" />}
                    {f.overall && <StarsDisplay value={f.overall} />}
                    <span className="text-sm text-muted-foreground">
                      {f.guides.map((g) => `${g.name} ★${g.rating}`).join(", ")}
                    </span>
                  </div>
                  {f.comment && <p className="line-clamp-1 text-sm">{f.comment}</p>}
                  <p className="text-xs text-muted-foreground">
                    <span className="tabular">{f.code}</span> · {formatRelative(f.submittedAt!, now)}
                  </p>
                </Row>
              );
            })}
          </Widget>
        </div>
      </PageContainer>
    </>
  );
}

function Widget({
  title,
  count,
  href,
  empty,
  hideCount = false,
  children,
}: {
  title: string;
  count: number;
  href?: string;
  empty: string;
  hideCount?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card shadow-card">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {!hideCount && count > 0 && <span className="rounded-full bg-kabut-100 px-2 text-xs font-semibold text-kabut-700 tabular">{count}</span>}
        {href && count > 0 && (
          <Link href={href} className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-danau-700 hover:underline">
            {t.common.seeAll}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </header>
      {count === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground">{empty}</p> : <ul className="divide-y">{children}</ul>}
    </section>
  );
}

/** A widget row: the whole row opens `href`; an optional action button sits above the link. */
function Row({
  href,
  action,
  actionLabel,
  className,
  children,
}: {
  href: string;
  action?: ReactNode;
  actionLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li className={cn("relative flex items-center gap-3 px-4 py-3 hover:bg-kabut-50", className)}>
      <Link href={href} className="min-w-0 flex-1 space-y-0.5 after:absolute after:inset-0">
        {children}
      </Link>
      {action}
      {actionLabel && <span className="text-sm font-medium text-danau-700">{actionLabel}</span>}
    </li>
  );
}

function TodayWidget({ data, nowTime }: { data: Dashboard; nowTime: string }) {
  const groups = new Map<string, Dashboard["tours"]["rows"]>();
  for (const b of data.tours.rows) {
    const key = `${b.slotStart}|${b.slotEnd}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  return (
    <Widget title={d.widgets.today} count={data.tours.total} href="/pemesanan?view=hari-ini" empty={d.empty.today}>
      {[...groups.entries()].map(([key, rows]) => {
        const [start, end] = key.split("|");
        const ongoing = start <= nowTime && nowTime < end;
        return (
          <li key={key} className="relative">
            {ongoing && <span className="absolute inset-y-0 left-0 w-1 bg-glow" aria-hidden />}
            <p className={cn("flex items-center gap-2 bg-surface-muted px-4 py-1.5 text-xs font-semibold tabular", ongoing && "text-danau-800")}>
              {formatSlot(start, end)}
              {ongoing && <span className="rounded-full bg-danau-700 px-2 text-[0.6875rem] text-white">Berlangsung</span>}
            </p>
            <ul className="divide-y">
              {rows.map((b) => (
                <Row key={b.id} href={`/pemesanan/${b.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium tabular">
                      {b.code} <span className="font-normal text-muted-foreground">· {b.customerName}</span>
                    </p>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {b.languageCode.toUpperCase()} · {t.common.people(b.people)} · {b.guideNames.join(", ") || t.common.none}
                  </p>
                </Row>
              ))}
            </ul>
          </li>
        );
      })}
    </Widget>
  );
}
