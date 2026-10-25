"use client";

import { Sparkles, Star } from "lucide-react";
import { LanguagePill, Pill } from "@/components/common/badges";
import { GuideAvatar } from "@/components/common/guide-bits";
import { Checkbox } from "@/components/ui/checkbox";
import { t } from "@/i18n/id";
import { formatRating } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CandidateView } from "./types";

/** design-system §7.3 GuideCard, selectable. */
export function GuideCard({ candidate, selected, disabled, onToggle }: { candidate: CandidateView; selected: boolean; disabled: boolean; onToggle: () => void }) {
  const sg = t.booking.wizard.guides;
  const inputId = `guide-${candidate.guideId}`;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 transition-colors",
        selected ? "border-danau-700 bg-danau-50 ring-1 ring-danau-700" : "hover:bg-kabut-50",
        disabled && !selected && "cursor-not-allowed opacity-60",
      )}
    >
      <GuideAvatar name={candidate.fullName} photoUrl={candidate.photoUrl} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{candidate.displayName}</span>
          {candidate.recommended && (
            <Pill tone="senja" icon={Sparkles}>
              {sg.recommended}
            </Pill>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{candidate.fullName}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="flex gap-1">
            {candidate.languageCodes.map((c) => (
              <LanguagePill key={c} code={c} />
            ))}
          </span>
          <span className="text-muted-foreground">{sg.weekLoad(candidate.weekLoad)}</span>
          {candidate.avgRating !== null && (
            <span className="flex items-center gap-0.5 font-medium">
              <Star className="size-3.5 fill-senja-500 text-senja-500" aria-hidden />
              {formatRating(candidate.avgRating)} <span className="text-muted-foreground">({candidate.ratingCount})</span>
            </span>
          )}
        </div>
      </div>
      <Checkbox id={inputId} checked={selected} disabled={disabled && !selected} onCheckedChange={onToggle} aria-label={candidate.displayName} />
    </label>
  );
}
