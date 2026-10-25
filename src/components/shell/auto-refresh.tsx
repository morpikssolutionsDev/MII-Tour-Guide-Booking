"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches server data on window focus and every `intervalMs` while visible (08 BR-08-8). */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) router.refresh();
    };
    const timer = setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [router, intervalMs]);
  return null;
}
