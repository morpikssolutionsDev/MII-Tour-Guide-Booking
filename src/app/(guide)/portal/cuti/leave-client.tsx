"use client";

import { CalendarPlus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DatePicker } from "@/components/common/date-picker";
import { Field, fieldAria } from "@/components/common/field";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addDays, wibToday } from "@/domain/time";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { cancelLeave, requestLeave } from "@/server/guides/actions";

const sl = t.leave;

/** "Ajukan Cuti" (08 §3.4): full-screen sheet on mobile. */
export function RequestLeaveButton() {
  const today = wibToday();
  const [open, setOpen] = useState(false);
  const [startDate, setStart] = useState<string | null>(today);
  const [endDate, setEnd] = useState<string | null>(today);
  const [reason, setReason] = useState("");
  const [warning, setWarning] = useState<number | null>(null);
  const action = useAction(requestLeave, {
    successMessage: sl.requested,
    onSuccess: (d) => {
      // Own tours in the range are only a warning (admin reschedules before approving).
      if (d.conflicts > 0) setWarning(d.conflicts);
      else setOpen(false);
      setReason("");
    },
  });
  const e = action.fieldErrors;

  return (
    <>
      <Button className="w-full" size="lg" onClick={() => { setWarning(null); setOpen(true); }}>
        <CalendarPlus />
        {sl.request}
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={sl.request}
        footer={
          warning !== null ? (
            <Button onClick={() => setOpen(false)}>{t.common.close}</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button pending={action.pending} onClick={() => action.run({ startDate: startDate ?? "", endDate: endDate ?? "", reason })}>
                {sl.submit}
              </Button>
            </>
          )
        }
      >
        {warning !== null ? (
          <Alert variant="warning">
            <TriangleAlert />
            <AlertDescription>
              <span className="block font-medium">{sl.requested}</span>
              {sl.ownTourWarning(warning)}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Field id="lv-start" label={sl.start} required error={e.startDate}>
              <DatePicker
                id="lv-start"
                value={startDate}
                min={today}
                max={addDays(today, 365)}
                onChange={(v) => {
                  setStart(v);
                  if (!endDate || endDate < v) setEnd(v);
                }}
                invalid={Boolean(e.startDate)}
              />
            </Field>
            <Field id="lv-end" label={sl.end} required error={e.endDate}>
              <DatePicker id="lv-end" value={endDate} min={startDate ?? today} max={addDays(startDate ?? today, 29)} onChange={setEnd} invalid={Boolean(e.endDate)} />
            </Field>
            <Field id="lv-reason" label={sl.reason} required error={e.reason}>
              <Textarea id="lv-reason" maxLength={300} value={reason} onChange={(ev) => setReason(ev.target.value)} {...fieldAria("lv-reason", e.reason)} />
            </Field>
          </div>
        )}
      </ResponsiveDialog>
    </>
  );
}

export function CancelRequestButton({ leaveId }: { leaveId: string }) {
  const [open, setOpen] = useState(false);
  const cancel = useAction(cancelLeave, { successMessage: sl.cancelled, onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="danger-outline" size="sm" onClick={() => setOpen(true)}>
        {sl.cancelRequest}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t.portal.leave.cancelConfirm}
        confirmLabel={`Ya, ${sl.cancelRequest.toLowerCase()}`}
        pending={cancel.pending}
        onConfirm={() => cancel.run({ id: leaveId })}
      />
    </>
  );
}
