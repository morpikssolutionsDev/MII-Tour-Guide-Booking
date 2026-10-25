"use server";

import bcrypt from "bcryptjs";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { signIn } from "@/auth";
import { db } from "@/db/client";
import { CHANNELS, users } from "@/db/schema";
import { t } from "@/i18n/id";
import { ActionError, defineAction, fieldError } from "../action";

const name = z.string().trim().min(2, t.users.nameLength).max(80, t.users.nameLength);
const email = z.string().trim().toLowerCase().email(t.users.emailInvalid);
const password = z.string().min(8, t.users.passwordMin).max(200);
const role = z.enum(["admin", "staff"]);
const channel = z.enum(CHANNELS).nullable();

async function assertEmailFree(value: string, exceptId?: string) {
  const existing = await db.query.users.findFirst({
    where: exceptId ? and(eq(users.email, value), ne(users.id, exceptId)) : eq(users.email, value),
    columns: { id: true },
  });
  if (existing) throw fieldError("email", t.users.emailTaken);
}

async function otherActiveAdmins(exceptId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true), ne(users.id, exceptId)));
  return row.n;
}

async function loadEditable(id: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new ActionError("NOT_FOUND", t.errors.notFound);
  if (user.role === "guide") throw new ActionError("FORBIDDEN", t.users.guideManaged); // BR-01-7
  return user;
}

/** 01 §3.3 create. Returns the initial password once for the one-time dialog. */
export const createUser = defineAction(
  { roles: ["admin"], input: z.object({ name, email, role, defaultChannel: channel, password }) },
  async (input) => {
    await assertEmailFree(input.email);
    const [row] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        role: input.role,
        defaultChannel: input.role === "staff" ? input.defaultChannel : null, // BR-01-8
        passwordHash: await bcrypt.hash(input.password, 10),
      })
      .returning({ id: users.id });
    return { id: row.id, email: input.email, password: input.password };
  },
);

export const updateUser = defineAction(
  { roles: ["admin"], input: z.object({ id: z.string(), name, email, role, defaultChannel: channel }) },
  async (input, me) => {
    const user = await loadEditable(input.id);
    if (input.id === me.id && input.role !== user.role) throw new ActionError("FORBIDDEN", t.users.cannotSelf);
    if (user.role === "admin" && input.role !== "admin" && user.isActive && (await otherActiveAdmins(user.id)) === 0) {
      throw new ActionError("INVALID_STATE", t.users.lastAdmin); // BR-01-6
    }
    await assertEmailFree(input.email, input.id);
    await db
      .update(users)
      .set({
        name: input.name,
        email: input.email,
        role: input.role,
        defaultChannel: input.role === "staff" ? input.defaultChannel : null,
      })
      .where(eq(users.id, input.id));
    return null;
  },
);

export const setUserActive = defineAction(
  { roles: ["admin"], input: z.object({ id: z.string(), isActive: z.boolean() }) },
  async (input, me) => {
    const user = await loadEditable(input.id);
    if (input.id === me.id) throw new ActionError("FORBIDDEN", t.users.cannotSelf);
    if (!input.isActive && user.role === "admin" && (await otherActiveAdmins(user.id)) === 0) {
      throw new ActionError("INVALID_STATE", t.users.lastAdmin);
    }
    await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.id));
    return null;
  },
);

/** 01 §3.4: also allowed for guide accounts (BR-01-7). Signs out the user's other sessions. */
export const resetUserPassword = defineAction(
  { roles: ["admin"], input: z.object({ id: z.string(), newPassword: password }) },
  async (input, me) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, input.id) });
    if (!user) throw new ActionError("NOT_FOUND", t.errors.notFound);
    await db
      .update(users)
      .set({ passwordHash: await bcrypt.hash(input.newPassword, 10), passwordChangedAt: new Date().toISOString() })
      .where(eq(users.id, input.id));
    // Resetting your own password re-issues this session (01 §8).
    if (input.id === me.id) await signIn("credentials", { email: user.email, password: input.newPassword, redirect: false });
    return { email: user.email, password: input.newPassword };
  },
);
