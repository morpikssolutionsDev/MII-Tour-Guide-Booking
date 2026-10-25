import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Home,
  Inbox,
  Settings,
  Tags,
  UserCog,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/db/schema";
import { t } from "@/i18n/id";

export type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[] };
export type NavGroup = { label: string; items: NavItem[] };

const both: Role[] = ["admin", "staff"];
const admin: Role[] = ["admin"];

// design-system §6.2 sidebar groups.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: t.nav.groups.operasional,
    items: [
      { href: "/beranda", label: t.nav.beranda, icon: Home, roles: both },
      { href: "/pemesanan", label: t.nav.pemesanan, icon: ClipboardList, roles: both },
      { href: "/jadwal", label: t.nav.jadwal, icon: CalendarDays, roles: both },
      { href: "/pelanggan", label: t.nav.pelanggan, icon: Users, roles: both },
    ],
  },
  {
    label: t.nav.groups.masterData,
    items: [
      { href: "/tour-guide", label: t.nav.tourGuide, icon: UserRoundCheck, roles: both },
      { href: "/harga", label: t.nav.harga, icon: Tags, roles: both },
      { href: "/pengaturan", label: t.nav.pengaturan, icon: Settings, roles: admin },
      { href: "/pengguna", label: t.nav.pengguna, icon: UserCog, roles: admin },
    ],
  },
  {
    label: t.nav.groups.analitik,
    items: [
      { href: "/laporan", label: t.nav.laporan, icon: BarChart3, roles: both },
      { href: "/outbox", label: t.nav.outbox, icon: Inbox, roles: admin },
    ],
  },
];

/** Mobile bottom tabs: Beranda · Pemesanan · Jadwal (+ "Lainnya"). */
export const MOBILE_TABS = ["/beranda", "/pemesanan", "/jadwal"];

export function navForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter(
    (g) => g.items.length > 0,
  );
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function titleForPath(pathname: string): string {
  if (pathname.startsWith("/akun")) return t.nav.akun;
  for (const group of NAV_GROUPS) for (const item of group.items) if (isActive(pathname, item.href)) return item.label;
  return t.app.shortName;
}
