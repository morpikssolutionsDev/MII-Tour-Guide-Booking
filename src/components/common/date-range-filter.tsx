"use client";

import { DateRangePicker } from "./date-picker";
import { useUrlParams } from "./url-filters";

/** Date range filter bound to `?dari=&sampai=` (custom calendar, no native inputs). */
export function DateRangeFilter({ label, fromParam = "dari", toParam = "sampai" }: { label: string; fromParam?: string; toParam?: string }) {
  const { params, set } = useUrlParams();
  return (
    <DateRangePicker
      id={`range-${fromParam}`}
      placeholder={label}
      from={params.get(fromParam)}
      to={params.get(toParam)}
      onChange={({ from, to }) => {
        // Apply once the range is complete (or cleared).
        if (from && !to) return;
        set({ [fromParam]: from, [toParam]: to });
      }}
    />
  );
}
