"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { ConflictList } from "@/components/common/conflict-list";
import { Field, fieldAria } from "@/components/common/field";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import type { BookingRef } from "@/server/bookings/conflicts";
import { approveLeave, rejectLeave } from "@/server/guides/actions";

const sl = t.leave;

/** "Setujui" is disabled while assignments overlap (BR-02-8); "Tolak" needs a reason. */
export function LeaveDecision({ leaveId, conflicts }: { leaveId: string; conflicts: BookingRef[] }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const approve = useAction(approveLeave, { successMessage: sl.approved });
  const reject = useAction(rejectLeave, { successMessage: sl.rejected, onSuccess: () => setRejectOpen(false) });

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      {conflicts.length > 0 && (
        <>
          <Alert variant="warning">
            <AlertDescription>
              {sl.conflicts(conflicts.length)}. {sl.approveBlocked}
            </AlertDescription>
          </Alert>
          <ConflictList conflicts={conflicts} />
        </>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="danger-outline" onClick={() => setRejectOpen(true)}>
          <X />
          {sl.reject}
        </Button>
        <Button pending={approve.pending} disabled={conflicts.length > 0} onClick={() => approve.run({ id: leaveId })}>
          <Check />
          {sl.approve}
        </Button>
      </div>
      <ResponsiveDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={sl.rejectTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="danger" pending={reject.pending} onClick={() => reject.run({ id: leaveId, note })}>
              {sl.reject}
            </Button>
          </>
        }
      >
        <Field id={`reject-${leaveId}`} label={sl.rejectReason} required error={reject.fieldErrors.note}>
          <Textarea id={`reject-${leaveId}`} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} {...fieldAria(`reject-${leaveId}`, reject.fieldErrors.note)} />
        </Field>
      </ResponsiveDialog>
    </div>
  );
}
