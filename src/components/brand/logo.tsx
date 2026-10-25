import { cn } from "@/lib/utils";
import { LOGO_LETTERS, LOGO_VIEWBOX } from "./logo-paths";

/**
 * The TMII wordmark in `currentColor` (design-system §8.2): brand red on light
 * surfaces (`text-brand`), white on dark ones.
 */
export function Logo({ className, title = "TMII" }: { className?: string; title?: string }) {
  return (
    <svg viewBox={LOGO_VIEWBOX} role="img" aria-label={title} className={cn("h-7 w-auto", className)} fill="currentColor">
      {LOGO_LETTERS.map((letter) => (
        <path key={letter.id} d={letter.d} />
      ))}
    </svg>
  );
}
