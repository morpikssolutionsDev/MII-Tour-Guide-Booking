import type { LucideIcon } from "lucide-react";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * design-system §7.3 KpiTile. The delta shows ▲/▼ plus text, never colour alone;
 * `lowerIsBetter` flips the colour for measures like the cancellation share.
 */
export function KpiTile({
  label,
  value,
  valueTitle,
  valueTone,
  sub,
  delta,
  lowerIsBetter = false,
  icon: Icon,
  tone,
  className,
}: {
  label: string;
  value: string;
  /** Exact value when `value` is abbreviated (BR-11-11). */
  valueTitle?: string;
  valueTone?: "danger";
  sub?: string;
  delta?: number | null;
  lowerIsBetter?: boolean;
  icon?: LucideIcon;
  tone?: "warning";
  className?: string;
}) {
  const showDelta = delta !== undefined;
  const good = delta !== null && delta !== undefined && (lowerIsBetter ? delta < 0 : delta > 0);
  const flat = delta === 0;
  return (
    <div className={cn("flex min-w-[150px] flex-col rounded-lg border bg-card p-4 shadow-card", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-5 text-danau-600" aria-hidden />}
      </div>
      <p className={cn("mt-1 text-kpi font-bold tabular", valueTone === "danger" && "text-merah-700")} title={valueTitle}>
        {value}
      </p>
      {showDelta && (
        <p className={cn("mt-1 text-xs font-medium", delta === null || flat ? "text-muted-foreground" : good ? "text-rimba-600" : "text-merah-700")}>
          {delta === null ? "—" : `${delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} ${formatPercent(Math.abs(delta))}`}
          <span className="font-normal text-muted-foreground"> vs periode sebelumnya</span>
        </p>
      )}
      {sub && <p className={cn("mt-1 text-xs", tone === "warning" ? "font-medium text-senja-800" : "text-muted-foreground")}>{sub}</p>}
    </div>
  );
}
