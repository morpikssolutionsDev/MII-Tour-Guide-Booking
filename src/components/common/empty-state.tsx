/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Decoration = "carousel" | "bird-perched" | "birds-flying" | "leaves" | "castle" | "snake";

/** design-system §8.4: one decoration at 120px, a title, a line of text and an optional action. */
export function EmptyState({
  decoration,
  title,
  body,
  action,
  className,
}: {
  decoration?: Decoration;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-4 py-10 text-center", className)}>
      {decoration && <img src={`/brand/${decoration}.svg`} alt="" className="h-auto w-[120px]" />}
      <h3 className="mt-4 font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
