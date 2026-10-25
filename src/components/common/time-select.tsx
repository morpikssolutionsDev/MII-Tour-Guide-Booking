"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const pad = (n: number) => String(n).padStart(2, "0");

/** Hour + minute dropdowns (replaces native time inputs). Value is `HH:mm`. */
export function TimeSelect({
  id,
  value,
  onChange,
  minuteStep = 5,
  minHour = 0,
  maxHour = 23,
  invalid,
  disabled,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  minuteStep?: number;
  minHour?: number;
  maxHour?: number;
  invalid?: boolean;
  disabled?: boolean;
  label: string;
}) {
  const [h, m] = value ? value.split(":") : ["", ""];
  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => pad(minHour + i));
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => pad(i * minuteStep));
  // Keep an off-step stored minute selectable.
  if (m && !minutes.includes(m)) minutes.push(m);
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <Select value={h} onValueChange={(v) => onChange(`${v}:${m || "00"}`)} disabled={disabled}>
        <SelectTrigger id={id} aria-label={`${label}: jam`} aria-invalid={invalid || undefined} className="w-20 tabular">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {hours.map((hh) => (
            <SelectItem key={hh} value={hh} className="tabular">
              {hh}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="font-semibold text-muted-foreground">.</span>
      <Select value={m} onValueChange={(v) => onChange(`${h || pad(minHour)}:${v}`)} disabled={disabled}>
        <SelectTrigger aria-label={`${label}: menit`} aria-invalid={invalid || undefined} className="w-20 tabular">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {minutes.sort().map((mm) => (
            <SelectItem key={mm} value={mm} className="tabular">
              {mm}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
