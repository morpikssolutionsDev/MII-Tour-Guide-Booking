import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { UrlTabs } from "@/components/common/url-tabs";
import { wibToday } from "@/domain/time";
import { t } from "@/i18n/id";
import { listAddons, listAllHolidays, listFacilities, listHolidays, listPackagesFull, listPriceRules } from "@/server/pricing/queries";
import { requireRole } from "@/server/session";
import { AddonsTab, FacilitiesTab, HolidaysTab, PackagesTab, RulesTab } from "./pricing-tabs";
import { Simulator } from "./simulator";

export const metadata: Metadata = { title: t.pricing.title };

const sp = t.pricing;
const TABS = [
  { value: "paket", label: sp.tabs.paket },
  { value: "addon", label: sp.tabs.addon },
  { value: "fasilitas", label: sp.tabs.fasilitas },
  { value: "aturan", label: sp.tabs.aturan },
  { value: "libur", label: sp.tabs.libur },
  { value: "simulasi", label: sp.tabs.simulasi },
];

/** 03 §3: admin edits; staff see every tab read-only and can use Simulasi. */
export default async function PricingPage({ searchParams }: { searchParams: Promise<{ tab?: string; tahun?: string }> }) {
  const me = await requireRole("admin", "staff");
  const params = await searchParams;
  const tab = TABS.some((x) => x.value === params.tab) ? params.tab! : "paket";
  const canEdit = me.role === "admin";
  const currentYear = Number(wibToday().slice(0, 4));
  const year = Number(params.tahun) >= 2000 && Number(params.tahun) <= 2100 ? Number(params.tahun) : currentYear;

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={sp.title} />
      <UrlTabs tabs={TABS} active={tab} />
      {tab === "paket" && (
        <PackagesTab
          canEdit={canEdit}
          packages={await listPackagesFull()}
          facilities={await listFacilities()}
          addons={await listAddons()}
        />
      )}
      {tab === "addon" && <AddonsTab canEdit={canEdit} addons={await listAddons()} />}
      {tab === "fasilitas" && <FacilitiesTab canEdit={canEdit} facilities={await listFacilities()} />}
      {tab === "aturan" && <RulesTab canEdit={canEdit} rules={await listPriceRules()} />}
      {tab === "libur" && <HolidaysTab canEdit={canEdit} year={year} currentYear={currentYear} holidays={await listHolidays(year)} />}
      {tab === "simulasi" && <SimulatorTab />}
    </PageContainer>
  );
}

async function SimulatorTab() {
  const [packages, addons, rules, holidays] = await Promise.all([listPackagesFull(), listAddons(), listPriceRules(), listAllHolidays()]);
  // Same active configuration as loadPricingInputs (BR-03-8).
  return (
    <Simulator
      today={wibToday()}
      packages={packages
        .filter((p) => p.isActive)
        .map((p) => ({
          id: p.id,
          name: p.name,
          pricePerGuide: p.pricePerGuide,
          maxPeoplePerGuide: p.maxPeoplePerGuide,
          includedAddonIds: p.includedAddons.filter((a) => a.isActive).map((a) => a.id),
          facilityNames: p.facilities.filter((f) => f.isActive).map((f) => f.name),
        }))}
      addons={addons.filter((a) => a.isActive).map((a) => ({ id: a.id, name: a.name, price: a.price, unit: a.unit }))}
      rules={rules.map((r) => ({ type: r.type, name: r.name, kind: r.kind, value: r.value, isActive: r.isActive }))}
      holidays={holidays}
    />
  );
}
