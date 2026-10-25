"use client";

import { Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { formatDateTime, formatRelative } from "@/lib/format";
import { resendGuideNotice, setChecklistItem } from "@/server/preparation/actions";

type Item = { id: string; systemKey: string | null; label: string; description: string | null; checkedAt: string | null; checkedByName: string | null };
type GuideAck = { guideId: string; displayName: string; acknowledgedAt: string | null; notifiedAt: string | null };

const pp = t.preparation;

/** 07 §3.1 "Persiapan" checklist with per-guide acknowledgement. */
export function ChecklistPanel({ bookingId, items, guides, editable }: { bookingId: string; items: Item[]; guides: GuideAck[]; editable: boolean }) {
  const toggle = useAction(setChecklistItem);
  const resend = useAction(resendGuideNotice, { successMessage: pp.resent });
  const done = items.filter((i) => i.checkedAt).length;
  const now = new Date();

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{pp.progress(done, items.length)}</span>
        </div>
        <Progress value={items.length ? (done / items.length) * 100 : 0} className="mt-2 h-2 [&>div]:bg-rimba-500" />
        <p className="mt-2 text-xs text-muted-foreground">{done === items.length ? pp.allReady : pp.finishHint}</p>
      </div>
      <ul className="space-y-3">
        {items.map((item) => {
          const system = item.systemKey === "guide_ack";
          const checkboxId = `chk-${item.id}`;
          return (
            <li key={item.id} className="rounded-md border p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={checkboxId}
                  checked={Boolean(item.checkedAt)}
                  disabled={system || !editable || toggle.pending}
                  onCheckedChange={(v) => toggle.run({ itemId: item.id, checked: Boolean(v) })}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={checkboxId} className="flex items-center gap-1.5 text-sm font-medium">
                    {item.label}
                    {system && <Lock className="size-3.5 text-muted-foreground" aria-label={pp.systemReadOnly} />}
                  </label>
                  {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                  {item.checkedAt && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.checkedByName ? pp.checkedBy(item.checkedByName, formatDateTime(item.checkedAt)) : `${pp.bySystem} · ${formatDateTime(item.checkedAt)}`}
                    </p>
                  )}
                </div>
              </div>
              {system && (
                <ul className="mt-2 space-y-1.5 border-t pt-2 pl-7">
                  {guides.map((g) => (
                    <li key={g.guideId} className="flex flex-wrap items-center gap-2 text-xs">
                      {g.acknowledgedAt ? (
                        <span className="text-rimba-700">{pp.ackLine(g.displayName, formatDateTime(g.acknowledgedAt))}</span>
                      ) : (
                        <>
                          <span className="text-senja-800">{pp.notAckedLine(g.displayName, g.notifiedAt ? formatRelative(g.notifiedAt, now) : t.common.none)}</span>
                          {editable && (
                            <Button variant="ghost" size="xs" pending={resend.pending} onClick={() => resend.run({ bookingId, guideId: g.guideId })}>
                              <Send />
                              {pp.resend}
                            </Button>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
