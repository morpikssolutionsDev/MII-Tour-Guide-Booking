"use client";

import { useState } from "react";
import { ConflictList, isBookingRefs } from "@/components/common/conflict-list";
import { Field, fieldAria } from "@/components/common/field";
import { DatePicker } from "@/components/common/date-picker";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { wibToday } from "@/domain/time";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { createLeaveByAdmin } from "@/server/guides/actions";

const sl = t.leave;

/** 02 §3.5: admin adds approved leave directly (same conflict check as approval). */
export function LeaveDialog({ guideId, onClose }: { guideId: string; onClose: () => void }) {
  const today = wibToday();
  const [startDate, setStart] = useState(today);
  const [endDate, setEnd] = useState(today);
  const [reason, setReason] = useState("");
  const add = useAction(createLeaveByAdmin, { successMessage: sl.added, onSuccess: onClose, quiet: ["CONFLICT"] });
  const errors = add.fieldErrors;
  const conflicts = add.failure?.code === "CONFLICT" && isBookingRefs(add.failure.details) ? add.failure.details : null;

  return (
    <ResponsiveDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={sl.add}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button pending={add.pending} onClick={() => add.run({ guideId, startDate, endDate, reason })}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="leave-start" label={sl.start} required error={errors.startDate}>
            <DatePicker id="leave-start" min={today} value={startDate} onChange={setStart} invalid={Boolean(errors.startDate)} />
          </Field>
          <Field id="leave-end" label={sl.end} required error={errors.endDate}>
            <DatePicker id="leave-end" min={startDate || today} value={endDate} onChange={setEnd} invalid={Boolean(errors.endDate)} />
          </Field>
        </div>
        <Field id="leave-reason" label={sl.reason} required error={errors.reason}>
          <Textarea id="leave-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} {...fieldAria("leave-reason", errors.reason)} />
        </Field>
        {conflicts && (
          <>
            <Alert variant="destructive">
              <AlertDescription>{sl.approveBlocked}</AlertDescription>
            </Alert>
            <ConflictList conflicts={conflicts} />
          </>
        )}
      </div>
    </ResponsiveDialog>
  );
}
