"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, fieldAria } from "@/components/common/field";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHANNELS, type Channel } from "@/db/schema";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { createUser, updateUser } from "@/server/users/actions";
import { OneTimePassword, PasswordGenerator } from "./password-fields";

type Initial = { id: string; name: string; email: string; role: "admin" | "staff"; defaultChannel: Channel | null } | null;

/** 01 §3.3 */
export function UserForm({ initial, isSelf = false }: { initial: Initial; isSelf?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState<"admin" | "staff">(initial?.role ?? "staff");
  const [channel, setChannel] = useState<Channel | "none">(initial?.defaultChannel ?? "none");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const create = useAction(createUser, { successMessage: t.users.created, onSuccess: setCreated, refresh: false });
  const update = useAction(updateUser, {
    successMessage: t.users.updated,
    onSuccess: () => router.push("/pengguna"),
  });
  const errors = initial ? update.fieldErrors : create.fieldErrors;
  const pending = create.pending || update.pending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const defaultChannel = role === "staff" && channel !== "none" ? channel : null;
    if (initial) update.run({ id: initial.id, name, email, role, defaultChannel });
    else create.run({ name, email, role, defaultChannel, password });
  };

  return (
    <>
      <form onSubmit={submit} className="max-w-[720px] space-y-5 rounded-lg border bg-card p-5 shadow-card md:p-6" noValidate>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="name" label={t.users.fieldName} required error={errors.name}>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} {...fieldAria("name", errors.name)} />
          </Field>
          <Field id="email" label={t.users.fieldEmail} required error={errors.email}>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} {...fieldAria("email", errors.email)} />
          </Field>
        </div>

        <fieldset className="space-y-2" disabled={isSelf}>
          <legend className="text-sm font-medium">
            {t.users.fieldRole} <span aria-hidden>*</span>
          </legend>
          <RadioGroup value={role} onValueChange={(v) => setRole(v as "admin" | "staff")} className="flex gap-6">
            {(["admin", "staff"] as const).map((r) => (
              <div key={r} className="flex items-center gap-2">
                <RadioGroupItem id={`role-${r}`} value={r} />
                <Label htmlFor={`role-${r}`}>{t.roles[r]}</Label>
              </div>
            ))}
          </RadioGroup>
          {isSelf && <p className="text-xs text-muted-foreground">{t.users.cannotSelf}</p>}
        </fieldset>

        {role === "staff" && (
          <Field id="channel" label={t.users.fieldChannel} className="md:max-w-xs">
            <Select value={channel} onValueChange={(v) => setChannel(v as Channel | "none")}>
              <SelectTrigger id="channel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t.channels[c]}
                  </SelectItem>
                ))}
                <SelectItem value="none">{t.users.channelNone}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        {!initial && (
          <Field id="password" label={t.users.fieldInitialPassword} required error={errors.password} helper={t.users.passwordMin}>
            <PasswordGenerator id="password" value={password} onChange={setPassword} {...fieldAria("password", errors.password)} />
          </Field>
        )}

        <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" asChild>
            <Link href="/pengguna">{t.common.cancel}</Link>
          </Button>
          <Button type="submit" pending={pending}>
            {t.common.save}
          </Button>
        </div>
      </form>

      <ResponsiveDialog
        open={created !== null}
        onOpenChange={(open) => !open && router.push("/pengguna")}
        title={t.users.oneTimeTitle}
        description={t.users.oneTimeBody}
        footer={<Button onClick={() => router.push("/pengguna")}>{t.common.close}</Button>}
      >
        {created && <OneTimePassword email={created.email} password={created.password} />}
      </ResponsiveDialog>
    </>
  );
}
