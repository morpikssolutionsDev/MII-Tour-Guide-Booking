import { TriangleAlert } from "lucide-react";
import type { PriceSnapshot } from "@/domain/pricing";
import { t } from "@/i18n/id";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

const sp = t.pricing;

function surchargeLabel(s: NonNullable<PriceSnapshot["surcharge"]>) {
  const base = s.ruleType === "holiday" && s.holidayName ? sp.summary.ruleHoliday(s.holidayName) : s.name;
  const value = s.kind === "percent" ? `+${s.value}%` : `+${formatRupiah(s.value)} / guide`;
  return `${base} (${value})`;
}

/** design-system §7.3 PriceSummary: lines, divider, total in tabular figures. */
export function PriceSummary({
  snapshot,
  priceDiff,
  className,
}: {
  snapshot: PriceSnapshot;
  /** After a reschedule of a paid booking (05 §3.4). */
  priceDiff?: number | null;
  className?: string;
}) {
  const lines: { label: string; amount: number | null; muted?: boolean }[] = [
    {
      label: sp.summary.lineGuides(snapshot.package.name, formatRupiah(snapshot.package.pricePerGuide), snapshot.guidesNeeded),
      amount: snapshot.packageSubtotal,
    },
  ];
  if (snapshot.surcharge) lines.push({ label: surchargeLabel(snapshot.surcharge), amount: snapshot.surcharge.amount });
  for (const a of snapshot.addons) {
    lines.push(
      a.included
        ? { label: `${a.name} · ${sp.includedInPackage}`, amount: 0, muted: true }
        : { label: sp.summary.lineAddon(a.name, formatRupiah(a.unitPrice), a.quantity, a.unit === "per_person" ? "orang" : "pemesanan"), amount: a.amount },
    );
  }

  return (
    <div className={cn("space-y-3 text-sm", className)}>
      <dl className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="flex items-start justify-between gap-4">
            <dt className={cn(line.muted && "text-muted-foreground")}>{line.label}</dt>
            <dd className="shrink-0 tabular">{line.amount === null ? "" : formatRupiah(line.amount)}</dd>
          </div>
        ))}
      </dl>
      {snapshot.facilities.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {sp.includes}: {snapshot.facilities.join(", ")}
        </p>
      )}
      <div className="flex items-baseline justify-between border-t pt-3">
        <span className="font-semibold">{sp.summary.total}</span>
        <span className="text-lg font-bold tabular">{formatRupiah(snapshot.total)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{sp.simulator.guidesNeeded(snapshot.guidesNeeded, snapshot.package.maxPeoplePerGuide)}</p>
      {priceDiff ? (
        <p className="flex items-center gap-1.5 rounded-md bg-senja-50 px-3 py-2 text-xs font-medium text-senja-800">
          <TriangleAlert className="size-4" aria-hidden />
          Selisih harga: {priceDiff > 0 ? "+ " : "− "}
          {formatRupiah(Math.abs(priceDiff))}
        </p>
      ) : null}
    </div>
  );
}
