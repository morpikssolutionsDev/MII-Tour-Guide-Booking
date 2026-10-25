"use client";

import { UserCheck } from "lucide-react";
import { ReturningBadge } from "@/components/common/badges";
import { CountrySelect } from "@/components/common/country-select";
import { Field, fieldAria } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CHANNELS, type Channel } from "@/db/schema";
import { t } from "@/i18n/id";
import { formatDateMedium } from "@/lib/format";
import type { CustomerForm } from "./types";

export type CustomerLookup = {
  name: string;
  visits: number;
  lastVisit: string | null;
  applied: boolean;
  data?: { name: string; nationality: string; email: string | null; notes: string | null };
};

const cw = t.booking.wizard.customer;

/** 05 §3.2 step 1 "Pelanggan". */
export function StepCustomer({
  customer,
  onChange,
  channel,
  onChannel,
  lookup,
  onLookup,
  onApplyLookup,
  errors,
}: {
  customer: CustomerForm;
  onChange: (patch: Partial<CustomerForm>) => void;
  channel: Channel;
  onChannel: (c: Channel) => void;
  lookup: CustomerLookup | null;
  onLookup: () => void;
  onApplyLookup: () => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field id="c-phone" label={cw.phone} required error={errors["customer.phone"]} className="md:col-span-2">
        <Input
          id="c-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+966 50 123 4567"
          value={customer.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          onBlur={onLookup}
          className="md:max-w-sm"
          {...fieldAria("c-phone", errors["customer.phone"])}
        />
      </Field>

      {lookup && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-senja-200 bg-senja-50 p-3 md:col-span-2">
          <UserCheck className="size-5 text-senja-800" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-senja-800">
              {cw.found}: {lookup.name}
            </p>
            {lookup.lastVisit && <p className="text-xs text-senja-800">{cw.lastVisit(formatDateMedium(lookup.lastVisit))}</p>}
          </div>
          {lookup.visits > 0 && <ReturningBadge visits={lookup.visits} />}
          {!lookup.applied && (
            <Button type="button" size="sm" variant="secondary" onClick={onApplyLookup}>
              {cw.useData}
            </Button>
          )}
          {lookup.applied && lookup.data && <p className="w-full text-xs text-senja-800">{cw.updateNotice}</p>}
        </div>
      )}

      <Field id="c-name" label={cw.name} required error={errors["customer.name"]}>
        <Input id="c-name" autoComplete="name" value={customer.name} onChange={(e) => onChange({ name: e.target.value })} {...fieldAria("c-name", errors["customer.name"])} />
      </Field>
      <Field id="c-nat" label={cw.nationality} required error={errors["customer.nationality"]}>
        <CountrySelect id="c-nat" value={customer.nationality} onChange={(nationality) => onChange({ nationality })} invalid={Boolean(errors["customer.nationality"])} />
      </Field>
      <Field id="c-email" label={cw.email} error={errors["customer.email"]}>
        <Input id="c-email" type="email" autoComplete="email" value={customer.email} onChange={(e) => onChange({ email: e.target.value })} {...fieldAria("c-email", errors["customer.email"])} />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">
          {cw.channel} <span aria-hidden>*</span>
        </legend>
        <ToggleGroup type="single" variant="outline" value={channel} onValueChange={(v) => v && onChannel(v as Channel)} className="w-full">
          {CHANNELS.map((c) => (
            <ToggleGroupItem key={c} value={c} className="h-11 flex-1 text-xs data-[state=on]:bg-danau-50 data-[state=on]:text-danau-800 md:h-10">
              {t.channels[c]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>
      <Field id="c-notes" label={cw.notes} helper={cw.notesHelp} className="md:col-span-2">
        <Textarea id="c-notes" maxLength={500} value={customer.notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </Field>
    </div>
  );
}
