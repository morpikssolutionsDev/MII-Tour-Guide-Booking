import { InactiveBadge, LanguagePill } from "@/components/common/badges";
import { t } from "@/i18n/id";
import { listLanguages } from "@/server/settings-queries";
import { LanguageActions, LanguageDialogButton } from "./languages-client";

/** 04 §3.2 */
export async function LanguagesSection() {
  const rows = await listLanguages();
  const sl = t.settings.languages;
  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <LanguageDialogButton />
      </div>
      <ul className="divide-y rounded-lg border bg-card shadow-card">
        {rows.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
            <LanguagePill code={l.code} name={l.nameId} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{l.nameId}</p>
              <p className="text-xs text-muted-foreground">
                {sl.colNameEn}: {l.nameEn} · {sl.colGuides}: {l.guideCount}
              </p>
            </div>
            {!l.isActive && <InactiveBadge />}
            <LanguageActions language={l} />
          </li>
        ))}
      </ul>
    </section>
  );
}
