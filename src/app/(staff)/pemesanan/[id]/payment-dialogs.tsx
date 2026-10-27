"use client";

import { Banknote, Cpu, CreditCard, Landmark, QrCode, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field, fieldAria } from "@/components/common/field";
import { DatePicker } from "@/components/common/date-picker";
import { TimeSelect } from "@/components/common/time-select";
import { ImageDrop } from "@/components/common/file-drop";
import { MoneyInput } from "@/components/common/money-input";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MANUAL_PAYMENT_METHODS, type ManualPaymentMethod, type PaymentMethod } from "@/db/schema";
import { toWib } from "@/domain/time";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { formatRupiah } from "@/lib/format";
import { confirmPayment, recordAdjustment, voidPayment } from "@/server/payments/actions";

const sp = t.payment;
export const METHOD_ICONS: Record<PaymentMethod, typeof Landmark> = { bank_transfer: Landmark, qris: QrCode, cash: Banknote, edc: CreditCard, system: Cpu };

function MethodPicker({ value, onChange }: { value: ManualPaymentMethod; onChange: (m: ManualPaymentMethod) => void }) {
  return (
    <ToggleGroup type="single" variant="outline" value={value} onValueChange={(v) => v && onChange(v as ManualPaymentMethod)} className="grid w-full grid-cols-2 sm:grid-cols-4">
      {MANUAL_PAYMENT_METHODS.map((m) => {
        const Icon = METHOD_ICONS[m];
        return (
          <ToggleGroupItem key={m} value={m} className="h-11 gap-1.5 data-[state=on]:bg-danau-50 data-[state=on]:text-danau-800 md:h-10">
            <Icon className="size-4" />
            {t.paymentMethods[m]}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

function PaidAtInputs({ date, time, onDate, onTime, error }: { date: string; time: string; onDate: (v: string) => void; onTime: (v: string) => void; error?: string }) {
  return (
    <Field id="paid-date" label={sp.fields.paidAt} required error={error}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <DatePicker id="paid-date" value={date} onChange={onDate} invalid={Boolean(error)} />
        </div>
        <TimeSelect id="paid-time" label="Jam" value={time} onChange={onTime} minuteStep={1} />
      </div>
    </Field>
  );
}

/** 06 §3.2 "Tandai Lunas". */
export function MarkPaidDialog({ bookingId, code, total, onClose }: { bookingId: string; code: string; total: number; onClose: () => void }) {
  const nowWib = toWib(new Date());
  const [method, setMethod] = useState<ManualPaymentMethod>("bank_transfer");
  const [amount, setAmount] = useState<number | null>(total);
  const [paidDate, setPaidDate] = useState(nowWib.date);
  const [paidTime, setPaidTime] = useState(nowWib.time);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState(false);
  const action = useAction(confirmPayment, { successMessage: sp.confirmed(code), onSuccess: onClose, quiet: ["INVALID_STATE"] });
  const e = action.fieldErrors;
  const mismatch = amount !== null && amount !== total;
  const expired = action.failure?.code === "INVALID_STATE" && (action.failure.details as { expired?: boolean } | undefined)?.expired;

  return (
    <ResponsiveDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={sp.markPaidTitle(code)}
      description={`${sp.total} ${formatRupiah(total)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            pending={action.pending}
            disabled={mismatch && !checked}
            onClick={() =>
              action.run({
                bookingId,
                method,
                amount: amount ?? 0,
                paidDate,
                paidTime,
                proofFile: file ?? undefined,
                reference,
                note,
                mismatchAcknowledged: checked,
              })
            }
          >
            {sp.markPaid}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {action.failure?.code === "INVALID_STATE" && (
          <Alert variant="destructive">
            <AlertDescription className="space-y-2">
              <span className="block">{action.failure.error}</span>
              {expired && (
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/pemesanan/baru?ulang=${bookingId}`}>{sp.rebook}</Link>
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">
            {sp.fields.method} <span aria-hidden>*</span>
          </legend>
          <MethodPicker value={method} onChange={setMethod} />
        </fieldset>
        <Field id="pay-amount" label={sp.fields.amount} required error={e.amount}>
          <MoneyInput id="pay-amount" value={amount} onChange={setAmount} {...fieldAria("pay-amount", e.amount)} />
        </Field>
        {mismatch && amount !== null && (
          <Alert variant="warning">
            <TriangleAlert />
            <AlertDescription className="space-y-2">
              <span className="block">{sp.mismatch(formatRupiah(Math.abs(total - amount)))}</span>
              <span className="flex items-center gap-2">
                <Checkbox id="pay-check" checked={checked} onCheckedChange={(v) => setChecked(Boolean(v))} />
                <Label htmlFor="pay-check">{sp.mismatchCheck}</Label>
              </span>
            </AlertDescription>
          </Alert>
        )}
        <PaidAtInputs date={paidDate} time={paidTime} onDate={setPaidDate} onTime={setPaidTime} error={e.paidDate} />
        <Field id="pay-proof" label={sp.fields.proof} helper={sp.fields.proofHelp} error={e.proofFile}>
          <ImageDrop id="pay-proof" file={file} onChange={setFile} label={sp.pickFile} />
        </Field>
        <Field id="pay-ref" label={sp.fields.reference} helper={method === "cash" ? undefined : sp.fields.referenceHelp} error={e.reference}>
          <Input id="pay-ref" maxLength={60} value={reference} onChange={(ev) => setReference(ev.target.value)} {...fieldAria("pay-ref", e.reference)} />
        </Field>
        <Field id="pay-note" label={sp.fields.note}>
          <Textarea id="pay-note" maxLength={300} value={note} onChange={(ev) => setNote(ev.target.value)} />
        </Field>
      </div>
    </ResponsiveDialog>
  );
}

/** 06 §3.3 "Catat Penyesuaian". */
export function AdjustmentDialog({ bookingId, balance, onClose }: { bookingId: string; balance: number; onClose: () => void }) {
  const nowWib = toWib(new Date());
  const [direction, setDirection] = useState<"charge" | "refund">(balance < 0 ? "refund" : "charge");
  const [amount, setAmount] = useState<number | null>(balance !== 0 ? Math.abs(balance) : null);
  const [method, setMethod] = useState<ManualPaymentMethod>("bank_transfer");
  const [paidDate, setPaidDate] = useState(nowWib.date);
  const [paidTime, setPaidTime] = useState(nowWib.time);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const action = useAction(recordAdjustment, { successMessage: sp.adjusted, onSuccess: onClose });
  const e = action.fieldErrors;
  return (
    <ResponsiveDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={sp.adjust}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            pending={action.pending}
            onClick={() => action.run({ bookingId, direction, amount: amount ?? 0, method, paidDate, paidTime, proofFile: file ?? undefined, reference, note })}
          >
            {sp.adjustSave}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{sp.fields.direction}</legend>
          <RadioGroup value={direction} onValueChange={(v) => setDirection(v as "charge" | "refund")} className="space-y-1">
            {(["charge", "refund"] as const).map((d) => (
              <div key={d} className="flex items-center gap-2">
                <RadioGroupItem id={`dir-${d}`} value={d} />
                <Label htmlFor={`dir-${d}`}>{sp.fields[d]}</Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
        <Field id="adj-amount" label={sp.fields.adjustAmount} required error={e.amount}>
          <MoneyInput id="adj-amount" value={amount} onChange={setAmount} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{sp.fields.method}</legend>
          <MethodPicker value={method} onChange={setMethod} />
        </fieldset>
        <PaidAtInputs date={paidDate} time={paidTime} onDate={setPaidDate} onTime={setPaidTime} error={e.paidDate} />
        <Field id="adj-proof" label={sp.fields.proof} error={e.proofFile}>
          <ImageDrop id="adj-proof" file={file} onChange={setFile} label={sp.pickFile} />
        </Field>
        <Field id="adj-ref" label={sp.fields.reference} error={e.reference}>
          <Input id="adj-ref" maxLength={60} value={reference} onChange={(ev) => setReference(ev.target.value)} />
        </Field>
        <Field id="adj-note" label={sp.fields.note} required error={e.note}>
          <Textarea id="adj-note" maxLength={300} value={note} onChange={(ev) => setNote(ev.target.value)} {...fieldAria("adj-note", e.note)} />
        </Field>
      </div>
    </ResponsiveDialog>
  );
}

/** 06 §3.4 (admin). */
export function VoidPaymentDialog({ paymentId, holdHours, onClose }: { paymentId: string; holdHours: number; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const action = useAction(voidPayment, { successMessage: sp.voided, onSuccess: onClose });
  return (
    <ResponsiveDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`${sp.voidAction}?`}
      description={sp.voidBody(holdHours)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.back}
          </Button>
          <Button variant="danger" pending={action.pending} onClick={() => action.run({ paymentId, reason })}>
            {sp.voidConfirm}
          </Button>
        </>
      }
    >
      <Field id="void-reason" label={sp.fields.reason} required error={action.fieldErrors.reason}>
        <Textarea id="void-reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} {...fieldAria("void-reason", action.fieldErrors.reason)} />
      </Field>
    </ResponsiveDialog>
  );
}
