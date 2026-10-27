"use client";

import { Merge, Split, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Pill, StatusBadge } from "@/components/common/badges";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Button } from "@/components/ui/button";
import type { BookingStatus } from "@/db/schema";
import { useAction } from "@/hooks/use-action";
import { useKeyedResource } from "@/hooks/use-keyed-resource";
import { t } from "@/i18n/id";
import { cn } from "@/lib/utils";
import { listMergeCandidates, mergeBooking, splitBooking } from "@/server/bookings/merge";

const sm = t.merge;

type Candidates = Extract<Awaited<ReturnType<typeof listMergeCandidates>>, { ok: true }>["data"];
type Candidate = Candidates["candidates"][number];

/** 12 §3.1 "Gabungkan pemesanan" (admin). */
export function MergeButton({ hostId, subtitle, guideNames }: { hostId: string; subtitle: string; guideNames: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Merge />
        {sm.button}
      </Button>
      {open && <MergeDialog hostId={hostId} subtitle={subtitle} guideNames={guideNames} onClose={() => setOpen(false)} />}
    </>
  );
}

function MergeDialog({ hostId, subtitle, guideNames, onClose }: { hostId: string; subtitle: string; guideNames: string[]; onClose: () => void }) {
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { data } = useKeyedResource(hostId, async () => {
    const result = await listMergeCandidates({ hostId });
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    return result.data;
  });
  const merge = useAction(mergeBooking, { successMessage: () => sm.done(selected?.code ?? ""), onSuccess: onClose });

  const title = data ? sm.title(data.host.code) : sm.button;
  return (
    <ResponsiveDialog
      open
      wide
      onOpenChange={(v) => !v && onClose()}
      title={title}
      description={subtitle}
      footer={
        <>
          <Button variant="secondary" onClick={confirming ? () => setConfirming(false) : onClose}>
            {confirming ? t.common.back : t.common.cancel}
          </Button>
          {confirming ? (
            <Button pending={merge.pending} onClick={() => selected && merge.run({ hostId, bookingId: selected.id })}>
              <Merge />
              {sm.confirm}
            </Button>
          ) : (
            <Button disabled={!selected} onClick={() => setConfirming(true)}>
              {t.common.next}
            </Button>
          )}
        </>
      }
    >
      {!data ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t.common.loading}</p>
      ) : confirming && selected ? (
        <p className="text-sm">{sm.confirmBody(selected.code, guideNames.join(", "), selected.releasesGuides.join(", "))}</p>
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4 text-danau-700" aria-hidden />
            {sm.capacityLine(data.capacity.used, data.capacity.max, data.capacity.guides)}
          </p>
          {data.candidates.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">{sm.empty}</p>
          ) : (
            <ul className="space-y-2" role="radiogroup" aria-label={sm.button}>
              {data.candidates.map((c) => {
                const on = selected?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={!c.fits}
                      onClick={() => setSelected(c)}
                      className={cn(
                        "w-full rounded-md border p-3 text-left transition-colors",
                        on ? "border-danau-700 bg-danau-50" : "hover:bg-kabut-50",
                        !c.fits && "cursor-not-allowed opacity-60 hover:bg-transparent",
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tabular">{c.code}</span>
                        <StatusBadge status={c.status as BookingStatus} />
                        <span className="ml-auto text-sm font-medium">{t.common.people(c.people)}</span>
                      </span>
                      <span className="mt-1 block text-sm">
                        {c.customerName} <span className="text-xs text-muted-foreground">{c.nationality}</span> · {c.packageName}
                      </span>
                      <span className={cn("mt-1 block text-xs", c.fits ? "text-muted-foreground" : "font-medium text-merah-700")}>
                        {c.fits ? (c.releasesGuides.length ? sm.releases(c.releasesGuides.join(", ")) : sm.noGuidesToRelease) : sm.overBy(c.overBy)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {merge.failure && <p className="text-sm font-medium text-merah-700">{merge.failure.error}</p>}
        </div>
      )}
    </ResponsiveDialog>
  );
}

type Member = {
  id: string;
  code: string;
  status: string;
  people: number;
  customerName: string;
  nationality: string;
  packageName: string;
  isHost: boolean;
};

/** 12 §3.1 "Tur gabungan" block, with "Pisahkan" for admin before the slot starts. */
export function GroupPanel({ currentId, members, canSplit }: { currentId: string; members: Member[]; canSplit: boolean }) {
  const [splitting, setSplitting] = useState<Member | null>(null);
  const split = useAction(splitBooking, { successMessage: () => sm.splitDone(splitting?.code ?? ""), onSuccess: () => setSplitting(null) });
  return (
    <>
      <ul className="divide-y">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
            <Link href={`/pemesanan/${m.id}`} className={cn("font-semibold tabular hover:underline", m.id === currentId && "text-danau-700")}>
              {m.code}
            </Link>
            {m.isHost && <Pill tone="danau">{sm.hostLabel}</Pill>}
            <StatusBadge status={m.status as BookingStatus} />
            <span className="min-w-0 flex-1 text-muted-foreground">
              {m.customerName} <span className="text-xs">{m.nationality}</span> · {t.common.people(m.people)} · {m.packageName}
            </span>
            {canSplit && !m.isHost && (
              <Button variant="ghost" size="sm" onClick={() => setSplitting(m)}>
                <Split />
                {sm.split}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(splitting)}
        onOpenChange={(v) => !v && setSplitting(null)}
        title={splitting ? sm.splitTitle(splitting.code) : ""}
        body={sm.splitBody}
        confirmLabel={sm.split}
        tone="primary"
        pending={split.pending}
        onConfirm={() => splitting && split.run({ bookingId: splitting.id })}
      />
    </>
  );
}
