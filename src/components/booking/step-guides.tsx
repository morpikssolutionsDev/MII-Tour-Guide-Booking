"use client";

import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { t } from "@/i18n/id";
import { formatDateMedium } from "@/lib/format";
import { GuideCard } from "./guide-card";
import type { CandidateView } from "./types";

const wg = t.booking.wizard.guides;

/** 05 §3.2 step 3 "Tour Guide". */
export function StepGuides({
  candidates,
  loading,
  guidesNeeded,
  selected,
  onToggle,
  slotLabel,
  date,
  languageName,
  error,
  missingPrefillGuide,
}: {
  candidates: CandidateView[] | null;
  loading: boolean;
  guidesNeeded: number;
  selected: string[];
  onToggle: (guideId: string) => void;
  slotLabel: string;
  date: string;
  languageName: string;
  error?: string;
  missingPrefillGuide: string | null;
}) {
  if (loading || !candidates) {
    return (
      <div className="space-y-3" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-kabut-100" />
        ))}
      </div>
    );
  }
  if (candidates.length === 0) return <EmptyState decoration="bird-perched" title={t.booking.wizard.slotGone} />;

  const full = selected.length >= guidesNeeded;
  return (
    <div className="space-y-4">
      <h2 className="font-semibold">{wg.heading(guidesNeeded, candidates.length, slotLabel, formatDateMedium(date), languageName)}</h2>
      {missingPrefillGuide && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>{wg.notEligible(missingPrefillGuide)}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {candidates.map((c) => (
          <GuideCard key={c.guideId} candidate={c} selected={selected.includes(c.guideId)} disabled={full} onToggle={() => onToggle(c.guideId)} />
        ))}
      </div>
      <p className={error ? "text-sm font-medium text-merah-700" : "text-sm text-muted-foreground"} aria-live="polite">
        {error ?? `${selected.length}/${guidesNeeded} · ${wg.pickExactly(guidesNeeded)}`}
      </p>
    </div>
  );
}
