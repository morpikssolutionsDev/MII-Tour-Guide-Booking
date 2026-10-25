// Price calculation (03-harga.md §5). Pure: the simulator and real bookings share it.
import { isoWeekday } from "./time";

export type AddonUnit = "per_booking" | "per_person";
export type PriceRuleType = "weekend" | "holiday";
export type PriceRuleKind = "percent" | "flat_per_guide";

export type PricingPackage = {
  id: string;
  name: string;
  pricePerGuide: number;
  maxPeoplePerGuide: number;
  includedAddonIds: string[];
  facilityNames: string[];
};

export type PricingAddon = {
  id: string;
  name: string;
  price: number;
  unit: AddonUnit;
};

export type PricingRule = {
  type: PriceRuleType;
  name: string;
  kind: PriceRuleKind;
  value: number;
  isActive: boolean;
};

export type PricingHoliday = { date: string; name: string };

export type AddonLine = {
  id: string;
  name: string;
  unit: AddonUnit;
  unitPrice: number;
  quantity: number;
  amount: number;
  included: boolean;
};

export type PriceSnapshot = {
  version: 1;
  calculatedAt: string;
  date: string;
  people: number;
  package: { id: string; name: string; pricePerGuide: number; maxPeoplePerGuide: number };
  guidesNeeded: number;
  packageSubtotal: number;
  surcharge: {
    ruleType: PriceRuleType;
    name: string;
    kind: PriceRuleKind;
    value: number;
    amount: number;
    holidayName?: string;
  } | null;
  addons: AddonLine[];
  facilities: string[];
  total: number;
};

/** BR-03-1 */
export function guidesNeededFor(people: number, maxPeoplePerGuide: number): number {
  if (people < 1) throw new Error("people must be at least 1");
  return Math.ceil(people / Math.max(1, maxPeoplePerGuide));
}

const roundHalfUp = (value: number) => Math.floor(value + 0.5);

export function calculatePrice(input: {
  date: string;
  people: number;
  pkg: PricingPackage;
  /** Add-ons chosen by staff; ones the package already includes are ignored (BR-03-5). */
  selectedAddonIds: string[];
  /** Lookup of every add-on that may appear (selected and included). */
  addons: PricingAddon[];
  rules: PricingRule[];
  holidays: PricingHoliday[];
  now?: Date;
}): PriceSnapshot {
  const { date, people, pkg } = input;
  const guidesNeeded = guidesNeededFor(people, pkg.maxPeoplePerGuide);
  const packageSubtotal = pkg.pricePerGuide * guidesNeeded; // BR-03-2

  // BR-03-3 / BR-03-4: candidates, highest amount wins, ties go to holiday.
  const holiday = input.holidays.find((h) => h.date === date);
  const weekday = isoWeekday(date);
  const candidates = input.rules
    .filter((rule) => rule.isActive)
    .filter((rule) => (rule.type === "weekend" ? weekday >= 6 : Boolean(holiday)))
    .map((rule) => ({
      rule,
      amount:
        rule.kind === "percent"
          ? roundHalfUp((packageSubtotal * rule.value) / 100)
          : rule.value * guidesNeeded,
    }))
    .sort((a, b) => b.amount - a.amount || (a.rule.type === "holiday" ? -1 : 1));
  const best = candidates[0];
  const surcharge = best
    ? {
        ruleType: best.rule.type,
        name: best.rule.name,
        kind: best.rule.kind,
        value: best.rule.value,
        amount: best.amount,
        ...(best.rule.type === "holiday" && holiday ? { holidayName: holiday.name } : {}),
      }
    : null;

  // BR-03-5: included add-ons first (Rp 0), then chargeable selections.
  const addonById = new Map(input.addons.map((a) => [a.id, a]));
  const included = new Set(pkg.includedAddonIds);
  const lines: AddonLine[] = [];
  for (const addonId of pkg.includedAddonIds) {
    const addon = addonById.get(addonId);
    if (!addon) continue;
    lines.push({ id: addon.id, name: addon.name, unit: addon.unit, unitPrice: 0, quantity: 1, amount: 0, included: true });
  }
  for (const addonId of new Set(input.selectedAddonIds)) {
    if (included.has(addonId)) continue;
    const addon = addonById.get(addonId);
    if (!addon) continue;
    const quantity = addon.unit === "per_person" ? people : 1;
    lines.push({
      id: addon.id,
      name: addon.name,
      unit: addon.unit,
      unitPrice: addon.price,
      quantity,
      amount: addon.price * quantity,
      included: false,
    });
  }

  const total = packageSubtotal + (surcharge?.amount ?? 0) + lines.reduce((sum, l) => sum + l.amount, 0); // BR-03-6

  return {
    version: 1,
    calculatedAt: (input.now ?? new Date()).toISOString(),
    date,
    people,
    package: {
      id: pkg.id,
      name: pkg.name,
      pricePerGuide: pkg.pricePerGuide,
      maxPeoplePerGuide: pkg.maxPeoplePerGuide,
    },
    guidesNeeded,
    packageSubtotal,
    surcharge,
    addons: lines,
    facilities: pkg.facilityNames,
    total,
  };
}
