"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** − / value / + stepper (replaces raw number inputs). Typing is still allowed. */
export function NumberStepper({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  invalid,
  className,
}: {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  invalid?: boolean;
  className?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button type="button" variant="secondary" size="icon" aria-label="Kurangi" disabled={value !== null && value <= min} onClick={() => onChange(clamp((value ?? min) - step))}>
        <Minus />
      </Button>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className="w-20 text-center tabular"
        value={value === null ? "" : String(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits === "" ? null : Math.min(max, Number(digits)));
        }}
        onBlur={() => value !== null && onChange(clamp(value))}
      />
      <Button type="button" variant="secondary" size="icon" aria-label="Tambah" disabled={value !== null && value >= max} onClick={() => onChange(clamp((value ?? min - step) + step))}>
        <Plus />
      </Button>
      {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
    </div>
  );
}
