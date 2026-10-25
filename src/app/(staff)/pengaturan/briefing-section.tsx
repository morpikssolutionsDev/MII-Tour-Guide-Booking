import { FileText, Link2, Plus } from "lucide-react";
import Link from "next/link";
import { InactiveBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/id";
import { formatRelative } from "@/lib/format";
import { listBriefingMaterials } from "@/server/settings-queries";
import { BriefingActions } from "./briefing-actions";

/** 04 §3.4 */
export async function BriefingSection() {
  const rows = await listBriefingMaterials();
  const sb = t.settings.briefing;
  const now = new Date();
  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/pengaturan/materi/baru">
            <Plus />
            {sb.add}
          </Link>
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState decoration="castle" title={sb.empty} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card shadow-card">
          {rows.map((m) => (
            <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/pengaturan/materi/${m.id}`} className="font-semibold hover:underline">
                  {m.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sb.colScope}: {m.appliesToAll ? sb.allPackages : m.packages.map((p) => p.name).join(", ")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.common.lastUpdated} {formatRelative(m.updatedAt, now)}
                  {m.updatedByName ? ` ${t.common.by} ${m.updatedByName}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {m.linkUrl && <Link2 className="size-4" aria-label={sb.link} />}
                {m.fileUrl && <FileText className="size-4" aria-label={sb.pdf} />}
              </div>
              {!m.isActive && <InactiveBadge />}
              <BriefingActions id={m.id} isActive={m.isActive} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
