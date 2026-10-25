"use client";

import { CalendarClock, CheckCheck, CircleDollarSign, UserX, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Field, fieldAria } from "@/components/common/field";
import { MoneyInput } from "@/components/common/money-input";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CANCEL_REASONS, type CancelReason } from "@/db/schema";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { cancelBooking, completeBooking } from "@/server/bookings/actions";
import { MarkPaidDialog } from "./payment-dialogs";

const sa = t.booking.actions;
const sc = t.booking.cancel;

export type ActionFlags = {
  markPaid: boolean;
  reschedule: boolean;
  complete: boolean;
  cancel: boolean;
};

/** The right-rail action buttons, shown by status and permission (05 §3.3). */
export function BookingActions({
  bookingId,
  code,
  total,
  paid,
  flags,
}: {
  bookingId: string;
  code: string;
  total: number;
  paid: number;
  flags: ActionFlags;
}) {
  const [dialog, setDialog] = useState<"paid" | "complete" | "noshow" | "cancel" | null>(null);
  const close = () => setDialog(null);
  const complete = useAction(completeBooking, {
    successMessage: (d) => (d.status === "completed" ? sa.completed : sa.noShowDone),
    onSuccess: close,
  });
  if (!flags.markPaid && !flags.reschedule && !flags.complete && !flags.cancel) return null;

  return (
    <div className="flex flex-col gap-2">
      {flags.markPaid && (
        <Button onClick={() => setDialog("paid")}>
          <CircleDollarSign />
          {sa.markPaid}
        </Button>
      )}
      {flags.complete && (
        <>
          <Button onClick={() => setDialog("complete")}>
            <CheckCheck />
            {sa.complete}
          </Button>
          <Button variant="secondary" onClick={() => setDialog("noshow")}>
            <UserX />
            {sa.noShow}
          </Button>
        </>
      )}
      {flags.reschedule && (
        <Button variant="secondary" asChild>
          <Link href={`/pemesanan/${bookingId}/ubah`}>
            <CalendarClock />
            {sa.reschedule}
          </Link>
        </Button>
      )}
      {flags.cancel && (
        <Button variant="danger-outline" onClick={() => setDialog("cancel")}>
          <XCircle />
          {sa.cancel}
        </Button>
      )}

      {dialog === "paid" && <MarkPaidDialog bookingId={bookingId} code={code} total={total} onClose={close} />}
      <ConfirmDialog
        open={dialog === "complete" || dialog === "noshow"}
        onOpenChange={(v) => !v && close()}
        tone="primary"
        title={dialog === "noshow" ? sa.noShowConfirm : sa.completeConfirm(code)}
        confirmLabel={dialog === "noshow" ? sa.noShowYes : sa.completeYes}
        pending={complete.pending}
        onConfirm={() => complete.run({ id: bookingId, outcome: dialog === "noshow" ? "no_show" : "completed" })}
      />
      {dialog === "cancel" && <CancelDialog bookingId={bookingId} code={code} paid={paid} onClose={close} />}
    </div>
  );
}

/** 05 §3.5 */
function CancelDialog({ bookingId, code, paid, onClose }: { bookingId: string; code: string; paid: number; onClose: () => void }) {
  const [reason, setReason] = useState<CancelReason | "">("");
  const [detail, setDetail] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [refundAmount, setRefundAmount] = useState<number | null>(null);
  const action = useAction(cancelBooking, { successMessage: sc.done, onSuccess: onClose });
  const e = action.fieldErrors;
  return (
    <ResponsiveDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={sc.title(code)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.back}
          </Button>
          <Button
            variant="danger"
            pending={action.pending}
            disabled={!reason}
            onClick={() => reason && action.run({ id: bookingId, reason, detail, refundNote, refundAmount })}
          >
            {sc.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="cancel-reason" label={sc.reason} required error={e.reason}>
          <Select value={reason} onValueChange={(v) => setReason(v as CancelReason)}>
            <SelectTrigger id="cancel-reason" className="w-full">
              <SelectValue placeholder={sc.reason} />
            </SelectTrigger>
            <SelectContent>
              {CANCEL_REASONS.filter((r) => r !== "expired").map((r) => (
                <SelectItem key={r} value={r}>
                  {t.cancelReasons[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {reason === "other" && (
          <Field id="cancel-detail" label={sc.detail} required error={e.detail}>
            <Input id="cancel-detail" maxLength={200} value={detail} onChange={(ev) => setDetail(ev.target.value)} {...fieldAria("cancel-detail", e.detail)} />
          </Field>
        )}
        {paid > 0 && (
          <>
            <Field id="refund-note" label={sc.refundNote}>
              <Textarea id="refund-note" maxLength={300} value={refundNote} onChange={(ev) => setRefundNote(ev.target.value)} />
            </Field>
            <Field id="refund-amount" label={sc.refundAmount} error={e.refundAmount}>
              <MoneyInput id="refund-amount" value={refundAmount} onChange={setRefundAmount} {...fieldAria("refund-amount", e.refundAmount)} />
            </Field>
          </>
        )}
      </div>
    </ResponsiveDialog>
  );
}
