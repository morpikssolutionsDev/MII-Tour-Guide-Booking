import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Page title row with optional description and actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Standard page padding and width (design-system §6.2). */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1280px] px-4 py-5 md:px-6 md:py-6 lg:px-8", className)}>{children}</div>;
}

/** Photo header band for Beranda and Laporan (design-system §6.5). */
export function HeaderBand({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden text-white",
        compact ? "h-[120px] md:h-[160px]" : "h-[160px] md:h-[200px]",
      )}
    >
      <Image
        src="/brand/top-bg-1600.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[50%_40%]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-rimba-900/55 to-rimba-900/85" />
      <div className="relative mx-auto flex h-full max-w-[1280px] flex-col justify-center px-4 pb-8 md:px-6 lg:px-8">
        {children}
      </div>
    </section>
  );
}
