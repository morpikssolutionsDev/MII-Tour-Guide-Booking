import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { DateRangeFilter } from "@/components/common/date-range-filter";
import { FilterBar, FilterChips, FilterField } from "@/components/common/filter-bar";
import { SearchFilter, SelectFilter } from "@/components/common/url-filters";
import { Button } from "@/components/ui/button";
import { isValidDate } from "@/domain/time";
import { t } from "@/i18n/id";
import { listOutbox, OUTBOX_PAGE } from "@/server/notify/queries";
import { EVENT_LABELS } from "@/server/notify/templates";
import { requireRole } from "@/server/session";
import { OutboxTable } from "./outbox-table";

export const metadata: Metadata = { title: t.outbox.title };

type Search = Promise<{ q?: string; kanal?: string; peristiwa?: string; dari?: string; sampai?: string; page?: string }>;

/** 09 §3.2 (admin). */
export default async function OutboxPage({ searchParams }: { searchParams: Search }) {
  await requireRole("admin");
  const p = await searchParams;
  const page = Math.max(1, Number(p.page) || 1);
  const { rows, total } = await listOutbox({
    q: p.q,
    channel: p.kanal === "in_app" || p.kanal === "whatsapp_mock" || p.kanal === "email" ? p.kanal : undefined,
    eventKey: p.peristiwa && p.peristiwa in EVENT_LABELS ? p.peristiwa : undefined,
    from: p.dari && isValidDate(p.dari) ? p.dari : undefined,
    to: p.sampai && isValidDate(p.sampai) ? p.sampai : undefined,
    page,
  });
  const so = t.outbox;
  const channelOptions = [
    { value: "in_app", label: so.channels.in_app },
    { value: "whatsapp_mock", label: so.channels.whatsapp_mock },
    { value: "email", label: so.channels.email },
  ];
  const pageHref = (n: number) => {
    const next = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]);
    next.set("page", String(n));
    return `/outbox?${next.toString()}`;
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={so.title} description={so.description} />
      <FilterBar
        search={<SearchFilter placeholder={so.searchPlaceholder} />}
        params={["kanal", "peristiwa", "dari", "sampai"]}
        chips={<FilterChips param="kanal" allLabel={so.allChannels} options={channelOptions} />}
      >
        <FilterField label={so.channel}>
          <SelectFilter param="kanal" label={so.channel} allLabel={so.allChannels} options={channelOptions} />
        </FilterField>
        <FilterField label={so.event}>
          <SelectFilter param="peristiwa" label={so.event} allLabel={so.allEvents} options={Object.entries(EVENT_LABELS).map(([value, label]) => ({ value, label }))} className="md:w-56" />
        </FilterField>
        <FilterField label="Tanggal">
          <DateRangeFilter label="Tanggal" />
        </FilterField>
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState decoration="birds-flying" title={so.empty} />
      ) : (
        <>
          <OutboxTable rows={rows} />
          <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Halaman">
            <span className="text-muted-foreground">{t.booking.page((page - 1) * OUTBOX_PAGE + 1, Math.min(page * OUTBOX_PAGE, total), total)}</span>
            <span className="flex gap-2">
              {page > 1 && (
                <Button variant="secondary" size="sm" asChild>
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft />
                    {t.booking.prev}
                  </Link>
                </Button>
              )}
              {page * OUTBOX_PAGE < total && (
                <Button variant="secondary" size="sm" asChild>
                  <Link href={pageHref(page + 1)}>
                    {t.booking.next}
                    <ChevronRight />
                  </Link>
                </Button>
              )}
            </span>
          </nav>
        </>
      )}
    </PageContainer>
  );
}
