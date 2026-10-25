"use client";

import { KeyRound, MoreVertical, Pencil, Power, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { setUserActive } from "@/server/users/actions";
import type { UserListItem } from "@/server/users/queries";
import { ResetPasswordDialog } from "./reset-password-dialog";

export function UserRowActions({ user, isSelf }: { user: UserListItem; isSelf: boolean }) {
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toggle = useAction(setUserActive, {
    successMessage: user.isActive ? t.users.deactivated : t.users.activated,
    onSuccess: () => setConfirmOpen(false),
  });
  const isGuide = user.role === "guide";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`${t.common.actions}: ${user.name}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isGuide ? (
            user.guideId && (
              <DropdownMenuItem asChild>
                <Link href={`/tour-guide/${user.guideId}`}>
                  <UserRoundCheck />
                  {t.users.openGuideProfile}
                </Link>
              </DropdownMenuItem>
            )
          ) : (
            <DropdownMenuItem asChild>
              <Link href={`/pengguna/${user.id}`}>
                <Pencil />
                {t.common.edit}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <KeyRound />
            {t.users.resetPassword}
          </DropdownMenuItem>
          {!isGuide && !isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => (user.isActive ? setConfirmOpen(true) : toggle.run({ id: user.id, isActive: true }))}
                className={user.isActive ? "text-merah-700" : undefined}
              >
                <Power />
                {user.isActive ? t.common.deactivate : t.common.activate}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ResetPasswordDialog userId={user.id} name={user.name} open={resetOpen} onOpenChange={setResetOpen} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${t.common.deactivate} ${user.name}?`}
        body="Pengguna tidak dapat masuk lagi. Riwayat pemesanan dan pembayaran tetap tersimpan."
        confirmLabel={`Ya, ${t.common.deactivate.toLowerCase()}`}
        pending={toggle.pending}
        onConfirm={() => toggle.run({ id: user.id, isActive: false })}
      />
    </>
  );
}
