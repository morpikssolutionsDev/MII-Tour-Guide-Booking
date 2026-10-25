"use client";

import { DateRangeFilter } from "@/components/common/date-range-filter";
import { FilterBar, FilterChips, FilterField, MultiSelectFilter } from "@/components/common/filter-bar";
import { useUrlParams } from "@/components/common/url-filters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHANNELS } from "@/db/schema";
import { t } from "@/i18n/id";
import { PERIOD_PRESETS } from "@/server/reports/params";

type Option = { id: string; name: string };
const r = t.reports;

/** 11 §3.2 FilterBar: period + multi-selects; mobile gets period chips and a filter sheet. */
export function ReportFilters({ options }: { options: { languages: Option[]; packages: Option[]; guides: Option[] } }) {
  const { params, set } = useUrlParams();
  const preset = params.get("periode") ?? "30";
  const toOptions = (list: Option[]) => list.map((o) => ({ value: o.id, label: o.name }));

  return (
    <FilterBar
      params={["periode", "dari", "sampai", "kanal", "bahasa", "paket", "guide"]}
      chips={<FilterChips param="periode" defaultValue="30" options={PERIOD_PRESETS.map((p) => ({ value: p, label: r.presetsShort[p] }))} />}
    >
      <FilterField label={r.period}>
        <Select value={preset} onValueChange={(v) => set({ periode: v === "30" ? null : v, ...(v === "kustom" ? {} : { dari: null, sampai: null }) })}>
          <SelectTrigger aria-label={r.period} className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_PRESETS.map((p) => (
              <SelectItem key={p} value={p}>
                {r.presets[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
      {preset === "kustom" && (
        <FilterField label={r.presets.kustom}>
          <DateRangeFilter label={r.presets.kustom} />
        </FilterField>
      )}
      <FilterField label={r.filters.channel}>
        <MultiSelectFilter param="kanal" label={r.filters.channel} options={CHANNELS.map((c) => ({ value: c, label: t.channels[c] }))} className="md:w-40" />
      </FilterField>
      <FilterField label={r.filters.language}>
        <MultiSelectFilter param="bahasa" label={r.filters.language} options={toOptions(options.languages)} className="md:w-40" />
      </FilterField>
      <FilterField label={r.filters.package}>
        <MultiSelectFilter param="paket" label={r.filters.package} options={toOptions(options.packages)} className="md:w-40" />
      </FilterField>
      <FilterField label={r.filters.guide}>
        <MultiSelectFilter param="guide" label={r.filters.guide} options={toOptions(options.guides)} className="md:w-44" />
      </FilterField>
    </FilterBar>
  );
}
