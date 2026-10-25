import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { RedirectNotices } from "@/components/shell/redirect-notices";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { t } from "@/i18n/id";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: t.app.name, template: `%s · ${t.app.shortName}` },
  description: t.app.description,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d2d1f",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="min-h-dvh">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster />
        <Suspense>
          <RedirectNotices />
        </Suspense>
      </body>
    </html>
  );
}
