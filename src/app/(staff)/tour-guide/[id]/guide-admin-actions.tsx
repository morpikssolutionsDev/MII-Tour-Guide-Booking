"use client";

import { CalendarPlus, KeyRound, Pencil, Power } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ConflictList, isBookingRefs } from "@/components/common/conflict-list";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { cancelLeave, setGuideActive } from "@/server/guides/actions";
import { ResetPasswordDialog } from "@/app/(staff)/pengguna/reset-password-dialog";
import { LeaveDialog } from "../leave-dialog";

const sg = t.guides;

/** Admin actions on the guide detail header (02 §3.2). */
export function GuideAdminActions({ guideId, userId, name, isActive }: { guideId: string; userId: string; name: string; isActive: boolean }) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const toggle = useAction(setGuideActive, {
    successMessage: isActive ? sg.deactivated : sg.activated,
    quiet: ["CONFLICT"],
    onSuccess: () => setConfirmOpen(false),
  });
  const conflicts = toggle.failure?.code === "CONFLICT" && isBookingRefs(toggle.failure.details) ? toggle.failure.details : null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" asChild>
        <Link href={`/tour-guide/${guideId}/ubah`}>
          <Pencil />
          {t.common.edit}
        </Link>
      </Button>
      {isActive && (
        <Button variant="secondary" onClick={() => setLeaveOpen(true)}>
          <CalendarPlus />
          {t.leave.add}
        </Button>
      )}
      <Button variant="ghost" onClick={() => setResetOpen(true)}>
        <KeyRound />
        {sg.resetPassword}
      </Button>
      {isActive ? (
        <Button variant="danger-outline" onClick={() => setConfirmOpen(true)}>
          <Power />
          {t.common.deactivate}
        </Button>
      ) : (
        <Button variant="secondary" pending={toggle.pending} onClick={() => toggle.run({ id: guideId, isActive: true })}>
          <Power />
          {t.common.activate}
        </Button>
      )}

      {leaveOpen && <LeaveDialog guideId={guideId} onClose={() => setLeaveOpen(false)} />}
      {/* BR-02-4: blocked while upcoming tours exist; the dialog lists them. */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          setConfirmOpen(v);
          if (!v) toggle.reset();
        }}
        title={sg.deactivateConfirm(name)}
        body={conflicts ? sg.errors.deactivateBlocked : sg.deactivateBody}
        confirmLabel={`Ya, ${t.common.deactivate.toLowerCase()}`}
        pending={toggle.pending}
        confirmDisabled={Boolean(conflicts)}
        onConfirm={() => toggle.run({ id: guideId, isActive: false })}
      >
        {conflicts && <ConflictList conflicts={conflicts} />}
      </ConfirmDialog>
      <ResetPasswordDialog userId={userId} name={name} open={resetOpen} onOpenChange={setResetOpen} />
    </div>
  );
}

/** BR-02-9: cancel (or shorten, when ongoing) approved leave. */
export function CancelLeaveButton({ leaveId }: { leaveId: string }) {
  const [open, setOpen] = useState(false);
  const cancel = useAction(cancelLeave, { successMessage: t.leave.cancelled, onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="danger-outline" size="sm" onClick={() => setOpen(true)}>
        {t.leave.cancelLeave}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`${t.leave.cancelLeave} cuti ini?`}
        body={t.leave.cancelBody}
        confirmLabel={`Ya, ${t.leave.cancelLeave.toLowerCase()}`}
        pending={cancel.pending}
        onConfirm={() => cancel.run({ id: leaveId })}
      />
    </>
  );
}
