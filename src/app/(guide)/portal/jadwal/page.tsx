import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { UrlTabs } from "@/components/common/url-tabs";
import { TourCard } from "@/components/portal/tour-card";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { eachDay } from "@/domain/time";
import { t } from "@/i18n/id";
import { formatDateLong } from "@/lib/format";
import { listGuideTours } from "@/server/portal/queries";
import { requireGuide } from "@/server/session";
import { GuideCalendar } from "./guide-calendar";

export const metadata: Metadata = { title: t.nav.portal.jadwal };

type View = "mendatang" | "kalender" | "riwayat";

/** 08 §3.2 "Jadwal": Mendatang · Kalender · Riwayat. */
export default function PortalSchedulePage({ searchParams }: { searchParams: Promise<{ view?: string; bulan?: string }> }) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-kabut-100" />}>
      <Schedule searchParams={searchParams} />
    </Suspense>
  );
}

async function Schedule({ searchParams }: { searchParams: Promise<{ view?: string; bulan?: string }> }) {
  const me = await requireGuide();
  const p = await searchParams;
  const view: View = p.view === "kalender" || p.view === "riwayat" ? p.view : "mendatang";
  const { cards, leaves, from, to } = await listGuideTours(me.guideId, view, p.bulan);
  const sp = t.portal;
  const leaveDays = leaves.flatMap((l) => eachDay(l.startDate, l.endDate)).filter((d) => d >= from && d <= to);
  const upcomingDates = [...new Set([...cards.map((c) => c.tourDate), ...leaveDays])].sort();

  return (
    <div className="space-y-4">
      <AutoRefresh />
      <UrlTabs param="view" active={view} tabs={(["mendatang", "kalender", "riwayat"] as const).map((v) => ({ value: v, label: sp.views[v] }))} />

      {view === "kalender" && <GuideCalendar month={p.bulan} tours={cards} leaveDays={leaveDays} />}

      {view === "mendatang" &&
        (cards.length === 0 && leaveDays.length === 0 ? (
          <EmptyState decoration="carousel" title={sp.upcomingEmpty} />
        ) : (
          <div className="space-y-5">
            {upcomingDates.map((date) => (
                <section key={date} className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">{formatDateLong(date)}</h2>
                  {leaveDays.includes(date) && <div className="hatch-batu rounded-md px-3 py-2 text-sm font-medium text-batu-800">{sp.leaveDay}</div>}
                  {cards
                    .filter((c) => c.tourDate === date)
                    .map((tour) => (
                      <TourCard key={tour.bookingId} tour={tour} />
                    ))}
                </section>
              ))}
          </div>
        ))}

      {view === "riwayat" &&
        (cards.length === 0 ? (
          <EmptyState decoration="castle" title={sp.historyEmpty} />
        ) : (
          <div className="space-y-3">
            {cards.map((tour) => (
              <TourCard key={tour.bookingId} tour={tour} showDate compact rating={tour.rating} />
            ))}
          </div>
        ))}
    </div>
  );
}
