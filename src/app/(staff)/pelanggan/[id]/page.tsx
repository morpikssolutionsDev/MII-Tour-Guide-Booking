import { BadgeCheck, CircleOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill, ReturningBadge, StatusBadge } from "@/components/common/badges";
import { PageContainer } from "@/components/common/page-header";
import { StarsDisplay } from "@/components/common/star-rating";
import { formatPhone } from "@/domain/phone";
import { t } from "@/i18n/id";
import { countryNameId, formatDateMedium, formatDateTime, formatRupiah, formatSlot } from "@/lib/format";
import { getCustomerDetail } from "@/server/bookings/queries";
import { requireRole } from "@/server/session";
import { CustomerForm } from "./customer-form";

export const metadata: Metadata = { title: t.customers.title };

/** 05 §3.7 customer detail. */
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin", "staff");
  const { id } = await params;
  const d = await getCustomerDetail(id);
  if (!d) notFound();
  const c = d.customer;
  const sc = t.customers;

  return (
    <PageContainer className="space-y-5">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold md:text-2xl">{c.name}</h1>
        {d.visits >= 1 && <ReturningBadge visits={d.visits} />}
        <span className="text-sm text-muted-foreground">
          {countryNameId(c.nationality)} · <span className="tabular">{formatPhone(c.phoneE164)}</span>
        </span>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="rounded-lg border bg-card p-5 shadow-card">
            <h2 className="mb-3 font-semibold">{sc.bookings}</h2>
            <ul className="divide-y">
              {d.history.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
                  <Link href={`/pemesanan/${b.id}`} className="font-medium text-danau-700 tabular hover:underline">
                    {b.code}
                  </Link>
                  <span>
                    {formatDateMedium(b.tourDate)} · {formatSlot(b.slotStart, b.slotEnd)}
                  </span>
                  <span className="text-muted-foreground">
                    {b.languageName} · {t.common.people(b.people)} · {formatRupiah(b.totalAmount)}
                  </span>
                  <span className="ml-auto">
                    <StatusBadge status={b.status} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border bg-card p-5 shadow-card">
            <h2 className="mb-3 font-semibold">{sc.ratings}</h2>
            {d.ratings.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.common.none}</p>
            ) : (
              <ul className="space-y-3">
                {d.ratings.map((r) => (
                  <li key={r.bookingId} className="text-sm">
                    <p className="flex items-center gap-2">
                      <StarsDisplay value={r.overall ?? 0} />
                      <Link href={`/pemesanan/${r.bookingId}`} className="text-xs text-danau-700 tabular hover:underline">
                        {r.code}
                      </Link>
                      {r.submittedAt && <span className="text-xs text-muted-foreground">{formatDateTime(r.submittedAt)}</span>}
                    </p>
                    {r.comment && <p className="mt-1 text-muted-foreground italic" lang="en">“{r.comment}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="space-y-5">
          <section className="rounded-lg border bg-card p-5 shadow-card">
            <h2 className="mb-3 font-semibold">{sc.profile}</h2>
            <div className="mb-4">
              {c.marketingConsent ? (
                <Pill tone="rimba" icon={BadgeCheck}>
                  {sc.consent}
                </Pill>
              ) : (
                <Pill tone="kabut" icon={CircleOff}>
                  {sc.noConsent}
                </Pill>
              )}
            </div>
            <CustomerForm customer={{ id: c.id, name: c.name, phone: formatPhone(c.phoneE164), nationality: c.nationality, email: c.email ?? "", notes: c.notes ?? "" }} />
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
