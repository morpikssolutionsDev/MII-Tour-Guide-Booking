"use client";

import { Ban, Check } from "lucide-react";
import { t } from "@/i18n/id";
import { cn } from "@/lib/utils";
import type { SlotView } from "./types";

/** design-system §7.3 SlotChip: available, selected, unavailable with reason. */
export function SlotChip({ slot, selected, onSelect }: { slot: SlotView; selected: boolean; onSelect: () => void }) {
  if (!slot.available) {
    return (
      <div className="flex min-h-14 flex-col justify-center rounded-md border border-kabut-200 bg-kabut-50 px-3 py-2 text-kabut-600" aria-disabled>
        <span className="flex items-center gap-1.5 text-sm font-semibold tabular">
          <Ban className="size-4" aria-hidden />
          {slot.label}
        </span>
        <span className="text-xs">{slot.reasonText}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-14 flex-col justify-center rounded-md border px-3 py-2 text-left transition-colors",
        selected ? "border-danau-700 bg-danau-50 text-danau-800 ring-1 ring-danau-700" : "border-input-border bg-card hover:bg-kabut-50",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold tabular">
        {selected && <Check className="size-4" aria-hidden />}
        {slot.label}
      </span>
      <span className="text-xs text-muted-foreground">{t.booking.wizard.schedule.slotAvailable(slot.eligibleCount)}</span>
    </button>
  );
}
