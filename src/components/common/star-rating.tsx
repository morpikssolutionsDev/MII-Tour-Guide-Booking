"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** 1–5 stars as a radio group; large tap targets on the public page (10 §3.1). */
export function StarRating({
  value,
  onChange,
  label,
  size = "md",
  labels,
}: {
  value: number | null;
  onChange: (value: number) => void;
  label: string;
  size?: "md" | "lg";
  labels?: string[];
}) {
  const box = size === "lg" ? "size-12" : "size-10";
  const icon = size === "lg" ? "size-8" : "size-6";
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={labels?.[n - 1] ?? `${n}`}
            onClick={() => onChange(n)}
            className={cn("flex items-center justify-center rounded-md", box)}
          >
            <Star className={cn(icon, value !== null && n <= value ? "fill-senja-500 text-senja-500" : "text-kabut-300")} />
          </button>
        ))}
      </div>
      {labels && value !== null && <p className="mt-1 text-sm font-medium">{labels[value - 1]}</p>}
    </div>
  );
}

export function StarsDisplay({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= value ? "fill-senja-500 text-senja-500" : "text-kabut-300")} aria-hidden />
      ))}
    </span>
  );
}
