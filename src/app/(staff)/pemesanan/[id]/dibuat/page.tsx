/* eslint-disable @next/next/no-img-element */
import { ArrowRight, BadgeCheck, CheckCircle2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/components/common/badges";
import { CopyButton } from "@/components/common/copy-button";
import { PageContainer } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/id";
import { formatDateLong, formatRupiah, formatSlot } from "@/lib/format";
import { getBookingDetail } from "@/server/bookings/queries";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: t.splash.title };

/** 12 §3.4: full-screen confirmation after creating a booking while payment confirmation is off. */
export default async function BookingCreatedPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin", "staff");
  const { id } = await params;
  const d = await getBookingDetail(id);
  if (!d) notFound();
  const b = d.booking;
  const message = d.messages.find((m) => m.eventKey === "booking_created")?.body ?? null;
  const ss = t.splash;
  const rows: [string, string][] = [
    [ss.schedule, `${formatDateLong(b.tourDate)} · ${formatSlot(b.slotStart, b.slotEnd)}`],
    [ss.languagePeople, `${d.languageName} · ${t.common.people(b.people)}`],
    [ss.package, d.packageName],
    [ss.guides, d.guides.map((g) => g.displayName).join(", ") || t.common.none],
    [ss.customer, d.customer.name],
  ];

  return (
    <PageContainer className="flex min-h-[calc(100dvh-8rem)] items-center justify-center">
      <section className="w-full max-w-lg rounded-xl border bg-card p-6 text-center shadow-card md:p-8" aria-labelledby="splash-title">
        <img src="/brand/carousel.svg" alt="" className="mx-auto h-auto w-24" />
        <CheckCircle2 className="mx-auto mt-4 size-10 text-rimba-600" aria-hidden />
        <h1 id="splash-title" className="mt-2 text-xl font-bold md:text-2xl">
          {ss.title}
        </h1>
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-2xl font-bold tracking-wide tabular md:text-3xl">{b.code}</span>
          <CopyButton value={b.code} iconOnly label={ss.copyCode} />
        </div>

        <dl className="mt-6 divide-y rounded-lg border text-left text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-3 px-4 py-2.5">
              <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
              <dd className="min-w-0 font-medium">{value}</dd>
            </div>
          ))}
          <div className="flex items-center gap-3 px-4 py-2.5">
            <dt className="w-32 shrink-0 text-muted-foreground">{ss.total}</dt>
            <dd className="flex flex-1 flex-wrap items-center gap-2 font-semibold tabular">
              {formatRupiah(b.totalAmount)}
              <Pill tone="rimba" icon={BadgeCheck}>
                {t.common.paidBadge}
              </Pill>
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" asChild>
            <Link href={`/pemesanan/${b.id}`}>
              {ss.viewDetail}
              <ArrowRight />
            </Link>
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" className="flex-1" asChild>
              <Link href="/pemesanan/baru">
                <Plus />
                {ss.another}
              </Link>
            </Button>
            {message && (
              <div className="flex-1 [&>button]:w-full">
                <CopyButton value={message} label={ss.copyMessage} />
              </div>
            )}
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
