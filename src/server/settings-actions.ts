"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  briefingMaterialPackages,
  briefingMaterials,
  checklistTemplateItems,
  languages,
  settings,
  slots,
} from "@/db/schema";
import { isValidTime, timeToMinutes } from "@/domain/time";
import { t } from "@/i18n/id";
import { formatSlot } from "@/lib/format";
import { ActionError, defineAction, fieldError } from "./action";
import { findLiveConflicts } from "./bookings/conflicts";
import { richTextLength, sanitizeRichText } from "./sanitize";
import { settingsSchema } from "./settings";
import { PDF_TYPES, storeFile, UploadError } from "./storage";

const ss = t.settings;

/* ---------------- Slots (04 §3.1, BR-04-1..3) ---------------- */

const time = z.string().refine(isValidTime, ss.slots.range);
const slotInput = z
  .object({ startTime: time, endTime: time })
  .superRefine((v, ctx) => {
    const start = timeToMinutes(v.startTime);
    const end = timeToMinutes(v.endTime);
    if (start % 15 || end % 15 || start < 6 * 60 || end > 21 * 60) ctx.addIssue({ code: "custom", message: ss.slots.range, path: ["startTime"] });
    else if (end <= start) ctx.addIssue({ code: "custom", message: ss.slots.endAfterStart, path: ["endTime"] });
    else if (end - start < 30 || end - start > 480) ctx.addIssue({ code: "custom", message: ss.slots.duration, path: ["endTime"] });
  });

async function assertNoOverlap(startTime: string, endTime: string, exceptId?: string) {
  const active = await db
    .select()
    .from(slots)
    .where(exceptId ? and(eq(slots.isActive, true), ne(slots.id, exceptId)) : eq(slots.isActive, true));
  const s = timeToMinutes(startTime);
  const e = timeToMinutes(endTime);
  // Half-open ranges: 16:00–19:00 and 19:00–21:00 do not overlap.
  const clash = active.find((o) => s < timeToMinutes(o.endTime) && timeToMinutes(o.startTime) < e);
  if (clash) throw fieldError("startTime", ss.slots.overlap(formatSlot(clash.startTime, clash.endTime)));
}

export const createSlot = defineAction({ roles: ["admin"], input: slotInput }, async (input) => {
  await assertNoOverlap(input.startTime, input.endTime);
  await db.insert(slots).values(input);
  return null;
});

export const updateSlot = defineAction(
  { roles: ["admin"], input: z.object({ id: z.string() }).and(slotInput) },
  async (input) => {
    const slot = await db.query.slots.findFirst({ where: eq(slots.id, input.id) });
    if (!slot) throw new ActionError("NOT_FOUND", t.errors.notFound);
    if (slot.startTime !== input.startTime || slot.endTime !== input.endTime) {
      const conflicts = await findLiveConflicts({ slotId: slot.id });
      if (conflicts.length) throw new ActionError("CONFLICT", ss.slots.locked(conflicts.length), conflicts); // BR-04-2
    }
    if (slot.isActive) await assertNoOverlap(input.startTime, input.endTime, slot.id);
    await db.update(slots).set({ startTime: input.startTime, endTime: input.endTime }).where(eq(slots.id, input.id));
    return null;
  },
);

export const setSlotActive = defineAction(
  { roles: ["admin"], input: z.object({ id: z.string(), isActive: z.boolean() }) },
  async (input) => {
    const slot = await db.query.slots.findFirst({ where: eq(slots.id, input.id) });
    if (!slot) throw new ActionError("NOT_FOUND", t.errors.notFound);
    if (!input.isActive) {
      const conflicts = await findLiveConflicts({ slotId: slot.id });
      if (conflicts.length) throw new ActionError("CONFLICT", ss.slots.deactivateBlocked, conflicts); // BR-04-3
    } else {
      await assertNoOverlap(slot.startTime, slot.endTime, slot.id);
    }
    await db.update(slots).set({ isActive: input.isActive }).where(eq(slots.id, input.id));
    return null;
  },
);

/* ---------------- Languages (04 §3.2, BR-04-4) ---------------- */

const languageInput = z.object({
  nameId: z.string().trim().min(2).max(30),
  nameEn: z.string().trim().min(2).max(30),
  code: z.string().trim().regex(/^[a-z]{2}$/, ss.languages.codeInvalid),
});

async function assertLanguageUnique(input: z.infer<typeof languageInput>, exceptId?: string) {
  const others = await db.select().from(languages).where(exceptId ? ne(languages.id, exceptId) : undefined);
  if (others.some((l) => l.code === input.code)) throw fieldError("code", ss.languages.codeTaken);
  if (others.some((l) => l.nameId.toLowerCase() === input.nameId.toLowerCase())) throw fieldError("nameId", ss.languages.nameTaken);
}

export const createLanguage = defineAction({ roles: ["admin"], input: languageInput }, async (input) => {
  await assertLanguageUnique(input);
  const all = await db.select({ id: languages.id }).from(languages);
  await db.insert(languages).values({ ...input, sortOrder: all.length });
  return null;
});

export const updateLanguage = defineAction(
  { roles: ["admin"], input: languageInput.extend({ id: z.string() }) },
  async ({ id, ...input }) => {
    await assertLanguageUnique(input, id);
    await db.update(languages).set(input).where(eq(languages.id, id));
    return null;
  },
);

/** Number of future live bookings in a language, for the deactivation warning. */
export const countLanguageUsage = defineAction({ roles: ["admin"], input: z.object({ id: z.string() }) }, async ({ id }) => {
  return (await findLiveConflicts({ languageId: id })).length;
});

export const setLanguageActive = defineAction(
  { roles: ["admin"], input: z.object({ id: z.string(), isActive: z.boolean() }) },
  async (input) => {
    await db.update(languages).set({ isActive: input.isActive }).where(eq(languages.id, input.id));
    return null;
  },
);

/* ---------------- Checklist template (04 §3.3, BR-04-5/6) ---------------- */

const checklistInput = z.object({
  label: z.string().trim().min(1, t.common.required).max(80),
  description: z.string().trim().max(200).optional().transform((v) => v || null),
});

export const createChecklistItem = defineAction({ roles: ["admin"], input: checklistInput }, async (input) => {
  const all = await db.select({ id: checklistTemplateItems.id }).from(checklistTemplateItems);
  await db.insert(checklistTemplateItems).values({ ...input, sortOrder: all.length });
  return null;
});

export const updateChecklistItem = defineAction(
  { roles: ["admin"], input: checklistInput.extend({ id: z.string() }) },
  async ({ id, ...input }) => {
    await db.update(checklistTemplateItems).set(input).where(eq(checklistTemplateItems.id, id));
    return null;
  },
);

export const deleteChecklistItem = defineAction({ roles: ["admin"], input: z.object({ id: z.string() }) }, async ({ id }) => {
  const item = await db.query.checklistTemplateItems.findFirst({ where: eq(checklistTemplateItems.id, id) });
  if (!item) throw new ActionError("NOT_FOUND", t.errors.notFound);
  if (item.systemKey) throw new ActionError("FORBIDDEN", ss.checklist.systemLocked); // BR-04-6
  await db.delete(checklistTemplateItems).where(eq(checklistTemplateItems.id, id));
  return null;
});

export const reorderChecklistItems = defineAction(
  { roles: ["admin"], input: z.object({ ids: z.array(z.string()).min(1) }) },
  async ({ ids }) => {
    await db.transaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx.update(checklistTemplateItems).set({ sortOrder: index }).where(eq(checklistTemplateItems.id, id));
      }
    });
    return null;
  },
);

/* ---------------- Briefing material (04 §3.4, BR-04-7/10) ---------------- */

const briefingInput = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(3).max(100),
    bodyHtml: z.string(),
    linkUrl: z
      .string()
      .trim()
      .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), ss.briefing.linkInvalid)
      .transform((v) => v || null),
    appliesToAll: z.boolean(),
    packageIds: z.array(z.string()),
    file: z.instanceof(File).optional(),
    removeFile: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.appliesToAll && v.packageIds.length === 0) ctx.addIssue({ code: "custom", message: ss.briefing.pickPackage, path: ["packageIds"] });
  });

export const saveBriefingMaterial = defineAction({ roles: ["admin"], input: briefingInput }, async (input, me) => {
  const bodyHtml = sanitizeRichText(input.bodyHtml); // BR-04-10: server-side
  const length = richTextLength(bodyHtml);
  if (length === 0) throw fieldError("bodyHtml", t.common.required);
  if (length > 20_000) throw fieldError("bodyHtml", ss.briefing.bodyTooLong);

  let file: { fileUrl: string | null; fileName: string | null; fileSize: number | null } | undefined;
  if (input.file && input.file.size > 0) {
    try {
      const stored = await storeFile(input.file, "briefing", {
        types: PDF_TYPES,
        maxBytes: 10 * 1024 * 1024,
        typeMessage: ss.briefing.pdfType,
        sizeMessage: ss.briefing.pdfSize,
      });
      file = { fileUrl: stored.url, fileName: stored.name, fileSize: stored.size };
    } catch (error) {
      if (error instanceof UploadError) throw fieldError("file", error.message);
      throw error;
    }
  } else if (input.removeFile) {
    file = { fileUrl: null, fileName: null, fileSize: null };
  }

  const values = {
    title: input.title,
    bodyHtml,
    linkUrl: input.linkUrl,
    appliesToAll: input.appliesToAll,
    updatedBy: me.id,
    ...file,
  };
  return db.transaction(async (tx) => {
    let id = input.id;
    if (id) await tx.update(briefingMaterials).set(values).where(eq(briefingMaterials.id, id));
    else id = (await tx.insert(briefingMaterials).values(values).returning({ id: briefingMaterials.id }))[0].id;
    await tx.delete(briefingMaterialPackages).where(eq(briefingMaterialPackages.materialId, id));
    if (!input.appliesToAll) {
      await tx.insert(briefingMaterialPackages).values(input.packageIds.map((packageId) => ({ materialId: id!, packageId })));
    }
    return { id };
  });
});

export const setBriefingMaterialActive = defineAction(
  { roles: ["admin"], input: z.object({ id: z.string(), isActive: z.boolean() }) },
  async (input, me) => {
    await db.update(briefingMaterials).set({ isActive: input.isActive, updatedBy: me.id }).where(eq(briefingMaterials.id, input.id));
    return null;
  },
);

/* ---------------- General settings (04 §3.5, BR-04-8) ---------------- */

export const updateSettings = defineAction({ roles: ["admin"], input: settingsSchema }, async (input, me) => {
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(input)) {
      await tx
        .insert(settings)
        .values({ key, value, updatedBy: me.id })
        .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: me.id, updatedAt: new Date().toISOString() } });
    }
  });
  return null;
});
