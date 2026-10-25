"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/i18n/id";
import { cn } from "@/lib/utils";

/** Updates query-string filters; resets pagination when a filter changes. */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = (updates: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    }
    if (!("page" in updates)) next.delete("page");
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  return { params, set, pending };
}

export function FilterRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>{children}</div>;
}

/** Debounced (300 ms) search box bound to `?q=`. */
export function SearchFilter({ placeholder, param = "q", className }: { placeholder: string; param?: string; className?: string }) {
  const { params, set } = useUrlParams();
  const current = params.get(param) ?? "";
  const [value, setValue] = useState(current);
  const [synced, setSynced] = useState(current);

  // Follow external URL changes (back button, reset) without an effect.
  if (current !== synced) {
    setSynced(current);
    setValue(current);
  }
  useEffect(() => {
    if (value === current) return;
    const timer = setTimeout(() => set({ [param]: value.trim() || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative md:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
    </div>
  );
}

export function SelectFilter({
  param,
  label,
  options,
  allLabel,
  defaultValue = "",
  className,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel: string;
  defaultValue?: string;
  className?: string;
}) {
  const { params, set } = useUrlParams();
  const value = params.get(param) ?? defaultValue;
  return (
    <Select value={value || "__all"} onValueChange={(v) => set({ [param]: v === "__all" ? null : v })}>
      <SelectTrigger aria-label={label} className={cn("w-full md:w-48", className)}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ResetFilters({ params: keys }: { params: string[] }) {
  const { params, set } = useUrlParams();
  if (!keys.some((k) => params.has(k))) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(keys.map((k) => [k, null])))}>
      <X />
      {t.common.reset}
    </Button>
  );
}
