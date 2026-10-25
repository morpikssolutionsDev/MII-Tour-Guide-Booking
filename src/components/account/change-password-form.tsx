"use client";

import { useState } from "react";
import { Field, fieldAria } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { changeOwnPassword } from "@/server/auth-actions";

/** 01 §3.5 "Ubah kata sandi" */
export function ChangePasswordForm() {
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", repeatPassword: "" });
  const action = useAction(changeOwnPassword, {
    successMessage: t.account.changed,
    onSuccess: () => setValues({ currentPassword: "", newPassword: "", repeatPassword: "" }),
  });
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const errors = action.fieldErrors;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        action.run(values);
      }}
    >
      <Field id="currentPassword" label={t.account.currentPassword} required error={errors.currentPassword}>
        <Input id="currentPassword" type="password" autoComplete="current-password" value={values.currentPassword} onChange={set("currentPassword")} {...fieldAria("currentPassword", errors.currentPassword)} />
      </Field>
      <Field id="newPassword" label={t.account.newPassword} required error={errors.newPassword} helper={t.users.passwordMin}>
        <Input id="newPassword" type="password" autoComplete="new-password" value={values.newPassword} onChange={set("newPassword")} {...fieldAria("newPassword", errors.newPassword)} />
      </Field>
      <Field id="repeatPassword" label={t.account.repeatPassword} required error={errors.repeatPassword}>
        <Input id="repeatPassword" type="password" autoComplete="new-password" value={values.repeatPassword} onChange={set("repeatPassword")} {...fieldAria("repeatPassword", errors.repeatPassword)} />
      </Field>
      <Button type="submit" pending={action.pending}>
        {t.account.submit}
      </Button>
    </form>
  );
}
