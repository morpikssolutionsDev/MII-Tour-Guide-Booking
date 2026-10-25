"use client";

import { useState } from "react";
import { Field, fieldAria } from "@/components/common/field";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { resetUserPassword } from "@/server/users/actions";
import { OneTimePassword, PasswordGenerator } from "./password-fields";

/** 01 §3.4 */
export function ResetPasswordDialog({
  userId,
  name,
  open,
  onOpenChange,
}: {
  userId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState<{ email: string; password: string } | null>(null);
  const action = useAction(resetUserPassword, { successMessage: t.users.passwordReset, onSuccess: setShown });

  const close = (value: boolean) => {
    onOpenChange(value);
    if (!value) {
      setPassword("");
      setShown(null);
      action.reset();
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={close}
      title={shown ? t.users.oneTimeTitle : t.users.resetTitle(name)}
      description={shown ? t.users.oneTimeBody : undefined}
      footer={
        shown ? (
          <Button onClick={() => close(false)}>{t.common.close}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {t.common.cancel}
            </Button>
            <Button pending={action.pending} onClick={() => action.run({ id: userId, newPassword: password })}>
              {t.users.savePassword}
            </Button>
          </>
        )
      }
    >
      {shown ? (
        <OneTimePassword email={shown.email} password={shown.password} />
      ) : (
        <Field id="reset-password" label={t.users.newPassword} required error={action.fieldErrors.newPassword} helper={t.users.passwordMin}>
          <PasswordGenerator id="reset-password" value={password} onChange={setPassword} {...fieldAria("reset-password", action.fieldErrors.newPassword)} />
        </Field>
      )}
    </ResponsiveDialog>
  );
}
