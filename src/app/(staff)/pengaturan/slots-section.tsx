import { Clock } from "lucide-react";
import { InactiveBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { t } from "@/i18n/id";
import { formatSlot } from "@/lib/format";
import { timeToMinutes } from "@/domain/time";
import { listSlots, upcomingBookingCountsBySlot } from "@/server/settings-queries";
import { SlotActions, SlotDialogButton } from "./slots-client";

/** 04 §3.1 */
export async function SlotsSection() {
  const [rows, counts] = await Promise.all([listSlots(), upcomingBookingCountsBySlot()]);
  const ss = t.settings.slots;

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <SlotDialogButton />
      </div>
      {rows.length === 0 ? (
        <EmptyState title={ss.empty} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card shadow-card">
          {rows.map((slot) => {
            const upcoming = counts.get(slot.id) ?? 0;
            return (
              <li key={slot.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <Clock className="size-5 text-danau-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular">{formatSlot(slot.startTime, slot.endTime)}</p>
                  <p className="text-xs text-muted-foreground">
                    {ss.hours(timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime))} · {ss.colUpcoming}: {upcoming}
                  </p>
                </div>
                {!slot.isActive && <InactiveBadge />}
                <SlotActions slot={slot} upcoming={upcoming} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
