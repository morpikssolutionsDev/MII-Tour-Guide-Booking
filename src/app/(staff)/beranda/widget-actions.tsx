"use client";

import { BellRing, Wallet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { resendGuideNotice } from "@/server/preparation/actions";
import { MarkPaidDialog } from "../pemesanan/[id]/payment-dialogs";

/** Widget 2 row action: opens the 06 "Tandai Lunas" dialog in place. */
export function MarkPaidButton({ bookingId, code, total }: { bookingId: string; code: string; total: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" className="relative z-10" onClick={() => setOpen(true)}>
        <Wallet />
        {t.payment.markPaid}
      </Button>
      {open && <MarkPaidDialog bookingId={bookingId} code={code} total={total} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Widget 4 row action (BR-07-7). */
export function ResendButton({ bookingId, guideId }: { bookingId: string; guideId: string }) {
  const resend = useAction(resendGuideNotice, { successMessage: t.preparation.resent });
  return (
    <Button size="sm" variant="ghost" className="relative z-10" pending={resend.pending} onClick={() => resend.run({ bookingId, guideId })}>
      <BellRing />
      {t.dashboard.resend}
    </Button>
  );
}
