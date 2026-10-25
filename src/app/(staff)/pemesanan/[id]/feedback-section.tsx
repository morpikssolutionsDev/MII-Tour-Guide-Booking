"use client";

import { MessageSquareText, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Pill } from "@/components/common/badges";
import { FeedbackFormDialog } from "@/components/common/feedback-form-dialog";
import { FeedbackShare } from "@/components/common/feedback-share";
import { StarsDisplay } from "@/components/common/star-rating";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { formatDateLong, formatDateTime } from "@/lib/format";
import { regenerateFeedbackLink } from "@/server/feedback/actions";

type FeedbackView = {
  token: string;
  tokenExpiresAt: string;
  submittedAt: string | null;
  source: "tourist" | "staff" | "guide" | null;
  overallRating: number | null;
  comment: string | null;
  wouldRevisit: "yes" | "maybe" | "no" | null;
  contactConsent: boolean | null;
  enteredByName: string | null;
  ratings: { guideId: string; rating: number; name: string }[];
};

const fb = t.feedback;

/** 10 §3.2 section "Ulasan" on the booking detail. */
export function FeedbackSection({
  bookingId,
  feedback,
  guides,
  share,
  meName,
  linkExpired,
}: {
  bookingId: string;
  feedback: FeedbackView | null;
  guides: { id: string; name: string }[];
  share: { url: string; whatsappText: string; phone: string } | null;
  meName: string;
  /** Computed on the server (render must stay pure). */
  linkExpired: boolean;
}) {
  const [fillOpen, setFillOpen] = useState(false);
  const regenerate = useAction(regenerateFeedbackLink, { successMessage: fb.regenerated });

  if (feedback?.submittedAt) {
    const source =
      feedback.source === "tourist"
        ? fb.source.tourist
        : feedback.source === "guide"
          ? fb.source.guide(feedback.enteredByName ?? "")
          : fb.source.staff(feedback.enteredByName ?? "");
    return (
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StarsDisplay value={feedback.overallRating ?? 0} />
          <span className="font-semibold">{feedback.overallRating}/5</span>
          <Pill tone="outline" icon={MessageSquareText}>
            {source}
          </Pill>
        </div>
        <ul className="space-y-1">
          {feedback.ratings.map((r) => (
            <li key={r.guideId} className="flex items-center gap-2">
              <span className="w-24">{r.name}</span>
              <StarsDisplay value={r.rating} />
            </li>
          ))}
        </ul>
        {feedback.comment && <blockquote className="rounded-md bg-surface-muted p-3 italic" lang="en">“{feedback.comment}”</blockquote>}
        <p className="text-muted-foreground">
          {fb.revisit} {feedback.wouldRevisit ? fb.revisitAnswers[feedback.wouldRevisit] : t.common.none} · {fb.consentShort}: {feedback.contactConsent ? "✓" : t.common.none} ·{" "}
          {fb.submittedAt(formatDateTime(feedback.submittedAt))}
        </p>
      </div>
    );
  }

  const expired = !feedback || linkExpired;
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{expired ? fb.expired : fb.waiting(formatDateLong(feedback!.tokenExpiresAt.slice(0, 10)))}</p>
      {!expired && share && (
        <FeedbackShare url={share.url} whatsappText={share.whatsappText} phone={share.phone} expiresLabel={formatDateTime(feedback!.tokenExpiresAt)} />
      )}
      <div className="flex flex-wrap gap-2">
        {expired && (
          <Button variant="secondary" pending={regenerate.pending} onClick={() => regenerate.run({ bookingId })}>
            <RefreshCw />
            {fb.regenerate}
          </Button>
        )}
        <Button onClick={() => setFillOpen(true)}>{fb.fill}</Button>
      </div>
      {fillOpen && <FeedbackFormDialog bookingId={bookingId} guides={guides} enteredByName={meName} onClose={() => setFillOpen(false)} />}
    </div>
  );
}
