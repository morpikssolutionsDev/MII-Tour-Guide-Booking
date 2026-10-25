"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const grouping = new Intl.NumberFormat("id-ID");

/** design-system §7.2: "Rp" prefix, dot thousands separator while typing, integer value. */
export function MoneyInput({
  id,
  value,
  onChange,
  className,
  ...rest
}: {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        className="pl-10 tabular"
        value={value === null ? "" : grouping.format(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits ? Math.min(Number(digits), 1_000_000_000) : null);
        }}
        {...rest}
      />
    </div>
  );
}
