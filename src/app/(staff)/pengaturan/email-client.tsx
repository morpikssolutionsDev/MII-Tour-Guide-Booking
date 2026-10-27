"use client";

import { CheckCircle2, Mail, Send, X, XCircle } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Pill } from "@/components/common/badges";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { saveEmailSettings, sendTestEmail } from "@/server/email/actions";

const se = t.emailSettings;
const MAX = 20;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Smtp = { configured: boolean; missing: string[]; host: string; port: number; from: string };

/** 12 §3.6 Pengaturan → Email. */
export function EmailSettingsForm({ initial, smtp }: { initial: { enabled: boolean; recipients: string[] }; smtp: Smtp }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [recipients, setRecipients] = useState(initial.recipients);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [results, setResults] = useState<{ email: string; ok: boolean; error?: string }[] | null>(null);
  const save = useAction(saveEmailSettings, { successMessage: se.saved });
  const test = useAction(sendTestEmail, { onSuccess: setResults, refresh: false });

  const add = (raw: string) => {
    const emails = raw.split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (emails.length === 0) return;
    const bad = emails.find((e) => !EMAIL.test(e));
    if (bad) {
      setDraftError(se.invalidEmail);
      return;
    }
    const next = [...new Set([...recipients, ...emails])];
    if (next.length > MAX) {
      setDraftError(se.tooMany(MAX));
      return;
    }
    setRecipients(next);
    setDraft("");
    setDraftError(null);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && recipients.length) {
      setRecipients(recipients.slice(0, -1));
    }
  };
  const pending = [...recipients, ...(EMAIL.test(draft.trim()) ? [draft.trim().toLowerCase()] : [])];

  return (
    <div className="max-w-2xl space-y-5">
      <section className="rounded-lg border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{se.connection}</h2>
          {smtp.configured ? (
            <Pill tone="rimba" icon={CheckCircle2}>
              {se.ready}
            </Pill>
          ) : (
            <Pill tone="merah" icon={XCircle}>
              {se.notConfiguredPill}
            </Pill>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {smtp.configured ? se.serverLine(smtp.host, smtp.port, smtp.from) : se.missing(smtp.missing.join(", "))}
        </p>
      </section>

      <section className="space-y-5 rounded-lg border bg-card p-5 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="email-enabled" className="font-semibold">
              {se.enabled}
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">{smtp.configured ? se.enabledHelp : se.disabledHint}</p>
          </div>
          <Switch id="email-enabled" checked={enabled && smtp.configured} disabled={!smtp.configured} onCheckedChange={setEnabled} />
        </div>

        <Field id="email-recipients" label={se.recipients} helper={se.recipientsHelp(MAX)} error={draftError ?? save.fieldErrors.recipients}>
          <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
            {recipients.map((email) => (
              <span key={email} className="inline-flex items-center gap-1 rounded-full bg-danau-50 py-0.5 pr-1 pl-2.5 text-sm text-danau-800">
                <Mail className="size-3.5" aria-hidden />
                {email}
                <button
                  type="button"
                  onClick={() => setRecipients(recipients.filter((r) => r !== email))}
                  className="rounded-full p-0.5 hover:bg-danau-100"
                  aria-label={se.removeRecipient(email)}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            <Input
              id="email-recipients"
              type="email"
              inputMode="email"
              value={draft}
              placeholder={recipients.length ? "" : se.recipientsPlaceholder}
              onChange={(e) => {
                setDraft(e.target.value);
                setDraftError(null);
              }}
              onKeyDown={onKey}
              onBlur={() => draft && add(draft)}
              className="h-8 min-w-48 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
            />
          </div>
        </Field>
        {enabled && recipients.length === 0 && <p className="text-sm font-medium text-senja-800">{se.needRecipientHint}</p>}

        <div className="flex flex-wrap gap-2">
          <Button pending={save.pending} onClick={() => save.run({ enabled: enabled && smtp.configured, recipients: pending })}>
            {t.common.save}
          </Button>
          <Button variant="secondary" pending={test.pending} disabled={!smtp.configured || pending.length === 0} onClick={() => test.run({ recipients: pending })}>
            <Send />
            {se.sendTest}
          </Button>
        </div>

        {results && (
          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">{se.testResult}</p>
            <ul className="space-y-1 text-sm">
              {results.map((r) => (
                <li key={r.email} className="flex items-start gap-2">
                  {r.ok ? <CheckCircle2 className="mt-0.5 size-4 text-rimba-600" aria-hidden /> : <XCircle className="mt-0.5 size-4 text-merah-700" aria-hidden />}
                  <span>
                    <span className="font-medium">{r.email}</span> · {r.ok ? se.sent : se.failed(r.error ?? "")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
