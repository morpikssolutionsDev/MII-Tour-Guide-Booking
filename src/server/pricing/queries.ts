import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, type Executor } from "@/db/client";
import { addons, facilities, holidays, packageFacilities, packageIncludedAddons, packages, priceRules } from "@/db/schema";
import type { PricingAddon, PricingHoliday, PricingPackage, PricingRule } from "@/domain/pricing";

/** Packages with their facilities and included add-ons (03 §3.1). */
export async function listPackagesFull(ex: Executor = db) {
  const [rows, pf, pia] = await Promise.all([
    ex.select().from(packages).orderBy(asc(packages.sortOrder), asc(packages.name)),
    ex
      .select({ packageId: packageFacilities.packageId, facility: facilities })
      .from(packageFacilities)
      .innerJoin(facilities, eq(facilities.id, packageFacilities.facilityId))
      .orderBy(asc(facilities.sortOrder)),
    ex
      .select({ packageId: packageIncludedAddons.packageId, addon: addons })
      .from(packageIncludedAddons)
      .innerJoin(addons, eq(addons.id, packageIncludedAddons.addonId))
      .orderBy(asc(addons.sortOrder)),
  ]);
  return rows.map((p) => ({
    ...p,
    facilities: pf.filter((x) => x.packageId === p.id).map((x) => x.facility),
    includedAddons: pia.filter((x) => x.packageId === p.id).map((x) => x.addon),
  }));
}

export type PackageFull = Awaited<ReturnType<typeof listPackagesFull>>[number];

export async function listAddons(ex: Executor = db) {
  const [rows, pia] = await Promise.all([
    ex.select().from(addons).orderBy(asc(addons.sortOrder), asc(addons.name)),
    ex
      .select({ addonId: packageIncludedAddons.addonId, packageName: packages.name })
      .from(packageIncludedAddons)
      .innerJoin(packages, eq(packages.id, packageIncludedAddons.packageId)),
  ]);
  return rows.map((a) => ({ ...a, includedIn: pia.filter((x) => x.addonId === a.id).map((x) => x.packageName) }));
}

export async function listFacilities(ex: Executor = db) {
  const [rows, pf] = await Promise.all([
    ex.select().from(facilities).orderBy(asc(facilities.sortOrder), asc(facilities.name)),
    ex
      .select({ facilityId: packageFacilities.facilityId, packageName: packages.name })
      .from(packageFacilities)
      .innerJoin(packages, eq(packages.id, packageFacilities.packageId)),
  ]);
  return rows.map((f) => ({ ...f, usedIn: pf.filter((x) => x.facilityId === f.id).map((x) => x.packageName) }));
}

export async function listPriceRules(ex: Executor = db) {
  return ex.select().from(priceRules).orderBy(asc(priceRules.type));
}

export async function listHolidays(year: number, ex: Executor = db) {
  return ex
    .select()
    .from(holidays)
    .where(and(gte(holidays.date, `${year}-01-01`), lte(holidays.date, `${year}-12-31`)))
    .orderBy(asc(holidays.date));
}

export async function listAllHolidays(ex: Executor = db): Promise<PricingHoliday[]> {
  return ex.select({ date: holidays.date, name: holidays.name }).from(holidays);
}

/**
 * Everything calculatePrice needs. Inactive add-ons and facilities are left out (BR-03-8);
 * `packageId` is loaded even when inactive so existing bookings can be re-priced.
 */
export async function loadPricingInputs(ex: Executor, packageId: string) {
  const [all, addonRows, rules, hols] = await Promise.all([
    listPackagesFull(ex),
    ex.select().from(addons).where(eq(addons.isActive, true)),
    listPriceRules(ex),
    listAllHolidays(ex),
  ]);
  const pkg = all.find((p) => p.id === packageId);
  if (!pkg) return null;
  const pricingPackage: PricingPackage = {
    id: pkg.id,
    name: pkg.name,
    pricePerGuide: pkg.pricePerGuide,
    maxPeoplePerGuide: pkg.maxPeoplePerGuide,
    includedAddonIds: pkg.includedAddons.filter((a) => a.isActive).map((a) => a.id),
    facilityNames: pkg.facilities.filter((f) => f.isActive).map((f) => f.name),
  };
  const pricingAddons: PricingAddon[] = addonRows.map((a) => ({ id: a.id, name: a.name, price: a.price, unit: a.unit }));
  const pricingRules: PricingRule[] = rules.map((r) => ({ type: r.type, name: r.name, kind: r.kind, value: r.value, isActive: r.isActive }));
  return { pkg: pricingPackage, packageIsActive: pkg.isActive, addons: pricingAddons, rules: pricingRules, holidays: hols };
}

