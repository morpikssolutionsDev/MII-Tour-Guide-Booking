import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { guides, users, type Channel, type Role } from "@/db/schema";
import { DENIED_PARAM, homeFor } from "@/lib/routes";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  defaultChannel: Channel | null;
  /** Set for role `guide`: the linked guide profile. */
  guideId: string | null;
};

type SessionCheck = { user: CurrentUser } | { user: null; hadSession: boolean };

/**
 * Loads the session user from the database on every request (BR-01-4): a missing or
 * inactive user, or a password changed after the session was issued, means signed out.
 */
const checkSession = cache(async (): Promise<SessionCheck> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { user: null, hadSession: false };

  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row || !row.isActive) return { user: null, hadSession: true };
  if (Date.parse(row.passwordChangedAt) > (session.issuedAt ?? 0)) return { user: null, hadSession: true };

  let guideId: string | null = null;
  if (row.role === "guide") {
    const guide = await db.query.guides.findFirst({ where: eq(guides.userId, row.id), columns: { id: true } });
    guideId = guide?.id ?? null;
  }
  return {
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      defaultChannel: row.defaultChannel,
      guideId,
    },
  };
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await checkSession()).user;
}

/** For pages: redirects to login (clearing a rejected session) when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const check = await checkSession();
  if (check.user) return check.user;
  redirect(check.hadSession ? "/keluar?alasan=sesi" : "/masuk");
}

/** For pages: redirects to the user's home with the no-access notice on a role mismatch. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(`${homeFor(user.role)}?${DENIED_PARAM}=ditolak`);
  return user;
}

/** For guide pages: the user plus their guide id. */
export async function requireGuide(): Promise<CurrentUser & { guideId: string }> {
  const user = await requireRole("guide");
  if (!user.guideId) redirect("/keluar?alasan=sesi");
  return user as CurrentUser & { guideId: string };
}
