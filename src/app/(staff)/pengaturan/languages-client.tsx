"use client";

import { MoreVertical, Pencil, Plus, Power } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Field, fieldAria } from "@/components/common/field";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { countLanguageUsage, createLanguage, setLanguageActive, updateLanguage } from "@/server/settings-actions";

type Language = { id: string; code: string; nameId: string; nameEn: string; isActive: boolean };
const sl = t.settings.languages;

export function LanguageDialogButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {sl.add}
      </Button>
      {open && <LanguageDialog open={open} onOpenChange={setOpen} language={null} />}
    </>
  );
}

function LanguageDialog({ open, onOpenChange, language }: { open: boolean; onOpenChange: (v: boolean) => void; language: Language | null }) {
  const [values, setValues] = useState({ nameId: language?.nameId ?? "", nameEn: language?.nameEn ?? "", code: language?.code ?? "" });
  const opts = { successMessage: sl.saved, onSuccess: () => onOpenChange(false) };
  const create = useAction(createLanguage, opts);
  const update = useAction(updateLanguage, opts);
  const action = language ? update : create;
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const errors = action.fieldErrors;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={language ? sl.edit : sl.add}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button pending={action.pending} onClick={() => (language ? update.run({ id: language.id, ...values }) : create.run(values))}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="lang-name" label={sl.nameId} required helper={sl.nameIdHelp} error={errors.nameId}>
          <Input id="lang-name" value={values.nameId} onChange={set("nameId")} {...fieldAria("lang-name", errors.nameId)} />
        </Field>
        <Field id="lang-en" label={sl.nameEn} required helper={sl.nameEnHelp} error={errors.nameEn}>
          <Input id="lang-en" value={values.nameEn} onChange={set("nameEn")} {...fieldAria("lang-en", errors.nameEn)} />
        </Field>
        <Field id="lang-code" label={sl.code} required helper={sl.codeHelp} error={errors.code} className="max-w-32">
          <Input id="lang-code" value={values.code} maxLength={2} onChange={(e) => setValues((v) => ({ ...v, code: e.target.value.toLowerCase() }))} {...fieldAria("lang-code", errors.code)} />
        </Field>
      </div>
    </ResponsiveDialog>
  );
}

export function LanguageActions({ language }: { language: Language }) {
  const [editOpen, setEditOpen] = useState(false);
  const [warning, setWarning] = useState<number | null>(null);
  const toggle = useAction(setLanguageActive, { successMessage: sl.saved, onSuccess: () => setWarning(null) });
  const usage = useAction(countLanguageUsage, {
    refresh: false,
    onSuccess: (n) => (n > 0 ? setWarning(n) : toggle.run({ id: language.id, isActive: false })),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t.common.actions}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil />
            {t.common.edit}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => (language.isActive ? usage.run({ id: language.id }) : toggle.run({ id: language.id, isActive: true }))}
          >
            <Power />
            {language.isActive ? t.common.deactivate : t.common.activate}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editOpen && <LanguageDialog open={editOpen} onOpenChange={setEditOpen} language={language} />}
      {/* BR-04-4: allowed, with a warning when upcoming bookings use the language. */}
      <ConfirmDialog
        open={warning !== null}
        onOpenChange={(v) => !v && setWarning(null)}
        title={`${t.common.deactivate} ${language.nameId}?`}
        body={warning ? sl.deactivateWarn(warning) : undefined}
        confirmLabel={`Ya, ${t.common.deactivate.toLowerCase()}`}
        pending={toggle.pending}
        onConfirm={() => toggle.run({ id: language.id, isActive: false })}
      />
    </>
  );
}
