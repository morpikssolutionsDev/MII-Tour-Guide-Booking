"use server";

import bcrypt from "bcryptjs";
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { guideLanguages, guideLeaves, guides, guideWorkingDays, users } from "@/db/schema";
import { normalizePhone } from "@/domain/phone";
import { addDays, daysBetween, isValidDate, wibToday } from "@/domain/time";
import { t } from "@/i18n/id";
import { ActionError, defineAction, fieldError } from "../action";
import { findLiveConflicts, type BookingRef } from "../bookings/conflicts";
import { notify } from "../notify";
import { IMAGE_TYPES, storeFile, UploadError } from "../storage";

const sg = t.guides;
const sl = t.leave;

const profile = {
  fullName: z.string().trim().min(2, t.users.nameLength).max(80, t.users.nameLength),
  displayName: z.string().trim().min(2).max(30),
  phone: z.string().trim(),
  notes: z.string().trim().max(1000).optional().transform((v) => v || null),
  languageIds: z.array(z.string()).min(1, sg.errors.needLanguage),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1, sg.errors.needWorkday),
  photo: z.instanceof(File).optional(),
};

async function normalizeUniquePhone(raw: string, exceptGuideId?: string) {
  const phone = normalizePhone(raw);
  if (!phone) throw fieldError("phone", sg.errors.phoneInvalid);
  const clash = await db.query.guides.findFirst({
    where: exceptGuideId ? and(eq(guides.phoneE164, phone), ne(guides.id, exceptGuideId)) : eq(guides.phoneE164, phone),
    columns: { id: true },
  });
  if (clash) throw fieldError("phone", sg.errors.phoneTaken);
  return phone;
}

async function storePhoto(photo: File | undefined) {
  if (!photo || photo.size === 0) return undefined;
  try {
    return (
      await storeFile(photo, "guides", {
        types: IMAGE_TYPES,
        maxBytes: 2 * 1024 * 1024,
        typeMessage: sg.errors.photoType,
        sizeMessage: sg.errors.photoSize,
      })
    ).url;
  } catch (error) {
    if (error instanceof UploadError) throw fieldError("photo", error.message);
    throw error;
  }
}

/** 02 §3.3 create: the guide profile and its login in one transaction (BR-02-3). */
export const createGuide = defineAction(
  {
    roles: ["admin"],
    input: z.object({
      ...profile,
      email: z.string().trim().toLowerCase().email(t.users.emailInvalid),
      password: z.string().min(8, t.users.passwordMin).max(200),
    }),
  },
  async (input) => {
    const phone = await normalizeUniquePhone(input.phone);
    if (await db.query.users.findFirst({ where: eq(users.email, input.email), columns: { id: true } })) {
      throw fieldError("email", t.users.emailTaken);
    }
    const photoUrl = await storePhoto(input.photo);
    const passwordHash = await bcrypt.hash(input.password, 10);
    const id = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ name: input.fullName, email: input.email, passwordHash, role: "guide" })
        .returning({ id: users.id });
      const [guide] = await tx
        .insert(guides)
        .values({ userId: user.id, fullName: input.fullName, displayName: input.displayName, phoneE164: phone, notes: input.notes, photoUrl })
        .returning({ id: guides.id });
      await tx.insert(guideLanguages).values(input.languageIds.map((languageId) => ({ guideId: guide.id, languageId })));
      await tx.insert(guideWorkingDays).values([...new Set(input.weekdays)].map((weekday) => ({ guideId: guide.id, weekday })));
      return guide.id;
    });
    return { id, email: input.email, password: input.password };
  },
);

/** 02 §3.3 edit, blocked when removing a language or weekday breaks upcoming tours (BR-02-5/6). */
export const updateGuide = defineAction(
  { roles: ["admin"], input: z.object({ id: z.string(), ...profile, removePhoto: z.boolean().optional() }) },
  async (input) => {
    const guide = await db.query.guides.findFirst({ where: eq(guides.id, input.id) });
    if (!guide) throw new ActionError("NOT_FOUND", t.errors.notFound);
    const phone = await normalizeUniquePhone(input.phone, guide.id);

    const currentLangs = (await db.select().from(guideLanguages).where(eq(guideLanguages.guideId, guide.id))).map((r) => r.languageId);
    const currentDays = (await db.select().from(guideWorkingDays).where(eq(guideWorkingDays.guideId, guide.id))).map((r) => r.weekday);
    const removedLangs = currentLangs.filter((l) => !input.languageIds.includes(l));
    const removedDays = currentDays.filter((d) => !input.weekdays.includes(d));

    const conflicts = new Map<string, BookingRef>();
    for (const languageId of removedLangs) for (const c of await findLiveConflicts({ guideId: guide.id, languageId })) conflicts.set(c.id, c);
    for (const weekday of removedDays) for (const c of await findLiveConflicts({ guideId: guide.id, weekday })) conflicts.set(c.id, c);
    if (conflicts.size) throw new ActionError("CONFLICT", sg.errors.conflict(conflicts.size), [...conflicts.values()]);

    const photoUrl = await storePhoto(input.photo);
    await db.transaction(async (tx) => {
      await tx
        .update(guides)
        .set({
          fullName: input.fullName,
          displayName: input.displayName,
          phoneE164: phone,
          notes: input.notes,
          ...(photoUrl ? { photoUrl } : input.removePhoto ? { photoUrl: null } : {}),
        })
        .where(eq(guides.id, guide.id));
      await tx.update(users).set({ name: input.fullName }).where(eq(users.id, guide.userId)); // BR-02-3
      await tx.delete(guideLanguages).where(eq(guideLanguages.guideId, guide.id));
      await tx.insert(guideLanguages).values(input.languageIds.map((languageId) => ({ guideId: guide.id, languageId })));
      await tx.delete(guideWorkingDays).where(eq(guideWorkingDays.guideId, guide.id));
      await tx.insert(guideWorkingDays).values([...new Set(input.weekdays)].map((weekday) => ({ guideId: guide.id, weekday })));
    });
    return null;
  },
);

/** BR-02-4: deactivation needs no future active assignments; syncs the login. */
export const setGuideActive = defineAction(
  { roles: ["admin"], input: z.object({ id: z.string(), isActive: z.boolean() }) },
  async (input) => {
    const guide = await db.query.guides.findFirst({ where: eq(guides.id, input.id) });
    if (!guide) throw new ActionError("NOT_FOUND", t.errors.notFound);
    if (!input.isActive) {
      const conflicts = await findLiveConflicts({ guideId: guide.id });
      if (conflicts.length) throw new ActionError("CONFLICT", sg.errors.deactivateBlocked, conflicts);
    }
    await db.transaction(async (tx) => {
      await tx.update(guides).set({ isActive: input.isActive }).where(eq(guides.id, guide.id));
      await tx.update(users).set({ isActive: input.isActive }).where(eq(users.id, guide.userId));
    });
    return null;
  },
);

/* ---------------- Leave (02 §3.4–3.5, BR-02-7..9) ---------------- */

const leaveDates = {
  startDate: z.string().refine(isValidDate, t.errors.validation),
  endDate: z.string().refine(isValidDate, t.errors.validation),
  reason: z.string().trim().min(1, t.common.required).max(300),
};

async function validateLeave(guideId: string, startDate: string, endDate: string, exceptLeaveId?: string) {
  if (endDate < startDate) throw fieldError("endDate", sl.errors.order);
  if (startDate < wibToday()) throw fieldError("startDate", sl.errors.past);
  if (daysBetween(startDate, endDate) + 1 > 30) throw fieldError("endDate", sl.errors.max);
  const overlapping = await db
    .select({ id: guideLeaves.id })
    .from(guideLeaves)
    .where(
      and(
        eq(guideLeaves.guideId, guideId),
        inArray(guideLeaves.status, ["pending", "approved"]),
        lte(guideLeaves.startDate, endDate),
        gte(guideLeaves.endDate, startDate),
        exceptLeaveId ? ne(guideLeaves.id, exceptLeaveId) : undefined,
      ),
    );
  if (overlapping.length) throw fieldError("startDate", sl.errors.overlap);
}

/** BR-02-8: approved leave never overlaps an active assignment. */
async function assertNoAssignments(guideId: string, startDate: string, endDate: string) {
  const conflicts = await findLiveConflicts({ guideId, from: startDate, to: endDate });
  if (conflicts.length) throw new ActionError("CONFLICT", sl.approveBlocked, conflicts);
}

/** Guide's own request (from the portal, 08 §3.4). Pending leave never blocks availability. */
export const requestLeave = defineAction({ roles: ["guide"], input: z.object(leaveDates) }, async (input, me) => {
  await validateLeave(me.guideId!, input.startDate, input.endDate);
  const [leave] = await db
    .insert(guideLeaves)
    .values({ guideId: me.guideId!, ...input, status: "pending", requestedBy: me.id })
    .returning({ id: guideLeaves.id });
  await notify.leaveRequested(db, leave.id);
  // Own upcoming tours in the range are only a warning for the guide (08 §3.4).
  return { conflicts: (await findLiveConflicts({ guideId: me.guideId!, from: input.startDate, to: input.endDate })).length };
});

/** 02 §3.5: admin adds leave directly (approved immediately, same conflict check). */
export const createLeaveByAdmin = defineAction(
  { roles: ["admin"], input: z.object({ guideId: z.string(), ...leaveDates }) },
  async (input, me) => {
    await validateLeave(input.guideId, input.startDate, input.endDate);
    await assertNoAssignments(input.guideId, input.startDate, input.endDate);
    await db.transaction(async (tx) => {
      const now = new Date().toISOString();
      const [leave] = await tx
        .insert(guideLeaves)
        .values({
          guideId: input.guideId,
          startDate: input.startDate,
          endDate: input.endDate,
          reason: input.reason,
          status: "approved",
          requestedBy: me.id,
          decidedBy: me.id,
          decidedAt: now,
        })
        .returning({ id: guideLeaves.id });
      await notify.leaveAddedByAdmin(tx, leave.id);
    });
    return null;
  },
);

async function loadLeave(id: string) {
  const leave = await db.query.guideLeaves.findFirst({ where: eq(guideLeaves.id, id) });
  if (!leave) throw new ActionError("NOT_FOUND", t.errors.notFound);
  return leave;
}

export const approveLeave = defineAction({ roles: ["admin"], input: z.object({ id: z.string() }) }, async ({ id }, me) => {
  const leave = await loadLeave(id);
  if (leave.status !== "pending") throw new ActionError("INVALID_STATE", t.errors.unexpected);
  await assertNoAssignments(leave.guideId, leave.startDate, leave.endDate);
  await db.transaction(async (tx) => {
    await tx
      .update(guideLeaves)
      .set({ status: "approved", decidedBy: me.id, decidedAt: new Date().toISOString(), decisionNote: null })
      .where(and(eq(guideLeaves.id, id), eq(guideLeaves.status, "pending")));
    await notify.leaveDecided(tx, id);
  });
  return null;
});

export const rejectLeave = defineAction(
  { roles: ["admin"], input: z.object({ id: z.string(), note: z.string().trim().min(1, t.common.required).max(300) }) },
  async ({ id, note }, me) => {
    const leave = await loadLeave(id);
    if (leave.status !== "pending") throw new ActionError("INVALID_STATE", t.errors.unexpected);
    await db.transaction(async (tx) => {
      await tx
        .update(guideLeaves)
        .set({ status: "rejected", decidedBy: me.id, decidedAt: new Date().toISOString(), decisionNote: note })
        .where(eq(guideLeaves.id, id));
      await notify.leaveDecided(tx, id);
    });
    return null;
  },
);

/** BR-02-9: guides cancel their own pending requests; admins cancel (or shorten) approved leave. */
export const cancelLeave = defineAction({ roles: ["admin", "guide"], input: z.object({ id: z.string() }) }, async ({ id }, me) => {
  const leave = await loadLeave(id);
  const today = wibToday();
  if (me.role === "guide") {
    if (leave.guideId !== me.guideId || leave.status !== "pending") throw new ActionError("FORBIDDEN", sl.errors.notCancellable);
    await db.update(guideLeaves).set({ status: "cancelled" }).where(eq(guideLeaves.id, id));
    return null;
  }
  if (leave.status !== "approved" || leave.endDate < today) throw new ActionError("INVALID_STATE", sl.errors.notCancellable);
  await db.transaction(async (tx) => {
    // Notify first so the message names the range as the guide knew it.
    await notify.leaveCancelledByAdmin(tx, id);
    if (leave.startDate < today) {
      // Ongoing: shorten to end yesterday.
      await tx.update(guideLeaves).set({ endDate: addDays(today, -1) }).where(eq(guideLeaves.id, id));
    } else {
      await tx.update(guideLeaves).set({ status: "cancelled" }).where(eq(guideLeaves.id, id));
    }
  });
  return null;
});
