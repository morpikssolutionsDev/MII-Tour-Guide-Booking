import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { LanguagePill } from "@/components/common/badges";
import { GuideAvatar, WeekdayDots } from "@/components/common/guide-bits";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/domain/phone";
import { t } from "@/i18n/id";
import { logout } from "@/server/auth-actions";
import { getGuideProfile } from "@/server/portal/queries";
import { requireGuide } from "@/server/session";

export const metadata: Metadata = { title: t.nav.portal.akun };

/** 08 §3.5 "Akun". */
export default function PortalAccountPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-kabut-100" />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const me = await requireGuide();
  const profile = await getGuideProfile(me.guideId);
  if (!profile) return null;
  const g = profile.guide;
  const sa = t.portal.account;
  return (
    <div className="space-y-4">
      <section className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-card">
        <GuideAvatar name={g.fullName} photoUrl={g.photoUrl} size={56} />
        <div className="min-w-0">
          <p className="text-lg font-semibold">{g.displayName}</p>
          <p className="text-sm text-muted-foreground">{g.fullName}</p>
          <p className="text-sm text-muted-foreground">{me.email}</p>
        </div>
      </section>
      <section className="space-y-3 rounded-lg border bg-card p-4 shadow-card text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{sa.phone}</p>
          <p className="font-medium tabular">{formatPhone(g.phoneE164)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{sa.languages}</p>
          <p className="mt-1 flex flex-wrap gap-1.5">
            {profile.languages.map((l) => (
              <span key={l.code} className="flex items-center gap-1">
                <LanguagePill code={l.code} /> {l.name}
              </span>
            ))}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{sa.workdays}</p>
          <WeekdayDots weekdays={profile.weekdays} />
        </div>
        <p className="text-xs text-muted-foreground">{t.account.contactAdmin}</p>
      </section>
      <section className="rounded-lg border bg-card p-4 shadow-card">
        <h2 className="mb-3 font-semibold">{t.account.changePassword}</h2>
        <ChangePasswordForm />
      </section>
      <form action={logout}>
        <Button variant="secondary" type="submit" className="w-full">
          <LogOut />
          {t.account.logout}
        </Button>
      </form>
    </div>
  );
}
