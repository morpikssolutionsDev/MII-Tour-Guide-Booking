"use client";

/* eslint-disable @next/next/no-img-element */
import { ImagePlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConflictList, isBookingRefs } from "@/components/common/conflict-list";
import { Field, fieldAria } from "@/components/common/field";
import { GuideAvatar } from "@/components/common/guide-bits";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { cn } from "@/lib/utils";
import { createGuide, updateGuide } from "@/server/guides/actions";
import { OneTimePassword, PasswordGenerator } from "@/app/(staff)/pengguna/password-fields";

type Initial = {
  id: string;
  fullName: string;
  displayName: string;
  phone: string;
  notes: string | null;
  photoUrl: string | null;
  languageIds: string[];
  weekdays: number[];
} | null;

const sg = t.guides;

/** 02 §3.3: profile, languages, working days and (on create) the portal login. */
export function GuideForm({ initial, languages }: { initial: Initial; languages: { id: string; nameId: string; code: string; isActive: boolean }[] }) {
  const router = useRouter();
  const [values, setValues] = useState({
    fullName: initial?.fullName ?? "",
    displayName: initial?.displayName ?? "",
    phone: initial?.phone ?? "",
    notes: initial?.notes ?? "",
  });
  const [languageIds, setLanguageIds] = useState(initial?.languageIds ?? []);
  const [weekdays, setWeekdays] = useState(initial?.weekdays ?? [1, 2, 3, 4, 5, 6, 7]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<{ id: string; email: string; password: string } | null>(null);

  const create = useAction(createGuide, { successMessage: sg.created, onSuccess: setCreated, refresh: false });
  const update = useAction(updateGuide, {
    successMessage: sg.updated,
    quiet: ["CONFLICT"],
    onSuccess: () => router.push(`/tour-guide/${initial?.id}`),
  });
  const action = initial ? update : create;
  const errors = action.fieldErrors;
  const conflicts = update.failure?.code === "CONFLICT" && isBookingRefs(update.failure.details) ? update.failure.details : null;
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const objectUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);
  const previewUrl = objectUrl ?? (removePhoto ? null : initial?.photoUrl ?? null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const common = { ...values, languageIds, weekdays, photo: photo ?? undefined };
    if (initial) update.run({ id: initial.id, ...common, removePhoto });
    else create.run({ ...common, email, password });
  };

  return (
    <>
      <form onSubmit={submit} noValidate className="max-w-[880px] space-y-5">
        <Section title={sg.sections.profile}>
          <div className="flex items-center gap-4 md:col-span-2">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="size-16 rounded-full object-cover" />
            ) : (
              <GuideAvatar name={values.fullName || "?"} size={64} />
            )}
            <div className="space-y-1">
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" asChild>
                  <label htmlFor="photo" className="cursor-pointer">
                    <ImagePlus />
                    {sg.fields.photo}
                  </label>
                </Button>
                {previewUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setPhoto(null); setRemovePhoto(true); }}>
                    <X />
                    {t.common.delete}
                  </Button>
                )}
              </div>
              <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); setRemovePhoto(false); }} />
              <p className={cn("text-xs font-medium", errors.photo ? "text-merah-700" : "text-muted-foreground")}>{errors.photo ?? sg.fields.photoHelp}</p>
            </div>
          </div>
          <Field id="fullName" label={sg.fields.fullName} required error={errors.fullName}>
            <Input id="fullName" value={values.fullName} onChange={set("fullName")} {...fieldAria("fullName", errors.fullName)} />
          </Field>
          <Field id="displayName" label={sg.fields.displayName} required helper={sg.fields.displayNameHelp} error={errors.displayName}>
            <Input id="displayName" maxLength={30} value={values.displayName} onChange={set("displayName")} {...fieldAria("displayName", errors.displayName)} />
          </Field>
          <Field id="phone" label={sg.fields.phone} required error={errors.phone}>
            <Input id="phone" type="tel" inputMode="tel" placeholder="0812-3456-7890" value={values.phone} onChange={set("phone")} {...fieldAria("phone", errors.phone)} />
          </Field>
          <Field id="notes" label={sg.fields.notes} error={errors.notes} className="md:col-span-2">
            <Textarea id="notes" maxLength={1000} value={values.notes} onChange={set("notes")} />
          </Field>
        </Section>

        <Section title={sg.sections.languages}>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm font-medium">
              {sg.fields.languages} <span aria-hidden>*</span>
            </legend>
            <div className="flex flex-wrap gap-4">
              {languages.filter((l) => l.isActive || languageIds.includes(l.id)).map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`lang-${l.id}`}
                    checked={languageIds.includes(l.id)}
                    onCheckedChange={(v) => setLanguageIds((ids) => (v ? [...ids, l.id] : ids.filter((x) => x !== l.id)))}
                  />
                  <Label htmlFor={`lang-${l.id}`}>
                    {l.nameId}
                    {!l.isActive && ` ${t.common.inactiveSuffix}`}
                  </Label>
                </div>
              ))}
            </div>
            {errors.languageIds && <p className="mt-2 text-xs font-medium text-merah-700">{errors.languageIds}</p>}
          </fieldset>
        </Section>

        <Section title={sg.sections.workdays}>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm font-medium">
              {sg.fields.workdays} <span aria-hidden>*</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {t.weekdays.map((day, i) => {
                const value = i + 1;
                const on = weekdays.includes(value);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWeekdays((d) => (on ? d.filter((x) => x !== value) : [...d, value].sort()))}
                    className={cn(
                      "h-11 min-w-20 rounded-md border px-3 text-sm font-medium transition-colors",
                      on ? "border-rimba-600 bg-rimba-600 text-white" : "border-input-border bg-card hover:bg-kabut-50",
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            {errors.weekdays && <p className="mt-2 text-xs font-medium text-merah-700">{errors.weekdays}</p>}
          </fieldset>
        </Section>

        {!initial && (
          <Section title={sg.sections.account}>
            <Field id="email" label={sg.fields.email} required error={errors.email}>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} {...fieldAria("email", errors.email)} />
            </Field>
            <Field id="password" label={sg.fields.password} required error={errors.password} helper={t.users.passwordMin}>
              <PasswordGenerator id="password" value={password} onChange={setPassword} {...fieldAria("password", errors.password)} />
            </Field>
          </Section>
        )}

        {conflicts && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertDescription>{sg.errors.conflict(conflicts.length)}</AlertDescription>
            </Alert>
            <ConflictList conflicts={conflicts} />
          </div>
        )}

        <div className="sticky bottom-[72px] flex flex-col-reverse gap-2 rounded-lg border bg-card/95 p-3 backdrop-blur sm:flex-row sm:justify-end md:static md:border-0 md:bg-transparent md:p-0">
          <Button variant="secondary" asChild>
            <Link href={initial ? `/tour-guide/${initial.id}` : "/tour-guide"}>{t.common.cancel}</Link>
          </Button>
          <Button type="submit" pending={action.pending}>
            {t.common.save}
          </Button>
        </div>
      </form>

      <ResponsiveDialog
        open={created !== null}
        onOpenChange={(open) => !open && created && router.push(`/tour-guide/${created.id}`)}
        title={t.users.oneTimeTitle}
        description={t.users.oneTimeBody}
        footer={<Button onClick={() => created && router.push(`/tour-guide/${created.id}`)}>{t.common.close}</Button>}
      >
        {created && <OneTimePassword email={created.email} password={created.password} />}
      </ResponsiveDialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-card md:p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="grid gap-5 md:grid-cols-2">{children}</div>
    </section>
  );
}
