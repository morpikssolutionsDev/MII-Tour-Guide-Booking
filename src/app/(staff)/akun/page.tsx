import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/id";
import { logout } from "@/server/auth-actions";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: t.account.title };

/** 01 §3.5 */
export default async function AccountPage() {
  const me = await requireRole("admin", "staff");
  const rows: [string, string][] = [
    [t.users.fieldName, me.name],
    [t.users.fieldEmail, me.email],
    [t.users.fieldRole, t.roles[me.role]],
    [t.users.fieldChannel, me.defaultChannel ? t.channels[me.defaultChannel] : t.common.none],
  ];

  return (
    <PageContainer className="max-w-3xl space-y-5">
      <PageHeader title={t.account.title} />
      <section className="rounded-lg border bg-card p-5 shadow-card md:p-6">
        <h2 className="text-lg font-semibold">{t.account.profile}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="rounded-lg border bg-card p-5 shadow-card md:p-6">
        <h2 className="mb-4 text-lg font-semibold">{t.account.changePassword}</h2>
        <ChangePasswordForm />
      </section>
      <form action={logout}>
        <Button variant="secondary" type="submit">
          <LogOut />
          {t.account.logout}
        </Button>
      </form>
    </PageContainer>
  );
}
