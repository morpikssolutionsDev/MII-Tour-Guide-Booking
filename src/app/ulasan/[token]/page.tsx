/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { Suspense } from "react";
import { DecoratedLogo } from "@/components/brand/decorated-logo";
import { en } from "@/i18n/en";
import { getPublicFeedbackForm } from "@/server/feedback/public";
import { PublicFeedbackForm } from "./public-feedback-form";

export const metadata: Metadata = {
  title: "Your TMII tour",
  robots: { index: false, follow: false },
};

/** 10 §3.1: the only public page (English, no login, no app shell). */
export default function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main lang="en" className="min-h-dvh bg-batu-50 px-4 py-8">
      <div className="mx-auto w-full max-w-[480px]">
        <header className="text-center">
          <DecoratedLogo className="mx-auto max-w-[240px]" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">{en.feedback.park}</p>
        </header>
        <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-xl bg-kabut-100" />}>
          <FeedbackContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function FeedbackContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await getPublicFeedbackForm(token);
  if (form.state !== "open") {
    return (
      <div className="mt-8 flex flex-col items-center rounded-xl bg-card p-6 text-center shadow-card">
        <img src="/brand/snake.svg" alt="" className="w-[120px]" />
        <p className="mt-4 text-base font-medium">{en.feedback[form.state]}</p>
      </div>
    );
  }
  return <PublicFeedbackForm token={token} tour={form.tour} />;
}
