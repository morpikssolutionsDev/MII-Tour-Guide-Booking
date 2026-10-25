import Link from "next/link";
import { DecoratedLogo } from "@/components/brand/decorated-logo";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/id";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-batu-50 px-4 text-center">
      <DecoratedLogo className="max-w-[240px]" />
      <h1 className="mt-8 text-xl font-bold">{t.errors.notFoundTitle}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{t.errors.notFoundBody}</p>
      <Button asChild className="mt-6">
        <Link href="/">{t.common.backHome}</Link>
      </Button>
    </main>
  );
}
