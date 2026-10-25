"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { id as localeId } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useIsDesktop } from "@/hooks/use-media-query";
import { formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";

const toDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** A from–to range in one calendar (popover on desktop, bottom sheet on mobile). */
export function DateRangePicker({
  id,
  from,
  to,
  onChange,
  placeholder = "Pilih rentang tanggal",
  max,
  className,
}: {
  id: string;
  from: string | null;
  to: string | null;
  onChange: (range: { from: string | null; to: string | null }) => void;
  placeholder?: string;
  max?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const desktop = useIsDesktop();
  const label =
    from && to ? (from === to ? formatDateLong(from) : `${formatDayMonthShort(from)} – ${formatDayMonthShort(to)}`) : from ? `${formatDayMonthShort(from)} – …` : placeholder;
  const calendar = (
    <Calendar
      mode="range"
      locale={localeId}
      weekStartsOn={1}
      numberOfMonths={desktop ? 2 : 1}
      selected={from ? { from: toDate(from), to: to ? toDate(to) : undefined } : undefined}
      defaultMonth={from ? toDate(from) : undefined}
      onSelect={(range) => {
        onChange({ from: range?.from ? toValue(range.from) : null, to: range?.to ? toValue(range.to) : null });
        if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) setOpen(false);
      }}
      disabled={max ? [{ after: toDate(max) }] : undefined}
      className="[--cell-size:--spacing(10)] [&_[data-range-end=true]]:bg-danau-700 [&_[data-range-start=true]]:bg-danau-700 [&_[data-selected-single=true]]:bg-danau-700"
    />
  );
  const trigger = (
    <Button
      id={id}
      type="button"
      variant="secondary"
      className={cn("w-full justify-start font-normal md:w-60", !from && "text-muted-foreground", className)}
      onClick={desktop ? undefined : () => setOpen(true)}
    >
      <CalendarDays />
      <span className="truncate">{label}</span>
    </Button>
  );
  if (desktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          {calendar}
          {(from || to) && (
            <div className="flex justify-end border-t pt-2">
              <Button variant="ghost" size="sm" onClick={() => onChange({ from: null, to: null })}>
                Hapus
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <>
      {trigger}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col items-center gap-2 pb-6">
            {calendar}
            {(from || to) && (
              <Button variant="ghost" size="sm" onClick={() => onChange({ from: null, to: null })}>
                Hapus
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

const dayMonthShort = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
function formatDayMonthShort(value: string) {
  return dayMonthShort.format(new Date(`${value}T00:00:00Z`));
}

/**
 * design-system §7.2: calendar in a popover (bottom sheet on mobile). Days outside
 * [min, max] are disabled; holidays carry a dot; weekends are tinted Batu 100.
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  holidays = [],
  placeholder = "Pilih tanggal",
  invalid,
}: {
  id: string;
  value: string | null;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  holidays?: { date: string; name: string }[];
  placeholder?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const desktop = useIsDesktop();
  const holiday = value ? holidays.find((h) => h.date === value) : undefined;

  const calendar = (
    <Calendar
      mode="single"
      locale={localeId}
      weekStartsOn={1}
      selected={value ? toDate(value) : undefined}
      defaultMonth={value ? toDate(value) : min ? toDate(min) : undefined}
      onSelect={(date) => {
        if (!date) return;
        onChange(toValue(date));
        setOpen(false);
      }}
      disabled={[...(min ? [{ before: toDate(min) }] : []), ...(max ? [{ after: toDate(max) }] : [])]}
      modifiers={{ holiday: holidays.map((h) => toDate(h.date)), weekend: { dayOfWeek: [0, 6] } }}
      modifiersClassNames={{
        holiday: "relative after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-senja-600",
        weekend: "bg-batu-100",
      }}
      className="[--cell-size:--spacing(10)] [&_[data-selected-single=true]]:bg-danau-700 [&_[data-selected-single=true]]:text-white"
    />
  );

  const trigger = (
    <Button
      id={id}
      type="button"
      variant="secondary"
      aria-invalid={invalid || undefined}
      className={cn("w-full justify-start font-normal", !value && "text-muted-foreground")}
      onClick={desktop ? undefined : () => setOpen(true)}
    >
      <CalendarDays />
      {value ? formatDateLong(value) : placeholder}
    </Button>
  );

  return (
    <div className="space-y-1">
      {desktop ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            {calendar}
          </PopoverContent>
        </Popover>
      ) : (
        <>
          {trigger}
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>{placeholder}</DrawerTitle>
              </DrawerHeader>
              <div className="flex justify-center pb-6">{calendar}</div>
            </DrawerContent>
          </Drawer>
        </>
      )}
      {holiday && <p className="text-xs font-medium text-senja-800">Hari libur: {holiday.name}</p>}
    </div>
  );
}
