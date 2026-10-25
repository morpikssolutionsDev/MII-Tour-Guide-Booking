"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/id";
import { ResponsiveDialog } from "./responsive-dialog";

/** Destructive confirmation: the confirm button is the only filled red one (design-system §3.2). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  pending,
  tone = "danger",
  children,
  confirmDisabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  tone?: "danger" | "primary";
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={body}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            {t.common.cancel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "default"} onClick={onConfirm} pending={pending} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </ResponsiveDialog>
  );
}
