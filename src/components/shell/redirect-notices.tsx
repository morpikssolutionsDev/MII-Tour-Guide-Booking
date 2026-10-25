"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { t } from "@/i18n/id";
import { DENIED_PARAM } from "@/lib/routes";

/** Turns redirect flags (`?akses=ditolak`, `?alasan=sesi`) into a toast, then cleans the URL. */
export function RedirectNotices() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const denied = params.get(DENIED_PARAM) === "ditolak";
    const sessionEnded = params.get("alasan") === "sesi";
    if (!denied && !sessionEnded) return;
    if (denied) toast.error(t.common.noAccessToast);
    if (sessionEnded) toast.info(t.common.sessionEndedToast);
    const next = new URLSearchParams(params);
    next.delete(DENIED_PARAM);
    next.delete("alasan");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return null;
}
