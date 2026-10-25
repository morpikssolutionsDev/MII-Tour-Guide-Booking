"use client";

import { CheckCircle2, Link2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/id";

/** Shown after creating a booking (05 §3.2 "On success"). */
export function SuccessPanel({ bookingId, message }: { bookingId: string; message: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const sw = t.booking.wizard;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-rimba-200 bg-rimba-50 p-4 sm:flex-row sm:items-center">
      <CheckCircle2 className="size-6 shrink-0 text-rimba-600" aria-hidden />
      <p className="flex-1 font-medium text-rimba-700">{sw.successTitle}</p>
      <div className="flex flex-wrap gap-2">
        {message && <CopyButton value={message} label={sw.copyMessage} />}
        <Button variant="secondary" asChild>
          <Link href={`/pemesanan/baru?group=${bookingId}`}>
            <Link2 />
            {sw.linkedBooking}
          </Link>
        </Button>
        <Button variant="ghost" size="icon" aria-label={t.common.close} onClick={() => router.replace(pathname, { scroll: false })}>
          <X />
        </Button>
      </div>
    </div>
  );
}
