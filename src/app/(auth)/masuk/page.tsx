import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { DecoratedLogo } from "@/components/brand/decorated-logo";
import { Logo } from "@/components/brand/logo";
import { t } from "@/i18n/id";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: t.auth.loginTitle };

// 01 §3.1 + design-system §8.3: photo hero with the animated decorated logo on Batu 50.
export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-batu-50 lg:grid lg:grid-cols-[3fr_2fr]">
      <section className="relative h-[180px] overflow-hidden lg:h-auto">
        <Image
          src="/brand/top-bg-1600.webp"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover object-[50%_40%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-rimba-900/55 to-rimba-900/85" />
        <div className="absolute inset-x-0 bottom-0 hidden p-12 text-white lg:block">
          <Logo className="h-10 text-white" />
          <p className="mt-6 max-w-md text-display font-bold text-balance">{t.auth.tagline}</p>
        </div>
      </section>

      <section className="relative -mt-6 flex justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:px-12">
        <div className="w-full max-w-sm rounded-xl bg-batu-50 px-5 pt-6 pb-2 lg:rounded-none lg:p-0">
          <DecoratedLogo animated className="mx-auto max-w-[280px] lg:max-w-[360px]" />
          <h1 className="mt-6 text-display font-bold">{t.auth.loginTitle}</h1>
          <p className="mt-1 text-muted-foreground">{t.auth.loginSubtitle}</p>
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-xs font-medium text-muted-foreground">{t.auth.forgot}</p>
        </div>
      </section>
    </main>
  );
}
