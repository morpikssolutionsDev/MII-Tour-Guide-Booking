// Optimistic, cookie-only routing (01 BR-01-5). Real authorisation happens in the
// data access layer (src/server/auth.ts), which re-checks the user in the database.
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { DENIED_PARAM, homeFor, isPublicPath, rolesForPath } from "@/lib/routes";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const role = req.auth?.user?.role;
  const to = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl));

  if (pathname === "/") return to(role ? homeFor(role) : "/masuk");
  if (pathname === "/masuk" && role) {
    const next = req.nextUrl.searchParams.get("next");
    const allowed = next ? rolesForPath(next.split("?")[0]) : null;
    return to(next && next.startsWith("/") && allowed?.includes(role) ? next : homeFor(role));
  }
  if (isPublicPath(pathname)) return NextResponse.next();

  if (!role) return to(`/masuk?next=${encodeURIComponent(pathname + search)}`);

  const allowed = rolesForPath(pathname);
  if (allowed && !allowed.includes(role)) return to(`${homeFor(role)}?${DENIED_PARAM}=ditolak`);
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|uploads/|icon.png|apple-icon.png|favicon.ico).*)"],
};
