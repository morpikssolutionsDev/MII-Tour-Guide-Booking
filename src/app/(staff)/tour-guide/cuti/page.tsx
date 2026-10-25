import type { Metadata } from "next";
import Link from "next/link";
import { LeaveBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { UrlTabs } from "@/components/common/url-tabs";
import { daysBetween } from "@/domain/time";
import { t } from "@/i18n/id";
import { formatDateMedium, formatRelative } from "@/lib/format";
import { findLiveConflicts } from "@/server/bookings/conflicts";
import { listLeaveRequests } from "@/server/guides/queries";
import { requireRole } from "@/server/session";
import { LeaveDecision } from "./leave-decision";

export const metadata: Metadata = { title: t.leave.title };

/** 02 §3.4 */
export default async function LeaveRequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("admin");
  const { tab: requested } = await searchParams;
  const tab = requested === "riwayat" ? "history" : "pending";
  const rows = await listLeaveRequests(tab);
  const conflicts =
    tab === "pending"
      ? await Promise.all(rows.map((r) => findLiveConflicts({ guideId: r.leave.guideId, from: r.leave.startDate, to: r.leave.endDate })))
      : [];
  const now = new Date();
  const sl = t.leave;

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={sl.title} />
      <UrlTabs
        active={tab === "pending" ? "menunggu" : "riwayat"}
        tabs={[
          { value: "menunggu", label: sl.tabPending },
          { value: "riwayat", label: sl.tabHistory },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState decoration="leaves" title={tab === "pending" ? sl.pendingEmpty : sl.historyEmpty} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r, index) => {
            const l = r.leave;
            const days = daysBetween(l.startDate, l.endDate) + 1;
            return (
              <li key={l.id} className="rounded-lg border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/tour-guide/${l.guideId}`} className="font-semibold hover:underline">
                      {r.guideName}
                    </Link>
                    <p className="text-sm">
                      {l.startDate === l.endDate ? formatDateMedium(l.startDate) : `${formatDateMedium(l.startDate)} – ${formatDateMedium(l.endDate)}`}
                      {" · "}
                      {sl.days(days)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{l.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sl.submittedAt} {formatRelative(l.createdAt, now)}
                    </p>
                    {l.decisionNote && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {sl.decisionNote}: {l.decisionNote}
                      </p>
                    )}
                  </div>
                  {tab === "history" && <LeaveBadge status={l.status} />}
                </div>
                {tab === "pending" && <LeaveDecision leaveId={l.id} conflicts={conflicts[index]} />}
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
