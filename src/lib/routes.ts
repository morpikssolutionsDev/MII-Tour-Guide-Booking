// Route access by role (01 BR-01-5). Pure data so the proxy can use it without server deps.
import type { Role } from "@/db/schema";

const STAFF_AND_ADMIN = ["/beranda", "/pemesanan", "/jadwal", "/pelanggan", "/laporan", "/tour-guide", "/harga", "/akun"];
const ADMIN_ONLY = ["/pengaturan", "/pengguna", "/outbox"];
const GUIDE_ONLY = ["/portal"];
const PUBLIC = ["/masuk", "/keluar", "/ulasan", "/api/auth"];

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC.some((prefix) => matches(pathname, prefix));
}

/** Roles allowed on a path, or null when the path is not role-restricted. */
export function rolesForPath(pathname: string): Role[] | null {
  if (ADMIN_ONLY.some((p) => matches(pathname, p))) return ["admin"];
  if (STAFF_AND_ADMIN.some((p) => matches(pathname, p))) return ["admin", "staff"];
  if (GUIDE_ONLY.some((p) => matches(pathname, p))) return ["guide"];
  return null;
}

export function homeFor(role: Role): string {
  return role === "guide" ? "/portal" : "/beranda";
}

export const DENIED_PARAM = "akses";
