import { describe, expect, it } from "vitest";
import { calculatePrice, guidesNeededFor, type PricingAddon, type PricingPackage, type PricingRule } from "./pricing";

const fastTrack: PricingAddon = { id: "ft", name: "Fast Track (Angling)", price: 50_000, unit: "per_person" };
const photo: PricingAddon = { id: "doc", name: "Dokumentasi foto", price: 150_000, unit: "per_booking" };
const addons = [fastTrack, photo];

const reguler: PricingPackage = {
  id: "reg",
  name: "Reguler",
  pricePerGuide: 500_000,
  maxPeoplePerGuide: 8,
  includedAddonIds: [],
  facilityNames: ["Snack"],
};
const premium: PricingPackage = { ...reguler, id: "pre", name: "Premium", pricePerGuide: 750_000, includedAddonIds: ["ft"] };
const vip: PricingPackage = { ...reguler, id: "vip", name: "VIP Private", pricePerGuide: 1_200_000, maxPeoplePerGuide: 4 };

const weekend: PricingRule = { type: "weekend", name: "Akhir pekan", kind: "percent", value: 20, isActive: true };
const holiday: PricingRule = { type: "holiday", name: "Hari libur nasional", kind: "percent", value: 25, isActive: true };
const rules = [weekend, holiday];

const WEEKDAY = "2026-11-04"; // Rabu
const SATURDAY = "2026-11-07";

const price = (over: Partial<Parameters<typeof calculatePrice>[0]>) =>
  calculatePrice({ date: WEEKDAY, people: 12, pkg: reguler, selectedAddonIds: [], addons, rules, holidays: [], ...over });

describe("guides needed (BR-03-1)", () => {
  it("rounds up per package maximum", () => {
    expect(guidesNeededFor(8, 8)).toBe(1);
    expect(guidesNeededFor(9, 8)).toBe(2);
    expect(guidesNeededFor(6, 4)).toBe(2);
  });
});

describe("calculatePrice", () => {
  it("AC1: 12 people Reguler on a weekday → 2 guides, Rp 1.000.000", () => {
    const p = price({});
    expect(p.guidesNeeded).toBe(2);
    expect(p.total).toBe(1_000_000);
    expect(p.surcharge).toBeNull();
  });

  it("AC2: weekend +20% on the package subtotal", () => {
    const p = price({ date: SATURDAY });
    expect(p.surcharge?.amount).toBe(200_000);
    expect(p.total).toBe(1_200_000);
  });

  it("AC3: a Saturday holiday applies only the higher (holiday) surcharge", () => {
    const p = price({ date: SATURDAY, people: 8, holidays: [{ date: SATURDAY, name: "Hari Pahlawan" }] });
    expect(p.surcharge?.ruleType).toBe("holiday");
    expect(p.surcharge?.amount).toBe(125_000);
    expect(p.surcharge?.holidayName).toBe("Hari Pahlawan");
  });

  it("AC4: surcharge never applies to add-ons", () => {
    const p = price({ date: SATURDAY, selectedAddonIds: ["ft", "doc"] });
    expect(p.total).toBe(1_000_000 + 200_000 + 600_000 + 150_000);
  });

  it("AC5: an add-on the package includes is listed once at Rp 0", () => {
    const p = price({ pkg: premium, selectedAddonIds: ["ft"] });
    const ft = p.addons.filter((a) => a.id === "ft");
    expect(ft).toHaveLength(1);
    expect(ft[0]).toMatchObject({ included: true, amount: 0 });
    expect(p.total).toBe(1_500_000);
  });

  it("AC7: flat per-guide surcharge multiplies by guides", () => {
    const flat: PricingRule = { ...weekend, kind: "flat_per_guide", value: 100_000 };
    const p = price({ date: "2026-11-08", rules: [flat, holiday] });
    expect(p.surcharge?.amount).toBe(200_000);
  });

  it("compares amounts across kinds: flat 200.000 loses to holiday 250.000", () => {
    const flat: PricingRule = { ...weekend, kind: "flat_per_guide", value: 100_000 };
    const p = price({ date: SATURDAY, rules: [flat, holiday], holidays: [{ date: SATURDAY, name: "Libur" }] });
    expect(p.surcharge).toMatchObject({ ruleType: "holiday", amount: 250_000 });
  });

  it("ignores inactive rules", () => {
    const p = price({ date: SATURDAY, rules: [{ ...weekend, isActive: false }, holiday] });
    expect(p.surcharge).toBeNull();
  });

  it("VIP Private for 6 people needs 2 guides", () => {
    expect(price({ pkg: vip, people: 6 }).packageSubtotal).toBe(2_400_000);
  });

  it("on a tie the holiday rule wins", () => {
    const p = price({
      date: SATURDAY,
      rules: [{ ...weekend, value: 25 }, holiday],
      holidays: [{ date: SATURDAY, name: "Libur" }],
    });
    expect(p.surcharge?.ruleType).toBe("holiday");
  });
});
