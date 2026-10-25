import { MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LanguagePill, Pill, ShortNoticeBadge, StatusBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { StarsDisplay } from "@/components/common/star-rating";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { formatPhone, waNumber } from "@/domain/phone";
import { t } from "@/i18n/id";
import { countryNameId, formatDateLong, formatDateTime, formatSlot } from "@/lib/format";
import { getGuideTour } from "@/server/portal/queries";
import { requireGuide } from "@/server/session";
import { BriefingList } from "./briefing-list";
import { TourActionBar } from "./tour-action-bar";

export const metadata: Metadata = { title: t.nav.portal.hariIni };

/** 08 §3.3 tour detail (GuideTourView). */
export default function GuideTourPage({ params }: { params: Promise<{ bookingId: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-kabut-100" />}>
      <Tour params={params} />
    </Suspense>
  );
}

async function Tour({ params }: { params: Promise<{ bookingId: string }> }) {
  const me = await requireGuide();
  const { bookingId } = await params;
  const tour = await getGuideTour(me.guideId, bookingId);
  const sp = t.portal;
  // BR-08-1: 404 (not 403) for bookings the guide may not see.
  if (!tour) return <EmptyState decoration="snake" title={sp.tour.notFound} body={sp.tour.notFoundBody} />;
  const paid = tour.status === "confirmed" || tour.status === "ready";

  return (
    <div className="space-y-4 pb-24">
      <AutoRefresh />
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground tabular">{tour.code}</p>
        <h1 className="text-xl font-bold">{formatDateLong(tour.tourDate)}</h1>
        <p className="text-lg font-semibold tabular">
          {formatSlot(tour.slotStart, tour.slotEnd)} {sp.tour.wib}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {paid && tour.ongoing ? <Pill tone="danau">{sp.states.ongoing}</Pill> : <StatusBadge status={tour.status} size="md" />}
          {tour.shortNotice && paid && <ShortNoticeBadge />}
        </div>
      </header>

      {tour.status === "cancelled" && (
        <Alert variant="info">
          <AlertDescription>{tour.cancelledAt ? sp.tour.cancelledOn(formatDateTime(tour.cancelledAt)) : sp.tour.released}</AlertDescription>
        </Alert>
      )}

      <Section title={sp.tour.tourist}>
        <p className="font-semibold">{tour.customer.name}</p>
        <p className="text-sm text-muted-foreground">{countryNameId(tour.customer.nationality)}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <LanguagePill code={tour.languageCode} name={tour.languageName} />
          {tour.languageName} · {t.common.people(tour.people)}
        </p>
        {tour.customer.phone && !tour.isReleased && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-sm tabular">
              <Phone className="size-4 text-muted-foreground" aria-hidden />
              {formatPhone(tour.customer.phone)}
            </span>
            <Button variant="secondary" size="sm" asChild>
              <a href={`https://wa.me/${waNumber(tour.customer.phone)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                {sp.tour.chat}
              </a>
            </Button>
          </div>
        )}
      </Section>

      {tour.specialNeeds && (
        <Alert variant="info">
          <AlertDescription>
            <span className="block font-semibold">{sp.tour.specialNeeds}</span>
            {tour.specialNeeds}
          </AlertDescription>
        </Alert>
      )}

      <Section title={sp.tour.packageFacilities}>
        <p className="font-semibold">{tour.packageName}</p>
        <ul className="mt-2 flex flex-wrap gap-1.5 text-sm">
          {tour.facilities.map((f) => (
            <li key={f} className="rounded-sm bg-danau-50 px-2 py-1 text-danau-800">
              {f}
            </li>
          ))}
          {tour.addonNames.map((a) => (
            <li key={a} className="rounded-sm bg-senja-50 px-2 py-1 text-senja-800">
              {a}
            </li>
          ))}
        </ul>
      </Section>

      {tour.team.length > 0 && (
        <Section title={sp.tour.team}>
          <ul className="space-y-2 text-sm">
            {tour.team.map((g) => (
              <li key={g.guideId} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{g.name}</span>
                <span className="text-muted-foreground tabular">{formatPhone(g.phone)}</span>
                <span className={g.acknowledgedAt ? "text-rimba-700" : "text-senja-800"}>{g.acknowledgedAt ? sp.states.ready : sp.states.notAcked}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {tour.briefing.length > 0 && !tour.isReleased && (
        <Section title={sp.tour.briefing}>
          <BriefingList items={tour.briefing.map((m) => ({ id: m.id, title: m.title, html: m.bodyHtml, linkUrl: m.linkUrl, fileUrl: m.fileUrl }))} />
        </Section>
      )}

      {tour.feedback?.submitted && (
        <Section title={sp.tour.feedback}>
          {tour.feedback.ownRating !== null && (
            <p className="flex items-center gap-2 text-sm">
              {sp.tour.yourRating}: <StarsDisplay value={tour.feedback.ownRating} />
            </p>
          )}
          {tour.feedback.comment && (
            <blockquote className="mt-2 rounded-md bg-surface-muted p-3 text-sm italic" lang="en">
              “{tour.feedback.comment}”
            </blockquote>
          )}
        </Section>
      )}

      <TourActionBar
        bookingId={tour.bookingId}
        code={tour.code}
        status={tour.status}
        acknowledged={Boolean(tour.acknowledgedAt)}
        started={tour.started}
        isReleased={tour.isReleased}
        feedback={tour.feedback ? { submitted: tour.feedback.submitted, url: tour.feedback.url, expiresAt: tour.feedback.expiresAt, expired: tour.feedback.expired, whatsappText: tour.feedback.whatsappText } : null}
        customerPhone={tour.customer.phone}
        guidesToRate={tour.guidesToRate}
        meName={me.name}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-card">
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}
