import "server-only";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { db } from "@/db/client";
import { users } from "@/db/schema";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
        // BR-01-1: only active users; the same generic failure for every reason.
        if (!user || !user.isActive) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        await db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id));
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});
