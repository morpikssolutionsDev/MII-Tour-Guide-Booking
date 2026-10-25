"use client";

import { CalendarDays, CalendarOff, Sun, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { t } from "@/i18n/id";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: "/portal", label: t.nav.portal.hariIni, icon: Sun, match: (p) => p === "/portal" || p.startsWith("/portal/tur") },
  { href: "/portal/jadwal", label: t.nav.portal.jadwal, icon: CalendarDays, match: (p) => p.startsWith("/portal/jadwal") },
  { href: "/portal/cuti", label: t.nav.portal.cuti, icon: CalendarOff, match: (p) => p.startsWith("/portal/cuti") },
  { href: "/portal/akun", label: t.nav.portal.akun, icon: UserRound, match: (p) => p.startsWith("/portal/akun") },
];

/** design-system §6.3: mobile-first guide shell; a centred 560px column with top tabs on desktop. */
export function PortalShell({ bell, initials, children }: { bell: ReactNode; initials: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = TABS.find((tab) => tab.match(pathname));
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[560px] items-center gap-3 px-4">
          <Link href="/portal" aria-label={t.nav.portal.hariIni}>
            <Logo className="h-5 text-brand" />
          </Link>
          <p className="truncate font-semibold">{active?.label ?? t.app.shortName}</p>
          <div className="ml-auto flex items-center gap-1">
            {bell}
            <Link href="/portal/akun" aria-label={t.nav.portal.akun} className="flex size-10 items-center justify-center">
              <span className="flex size-8 items-center justify-center rounded-full bg-danau-100 text-xs font-semibold text-danau-800">{initials}</span>
            </Link>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-[560px] px-4 md:block" aria-label={t.nav.menu}>
          <ul className="flex gap-1">
            {TABS.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={tab.match(pathname) ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 items-center px-3 text-sm font-medium text-muted-foreground",
                    tab.match(pathname) && "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-full after:bg-glow",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[560px] px-4 pt-4 pb-28 text-base md:pb-10">{children}</main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card md:hidden" aria-label={t.nav.menu}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const on = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={on ? "page" : undefined}
              className={cn("flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground", on && "glow-top text-danau-700")}
            >
              <Icon className="size-5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PortalFallback() {
  return (
    <div className="min-h-dvh">
      <div className="h-14 border-b bg-card" />
    </div>
  );
}
