import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BookingWizard } from "@/components/booking/wizard";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { canReschedule } from "@/domain/booking-status";
import { t } from "@/i18n/id";
import { formatSlot } from "@/lib/format";
import { isPaymentConfirmationEnabled } from "@/lib/flags";
import { syncHolds } from "@/server/bookings/holds";
import { loadRescheduleState, loadWizardConfig } from "@/server/bookings/wizard";
import { getBookingDetail } from "@/server/bookings/queries";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: t.booking.reschedule.title };

/** 05 §3.4: wizard steps 2–4, pre-filled with the current values. */
export default async function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("admin", "staff");
  const { id } = await params;
  await syncHolds();
  const [state, detail] = await Promise.all([loadRescheduleState(id), getBookingDetail(id)]);
  if (!state) notFound();
  if (!canReschedule(state.booking, new Date())) redirect(`/pemesanan/${id}`);
  const b = state.booking;
  const config = await loadWizardConfig({ packageId: b.packageId, languageId: b.languageId });

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={`${t.booking.reschedule.title} · ${b.code}`} description={state.customerName} />
      <BookingWizard
        config={config}
        defaultChannel={me.defaultChannel ?? b.channel}
        reschedule={{
          bookingId: b.id,
          code: b.code,
          customerName: state.customerName,
          status: b.status,
          // 12 BR-12-P5: without payment confirmation the system settles price differences.
          hasPayments: isPaymentConfirmationEnabled() && Boolean(detail?.paymentSummary.paid),
          before: {
            languageId: b.languageId,
            people: b.people,
            packageId: b.packageId,
            date: b.tourDate,
            slotId: b.slotId,
            slotLabel: formatSlot(b.slotStart, b.slotEnd),
            guideIds: state.guides.map((g) => g.guideId),
            guideNames: Object.fromEntries(state.guides.map((g) => [g.guideId, g.name])),
            snapshot: state.snapshot,
          },
        }}
      />
    </PageContainer>
  );
}
