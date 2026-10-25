"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BriefingCard } from "@/app/(staff)/pengaturan/materi/briefing-form";
import { cn } from "@/lib/utils";

/** Expandable briefing items (08 §3.3). */
export function BriefingList({ items }: { items: { id: string; title: string; html: string; linkUrl: string | null; fileUrl: string | null }[] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <Collapsible open={open === item.id} onOpenChange={(v) => setOpen(v ? item.id : null)}>
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-2 text-left font-medium">
              {item.title}
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", open === item.id && "rotate-180")} aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <BriefingCard title={item.title} html={item.html} linkUrl={item.linkUrl} fileUrl={item.fileUrl} />
            </CollapsibleContent>
          </Collapsible>
        </li>
      ))}
    </ul>
  );
}
