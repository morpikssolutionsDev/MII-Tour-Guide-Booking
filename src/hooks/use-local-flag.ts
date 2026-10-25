"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "tmii:local-flag";

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false; // storage blocked (private mode, previews)
  }
}

/** A boolean persisted in localStorage, for per-viewer conveniences only. */
export function useLocalFlag(key: string): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => read(key),
    () => false,
  );
  const set = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}
