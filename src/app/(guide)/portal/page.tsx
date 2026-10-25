import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { TourCard } from "@/components/portal/tour-card";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { toWib } from "@/domain/time";
import { t } from "@/i18n/id";
import { firstName, formatDateLong, formatDateMedium, formatTime } from "@/lib/format";
import { getGuideToday } from "@/server/portal/queries";
import { requireGuide } from "@/server/session";

export const metadata: Metadata = { title: t.nav.portal.hariIni };

/** 08 §3.1 "Hari Ini". */
export default function PortalTodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  const me = await requireGuide();
  const { today, needsConfirm, todayTours, next } = await getGuideToday(me.guideId);
  const hour = Number(toWib(new Date()).time.slice(0, 2));
  const sp = t.portal;
  // The next or ongoing tour today gets the glow line.
  const highlightId = todayTours.find((c) => c.ongoing)?.bookingId ?? todayTours.find((c) => !c.started)?.bookingId;

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <header>
        <h1 className="text-display font-bold">
          {t.greeting(hour)}, {firstName(me.name)}
        </h1>
        <p className="text-muted-foreground">{formatDateLong(today)}</p>
      </header>

      {needsConfirm.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">
            {sp.needsConfirm} ({needsConfirm.length})
          </h2>
          {needsConfirm.map((tour) => (
            <TourCard key={tour.bookingId} tour={tour} compact showDate />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">{sp.todayTours}</h2>
        {todayTours.length === 0 ? (
          <EmptyState
            decoration="bird-perched"
            title={sp.noToursToday}
            body={next ? sp.nextTour(`${formatDateMedium(next.tourDate)} · ${formatTime(next.slotStart)}`) : undefined}
          />
        ) : (
          todayTours.map((tour) => <TourCard key={tour.bookingId} tour={tour} highlight={tour.bookingId === highlightId} />)
        )}
      </section>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="h-10 w-2/3 animate-pulse rounded bg-kabut-100" />
      <div className="h-32 animate-pulse rounded-lg bg-kabut-100" />
      <div className="h-32 animate-pulse rounded-lg bg-kabut-100" />
    </div>
  );
}
