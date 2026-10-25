import "server-only";
import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bookings,
  briefingMaterialPackages,
  briefingMaterials,
  checklistTemplateItems,
  guideLanguages,
  guides,
  languages,
  packages,
  slots,
  users,
} from "@/db/schema";
import { LIVE_STATUSES } from "@/domain/booking-status";
import { wibToday } from "@/domain/time";

export async function listSlots(includeInactive = true) {
  return db
    .select()
    .from(slots)
    .where(includeInactive ? undefined : eq(slots.isActive, true))
    .orderBy(asc(slots.startTime));
}

/** Future live bookings per slot (04 §3.1 "Pemesanan mendatang"). */
export async function upcomingBookingCountsBySlot(): Promise<Map<string, number>> {
  const rows = await db
    .select({ slotId: bookings.slotId, n: count() })
    .from(bookings)
    .where(and(inArray(bookings.status, [...LIVE_STATUSES]), gte(bookings.tourDate, wibToday())))
    .groupBy(bookings.slotId);
  return new Map(rows.map((r) => [r.slotId, r.n]));
}

export async function listLanguages(includeInactive = true) {
  const rows = await db
    .select()
    .from(languages)
    .where(includeInactive ? undefined : eq(languages.isActive, true))
    .orderBy(asc(languages.sortOrder), asc(languages.nameId));
  const guideCounts = await db
    .select({ languageId: guideLanguages.languageId, n: count() })
    .from(guideLanguages)
    .innerJoin(guides, eq(guides.id, guideLanguages.guideId))
    .where(eq(guides.isActive, true))
    .groupBy(guideLanguages.languageId);
  const byId = new Map(guideCounts.map((g) => [g.languageId, g.n]));
  return rows.map((l) => ({ ...l, guideCount: byId.get(l.id) ?? 0 }));
}

export async function listChecklistTemplate() {
  return db.select().from(checklistTemplateItems).orderBy(asc(checklistTemplateItems.sortOrder));
}

export async function listBriefingMaterials() {
  const rows = await db
    .select({ material: briefingMaterials, updatedByName: users.name })
    .from(briefingMaterials)
    .leftJoin(users, eq(users.id, briefingMaterials.updatedBy))
    .orderBy(desc(briefingMaterials.isActive), desc(briefingMaterials.updatedAt));
  const tags = await db
    .select({ materialId: briefingMaterialPackages.materialId, packageId: packages.id, packageName: packages.name })
    .from(briefingMaterialPackages)
    .innerJoin(packages, eq(packages.id, briefingMaterialPackages.packageId));
  return rows.map((r) => ({
    ...r.material,
    updatedByName: r.updatedByName,
    packages: tags.filter((t) => t.materialId === r.material.id).map((t) => ({ id: t.packageId, name: t.packageName })),
  }));
}

export async function getBriefingMaterial(id: string) {
  const material = await db.query.briefingMaterials.findFirst({ where: eq(briefingMaterials.id, id) });
  if (!material) return null;
  const tags = await db
    .select({ packageId: briefingMaterialPackages.packageId })
    .from(briefingMaterialPackages)
    .where(eq(briefingMaterialPackages.materialId, id));
  return { ...material, packageIds: tags.map((t) => t.packageId) };
}

/** Active briefing for a booking's package (04 BR-04-7). */
export async function briefingForPackage(packageId: string) {
  const all = await listBriefingMaterials();
  return all.filter((m) => m.isActive && (m.appliesToAll || m.packages.some((p) => p.id === packageId)));
}

export async function listPackageOptions() {
  return db
    .select({ id: packages.id, name: packages.name, isActive: packages.isActive })
    .from(packages)
    .orderBy(asc(packages.sortOrder));
}
