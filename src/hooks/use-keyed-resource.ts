"use client";

import { useEffect, useState } from "react";

/**
 * Loads data for a key (debounced). The result is only used while its key still matches,
 * so stale responses never show and no state is cleared synchronously in an effect.
 */
export function useKeyedResource<T>(key: string | null, load: () => Promise<T>, delayMs = 0) {
  const [state, setState] = useState<{ key: string; data: T } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await load();
        if (!cancelled) setState({ key, data });
      } catch {
        /* the caller's action wrapper reports failures */
      }
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `load` is recreated each render; the key captures its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delayMs]);

  const data = state && state.key === key ? state.data : null;
  return { data, loading: key !== null && data === null };
}
