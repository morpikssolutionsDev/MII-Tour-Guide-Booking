"use client";

import { Check, CheckCheck, Share2, UserX } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FeedbackFormDialog } from "@/components/common/feedback-form-dialog";
import { FeedbackShare } from "@/components/common/feedback-share";
import { Field } from "@/components/common/field";
import { ResponsiveDialog } from "@/components/common/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BookingStatus } from "@/db/schema";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { formatDateTime } from "@/lib/format";
import { completeBooking, completeGroup } from "@/server/bookings/actions";
import { acknowledgeAssignment } from "@/server/preparation/actions";

const sp = t.portal;

/** Sticky bottom bar with one primary action at a time (08 §3.3). */
export function TourActionBar({
  bookingId,
  code,
  status,
  acknowledged,
  started,
  isReleased,
  feedback,
  customerPhone,
  guidesToRate,
  meName,
  groupHostId,
}: {
  bookingId: string;
  code: string;
  status: BookingStatus;
  acknowledged: boolean;
  started: boolean;
  isReleased: boolean;
  feedback: { submitted: boolean; url: string | null; expiresAt: string; expired: boolean; whatsappText: string | null } | null;
  customerPhone: string;
  guidesToRate: { id: string; name: string }[];
  /** Host of a shared tour with more than one booking: enables "Selesaikan semua" (12 BR-12-M11). */
  groupHostId: string | null;
  meName: string;
}) {
  const [dialog, setDialog] = useState<"complete" | "noshow" | "share" | "fill" | null>(null);
  const [note, setNote] = useState("");
  const ack = useAction(acknowledgeAssignment, { successMessage: sp.readyToast });
  const complete = useAction(completeBooking, {
    successMessage: (d) => (d.status === "completed" ? t.booking.actions.completed : t.booking.actions.noShowDone),
    onSuccess: (d) => setDialog(d.status === "completed" ? "share" : null),
  });
  const completeAll = useAction(completeGroup, { successMessage: (d) => t.merge.completeAllDone(d.completed.length) });
  const paid = status === "confirmed" || status === "ready";
  if (isReleased || status === "cancelled" || status === "evaluated" || status === "no_show") return null;

  let content: React.ReactNode = null;
  if (paid && !started) {
    content = acknowledged ? (
      <Button className="w-full" variant="secondary" disabled>
        <Check />
        {sp.readyDone}
      </Button>
    ) : (
      <Button className="w-full" size="lg" pending={ack.pending} onClick={() => ack.run({ bookingId })}>
        <Check />
        {sp.imReady}
      </Button>
    );
  } else if (paid && started) {
    content = (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={() => setDialog("noshow")}>
            <UserX />
            {sp.tour.noShow}
          </Button>
          <Button className="flex-1" size="lg" variant={groupHostId ? "secondary" : "default"} onClick={() => setDialog("complete")}>
            <CheckCheck />
            {sp.tour.complete}
          </Button>
        </div>
        {groupHostId && (
          <Button className="w-full" size="lg" pending={completeAll.pending} onClick={() => completeAll.run({ hostId: groupHostId })}>
            <CheckCheck />
            {t.merge.completeAll}
          </Button>
        )}
      </div>
    );
  } else if (status === "completed" && feedback && !feedback.submitted) {
    content = (
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={() => setDialog("fill")}>
          {sp.tour.fillForTourist}
        </Button>
        {!feedback.expired && feedback.url && (
          <Button className="flex-1" size="lg" onClick={() => setDialog("share")}>
            <Share2 />
            {sp.tour.shareFeedback}
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      {content && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-30 border-t bg-card/95 px-4 py-3 backdrop-blur md:static md:mt-4 md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto max-w-[560px]">{content}</div>
        </div>
      )}
      <ConfirmDialog
        open={dialog === "complete"}
        onOpenChange={(v) => !v && setDialog(null)}
        tone="primary"
        title={t.booking.actions.completeConfirm(code)}
        confirmLabel={t.booking.actions.completeYes}
        pending={complete.pending}
        onConfirm={() => complete.run({ id: bookingId, outcome: "completed" })}
      />
      <ConfirmDialog
        open={dialog === "noshow"}
        onOpenChange={(v) => !v && setDialog(null)}
        title={t.booking.actions.noShowConfirm}
        confirmLabel={t.booking.actions.noShowYes}
        pending={complete.pending}
        onConfirm={() => complete.run({ id: bookingId, outcome: "no_show", note })}
      >
        <Field id="noshow-note" label={sp.tour.noShowNote}>
          <Textarea id="noshow-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </ConfirmDialog>
      {feedback?.url && (
        <ResponsiveDialog open={dialog === "share"} onOpenChange={(v) => !v && setDialog(null)} title={sp.tour.shareFeedback}>
          <FeedbackShare
            layout="sheet"
            url={feedback.url}
            whatsappText={feedback.whatsappText ?? feedback.url}
            phone={customerPhone}
            expiresLabel={formatDateTime(feedback.expiresAt)}
          />
        </ResponsiveDialog>
      )}
      {dialog === "fill" && <FeedbackFormDialog bookingId={bookingId} guides={guidesToRate} enteredByName={meName} onClose={() => setDialog(null)} />}
    </>
  );
}
