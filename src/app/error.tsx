"use client";

import Link from "next/link";
import { DecoratedLogo } from "@/components/brand/decorated-logo";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/id";

// design-system §7.4 error page.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center px-4 text-center">
      <DecoratedLogo className="max-w-[240px]" />
      <h1 className="mt-8 text-xl font-bold">{t.errors.pageTitle}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{t.errors.pageBody}</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>{t.common.tryAgain}</Button>
        <Button variant="secondary" asChild>
          <Link href="/">{t.common.backHome}</Link>
        </Button>
      </div>
    </main>
  );
}
