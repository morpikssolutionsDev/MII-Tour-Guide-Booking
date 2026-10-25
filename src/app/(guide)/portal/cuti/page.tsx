import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaveBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { daysBetween } from "@/domain/time";
import { t } from "@/i18n/id";
import { formatDateMedium } from "@/lib/format";
import { listOwnLeaves } from "@/server/portal/queries";
import { requireGuide } from "@/server/session";
import { CancelRequestButton, RequestLeaveButton } from "./leave-client";

export const metadata: Metadata = { title: t.nav.portal.cuti };

/** 08 §3.4 "Cuti". */
export default function PortalLeavePage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-kabut-100" />}>
      <Leaves />
    </Suspense>
  );
}

async function Leaves() {
  const me = await requireGuide();
  const leaves = await listOwnLeaves(me.guideId);
  return (
    <div className="space-y-4">
      <RequestLeaveButton />
      {leaves.length === 0 ? (
        <EmptyState decoration="leaves" title={t.portal.leave.empty} />
      ) : (
        <ul className="space-y-3">
          {leaves.map((l) => (
            <li key={l.id} className="rounded-lg border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">
                  {l.startDate === l.endDate ? formatDateMedium(l.startDate) : `${formatDateMedium(l.startDate)} – ${formatDateMedium(l.endDate)}`}
                  <span className="block text-sm font-normal text-muted-foreground">{t.leave.days(daysBetween(l.startDate, l.endDate) + 1)}</span>
                </p>
                <LeaveBadge status={l.status} />
              </div>
              <p className="mt-2 text-sm">{l.reason}</p>
              {l.status === "rejected" && l.decisionNote && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.leave.decisionNote}: {l.decisionNote}
                </p>
              )}
              {l.status === "pending" && (
                <div className="mt-3">
                  <CancelRequestButton leaveId={l.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
