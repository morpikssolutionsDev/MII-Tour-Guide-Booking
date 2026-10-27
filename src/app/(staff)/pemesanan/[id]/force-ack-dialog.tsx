"use client";

import { UserCheck } from "lucide-react";
import { useState } from "react";
import { Field, fieldAria } from "@/components/common/field";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { forceAcknowledge } from "@/server/preparation/actions";

const fa = t.preparation.forceAck;

/** 12 §3.8: admin confirms an assignment on the guide's behalf, with a reason. */
export function ForceAckButton({ bookingId, guideId, guideName, size = "xs" }: { bookingId: string; guideId: string; guideName: string; size?: "xs" | "sm" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size={size} className="relative z-10" onClick={() => setOpen(true)}>
        <UserCheck />
        {fa.button}
      </Button>
      {open && <ForceAckDialog bookingId={bookingId} guideId={guideId} guideName={guideName} onClose={() => setOpen(false)} />}
    </>
  );
}

function ForceAckDialog({ bookingId, guideId, guideName, onClose }: { bookingId: string; guideId: string; guideName: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const action = useAction(forceAcknowledge, { successMessage: fa.done, onSuccess: onClose });
  const error = action.fieldErrors.reason;
  return (
    <ResponsiveDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={fa.title(guideName)}
      description={fa.body(guideName)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button pending={action.pending} disabled={reason.trim().length < 5} onClick={() => action.run({ bookingId, guideId, reason })}>
            {fa.confirm}
          </Button>
        </>
      }
    >
      <Field id="force-ack-reason" label={fa.reason} required error={error} helper={`${reason.trim().length}/200`}>
        <Textarea
          id="force-ack-reason"
          maxLength={200}
          value={reason}
          placeholder={fa.reasonPlaceholder}
          onChange={(e) => setReason(e.target.value)}
          {...fieldAria("force-ack-reason", error)}
        />
      </Field>
    </ResponsiveDialog>
  );
}
