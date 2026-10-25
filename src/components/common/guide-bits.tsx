/* eslint-disable @next/next/no-img-element */
import { t } from "@/i18n/id";
import { cn } from "@/lib/utils";

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Photo, or initials on Danau 100 (02 §3.1). */
export function GuideAvatar({ name, photoUrl, size = 40, className }: { name: string; photoUrl?: string | null; size?: number; className?: string }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" width={size} height={size} className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-danau-100 font-semibold text-danau-800", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Seven dots "S S R K J S M", filled = working (02 §3.1). */
export function WeekdayDots({ weekdays }: { weekdays: number[] }) {
  const label = t.weekdays.filter((_, i) => weekdays.includes(i + 1)).join(", ");
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`${t.guides.workdayDots}: ${label}`}>
      {t.weekdayInitials.map((initial, i) => {
        const on = weekdays.includes(i + 1);
        return (
          <span
            key={i}
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-[0.6875rem] font-semibold",
              on ? "bg-rimba-600 text-white" : "border border-kabut-200 text-kabut-400",
            )}
          >
            {initial}
          </span>
        );
      })}
    </span>
  );
}
