// Auth.js config shared by the proxy and the full auth instance. No database access here:
// the proxy only decodes the session cookie (optimistic checks, overview §8.7).
import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/db/schema";

export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export const authConfig = {
  pages: { signIn: "/masuk" },
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS, updateAge: 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = user.role;
        // Compared with users.password_changed_at to invalidate older sessions (BR-01-4).
        token.issuedAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid;
      session.user.role = token.role;
      session.issuedAt = token.issuedAt;
      return session;
    },
  },
} satisfies NextAuthConfig;

declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    issuedAt: number;
    user: { id: string; role: Role; name: string; email: string };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid: string;
    role: Role;
    issuedAt: number;
  }
}
