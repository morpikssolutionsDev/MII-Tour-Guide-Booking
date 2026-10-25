"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/** design-system §6.4: centred modal (max 520px) on desktop, bottom sheet on mobile. */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const desktop = useIsDesktop();

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto shadow-overlay sm:max-w-[520px] md:p-6", wide && "sm:max-w-[640px]")}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          {footer && <DialogFooter className="gap-2">{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base font-semibold">{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-2">{children}</div>
        {footer && <DrawerFooter className="pb-safe flex-col-reverse gap-2 [&>*]:w-full">{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  );
}
