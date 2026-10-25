"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/common/field";
import { NumberStepper } from "@/components/common/number-stepper";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { updateSettings } from "@/server/settings-actions";

type Settings = {
  hold_expiry_hours: number;
  booking_horizon_days: number;
  notice_days: number;
  feedback_link_days: number;
  low_rating_threshold: number;
  payment_instructions_en: string;
};
const NUMBER_FIELDS = [
  ["hold_expiry_hours", 1, 168],
  ["booking_horizon_days", 7, 365],
  ["notice_days", 1, 7],
  ["feedback_link_days", 1, 60],
  ["low_rating_threshold", 1, 4],
] as const;
const sg = t.settings.general;

export function GeneralForm({ initial }: { initial: Settings }) {
  const [values, setValues] = useState<Record<keyof Settings, string>>({
    hold_expiry_hours: String(initial.hold_expiry_hours),
    booking_horizon_days: String(initial.booking_horizon_days),
    notice_days: String(initial.notice_days),
    feedback_link_days: String(initial.feedback_link_days),
    low_rating_threshold: String(initial.low_rating_threshold),
    payment_instructions_en: initial.payment_instructions_en,
  });
  const action = useAction(updateSettings, { successMessage: sg.saved });
  const errors = action.fieldErrors;

  return (
    <form
      className="max-w-[720px] space-y-5 rounded-lg border bg-card p-5 shadow-card md:p-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        action.run({
          hold_expiry_hours: Number(values.hold_expiry_hours),
          booking_horizon_days: Number(values.booking_horizon_days),
          notice_days: Number(values.notice_days),
          feedback_link_days: Number(values.feedback_link_days),
          low_rating_threshold: Number(values.low_rating_threshold),
          payment_instructions_en: values.payment_instructions_en,
        });
      }}
    >
      <div className="grid gap-5 md:grid-cols-2">
        {NUMBER_FIELDS.map(([key, min, max]) => {
          const meta = sg.fields[key];
          return (
            <Field key={key} id={key} label={meta.label} required helper={[meta.help, sg.range(min, max)].filter(Boolean).join(" ")} error={errors[key] ? sg.range(min, max) : undefined}>
              <NumberStepper
                id={key}
                min={min}
                max={max}
                value={values[key] === "" ? null : Number(values[key])}
                onChange={(n) => setValues((v) => ({ ...v, [key]: n === null ? "" : String(n) }))}
                invalid={Boolean(errors[key])}
                unit={meta.unit || undefined}
              />
            </Field>
          );
        })}
      </div>
      <Field id="payment_instructions_en" label={sg.fields.payment_instructions_en.label} helper={sg.fields.payment_instructions_en.help} error={errors.payment_instructions_en}>
        <Textarea
          id="payment_instructions_en"
          lang="en"
          rows={5}
          maxLength={1000}
          value={values.payment_instructions_en}
          onChange={(e) => setValues((v) => ({ ...v, payment_instructions_en: e.target.value }))}
        />
      </Field>
      {!values.payment_instructions_en.trim() && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>{sg.emptyInstructions}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end border-t pt-5">
        <Button type="submit" pending={action.pending}>
          {sg.save}
        </Button>
      </div>
    </form>
  );
}
