"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { t } from "@/i18n/id";
import { homeFor, rolesForPath } from "@/lib/routes";
import { ActionError, defineAction } from "./action";

export type LoginState = { error: string | null; email: string };

/** 01 §3.1. One generic message for every failure (BR-01-1). */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  const user = email ? await db.query.users.findFirst({ where: eq(users.email, email), columns: { role: true } }) : null;
  const nextPath = next.startsWith("/") && !next.startsWith("//") ? next : null;
  const target =
    user && nextPath && rolesForPath(nextPath.split("?")[0])?.includes(user.role) ? nextPath : user ? homeFor(user.role) : "/";

  try {
    await signIn("credentials", { email, password, redirectTo: target });
  } catch (error) {
    if (error instanceof AuthError) return { error: t.auth.invalid, email };
    throw error; // the success redirect
  }
  return { error: null, email };
}

export async function logout() {
  await signOut({ redirectTo: "/masuk" });
}

const passwordSchema = z.string().min(8, t.users.passwordMin).max(200);

/** 01 §3.5: change own password, then re-issue the session so this device stays signed in. */
export const changeOwnPassword = defineAction(
  {
    roles: ["admin", "staff", "guide"],
    input: z
      .object({ currentPassword: z.string().min(1, t.common.required), newPassword: passwordSchema, repeatPassword: z.string() })
      .refine((v) => v.newPassword === v.repeatPassword, { message: t.account.mismatch, path: ["repeatPassword"] }),
  },
  async (input, me) => {
    const row = await db.query.users.findFirst({ where: eq(users.id, me.id) });
    if (!row || !(await bcrypt.compare(input.currentPassword, row.passwordHash))) {
      throw new ActionError("VALIDATION", t.account.wrongCurrent, undefined, { currentPassword: t.account.wrongCurrent });
    }
    await db
      .update(users)
      .set({ passwordHash: await bcrypt.hash(input.newPassword, 10), passwordChangedAt: new Date().toISOString() })
      .where(eq(users.id, me.id));
    // A fresh sign-in issues a token newer than password_changed_at (BR-01-4, BR-01-10).
    await signIn("credentials", { email: row.email, password: input.newPassword, redirect: false });
    return null;
  },
);
