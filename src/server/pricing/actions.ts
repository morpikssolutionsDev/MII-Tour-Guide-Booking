"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { ADDON_UNITS, addons, facilities, holidays, packageFacilities, packageIncludedAddons, packages, PRICE_RULE_KINDS, priceRules } from "@/db/schema";
import { calculatePrice } from "@/domain/pricing";
import { isValidDate } from "@/domain/time";
import { t } from "@/i18n/id";
import { ActionError, defineAction, fieldError } from "../action";
import { FACILITY_ICONS } from "@/lib/facility-icons";
import { loadPricingInputs } from "./queries";

const sp = t.pricing;
const money = z.number().int().min(0).max(1_000_000_000);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

/* ---------------- Packages (03 §3.1) ---------------- */

const packageInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(40),
  description: optionalText(160),
  pricePerGuide: money,
  maxPeoplePerGuide: z.number().int().min(1).max(50),
  facilityIds: z.array(z.string()),
  includedAddonIds: z.array(z.string()),
  sortOrder: z.number().int().min(0).max(999),
});

export const savePackage = defineAction({ roles: ["admin"], input: packageInput }, async (input) => {
  const clash = await db.query.packages.findFirst({
    where: and(eq(packages.name, input.name), eq(packages.isActive, true), input.id ? ne(packages.id, input.id) : undefined),
    columns: { id: true },
  });
  if (clash) throw fieldError("name", sp.packages.nameTaken);
  const values = {
    name: input.name,
    description: input.description,
    pricePerGuide: input.pricePerGuide,
    maxPeoplePerGuide: input.maxPeoplePerGuide,
    sortOrder: input.sortOrder,
  };
  await db.transaction(async (tx) => {
    let id = input.id;
    if (id) await tx.update(packages).set(values).where(eq(packages.id, id));
    else id = (await tx.insert(packages).values(values).returning({ id: packages.id }))[0].id;
    await tx.delete(packageFacilities).where(eq(packageFacilities.packageId, id));
    if (input.facilityIds.length) await tx.insert(packageFacilities).values(input.facilityIds.map((facilityId) => ({ packageId: id!, facilityId })));
    await tx.delete(packageIncludedAddons).where(eq(packageIncludedAddons.packageId, id));
    if (input.includedAddonIds.length) await tx.insert(packageIncludedAddons).values(input.includedAddonIds.map((addonId) => ({ packageId: id!, addonId })));
  });
  return null;
});

export const setPackageActive = defineAction(
  { roles: ["admin"], input: z.object({ id: z.string(), isActive: z.boolean() }) },
  async (input) => {
    if (input.isActive) {
      const pkg = await db.query.packages.findFirst({ where: eq(packages.id, input.id) });
      const clash = pkg && (await db.query.packages.findFirst({ where: and(eq(packages.name, pkg.name), eq(packages.isActive, true), ne(packages.id, pkg.id)) }));
      if (clash) throw new ActionError("CONFLICT", sp.packages.nameTaken);
    }
    await db.update(packages).set({ isActive: input.isActive }).where(eq(packages.id, input.id));
    return null;
  },
);

/* ---------------- Add-ons (03 §3.2) ---------------- */

export const saveAddon = defineAction(
  {
    roles: ["admin"],
    input: z.object({
      id: z.string().optional(),
      name: z.string().trim().min(2).max(40),
      description: optionalText(160),
      price: money,
      unit: z.enum(ADDON_UNITS),
      sortOrder: z.number().int().min(0).max(999),
    }),
  },
  async ({ id, ...values }) => {
    const clash = await db.query.addons.findFirst({
      where: and(eq(addons.name, values.name), eq(addons.isActive, true), id ? ne(addons.id, id) : undefined),
      columns: { id: true },
    });
    if (clash) throw fieldError("name", sp.addons.nameTaken);
    if (id) await db.update(addons).set(values).where(eq(addons.id, id));
    else await db.insert(addons).values(values);
    return null;
  },
);

export const setAddonActive = defineAction({ roles: ["admin"], input: z.object({ id: z.string(), isActive: z.boolean() }) }, async (input) => {
  await db.update(addons).set({ isActive: input.isActive }).where(eq(addons.id, input.id));
  return null;
});

/* ---------------- Facilities (03 §3.3) ---------------- */

export const saveFacility = defineAction(
  {
    roles: ["admin"],
    input: z.object({
      id: z.string().optional(),
      name: z.string().trim().min(2).max(40),
      icon: z.enum(FACILITY_ICONS),
      sortOrder: z.number().int().min(0).max(999),
    }),
  },
  async ({ id, ...values }) => {
    if (id) await db.update(facilities).set(values).where(eq(facilities.id, id));
    else await db.insert(facilities).values(values);
    return null;
  },
);

export const setFacilityActive = defineAction({ roles: ["admin"], input: z.object({ id: z.string(), isActive: z.boolean() }) }, async (input) => {
  await db.update(facilities).set({ isActive: input.isActive }).where(eq(facilities.id, input.id));
  return null;
});

/* ---------------- Price rules (03 §3.4) ---------------- */

export const updatePriceRule = defineAction(
  {
    roles: ["admin"],
    input: z
      .object({ id: z.string(), kind: z.enum(PRICE_RULE_KINDS), value: z.number().int().min(0), isActive: z.boolean() })
      .refine((v) => v.kind !== "percent" || v.value <= 100, { message: sp.rules.percentRange, path: ["value"] }),
  },
  async ({ id, ...values }) => {
    await db.update(priceRules).set(values).where(eq(priceRules.id, id));
    return null;
  },
);

/* ---------------- Holidays (03 §3.5) ---------------- */

export const saveHoliday = defineAction(
  {
    roles: ["admin"],
    input: z.object({ id: z.string().optional(), date: z.string().refine(isValidDate, t.errors.validation), name: z.string().trim().min(2).max(60) }),
  },
  async ({ id, ...values }) => {
    const clash = await db.query.holidays.findFirst({
      where: and(eq(holidays.date, values.date), id ? ne(holidays.id, id) : undefined),
      columns: { id: true },
    });
    if (clash) throw fieldError("date", sp.holidays.dateTaken);
    if (id) await db.update(holidays).set(values).where(eq(holidays.id, id));
    else await db.insert(holidays).values(values);
    return null;
  },
);

/** Holidays may be hard-deleted: bookings keep their own snapshot (03 §3.5). */
export const deleteHoliday = defineAction({ roles: ["admin"], input: z.object({ id: z.string() }) }, async ({ id }) => {
  await db.delete(holidays).where(eq(holidays.id, id));
  return null;
});

/* ---------------- Simulator (03 §3.6) ---------------- */

export const simulatePrice = defineAction(
  {
    roles: ["admin", "staff"],
    input: z.object({
      date: z.string().refine(isValidDate, t.errors.validation),
      people: z.number().int().min(1).max(200),
      packageId: z.string(),
      addonIds: z.array(z.string()),
    }),
  },
  async (input) => {
    const inputs = await loadPricingInputs(db, input.packageId);
    if (!inputs || !inputs.packageIsActive) throw new ActionError("NOT_FOUND", t.errors.notFound);
    return calculatePrice({
      date: input.date,
      people: input.people,
      pkg: inputs.pkg,
      selectedAddonIds: input.addonIds,
      addons: inputs.addons,
      rules: inputs.rules,
      holidays: inputs.holidays,
    });
  },
);
