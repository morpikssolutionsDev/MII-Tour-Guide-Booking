"use client";

import { ChevronRight, Star } from "lucide-react";
import Link from "next/link";
import { LanguagePill, Pill, ShortNoticeBadge, StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { formatDateMedium, formatSlot } from "@/lib/format";
import { cn } from "@/lib/utils";
import { acknowledgeAssignment } from "@/server/preparation/actions";
import type { TourCardView } from "@/server/portal/queries";

const sp = t.portal;

/** Guide TourCard (08 §3.1): time, tourist, language · people, co-guides, state and one action. */
export function TourCard({
  tour,
  highlight = false,
  compact = false,
  showDate = false,
  rating,
}: {
  tour: TourCardView;
  highlight?: boolean;
  compact?: boolean;
  showDate?: boolean;
  rating?: number | null;
}) {
  const ack = useAction(acknowledgeAssignment, { successMessage: sp.readyToast });
  const paid = tour.status === "confirmed" || tour.status === "ready";
  const canAck = paid && !tour.acknowledged && !tour.started;
  const canComplete = paid && tour.started;

  let chip: React.ReactNode = <StatusBadge status={tour.status} />;
  if (paid && tour.ongoing) chip = <Pill tone="danau">{sp.states.ongoing}</Pill>;
  else if (canAck) chip = <Pill tone="senja">{sp.states.notAcked}</Pill>;
  else if (paid && tour.acknowledged) chip = <Pill tone="rimba">{sp.states.ready}</Pill>;

  return (
    <article className={cn("rounded-lg border bg-card shadow-card", highlight && "glow-top")}>
      <Link href={`/portal/tur/${tour.bookingId}`} className="block p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            {showDate && <p className="text-sm font-medium text-muted-foreground">{formatDateMedium(tour.tourDate)}</p>}
            <p className={cn("font-bold tabular", compact ? "text-base" : "text-lg")}>{formatSlot(tour.slotStart, tour.slotEnd)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {chip}
            {tour.shortNotice && paid && <ShortNoticeBadge />}
          </div>
        </div>
        <p className="mt-1 font-medium">
          {tour.customerName} <span className="text-xs font-semibold text-muted-foreground">{tour.nationality}</span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <LanguagePill code={tour.languageCode} name={tour.languageName} />
          {t.common.people(tour.people)} · {tour.packageName} · <span className="tabular">{tour.code}</span>
        </p>
        {tour.coGuides.length > 0 && <p className="mt-1 text-sm text-muted-foreground">{sp.with(tour.coGuides.join(", "))}</p>}
        {rating != null && (
          <p className="mt-1 flex items-center gap-1 text-sm font-medium">
            <Star className="size-4 fill-senja-500 text-senja-500" aria-hidden />
            {rating}
          </p>
        )}
      </Link>
      {(canAck || canComplete) && !compact && (
        <div className="flex gap-2 border-t px-4 py-3">
          {canAck && (
            <Button className="flex-1" pending={ack.pending} onClick={() => ack.run({ bookingId: tour.bookingId })}>
              {sp.imReady}
            </Button>
          )}
          {canComplete && (
            <Button className="flex-1" asChild>
              <Link href={`/portal/tur/${tour.bookingId}`}>
                {sp.tour.complete}
                <ChevronRight />
              </Link>
            </Button>
          )}
        </div>
      )}
      {canAck && compact && (
        <div className="border-t px-4 py-2">
          <Button size="sm" className="w-full" pending={ack.pending} onClick={() => ack.run({ bookingId: tour.bookingId })}>
            {sp.imReady}
          </Button>
        </div>
      )}
    </article>
  );
}
