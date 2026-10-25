"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/common/field";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { StarRating } from "@/components/common/star-rating";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { submitFeedbackByStaff } from "@/server/feedback/actions";

const fb = t.feedback;

/** 10 §3.3 "Isi ulasan" (staff, admin, or the assigned guide). */
export function FeedbackFormDialog({
  bookingId,
  guides,
  enteredByName,
  onClose,
}: {
  bookingId: string;
  guides: { id: string; name: string }[];
  enteredByName: string;
  onClose: () => void;
}) {
  const [overall, setOverall] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [revisit, setRevisit] = useState<"yes" | "maybe" | "no" | "">("");
  const [consent, setConsent] = useState(false);
  const action = useAction(submitFeedbackByStaff, { successMessage: fb.saved, onSuccess: onClose });
  const complete = overall !== null && revisit !== "" && guides.every((g) => ratings[g.id]);

  return (
    <ResponsiveDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={fb.fill}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            pending={action.pending}
            disabled={!complete}
            onClick={() =>
              complete &&
              action.run({
                bookingId,
                overall: overall!,
                guideRatings: guides.map((g) => ({ guideId: g.id, rating: ratings[g.id] })),
                comment,
                wouldRevisit: revisit as "yes" | "maybe" | "no",
                consent,
              })
            }
          >
            {fb.save}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Alert variant="info">
          <Info />
          <AlertDescription>{fb.fillNotice(enteredByName)}</AlertDescription>
        </Alert>
        <Field label={`${fb.overall} *`}>
          <StarRating value={overall} onChange={setOverall} label={fb.overall} />
        </Field>
        {guides.map((g) => (
          <Field key={g.id} label={`${fb.guideRating(g.name)} *`}>
            <StarRating value={ratings[g.id] ?? null} onChange={(v) => setRatings((r) => ({ ...r, [g.id]: v }))} label={fb.guideRating(g.name)} />
          </Field>
        ))}
        <Field id="fb-comment" label={fb.comment}>
          <Textarea id="fb-comment" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{fb.revisit} *</legend>
          <ToggleGroup type="single" variant="outline" value={revisit} onValueChange={(v) => setRevisit(v as "yes" | "maybe" | "no")}>
            {(["yes", "maybe", "no"] as const).map((v) => (
              <ToggleGroupItem key={v} value={v} className="h-11 min-w-20 data-[state=on]:bg-danau-50 data-[state=on]:text-danau-800 md:h-10">
                {fb.revisitAnswers[v]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </fieldset>
        <div className="flex items-start gap-2">
          <Checkbox id="fb-consent" checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} className="mt-0.5" />
          <Label htmlFor="fb-consent" className="leading-snug font-normal">
            {fb.consent}
          </Label>
        </div>
        {action.failure && !action.failure.fieldErrors && <p className="text-sm text-merah-700">{action.failure.error}</p>}
      </div>
    </ResponsiveDialog>
  );
}
