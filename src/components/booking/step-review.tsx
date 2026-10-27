"use client";

import { Info } from "lucide-react";
import { Field, fieldAria } from "@/components/common/field";
import { PriceSummary } from "@/components/common/price-summary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import type { Channel } from "@/db/schema";
import { computeHoldExpiry } from "@/domain/hold";
import type { PriceSnapshot } from "@/domain/pricing";
import { wibToUtc } from "@/domain/time";
import { t } from "@/i18n/id";
import { countryNameId, formatDateLong, formatDateTime, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CandidateView, CustomerForm, RescheduleContext, ScheduleForm, SlotView, WizardConfigView } from "./types";

const wr = t.booking.wizard.review;
const rs = t.booking.reschedule;

/** 05 §3.2 step 4 "Ringkasan" (and the §3.4 comparison when rescheduling). */
export function StepReview({
  config,
  customer,
  customerName,
  channel,
  schedule,
  slot,
  languageName,
  guideNames,
  snapshot,
  internalNotes,
  onInternalNotes,
  reschedule,
  errors,
}: {
  config: WizardConfigView;
  customer: CustomerForm | null;
  customerName: string;
  channel: Channel | null;
  schedule: ScheduleForm;
  slot: SlotView;
  languageName: string;
  guideNames: string[];
  snapshot: PriceSnapshot;
  internalNotes: string;
  onInternalNotes: (v: string) => void;
  reschedule: { context: RescheduleContext; reason: string; onReason: (v: string) => void; newGuideIds: string[]; candidates: CandidateView[] } | null;
  errors: Record<string, string>;
}) {
  const rows: [string, string][] = [
    [t.booking.wizard.customer.name, customerName],
    ...(customer
      ? ([
          [t.booking.wizard.customer.phone, customer.phone],
          [t.booking.wizard.customer.nationality, countryNameId(customer.nationality)],
        ] as [string, string][])
      : []),
    ...(channel ? ([[t.booking.wizard.customer.channel, t.channels[channel]]] as [string, string][]) : []),
    [t.booking.detail.tourDate, `${formatDateLong(schedule.date!)} · ${slot.label}`],
    [t.booking.detail.language, languageName],
    [t.booking.detail.people, t.common.people(schedule.people)],
    [t.booking.detail.package, snapshot.package.name],
    [t.booking.detail.guides, guideNames.join(", ")],
  ];
  if (schedule.specialNeeds) rows.push([t.booking.wizard.schedule.specialNeeds, schedule.specialNeeds]);

  // BR-05-11: the hold ends at the slot start when that comes before the normal hold time.
  const now = new Date();
  const hold = computeHoldExpiry(now, config.holdHours, schedule.date!, slot.startTime);
  const holdBySlot = wibToUtc(schedule.date!, slot.startTime).getTime() < now.getTime() + config.holdHours * 3_600_000;

  return (
    <div className="space-y-5">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-md border p-4 lg:hidden">
        <PriceSummary snapshot={snapshot} />
      </div>

      {reschedule ? (
        <RescheduleComparison reschedule={reschedule} snapshot={snapshot} schedule={schedule} slot={slot} />
      ) : (
        <Alert variant="info">
          <Info />
          <AlertDescription>
            {!config.paymentConfirmation
              ? wr.confirmedInfo
              : holdBySlot
                ? wr.holdInfoSlot(formatDateTime(hold.toISOString()))
                : wr.holdInfo(formatDateTime(hold.toISOString()), config.holdHours)}
          </AlertDescription>
        </Alert>
      )}

      {reschedule ? (
        <Field id="r-reason" label={rs.reason} required error={errors.reason}>
          <Textarea id="r-reason" maxLength={200} value={reschedule.reason} onChange={(e) => reschedule.onReason(e.target.value)} {...fieldAria("r-reason", errors.reason)} />
        </Field>
      ) : (
        <Field id="r-notes" label={wr.internalNotes} helper={wr.internalNotesHelp}>
          <Textarea id="r-notes" maxLength={500} value={internalNotes} onChange={(e) => onInternalNotes(e.target.value)} />
        </Field>
      )}
    </div>
  );
}

function RescheduleComparison({
  reschedule,
  snapshot,
  schedule,
  slot,
}: {
  reschedule: { context: RescheduleContext; newGuideIds: string[]; candidates: CandidateView[] };
  snapshot: PriceSnapshot;
  schedule: ScheduleForm;
  slot: SlotView;
}) {
  const before = reschedule.context.before;
  const name = (id: string) => reschedule.candidates.find((c) => c.guideId === id)?.displayName ?? before.guideNames[id] ?? id;
  const kept = reschedule.newGuideIds.filter((id) => before.guideIds.includes(id));
  const added = reschedule.newGuideIds.filter((id) => !before.guideIds.includes(id));
  const released = before.guideIds.filter((id) => !reschedule.newGuideIds.includes(id));
  const diff = snapshot.total - before.snapshot.total;

  return (
    <div className="overflow-hidden rounded-md border text-sm">
      <div className="grid grid-cols-[110px_1fr_1fr] bg-surface-muted px-3 py-2 text-xs font-medium text-muted-foreground">
        <span />
        <span>{rs.compare.before}</span>
        <span>{rs.compare.after}</span>
      </div>
      <div className="grid grid-cols-[110px_1fr_1fr] gap-2 border-t px-3 py-2">
        <span className="text-muted-foreground">{rs.compare.schedule}</span>
        <span>
          {formatDateLong(before.date)} · {before.slotLabel}
        </span>
        <span className="font-medium">
          {formatDateLong(schedule.date!)} · {slot.label}
        </span>
      </div>
      <div className="grid grid-cols-[110px_1fr_1fr] gap-2 border-t px-3 py-2">
        <span className="text-muted-foreground">{rs.compare.guides}</span>
        <span>{before.guideIds.map((id) => before.guideNames[id] ?? id).join(", ")}</span>
        <span className="space-y-0.5">
          {kept.map((id) => (
            <span key={id} className="block">
              {name(id)} <span className="text-xs text-muted-foreground">({rs.kept})</span>
            </span>
          ))}
          {added.map((id) => (
            <span key={id} className="block text-rimba-700">
              {name(id)} <span className="text-xs">({rs.added})</span>
            </span>
          ))}
          {released.map((id) => (
            <span key={id} className="block text-merah-700 line-through">
              {name(id)} <span className="text-xs no-underline">({rs.released})</span>
            </span>
          ))}
        </span>
      </div>
      <div className="grid grid-cols-[110px_1fr_1fr] gap-2 border-t px-3 py-2">
        <span className="text-muted-foreground">{rs.compare.price}</span>
        <span className="tabular">{formatRupiah(before.snapshot.total)}</span>
        <span className="font-medium tabular">{formatRupiah(snapshot.total)}</span>
      </div>
      {reschedule.context.hasPayments && diff !== 0 && (
        <div className={cn("border-t px-3 py-2 text-xs font-medium", "bg-senja-50 text-senja-800")}>
          {diff > 0 ? rs.diffCharge(formatRupiah(diff)) : rs.diffRefund(formatRupiah(-diff))}
          <span className="block font-normal">{rs.diffNote}</span>
        </div>
      )}
    </div>
  );
}
