import { MessageCircle, Phone, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelBadge, ReturningBadge, ShortNoticeBadge, StatusBadge } from "@/components/common/badges";
import { MessageRow } from "@/components/common/message-row";
import { PageContainer } from "@/components/common/page-header";
import { PriceSummary } from "@/components/common/price-summary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Disclosure } from "@/components/common/disclosure";
import { Button } from "@/components/ui/button";
import { canCancel, canComplete, canReschedule, canVoidPayment, LIVE_STATUSES, TERMINAL_STATUSES } from "@/domain/booking-status";
import { formatPhone, waNumber } from "@/domain/phone";
import { t } from "@/i18n/id";
import { countryNameId, formatDateLong, formatDateTime, formatDuration, formatRelative, formatSlot } from "@/lib/format";
import { getBookingDetail } from "@/server/bookings/queries";
import { feedbackUrl } from "@/server/feedback/tokens";
import { requireRole } from "@/server/session";
import { getSettings } from "@/server/settings";
import { BriefingCard } from "../../pengaturan/materi/briefing-form";
import { BookingActions } from "./booking-actions";
import { ChecklistPanel } from "./checklist-panel";
import { FeedbackSection } from "./feedback-section";
import { NotesEditor } from "./notes-editor";
import { PaymentSection } from "./payment-section";
import { SuccessPanel } from "./success-panel";
import { Timeline } from "./timeline";

export const metadata: Metadata = { title: t.booking.title };

/** 05 §3.3 booking detail, with the 06/07/09/10 sections. */
export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ baru?: string }>;
}) {
  const me = await requireRole("admin", "staff");
  const [{ id }, { baru }] = await Promise.all([params, searchParams]);
  const [d, settings] = await Promise.all([getBookingDetail(id), getSettings()]);
  if (!d) notFound();
  const b = d.booking;
  const now = new Date();
  const sd = t.booking.detail;
  const paymentRow = d.payments.find((p) => p.kind === "payment" && !p.voidedAt) ?? null;
  const hasAdjustments = d.payments.some((p) => p.kind === "adjustment");
  const shortNotice = d.guides.some((g) => g.shortNotice);
  const holdRemaining = b.holdExpiresAt ? Date.parse(b.holdExpiresAt) - now.getTime() : null;
  const bookingCreatedMessage = d.messages.find((m) => m.eventKey === "booking_created")?.body ?? null;

  const flags = {
    markPaid: b.status === "awaiting_payment",
    reschedule: canReschedule(b, now),
    complete: canComplete(b, now),
    cancel: canCancel(b, now),
  };

  const sections = (
    <>
      <Card title={sd.customer}>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/pelanggan/${d.customer.id}`} className="font-semibold hover:underline">
            {d.customer.name}
          </Link>
          <span className="text-sm text-muted-foreground">{countryNameId(d.customer.nationality)}</span>
          {d.visits >= 1 && <ReturningBadge visits={d.visits} />}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Phone className="size-4 text-muted-foreground" aria-hidden />
          <span className="tabular">{formatPhone(d.customer.phoneE164)}</span>
          <Button variant="ghost" size="xs" asChild>
            <a href={`https://wa.me/${waNumber(d.customer.phoneE164)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              {sd.whatsapp}
            </a>
          </Button>
          {d.customer.email && <span className="text-muted-foreground">{d.customer.email}</span>}
        </div>
        {d.customer.notes && <p className="mt-2 text-sm text-muted-foreground">{d.customer.notes}</p>}
      </Card>

      <Card title={sd.schedule}>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Item label={sd.tourDate} value={formatDateLong(b.tourDate)} />
          <Item label={sd.slot} value={formatSlot(b.slotStart, b.slotEnd)} />
          <Item label={sd.language} value={d.languageName} />
          <Item label={sd.people} value={t.common.people(b.people)} />
          <Item label={sd.package} value={d.snapshot.package.name} />
          <Item label={sd.guidesNeeded} value={String(b.guidesNeeded)} />
        </dl>
      </Card>

      <Card title={sd.guides}>
        <ul className="space-y-2">
          {d.guides.map((g) => (
            <li key={g.assignmentId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link href={`/tour-guide/${g.guideId}`} className="font-medium hover:underline">
                {g.displayName}
              </Link>
              <span className="text-muted-foreground tabular">{formatPhone(g.phoneE164)}</span>
              <span className={g.acknowledgedAt ? "text-rimba-700" : g.notifiedAt ? "text-senja-800" : "text-muted-foreground"}>
                {g.acknowledgedAt ? sd.ack(formatDateTime(g.acknowledgedAt)) : g.notifiedAt ? sd.notAcked : sd.notNotified}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={sd.addons}>
        {d.snapshot.addons.length === 0 && d.snapshot.facilities.length === 0 ? (
          <p className="text-sm text-muted-foreground">{sd.none}</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {d.snapshot.addons.map((a) => (
              <li key={a.id} className="rounded-sm bg-senja-50 px-2 py-1 text-senja-800">
                {a.name}
                {a.included ? ` · ${t.pricing.includedInPackage}` : ""}
              </li>
            ))}
            {d.snapshot.facilities.map((f) => (
              <li key={f} className="rounded-sm bg-danau-50 px-2 py-1 text-danau-800">
                {f}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="grid gap-5 sm:grid-cols-2">
          <NotesEditor bookingId={b.id} field="specialNeeds" label={sd.specialNeeds} value={b.specialNeeds} editable={!TERMINAL_STATUSES.includes(b.status)} />
          <NotesEditor bookingId={b.id} field="internalNotes" label={sd.internalNotes} value={b.internalNotes} editable={!TERMINAL_STATUSES.includes(b.status)} />
        </div>
      </Card>

      <Card title={sd.payment}>
        <PaymentSection
          bookingId={b.id}
          summary={d.paymentSummary}
          payments={d.payments}
          emptyText={holdRemaining && holdRemaining > 0 ? t.payment.empty(formatRelative(b.holdExpiresAt!, now)) : t.payment.emptyNoHold}
          canAdjust={d.paymentSummary.hasPayment && b.status !== "awaiting_payment"}
          voidablePaymentId={me.role === "admin" && paymentRow && !hasAdjustments && canVoidPayment(b, now) ? paymentRow.id : null}
          holdHours={settings.hold_expiry_hours}
        />
      </Card>

      {d.checklist.length > 0 && (
        <Card title={t.preparation.title}>
          {shortNotice && (
            <Alert variant="warning" className="mb-3">
              <TriangleAlert />
              <AlertDescription>{t.preparation.shortNotice(settings.notice_days)}</AlertDescription>
            </Alert>
          )}
          <ChecklistPanel
            bookingId={b.id}
            items={d.checklist}
            guides={d.guides.map((g) => ({ guideId: g.guideId, displayName: g.displayName, acknowledgedAt: g.acknowledgedAt, notifiedAt: g.notifiedAt }))}
            editable={b.status === "confirmed" || b.status === "ready"}
          />
        </Card>
      )}

      {d.briefing.length > 0 && (
        <Disclosure title={`${sd.briefing} (${d.briefing.length})`} className="rounded-lg border bg-card p-5 shadow-card">
          <div className="mt-3 space-y-3">
            {d.briefing.map((m) => (
              <BriefingCard key={m.id} title={m.title} html={m.bodyHtml} linkUrl={m.linkUrl} fileUrl={m.fileUrl} />
            ))}
          </div>
        </Disclosure>
      )}

      {(b.status === "completed" || b.status === "evaluated") && (
        <Card title={sd.feedback}>
          <FeedbackSection
            bookingId={b.id}
            feedback={d.feedback}
            guides={d.guides.map((g) => ({ id: g.guideId, name: g.displayName }))}
            share={
              d.feedback && !d.feedback.submittedAt
                ? {
                    url: feedbackUrl(d.feedback.token),
                    whatsappText: d.messages.find((m) => m.eventKey === "feedback_request")?.body ?? feedbackUrl(d.feedback.token),
                    phone: d.customer.phoneE164,
                  }
                : null
            }
            meName={me.name}
            linkExpired={!d.feedback || Date.parse(d.feedback.tokenExpiresAt) <= now.getTime()}
          />
        </Card>
      )}

      <Card title={sd.messages}>
        {d.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{sd.noMessages}</p>
        ) : (
          <ul className="divide-y">
            {d.messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );

  return (
    <PageContainer className="space-y-5">
      {baru === "1" && <SuccessPanel bookingId={b.id} message={bookingCreatedMessage} />}

      <header className="sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tabular md:text-2xl">{b.code}</h1>
          <StatusBadge status={b.status} size="md" />
          <ChannelBadge channel={b.channel} />
          {shortNotice && LIVE_STATUSES.includes(b.status) && <ShortNoticeBadge />}
          {d.linked.map((l) => (
            <Link key={l.id} href={`/pemesanan/${l.id}`} className="rounded-sm border px-2 py-0.5 text-xs font-medium text-danau-700 hover:underline">
              {t.booking.linked}: {l.code}
            </Link>
          ))}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{sd.createdBy(d.createdByName, formatDateTime(b.createdAt))}</p>
        {b.status === "awaiting_payment" && holdRemaining !== null && holdRemaining > 0 && (
          <p className="mt-1 text-sm font-medium text-senja-800">{sd.expires(`dalam ${formatDuration(holdRemaining)}`, formatDateTime(b.holdExpiresAt!))}</p>
        )}
        {b.status === "cancelled" && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t.cancelReasons[b.cancelReason ?? "other"]}
            {b.cancelDetail ? ` · ${b.cancelDetail}` : ""}
            {b.refundNote ? ` · ${b.refundNote}` : ""}
          </p>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* Mobile: price and actions right after the schedule (05 §3.3). */}
          <div className="space-y-5 lg:hidden">
            <Card title={t.pricing.summary.title}>
              <PriceSummary snapshot={d.snapshot} />
              <div className="mt-4">
                <BookingActions bookingId={b.id} code={b.code} total={b.totalAmount} paid={d.paymentSummary.paid} flags={flags} />
              </div>
            </Card>
          </div>
          {sections}
          <Disclosure title={sd.history} className="rounded-lg border bg-card p-5 shadow-card lg:hidden">
            <div className="mt-4">
              <Timeline events={d.events} />
            </div>
          </Disclosure>
        </div>
        <aside className="hidden space-y-5 lg:block">
          <Card title={t.pricing.summary.title}>
            <PriceSummary snapshot={d.snapshot} />
            <div className="mt-4">
              <BookingActions bookingId={b.id} code={b.code} total={b.totalAmount} paid={d.paymentSummary.paid} flags={flags} />
            </div>
          </Card>
          <Card title={sd.history}>
            <Timeline events={d.events} />
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-card">
      {title && <h2 className="mb-3 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
