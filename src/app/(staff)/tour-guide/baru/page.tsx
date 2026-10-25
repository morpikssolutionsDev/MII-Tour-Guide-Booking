import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { t } from "@/i18n/id";
import { listLanguages } from "@/server/settings-queries";
import { requireRole } from "@/server/session";
import { GuideForm } from "../guide-form";

export const metadata: Metadata = { title: t.guides.add };

export default async function NewGuidePage() {
  await requireRole("admin");
  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t.guides.add} />
      <GuideForm initial={null} languages={await listLanguages()} />
    </PageContainer>
  );
}
