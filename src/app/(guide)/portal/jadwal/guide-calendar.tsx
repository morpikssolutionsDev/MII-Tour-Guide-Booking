"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { id as localeId } from "react-day-picker/locale";
import { EmptyState } from "@/components/common/empty-state";
import { TourCard } from "@/components/portal/tour-card";
import { Calendar } from "@/components/ui/calendar";
import { t } from "@/i18n/id";
import { formatDateLong } from "@/lib/format";
import type { TourCardView } from "@/server/portal/queries";

const toDate = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 08 §3.2 month view: dots on tour days, Batu tint on leave days; tap a day to list its tours. */
export function GuideCalendar({ month, tours, leaveDays }: { month?: string; tours: (TourCardView & { rating: number | null })[]; leaveDays: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<string | null>(null);
  const shown = month && /^\d{4}-\d{2}$/.test(month) ? toDate(`${month}-01`) : new Date();
  const counts = new Map<string, number>();
  for (const tour of tours) if (tour.status !== "cancelled") counts.set(tour.tourDate, (counts.get(tour.tourDate) ?? 0) + 1);
  const oneTour = [...counts].filter(([, n]) => n === 1).map(([d]) => toDate(d));
  const manyTours = [...counts].filter(([, n]) => n > 1).map(([d]) => toDate(d));
  const dayTours = selected ? tours.filter((x) => x.tourDate === selected) : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-center rounded-lg border bg-card p-2 shadow-card">
        <Calendar
          mode="single"
          locale={localeId}
          weekStartsOn={1}
          month={shown}
          onMonthChange={(m) => router.replace(`${pathname}?view=kalender&bulan=${toValue(m).slice(0, 7)}`, { scroll: false })}
          selected={selected ? toDate(selected) : undefined}
          onSelect={(d) => setSelected(d ? toValue(d) : null)}
          modifiers={{ one: oneTour, many: manyTours, leave: leaveDays.map(toDate) }}
          modifiersClassNames={{
            one: "relative after:absolute after:bottom-1 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-danau-600",
            many: "relative after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-3.5 after:-translate-x-1/2 after:rounded-full after:bg-danau-600",
            leave: "bg-batu-100",
          }}
          className="[--cell-size:--spacing(11)] [&_[data-selected-single=true]]:bg-danau-700 [&_[data-selected-single=true]]:text-white"
        />
      </div>
      {selected && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{formatDateLong(selected)}</h2>
          {leaveDays.includes(selected) && <div className="hatch-batu rounded-md px-3 py-2 text-sm font-medium text-batu-800">{t.portal.leaveDay}</div>}
          {dayTours.length === 0 ? (
            <EmptyState title={t.portal.dayEmpty} className="py-4" />
          ) : (
            dayTours.map((tour) => <TourCard key={tour.bookingId} tour={tour} compact />)
          )}
        </section>
      )}
    </div>
  );
}
