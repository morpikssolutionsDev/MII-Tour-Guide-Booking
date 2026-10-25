"use client";

import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/common/field";
import { DatePicker } from "@/components/common/date-picker";
import { NumberStepper } from "@/components/common/number-stepper";
import { PriceSummary } from "@/components/common/price-summary";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  calculatePrice,
  type PriceSnapshot,
  type PricingAddon,
  type PricingHoliday,
  type PricingPackage,
  type PricingRule,
} from "@/domain/pricing";
import { isValidDate } from "@/domain/time";
import { t } from "@/i18n/id";
import { formatRupiah } from "@/lib/format";

const ss = t.pricing.simulator;

/**
 * 03 §3.6: a live quote, computed with the same pure calculatePrice that bookings use,
 * over the same active configuration, so the simulator and real bookings cannot disagree.
 */
export function Simulator({
  today,
  packages,
  addons,
  rules,
  holidays,
}: {
  today: string;
  packages: PricingPackage[];
  addons: PricingAddon[];
  rules: PricingRule[];
  holidays: PricingHoliday[];
}) {
  const [date, setDate] = useState(today);
  const [people, setPeople] = useState("2");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const pkg = packages.find((p) => p.id === packageId);

  const peopleNum = Number(people);
  let snapshot: PriceSnapshot | null = null;
  if (pkg && isValidDate(date) && Number.isInteger(peopleNum) && peopleNum >= 1 && peopleNum <= 200) {
    snapshot = calculatePrice({ date, people: peopleNum, pkg, selectedAddonIds: addonIds, addons, rules, holidays });
  }
  const offered = addons.filter((a) => !pkg?.includedAddonIds.includes(a.id));
  const bookHref = `/pemesanan/baru?date=${date}&people=${peopleNum}&package=${packageId}${addonIds.length ? `&addons=${addonIds.join(",")}` : ""}`;

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_400px]">
      <div className="space-y-5 rounded-lg border bg-card p-5 shadow-card md:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sim-date" label={ss.date} required>
            <DatePicker id="sim-date" min={today} value={date} onChange={setDate} holidays={holidays} />
          </Field>
          <Field id="sim-people" label={ss.people} required>
            <NumberStepper id="sim-people" min={1} max={200} value={people === "" ? null : Number(people)} onChange={(v) => setPeople(v === null ? "" : String(v))} unit="orang" />
          </Field>
        </div>
        <Field id="sim-package" label={ss.package} required>
          <Select value={packageId} onValueChange={(v) => { setPackageId(v); setAddonIds([]); }}>
            <SelectTrigger id="sim-package" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {packages.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {formatRupiah(p.pricePerGuide)} / guide
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {offered.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{ss.addons}</legend>
            <div className="space-y-2">
              {offered.map((a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <Checkbox id={`sim-${a.id}`} checked={addonIds.includes(a.id)} onCheckedChange={(v) => setAddonIds((l) => (v ? [...l, a.id] : l.filter((x) => x !== a.id)))} />
                  <Label htmlFor={`sim-${a.id}`} className="font-normal">
                    {a.name} · {formatRupiah(a.price)} / {t.pricing.unit[a.unit]}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
        )}
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden />
          {ss.note}
        </p>
      </div>
      <aside className="space-y-4 rounded-lg border bg-card p-5 shadow-card lg:sticky lg:top-20 lg:self-start">
        <h2 className="font-semibold">{t.pricing.summary.title}</h2>
        {snapshot ? <PriceSummary snapshot={snapshot} /> : <p className="text-sm text-muted-foreground">{ss.empty}</p>}
        {snapshot && (
          <Button asChild className="w-full">
            <Link href={bookHref}>
              {ss.book}
              <ArrowRight />
            </Link>
          </Button>
        )}
      </aside>
    </section>
  );
}
