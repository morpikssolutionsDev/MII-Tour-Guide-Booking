import { Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InactiveBadge, LanguagePill, LeaveBadge, StatusBadge } from "@/components/common/badges";
import { GuideAvatar, WeekdayDots } from "@/components/common/guide-bits";
import { PageContainer } from "@/components/common/page-header";
import { CopyButton } from "@/components/common/copy-button";
import { formatPhone } from "@/domain/phone";
import { daysBetween, wibToday } from "@/domain/time";
import { t } from "@/i18n/id";
import { formatDateMedium, formatRating, formatSlot } from "@/lib/format";
import { getGuideDetail } from "@/server/guides/queries";
import { requireRole } from "@/server/session";
import { CancelLeaveButton, GuideAdminActions } from "./guide-admin-actions";

export const metadata: Metadata = { title: t.guides.title };

/** 02 §3.2 */
export default async function GuideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("admin", "staff");
  const { id } = await params;
  const detail = await getGuideDetail(id);
  if (!detail) notFound();
  const { guide } = detail;
  const sg = t.guides;
  const isAdmin = me.role === "admin";
  const today = wibToday();

  return (
    <PageContainer className="space-y-5">
      <header className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-card sm:flex-row sm:items-center">
        <GuideAvatar name={guide.fullName} photoUrl={guide.photoUrl} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold md:text-2xl">{guide.displayName}</h1>
            {!guide.isActive && <InactiveBadge />}
          </div>
          <p className="text-sm text-muted-foreground">{guide.fullName}</p>
          <p className="mt-1 flex items-center gap-2 text-sm">
            <Phone className="size-4 text-muted-foreground" aria-hidden />
            <span className="tabular">{formatPhone(guide.phoneE164)}</span>
            <CopyButton value={guide.phoneE164} iconOnly label={sg.copyPhone} />
          </p>
        </div>
        {isAdmin && <GuideAdminActions guideId={guide.id} userId={guide.userId} name={guide.displayName} isActive={guide.isActive} />}
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card title={sg.sections.upcoming}>
            {detail.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">{sg.upcomingEmpty}</p>
            ) : (
              <ul className="divide-y">
                {detail.upcoming.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
                    <span className="w-32 font-medium">{formatDateMedium(b.tourDate)}</span>
                    <span className="tabular">{formatSlot(b.slotStart, b.slotEnd)}</span>
                    <Link href={`/pemesanan/${b.id}`} className="font-medium text-danau-700 tabular hover:underline">
                      {b.code}
                    </Link>
                    <span className="text-muted-foreground">
                      {b.customerName} · {t.common.people(b.people)}
                    </span>
                    <span className="ml-auto">
                      <StatusBadge status={b.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={sg.sections.leave}>
            {detail.leaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">{sg.leaveEmpty}</p>
            ) : (
              <ul className="divide-y">
                {detail.leaves.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
                    <span className="font-medium">
                      {l.startDate === l.endDate ? formatDateMedium(l.startDate) : `${formatDateMedium(l.startDate)} – ${formatDateMedium(l.endDate)}`}
                    </span>
                    <span className="text-muted-foreground">{t.leave.days(daysBetween(l.startDate, l.endDate) + 1)}</span>
                    <LeaveBadge status={l.status} />
                    <span className="w-full text-muted-foreground sm:w-auto">{l.reason}</span>
                    {l.decisionNote && <span className="w-full text-xs text-muted-foreground">{t.leave.decisionNote}: {l.decisionNote}</span>}
                    {isAdmin && l.status === "approved" && l.endDate >= today && (
                      <span className="ml-auto">
                        <CancelLeaveButton leaveId={l.id} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title={sg.sections.languages}>
            <div className="flex flex-wrap gap-2">
              {detail.languages.map((l) => (
                <span key={l.id} className="flex items-center gap-1.5 text-sm">
                  <LanguagePill code={l.code} />
                  <span className={l.isActive ? "" : "text-muted-foreground"}>{l.nameId}</span>
                </span>
              ))}
            </div>
          </Card>
          <Card title={sg.sections.workdays}>
            <WeekdayDots weekdays={detail.weekdays} />
            <p className="mt-2 text-xs text-muted-foreground">
              {t.weekdays.filter((_, i) => detail.weekdays.includes(i + 1)).join(", ")}
            </p>
          </Card>
          <Card title={sg.sections.performance}>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Stat label={sg.perf.rating} value={detail.rating.avg === null ? sg.noRating : `★ ${formatRating(detail.rating.avg)}`} />
              <Stat label={sg.perf.ratings} value={String(detail.rating.count)} />
              <Stat label={sg.perf.tours30} value={String(detail.performance.tours30)} />
              <Stat label={sg.perf.tours90} value={String(detail.performance.tours90)} />
              <Stat label={sg.perf.noShow90} value={String(detail.performance.noShow90)} />
            </dl>
          </Card>
          {guide.notes && (
            <Card title={sg.sections.notes}>
              <p className="text-sm whitespace-pre-line">{guide.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-card">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular">{value}</dd>
    </div>
  );
}
