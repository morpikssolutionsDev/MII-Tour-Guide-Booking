import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { t } from "@/i18n/id";
import { requireRole } from "@/server/session";
import { getBriefingMaterial, listPackageOptions } from "@/server/settings-queries";
import { BriefingForm } from "../briefing-form";

export const metadata: Metadata = { title: t.settings.briefing.edit };

export default async function EditBriefingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const [material, packages] = await Promise.all([getBriefingMaterial(id), listPackageOptions()]);
  if (!material) notFound();
  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t.settings.briefing.edit} />
      <BriefingForm initial={material} packages={packages} />
    </PageContainer>
  );
}
