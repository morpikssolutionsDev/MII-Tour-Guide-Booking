"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/** Expandable section (replaces native `<details>`), closed by default. */
export function Disclosure({
  title,
  children,
  className,
  triggerClassName,
  defaultOpen = false,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("group/disclosure", className)}>
      <CollapsibleTrigger className={cn("flex w-full items-center justify-between gap-2 rounded-sm text-left font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", triggerClassName)}>
        {title}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/disclosure:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
