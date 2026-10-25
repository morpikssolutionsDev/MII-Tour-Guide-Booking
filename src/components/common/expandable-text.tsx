"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Long text clamped to `lines`, with a "Selengkapnya" toggle when it is long enough to clamp. */
export function ExpandableText({ text, threshold = 90, className }: { text: string; threshold?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > threshold;
  return (
    <span className={cn("block", className)}>
      <span className={cn("block whitespace-pre-line", long && !open && "line-clamp-2")}>{text}</span>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="relative z-10 text-xs font-medium text-danau-700 hover:underline">
          {open ? "Ringkas" : "Selengkapnya"}
        </button>
      )}
    </span>
  );
}
