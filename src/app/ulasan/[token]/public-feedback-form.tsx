"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { DecoratedLogo } from "@/components/brand/decorated-logo";
import { GuideAvatar } from "@/components/common/guide-bits";
import { StarRating } from "@/components/common/star-rating";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { en } from "@/i18n/en";
import { submitPublicFeedback, type PublicFeedbackResult } from "@/server/feedback/actions";

type Tour = { dateEn: string; slotEn: string; languageEn: string; firstName: string; guides: { id: string; displayName: string; fullName: string; photoUrl: string | null }[] };

const f = en.feedback;

export function PublicFeedbackForm({ token, tour }: { token: string; tour: Tour }) {
  const [overall, setOverall] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [revisit, setRevisit] = useState<"yes" | "maybe" | "no" | "">("");
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<PublicFeedbackResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [pending, startTransition] = useTransition();
  const complete = overall !== null && revisit !== "" && tour.guides.every((g) => ratings[g.id]);

  if (result?.ok) {
    return (
      <div className="mt-8 rounded-xl bg-card p-6 text-center shadow-card">
        <DecoratedLogo birdsOnly className="mx-auto max-w-[200px]" />
        <h1 className="mt-4 text-xl font-bold">{f.thanks(tour.firstName)}</h1>
        <p className="mt-2 text-muted-foreground">{f.thanksBody}</p>
      </div>
    );
  }
  if (result && !result.ok && result.state !== "error") {
    return (
      <div className="mt-8 flex flex-col items-center rounded-xl bg-card p-6 text-center shadow-card">
        <img src="/brand/snake.svg" alt="" className="w-[120px]" />
        <p className="mt-4 text-base font-medium">{f[result.state]}</p>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete) {
      setShowErrors(true);
      return;
    }
    startTransition(async () => {
      try {
        setResult(
          await submitPublicFeedback({
            token,
            overall,
            guideRatings: tour.guides.map((g) => ({ guideId: g.id, rating: ratings[g.id] })),
            comment,
            wouldRevisit: revisit,
            consent,
          }),
        );
      } catch {
        setResult({ ok: false, state: "error" });
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-6 text-base">
      <section className="rounded-xl bg-card p-5 shadow-card">
        <p className="text-lg font-semibold">{f.hi(tour.firstName)}</p>
        <p className="mt-1">
          {f.tourOn} <strong>{tour.dateEn}</strong>
        </p>
        <p className="text-muted-foreground">
          {tour.slotEn} WIB · {tour.languageEn}
        </p>
        <p className="mt-1">
          {f.with} <strong>{tour.guides.map((g) => g.displayName).join(" & ")}</strong>
        </p>
      </section>

      <section className="space-y-6 rounded-xl bg-card p-5 shadow-card">
        <div>
          <p className="mb-2 font-semibold">
            {f.overall} <span className="text-merah-700">*</span>
          </p>
          <StarRating value={overall} onChange={setOverall} label={f.overall} size="lg" labels={f.ratingLabels} />
          {showErrors && overall === null && <p className="mt-1 text-sm text-merah-700">{f.required}</p>}
        </div>
        {tour.guides.map((g) => (
          <div key={g.id}>
            <p className="mb-2 flex items-center gap-2 font-semibold">
              <GuideAvatar name={g.fullName} photoUrl={g.photoUrl} size={32} />
              {f.guide(g.displayName)} <span className="text-merah-700">*</span>
            </p>
            <StarRating value={ratings[g.id] ?? null} onChange={(v) => setRatings((r) => ({ ...r, [g.id]: v }))} label={f.guide(g.displayName)} size="lg" labels={f.ratingLabels} />
            {showErrors && !ratings[g.id] && <p className="mt-1 text-sm text-merah-700">{f.required}</p>}
          </div>
        ))}
        <div>
          <Label htmlFor="pf-comment" className="mb-2 block text-base font-semibold">
            {f.comment}
          </Label>
          <Textarea id="pf-comment" rows={4} maxLength={1000} placeholder={f.commentPlaceholder} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <fieldset>
          <legend className="mb-2 font-semibold">
            {f.revisit} <span className="text-merah-700">*</span>
          </legend>
          <ToggleGroup type="single" variant="outline" value={revisit} onValueChange={(v) => setRevisit(v as "yes" | "maybe" | "no")} className="w-full">
            {(["yes", "maybe", "no"] as const).map((v) => (
              <ToggleGroupItem key={v} value={v} className="h-12 flex-1 text-base data-[state=on]:bg-danau-50 data-[state=on]:text-danau-800">
                {f.revisitAnswers[v]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {showErrors && !revisit && <p className="mt-1 text-sm text-merah-700">{f.required}</p>}
        </fieldset>
        <div className="flex items-start gap-3">
          <Checkbox id="pf-consent" checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} className="mt-1 size-5" />
          <Label htmlFor="pf-consent" className="text-base leading-snug font-normal">
            {f.consent}
          </Label>
        </div>
      </section>

      {result && !result.ok && result.state === "error" && (
        <p className="rounded-md bg-merah-50 p-3 text-sm text-merah-700" role="alert">
          {f.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" pending={pending}>
        {f.submit}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{f.footer}</p>
    </form>
  );
}
