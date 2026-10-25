"use client";

import { RefreshCw } from "lucide-react";
import { Pill } from "@/components/common/badges";
import { DatePicker } from "@/components/common/date-picker";
import { Field } from "@/components/common/field";
import { NumberStepper } from "@/components/common/number-stepper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isoWeekday } from "@/domain/time";
import { t } from "@/i18n/id";
import { facilityIcon } from "@/lib/facility-icons";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SlotChip } from "./slot-chip";
import type { ScheduleForm, SlotView, WizardConfigView } from "./types";

const ws = t.booking.wizard.schedule;

/** 05 §3.2 step 2 "Jadwal". */
export function StepSchedule({
  config,
  schedule,
  onChange,
  guidesNeeded,
  slots,
  slotsLoading,
  strip,
  selectedSlotId,
  onRefresh,
  errors,
  customerNotes,
}: {
  config: WizardConfigView;
  schedule: ScheduleForm;
  onChange: (patch: Partial<ScheduleForm>) => void;
  guidesNeeded: number;
  slots: SlotView[] | null;
  slotsLoading: boolean;
  strip: { date: string; availableSlots: number }[] | null;
  selectedSlotId: string | null;
  onRefresh: () => void;
  errors: Record<string, string>;
  customerNotes: string;
}) {
  const pkg = config.packages.find((p) => p.id === schedule.packageId);
  const offeredAddons = config.addons.filter((a) => !pkg?.includedAddonIds.includes(a.id));
  const ready = schedule.languageId && schedule.packageId && schedule.date && schedule.people >= 1;

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">
          {ws.language} <span aria-hidden>*</span>
        </legend>
        <ToggleGroup type="single" variant="outline" value={schedule.languageId} onValueChange={(v) => v && onChange({ languageId: v })} className="flex-wrap">
          {config.languages.map((l) => (
            <ToggleGroupItem key={l.id} value={l.id} className="h-11 min-w-24 data-[state=on]:bg-danau-50 data-[state=on]:text-danau-800 md:h-10">
              {l.nameId}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <Field id="s-people" label={ws.people} required error={errors.people}>
        <NumberStepper
          id="s-people"
          min={1}
          max={200}
          value={Number.isNaN(schedule.people) ? null : schedule.people}
          onChange={(v) => onChange({ people: v ?? Number.NaN })}
          invalid={Boolean(errors.people)}
          unit="orang"
        />
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">
          {ws.package} <span aria-hidden>*</span>
        </legend>
        <div className="grid gap-3 md:grid-cols-3" role="radiogroup">
          {config.packages.map((p) => {
            const selected = p.id === schedule.packageId;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ packageId: p.id, addonIds: schedule.addonIds.filter((id) => !p.includedAddonIds.includes(id)) })}
                className={cn(
                  "flex flex-col rounded-lg border p-4 text-left transition-colors",
                  selected ? "border-danau-700 bg-danau-50 ring-1 ring-danau-700" : "bg-card hover:bg-kabut-50",
                )}
              >
                <span className="font-semibold">{p.name}</span>
                <span className="text-sm tabular">
                  {formatRupiah(p.pricePerGuide)} / guide · maks. {p.maxPeoplePerGuide} orang
                </span>
                <span className="mt-2 flex flex-wrap gap-1">
                  {p.facilities.slice(0, 4).map((f) => {
                    const Icon = facilityIcon(f.icon);
                    return <Icon key={f.name} className="size-4 text-danau-700" aria-label={f.name} />;
                  })}
                  {p.includedAddonIds.length > 0 && (
                    <Pill tone="senja" className="ml-1">
                      {config.addons.filter((a) => p.includedAddonIds.includes(a.id)).map((a) => a.name).join(", ")}
                    </Pill>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-sm font-medium text-danau-800">{ws.needGuides(guidesNeeded)}</p>
      </fieldset>

      <Field id="s-date" label={ws.date} required error={errors.date}>
        <div className="md:max-w-sm">
          <DatePicker id="s-date" value={schedule.date} onChange={(date) => onChange({ date })} min={config.today} max={config.maxDate} holidays={config.holidays} invalid={Boolean(errors.date)} />
        </div>
      </Field>

      {strip && strip.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-medium">{ws.strip}</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {strip.map((d) => {
              const selected = d.date === schedule.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => onChange({ date: d.date })}
                  aria-pressed={selected}
                  className={cn(
                    "flex min-w-20 flex-col items-center rounded-md border px-2 py-2 text-xs",
                    selected ? "border-danau-700 bg-danau-50 text-danau-800" : "bg-card hover:bg-kabut-50",
                    d.availableSlots === 0 && !selected && "text-muted-foreground",
                  )}
                >
                  <span className="font-medium">{t.weekdaysShort[isoWeekday(d.date) - 1]}</span>
                  <span className="text-lg font-bold tabular">{Number(d.date.slice(8, 10))}</span>
                  <span className={cn(d.availableSlots === 0 ? "text-merah-700" : "text-rimba-700")}>{ws.stripSlots(d.availableSlots)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {ws.slot} <span aria-hidden>*</span>
          </p>
          {ready && (
            <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={slotsLoading}>
              <RefreshCw className={cn(slotsLoading && "animate-spin")} />
              {ws.recheck}
            </Button>
          )}
        </div>
        {!ready ? (
          <p className="text-sm text-muted-foreground">{ws.pickFirst}</p>
        ) : slotsLoading || !slots ? (
          <div className="grid gap-2 sm:grid-cols-3" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-kabut-100" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{ws.noSlots}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={ws.slot}>
            {slots.map((s) => (
              <SlotChip key={s.slotId} slot={s} selected={s.slotId === selectedSlotId} onSelect={() => onChange({ slotId: s.slotId })} />
            ))}
          </div>
        )}
        {errors.slotId && <p className="mt-1.5 text-xs font-medium text-merah-700">{errors.slotId}</p>}
      </div>

      {offeredAddons.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{ws.addons}</legend>
          <div className="space-y-2">
            {offeredAddons.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <Checkbox
                  id={`addon-${a.id}`}
                  checked={schedule.addonIds.includes(a.id)}
                  onCheckedChange={(v) => onChange({ addonIds: v ? [...schedule.addonIds, a.id] : schedule.addonIds.filter((x) => x !== a.id) })}
                />
                <Label htmlFor={`addon-${a.id}`} className="font-normal">
                  {a.name} · {formatRupiah(a.price)} / {t.pricing.unit[a.unit]}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <Field id="s-needs" label={ws.specialNeeds} helper={ws.specialNeedsHelp}>
        <Textarea id="s-needs" maxLength={500} value={schedule.specialNeeds} placeholder={customerNotes || undefined} onChange={(e) => onChange({ specialNeeds: e.target.value })} />
      </Field>
    </div>
  );
}
