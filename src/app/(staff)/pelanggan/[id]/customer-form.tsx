"use client";

import { useState } from "react";
import { CountrySelect } from "@/components/common/country-select";
import { Field, fieldAria } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { updateCustomer } from "@/server/bookings/actions";

type Customer = { id: string; name: string; phone: string; nationality: string; email: string; notes: string };

/** Editable customer profile; WhatsApp is checked for uniqueness (05 §3.7). */
export function CustomerForm({ customer }: { customer: Customer }) {
  const [values, setValues] = useState(customer);
  const action = useAction(updateCustomer, { successMessage: t.customers.saved });
  const e = action.fieldErrors;
  const cw = t.booking.wizard.customer;
  const set = (key: keyof Customer) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [key]: ev.target.value }));
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        action.run(values);
      }}
    >
      <Field id="cu-name" label={cw.name} required error={e.name}>
        <Input id="cu-name" value={values.name} onChange={set("name")} {...fieldAria("cu-name", e.name)} />
      </Field>
      <Field id="cu-phone" label={cw.phone} required error={e.phone}>
        <Input id="cu-phone" type="tel" value={values.phone} onChange={set("phone")} {...fieldAria("cu-phone", e.phone)} />
      </Field>
      <Field id="cu-nat" label={cw.nationality} required error={e.nationality}>
        <CountrySelect id="cu-nat" value={values.nationality} onChange={(nationality) => setValues((v) => ({ ...v, nationality }))} />
      </Field>
      <Field id="cu-email" label={cw.email} error={e.email}>
        <Input id="cu-email" type="email" value={values.email} onChange={set("email")} {...fieldAria("cu-email", e.email)} />
      </Field>
      <Field id="cu-notes" label={cw.notes} helper={cw.notesHelp}>
        <Textarea id="cu-notes" maxLength={500} value={values.notes} onChange={set("notes")} />
      </Field>
      <Button type="submit" pending={action.pending}>
        {t.common.save}
      </Button>
    </form>
  );
}
