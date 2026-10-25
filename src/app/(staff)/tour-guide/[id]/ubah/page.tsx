import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { formatPhone } from "@/domain/phone";
import { t } from "@/i18n/id";
import { getGuideDetail } from "@/server/guides/queries";
import { listLanguages } from "@/server/settings-queries";
import { requireRole } from "@/server/session";
import { GuideForm } from "../../guide-form";

export const metadata: Metadata = { title: t.guides.edit };

export default async function EditGuidePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const [detail, languages] = await Promise.all([getGuideDetail(id), listLanguages()]);
  if (!detail) notFound();
  const g = detail.guide;
  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t.guides.edit} description={g.fullName} />
      <GuideForm
        languages={languages}
        initial={{
          id: g.id,
          fullName: g.fullName,
          displayName: g.displayName,
          phone: formatPhone(g.phoneE164),
          notes: g.notes,
          photoUrl: g.photoUrl,
          languageIds: detail.languages.map((l) => l.id),
          weekdays: detail.weekdays,
        }}
      />
    </PageContainer>
  );
}
