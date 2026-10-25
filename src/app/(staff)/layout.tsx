import { Suspense } from "react";
import { NotificationBell } from "@/components/shell/notification-bell";
import { ShellFallback, StaffShell } from "@/components/shell/staff-shell";
import { unreadCountFor } from "@/server/notify/queries";
import { requireRole } from "@/server/session";

// The shell needs the session user (role-filtered navigation), so it streams behind
// a boundary; the skeleton is the static shell (Cache Components).
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin", "staff");
  const unread = await unreadCountFor(user.id);
  return (
    <StaffShell user={{ name: user.name, role: user.role }} bell={<NotificationBell initialCount={unread} />}>
      {children}
    </StaffShell>
  );
}
