import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { UrlTabs } from "@/components/common/url-tabs";
import { t } from "@/i18n/id";
import { requireRole } from "@/server/session";
import { BriefingSection } from "./briefing-section";
import { ChecklistSection } from "./checklist-section";
import { EmailSection } from "./email-section";
import { GeneralSection } from "./general-section";
import { LanguagesSection } from "./languages-section";
import { SlotsSection } from "./slots-section";

export const metadata: Metadata = { title: t.settings.title };

const TABS = [
  { value: "slot", label: t.settings.tabs.slot },
  { value: "bahasa", label: t.settings.tabs.bahasa },
  { value: "daftar-periksa", label: t.settings.tabs.checklist },
  { value: "materi", label: t.settings.tabs.briefing },
  { value: "umum", label: t.settings.tabs.umum },
  { value: "email", label: t.emailSettings.tab },
];

/** 04 §3: admin-only tabbed settings. */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("admin");
  const { tab: requested } = await searchParams;
  const tab = TABS.some((x) => x.value === requested) ? requested! : "slot";

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t.settings.title} />
      <UrlTabs tabs={TABS} active={tab} />
      {tab === "slot" && <SlotsSection />}
      {tab === "bahasa" && <LanguagesSection />}
      {tab === "daftar-periksa" && <ChecklistSection />}
      {tab === "materi" && <BriefingSection />}
      {tab === "umum" && <GeneralSection />}
      {tab === "email" && <EmailSection />}
    </PageContainer>
  );
}
