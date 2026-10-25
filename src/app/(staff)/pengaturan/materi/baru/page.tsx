import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { t } from "@/i18n/id";
import { requireRole } from "@/server/session";
import { listPackageOptions } from "@/server/settings-queries";
import { BriefingForm } from "../briefing-form";

export const metadata: Metadata = { title: t.settings.briefing.add };

export default async function NewBriefingPage() {
  await requireRole("admin");
  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t.settings.briefing.add} />
      <BriefingForm initial={null} packages={await listPackageOptions()} />
    </PageContainer>
  );
}
