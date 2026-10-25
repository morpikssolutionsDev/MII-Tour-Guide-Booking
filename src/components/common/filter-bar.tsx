"use client";

import { Check, ChevronsUpDown, SlidersHorizontal, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t } from "@/i18n/id";
import { cn } from "@/lib/utils";
import { useUrlParams } from "./url-filters";

/**
 * Responsive filter bar (design-system §7.3 FilterBar):
 * desktop shows the controls inline; mobile shows quick-filter chips plus a
 * "Filter (N)" button that opens the full controls in a bottom sheet.
 */
export function FilterBar({
  search,
  chips,
  params,
  searchParam = "q",
  children,
}: {
  search?: ReactNode;
  /** Mobile quick filters (chip style). */
  chips?: ReactNode;
  /** URL params the sheet controls: drive the count badge and "Reset". */
  params: string[];
  /** Cleared by the desktop "Reset" alongside `params`; null when the leading slot is not a search. */
  searchParam?: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { params: current, set } = useUrlParams();
  const active = params.filter((p) => current.has(p)).length;
  const reset = () => set(Object.fromEntries(params.map((p) => [p, null])));
  const searching = Boolean(search) && searchParam !== null && current.has(searchParam);

  return (
    <div className="space-y-3">
      {/* Desktop: everything inline. */}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {search}
        {children}
        {(active > 0 || searching) && (
          <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries([...params, ...(searchParam ? [searchParam] : [])].map((p) => [p, null])))}>
            <X />
            {t.common.reset}
          </Button>
        )}
      </div>

      {/* Mobile: search + Filter button, then quick chips. */}
      <div className="space-y-3 md:hidden">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">{search}</div>
          <Button variant="secondary" onClick={() => setOpen(true)} aria-haspopup="dialog" className={cn(!search && "w-full")}>
            <SlidersHorizontal />
            {t.common.filter}
            {active > 0 && <span className="rounded-full bg-danau-700 px-1.5 text-xs font-semibold text-white tabular">{active}</span>}
          </Button>
        </div>
        {chips}
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{t.common.filter}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-2 [&>*]:w-full">{children}</div>
          <DrawerFooter className="pb-safe flex-row gap-2">
            <Button variant="secondary" className="flex-1" onClick={reset} disabled={active === 0}>
              {t.common.reset}
            </Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>
              {t.common.done}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/** A labelled control inside the filter sheet (label hidden on desktop, where controls are inline). */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 md:space-y-0">
      <p className="text-sm font-medium md:sr-only">{label}</p>
      {children}
    </div>
  );
}

/** Single-select chips bound to a URL param (mobile quick filtering). */
export function FilterChips({
  param,
  options,
  allLabel,
  defaultValue = "",
  className,
}: {
  param: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  defaultValue?: string;
  className?: string;
}) {
  const { params, set } = useUrlParams();
  const value = params.get(param) ?? defaultValue;
  const items = allLabel ? [{ value: "", label: allLabel }, ...options] : options;
  return (
    <div className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1", className)} role="radiogroup" aria-label={allLabel ?? param}>
      {items.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value || "all"}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => set({ [param]: o.value === defaultValue ? null : o.value || null })}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
              on ? "border-danau-700 bg-danau-700 text-white" : "border-kabut-200 bg-card text-foreground hover:bg-kabut-50",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** On/off chip bound to `?{param}=1`. */
export function ToggleChip({ param, label }: { param: string; label: string }) {
  const { params, set } = useUrlParams();
  const on = params.get(param) === "1";
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => set({ [param]: on ? null : "1" })}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
        on ? "border-danau-700 bg-danau-700 text-white" : "border-kabut-200 bg-card text-foreground hover:bg-kabut-50",
      )}
    >
      {on && <Check className="size-4" aria-hidden />}
      {label}
    </button>
  );
}

/** Multi-select bound to a comma-separated URL param (Laporan filters, 11 §3.2). */
export function MultiSelectFilter({
  param,
  label,
  options,
  className,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const { params, set } = useUrlParams();
  const [open, setOpen] = useState(false);
  const selected = (params.get(param) ?? "").split(",").filter(Boolean);
  const toggle = (value: string) => {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    set({ [param]: next.length ? next.join(",") : null });
  };
  const summary =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? label)
        : `${label} (${selected.length})`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" role="combobox" aria-expanded={open} className={cn("w-full justify-between font-normal sm:w-48", selected.length === 0 && "text-muted-foreground", className)}>
          <span className="truncate">{summary}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          {options.length > 6 && <CommandInput placeholder={`${t.common.search}…`} />}
          <CommandList>
            <CommandEmpty>{t.common.none}</CommandEmpty>
            {options.map((o) => (
              <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                <span className={cn("flex size-4 items-center justify-center rounded-sm border", selected.includes(o.value) ? "border-danau-700 bg-danau-700 text-white" : "border-input-border")}>
                  {selected.includes(o.value) && <Check className="size-3" />}
                </span>
                {o.label}
              </CommandItem>
            ))}
          </CommandList>
          {selected.length > 0 && (
            <div className="border-t p-1">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => set({ [param]: null })}>
                {t.common.reset}
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
