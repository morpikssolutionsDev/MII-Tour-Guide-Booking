"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { FilterBar, FilterChips, FilterField } from "@/components/common/filter-bar";
import { SelectFilter, useUrlParams } from "@/components/common/url-filters";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { addDays } from "@/domain/time";
import { t } from "@/i18n/id";

export function ScheduleToolbar({ date, today, languages }: { date: string; today: string; languages: { id: string; name: string }[] }) {
  const { params, set } = useUrlParams();
  const ts = t.schedule;
  const languageOptions = languages.map((l) => ({ value: l.id, label: l.name }));
  return (
    <FilterBar
      params={["bahasa", "nonaktif"]}
      searchParam={null}
      search={
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" aria-label={ts.prevDay} onClick={() => set({ tanggal: addDays(date, -1) })}>
            <ChevronLeft />
          </Button>
          <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => set({ tanggal: null })} disabled={date === today}>
            {ts.today}
          </Button>
          <Button variant="secondary" size="icon" aria-label={ts.nextDay} onClick={() => set({ tanggal: addDays(date, 1) })}>
            <ChevronRight />
          </Button>
          <div className="ml-1 min-w-0 flex-1 md:w-64 md:flex-none">
            <DatePicker id="board-date" value={date} onChange={(v) => set({ tanggal: v === today ? null : v })} />
          </div>
        </div>
      }
      chips={<FilterChips param="bahasa" allLabel={t.booking.all.language} options={languageOptions} />}
    >
      <FilterField label={t.booking.filters.language}>
        <SelectFilter param="bahasa" label={t.booking.filters.language} allLabel={t.booking.all.language} options={languageOptions} />
      </FilterField>
      <div className="flex items-center gap-2">
        <Switch id="show-inactive" checked={params.get("nonaktif") === "1"} onCheckedChange={(v) => set({ nonaktif: v ? "1" : null })} />
        <Label htmlFor="show-inactive">{ts.showInactive}</Label>
      </div>
    </FilterBar>
  );
}
