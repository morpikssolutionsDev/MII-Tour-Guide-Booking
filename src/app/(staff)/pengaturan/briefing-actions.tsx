"use client";

import { MoreVertical, Pencil, Power } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { setBriefingMaterialActive } from "@/server/settings-actions";

export function BriefingActions({ id, isActive }: { id: string; isActive: boolean }) {
  const toggle = useAction(setBriefingMaterialActive, { successMessage: t.settings.briefing.saved });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t.common.actions}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/pengaturan/materi/${id}`}>
            <Pencil />
            {t.common.edit}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toggle.run({ id, isActive: !isActive })}>
          <Power />
          {isActive ? t.common.deactivate : t.common.activate}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
