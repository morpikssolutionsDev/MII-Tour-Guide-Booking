"use client";

import { useSyncExternalStore } from "react";

/** True at `md` (768px) and up. Server render assumes desktop. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)", true);
}

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
