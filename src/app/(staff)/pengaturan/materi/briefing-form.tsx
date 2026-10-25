"use client";

import { Eye, FileText, Link2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, fieldAria } from "@/components/common/field";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { RichTextEditor, RichTextView } from "@/components/common/rich-text";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { saveBriefingMaterial } from "@/server/settings-actions";

type Initial = {
  id: string;
  title: string;
  bodyHtml: string;
  linkUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  appliesToAll: boolean;
  packageIds: string[];
} | null;

const sb = t.settings.briefing;

/** 04 §3.4 briefing form (full page). */
export function BriefingForm({ initial, packages }: { initial: Initial; packages: { id: string; name: string; isActive: boolean }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [bodyHtml, setBodyHtml] = useState(initial?.bodyHtml ?? "");
  const [linkUrl, setLinkUrl] = useState(initial?.linkUrl ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [appliesToAll, setAppliesToAll] = useState(initial?.appliesToAll ?? true);
  const [packageIds, setPackageIds] = useState<string[]>(initial?.packageIds ?? []);
  const [preview, setPreview] = useState(false);
  const save = useAction(saveBriefingMaterial, {
    successMessage: sb.saved,
    onSuccess: () => router.push("/pengaturan?tab=materi"),
  });
  const errors = save.fieldErrors;
  const existingFile = initial?.fileUrl && !removeFile ? { url: initial.fileUrl, name: initial.fileName ?? "PDF" } : null;

  return (
    <form
      className="max-w-[800px] space-y-5 rounded-lg border bg-card p-5 shadow-card md:p-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save.run({
          id: initial?.id,
          title,
          bodyHtml,
          linkUrl,
          appliesToAll,
          packageIds,
          file: file ?? undefined,
          removeFile,
        });
      }}
    >
      <Field id="b-title" label={sb.title} required error={errors.title}>
        <Input id="b-title" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} {...fieldAria("b-title", errors.title)} />
      </Field>
      <Field id="b-body" label={sb.body} required error={errors.bodyHtml}>
        <RichTextEditor id="b-body" initialHtml={initial?.bodyHtml ?? ""} onChange={setBodyHtml} invalid={Boolean(errors.bodyHtml)} describedBy={errors.bodyHtml ? "b-body-error" : undefined} />
      </Field>
      <Field id="b-link" label={sb.link} helper={sb.linkHelp} error={errors.linkUrl}>
        <Input id="b-link" type="url" inputMode="url" placeholder="https://" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} {...fieldAria("b-link", errors.linkUrl)} />
      </Field>
      <Field id="b-file" label={sb.pdf} helper={sb.pdfHelp} error={errors.file}>
        {existingFile && !file ? (
          <div className="flex items-center gap-2 rounded-md border bg-surface-muted p-3 text-sm">
            <FileText className="size-4 text-danau-700" />
            <a href={existingFile.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate font-medium text-danau-700 hover:underline">
              {existingFile.name}
            </a>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={sb.removeFile} onClick={() => setRemoveFile(true)}>
              <X />
            </Button>
          </div>
        ) : (
          <label
            htmlFor="b-file"
            className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input-border bg-card p-4 text-sm hover:bg-kabut-50"
          >
            <FileText className="size-5 text-muted-foreground" />
            <span className="flex-1 truncate">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "Pilih file PDF"}</span>
            {file && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label={sb.removeFile} onClick={(e) => { e.preventDefault(); setFile(null); }}>
                <X />
              </Button>
            )}
            <input id="b-file" type="file" accept="application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        )}
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">
          {sb.scope} <span aria-hidden>*</span>
        </legend>
        <RadioGroup value={appliesToAll ? "all" : "some"} onValueChange={(v) => setAppliesToAll(v === "all")} className="flex gap-6">
          <div className="flex items-center gap-2">
            <RadioGroupItem id="scope-all" value="all" />
            <Label htmlFor="scope-all">{sb.allPackages}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="scope-some" value="some" />
            <Label htmlFor="scope-some">{sb.somePackages}</Label>
          </div>
        </RadioGroup>
        {!appliesToAll && (
          <div className="flex flex-wrap gap-4 rounded-md bg-surface-muted p-3">
            {packages.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <Checkbox
                  id={`pkg-${p.id}`}
                  checked={packageIds.includes(p.id)}
                  onCheckedChange={(v) => setPackageIds((ids) => (v ? [...ids, p.id] : ids.filter((x) => x !== p.id)))}
                />
                <Label htmlFor={`pkg-${p.id}`}>
                  {p.name}
                  {!p.isActive && ` ${t.common.inactiveSuffix}`}
                </Label>
              </div>
            ))}
          </div>
        )}
        {errors.packageIds && <p className="text-xs font-medium text-merah-700">{errors.packageIds}</p>}
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => setPreview(true)} className="sm:mr-auto">
          <Eye />
          {sb.preview}
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/pengaturan?tab=materi">{t.common.cancel}</Link>
        </Button>
        <Button type="submit" pending={save.pending}>
          {t.common.save}
        </Button>
      </div>

      <ResponsiveDialog open={preview} onOpenChange={setPreview} title={sb.preview} footer={<Button onClick={() => setPreview(false)}>{t.common.close}</Button>}>
        <BriefingCard title={title || sb.title} html={bodyHtml} linkUrl={linkUrl || null} fileUrl={file ? null : existingFile?.url ?? null} />
      </ResponsiveDialog>
    </form>
  );
}

/** How guides see a briefing item (08 §3.3). */
export function BriefingCard({ title, html, linkUrl, fileUrl }: { title: string; html: string; linkUrl: string | null; fileUrl: string | null }) {
  return (
    <article className="rounded-md border bg-card p-4">
      <h3 className="font-semibold">{title}</h3>
      <RichTextView html={html} className="mt-2" />
      {(linkUrl || fileUrl) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {linkUrl && (
            <Button variant="secondary" size="sm" asChild>
              <a href={linkUrl} target="_blank" rel="noopener noreferrer">
                <Link2 />
                {sb.openLink}
              </a>
            </Button>
          )}
          {fileUrl && (
            <Button variant="secondary" size="sm" asChild>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <FileText />
                {sb.openPdf}
              </a>
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
