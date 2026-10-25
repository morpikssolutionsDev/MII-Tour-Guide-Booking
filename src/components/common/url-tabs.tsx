"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Tabs reflected in the URL (`?tab=`); a horizontally scrollable bar on mobile. */
export function UrlTabs({ tabs, active, param = "tab" }: { tabs: { value: string; label: string }[]; active: string; param?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (value: string) => {
    const next = new URLSearchParams(params);
    next.set(param, value);
    for (const key of ["q", "page"]) next.delete(key);
    return `${pathname}?${next.toString()}`;
  };
  return (
    <nav className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Tab">
      <ul className="flex min-w-max gap-1 border-b">
        {tabs.map((tab) => {
          const selected = tab.value === active;
          return (
            <li key={tab.value}>
              <Link
                href={href(tab.value)}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  selected && "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-full after:bg-glow",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
