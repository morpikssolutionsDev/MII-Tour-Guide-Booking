"use client";

import { ChevronsLeft, ChevronsRight, LogOut, Menu, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useLocalFlag } from "@/hooks/use-local-flag";
import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Role } from "@/db/schema";
import { t } from "@/i18n/id";
import { cn } from "@/lib/utils";
import { logout } from "@/server/auth-actions";
import { isActive, MOBILE_TABS, navForRole, titleForPath, type NavItem } from "./nav-items";

type ShellUser = { name: string; role: Role };

const COLLAPSE_KEY = "tmii.sidebar.collapsed";

/** Admin / staff app shell (design-system §6.2). */
export function StaffShell({ user, bell, children }: { user: ShellUser; bell: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const groups = navForRole(user.role);
  const [collapsed, setCollapsed] = useLocalFlag(COLLAPSE_KEY);
  const [moreOpen, setMoreOpen] = useState(false);
  const toggle = () => setCollapsed(!collapsed);

  const allItems = groups.flatMap((g) => g.items);
  const moreItems = allItems.filter((i) => !MOBILE_TABS.includes(i.href));
  const showFab = !pathname.startsWith("/pemesanan/baru") && !pathname.endsWith("/ubah");

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar: icons only on tablet, full (collapsible) on desktop. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? "w-[72px]" : "w-[72px] lg:w-[248px]",
        )}
      >
        <div className="flex h-16 items-center gap-2 px-5">
          <Link href="/beranda" aria-label={t.nav.beranda}>
            <Logo className={cn("h-6 text-white", !collapsed && "lg:h-7")} />
          </Link>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2" aria-label={t.nav.menu}>
          {groups.map((group) => (
            <div key={group.label}>
              <p className={cn("mb-1 px-3 text-xs font-medium text-kabut-400", collapsed ? "sr-only" : "sr-only lg:not-sr-only")}>
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <SidebarLink item={item} active={isActive(pathname, item.href)} collapsed={collapsed} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-3">
          <Link
            href="/akun"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/5",
              isActive(pathname, "/akun") && "bg-sidebar-accent glow-left",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-danau-100 text-xs font-semibold text-danau-800">
              {initials(user.name)}
            </span>
            <span className={cn("min-w-0", collapsed ? "sr-only" : "sr-only lg:not-sr-only")}>
              <span className="block truncate text-sm font-medium text-white">{user.name}</span>
              <span className="block text-xs text-kabut-400">{t.roles[user.role]}</span>
            </span>
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-kabut-100 hover:bg-white/5"
            >
              <LogOut className="size-5 shrink-0" />
              <span className={cn(collapsed ? "sr-only" : "sr-only lg:not-sr-only")}>{t.nav.keluar}</span>
            </button>
          </form>
          <button
            type="button"
            onClick={toggle}
            className="hidden w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-kabut-400 hover:bg-white/5 lg:flex"
            aria-label={collapsed ? t.nav.expand : t.nav.collapse}
          >
            {collapsed ? <ChevronsRight className="size-5" /> : <ChevronsLeft className="size-5" />}
            <span className={cn(collapsed && "sr-only")}>{t.nav.collapse}</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur md:h-16 md:px-6">
          <Logo className="h-5 text-brand md:hidden" />
          <p className="ml-2 truncate font-semibold md:ml-0">{titleForPath(pathname)}</p>
          <div className="ml-auto flex items-center gap-1">
            {bell}
            <Link
              href="/akun"
              className="flex size-10 items-center justify-center rounded-full md:hidden"
              aria-label={t.nav.akun}
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-danau-100 text-xs font-semibold text-danau-800">
                {initials(user.name)}
              </span>
            </Link>
          </div>
        </header>

        <main className="flex-1 pb-24 md:pb-10">{children}</main>
      </div>

      {/* Mobile: floating create button + bottom tabs */}
      {showFab && (
        <Link
          href="/pemesanan/baru"
          className="fixed right-4 bottom-[84px] z-30 flex h-12 items-center gap-2 rounded-full bg-primary px-5 font-medium text-primary-foreground shadow-overlay md:hidden"
        >
          <Plus className="size-5" />
          {t.nav.buatPemesanan}
        </Link>
      )}
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card md:hidden"
        aria-label={t.nav.menu}
      >
        {allItems
          .filter((i) => MOBILE_TABS.includes(i.href))
          .map((item) => (
            <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground",
            moreItems.some((i) => isActive(pathname, i.href)) && "text-danau-700",
          )}
        >
          <Menu className="size-5" />
          {t.nav.lainnya}
        </button>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-xl bg-sidebar text-sidebar-foreground">
          <SheetHeader>
            <SheetTitle className="text-white">{t.nav.lainnya}</SheetTitle>
          </SheetHeader>
          <ul className="grid gap-1 px-4 pb-6">
            {moreItems.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} active={isActive(pathname, item.href)} collapsed={false} onNavigate={() => setMoreOpen(false)} />
              </li>
            ))}
            <li>
              <Link
                href="/akun"
                onClick={() => setMoreOpen(false)}
                className="flex h-12 items-center gap-3 rounded-md px-3 hover:bg-white/5"
              >
                <UserRound className="size-5" />
                {t.nav.akun}
              </Link>
            </li>
            <li>
              <form action={logout}>
                <button type="submit" className="flex h-12 w-full items-center gap-3 rounded-md px-3 hover:bg-white/5">
                  <LogOut className="size-5" />
                  {t.nav.keluar}
                </button>
              </form>
            </li>
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-kabut-100 transition-colors hover:bg-white/5",
        active && "bg-sidebar-accent text-white glow-left",
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span className={cn(onNavigate ? "" : collapsed ? "sr-only" : "sr-only lg:not-sr-only")}>{item.label}</span>
    </Link>
  );
  if (onNavigate) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className={cn(!collapsed && "lg:hidden")}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground",
        active && "text-danau-700 glow-top",
      )}
    >
      <Icon className="size-5" />
      {item.href === "/jadwal" ? t.nav.jadwalShort : item.label}
    </Link>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function ShellFallback() {
  return (
    <div className="min-h-dvh md:flex">
      <div className="hidden h-dvh w-[72px] bg-sidebar md:block lg:w-[248px]" />
      <div className="flex-1">
        <div className="h-14 border-b bg-card md:h-16" />
      </div>
    </div>
  );
}
