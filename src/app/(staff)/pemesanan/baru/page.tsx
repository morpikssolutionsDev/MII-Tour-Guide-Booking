import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/wizard";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { t } from "@/i18n/id";
import { defaultChannelFor, loadWizardConfig, parsePrefill } from "@/server/bookings/wizard";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: t.booking.create };

/** 05 §3.2 */
export default async function NewBookingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireRole("admin", "staff");
  const config = await loadWizardConfig();
  const prefill = await parsePrefill(await searchParams, config);
  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t.booking.create} />
      <BookingWizard config={config} defaultChannel={defaultChannelFor(me)} prefill={prefill} />
    </PageContainer>
  );
}
