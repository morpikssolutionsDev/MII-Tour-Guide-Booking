"use client";

import { Dices } from "lucide-react";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n/id";

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePassword(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Password input with "Buat acak" and copy (01 §3.3). */
export function PasswordGenerator({
  id,
  value,
  onChange,
  ...aria
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <div className="flex gap-2">
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" className="font-mono" {...aria} />
      <Button type="button" variant="secondary" onClick={() => onChange(generatePassword())}>
        <Dices />
        {t.users.generate}
      </Button>
      <CopyButton value={value} iconOnly />
    </div>
  );
}

/** Shown once after create / reset (01 §3.3). */
export function OneTimePassword({ email, password }: { email: string; password: string }) {
  return (
    <dl className="space-y-3 rounded-md bg-surface-muted p-4 text-sm">
      <div>
        <dt className="text-xs font-medium text-muted-foreground">{t.users.fieldEmail}</dt>
        <dd className="font-medium">{email}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-muted-foreground">{t.auth.password}</dt>
        <dd className="flex items-center gap-2">
          <code className="text-base font-semibold">{password}</code>
          <CopyButton value={`${email}\n${password}`} iconOnly />
        </dd>
      </div>
    </dl>
  );
}
