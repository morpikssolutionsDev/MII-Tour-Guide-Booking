import { Suspense } from "react";
import { initialsOf } from "@/components/common/guide-bits";
import { NotificationBell } from "@/components/shell/notification-bell";
import { PortalFallback, PortalShell } from "@/components/shell/portal-shell";
import { unreadCountFor } from "@/server/notify/queries";
import { requireGuide } from "@/server/session";

/** 08 guide portal shell; the user-dependent parts stream behind a boundary. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PortalFallback />}>
      <AuthenticatedPortal>{children}</AuthenticatedPortal>
    </Suspense>
  );
}

async function AuthenticatedPortal({ children }: { children: React.ReactNode }) {
  const me = await requireGuide();
  const unread = await unreadCountFor(me.id);
  return (
    <PortalShell bell={<NotificationBell initialCount={unread} />} initials={initialsOf(me.name)}>
      {children}
    </PortalShell>
  );
}
