import { ChevronLeft, ChevronRight, Link2, Plus, Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChannelBadge, StatusBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { UrlTabs } from "@/components/common/url-tabs";
import { DateRangeFilter } from "@/components/common/date-range-filter";
import { FilterBar, FilterChips, FilterField } from "@/components/common/filter-bar";
import { SearchFilter, SelectFilter } from "@/components/common/url-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BOOKING_STATUSES, CHANNELS, type BookingStatus, type Channel } from "@/db/schema";
import { isValidDate } from "@/domain/time";
import { t } from "@/i18n/id";
import { formatDateMedium, formatDuration, formatRupiah, formatSlot } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BOOKING_VIEWS, bookingFilterOptions, listBookings, PAGE_SIZE, type BookingListRow, type BookingView } from "@/server/bookings/queries";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: t.booking.title };

type Search = Promise<Record<string, string | undefined>>;

const TOUR_DATE = "Tanggal tur";

/** 05 §3.1 */
export default async function BookingsPage({ searchParams }: { searchParams: Search }) {
  await requireRole("admin", "staff");
  const p = await searchParams;
  const view: BookingView = BOOKING_VIEWS.includes(p.view as BookingView) ? (p.view as BookingView) : "mendatang";
  const status = BOOKING_STATUSES.includes(p.status as BookingStatus) ? (p.status as BookingStatus) : undefined;
  const page = Math.max(1, Number(p.page) || 1);
  const [{ rows, total }, options] = await Promise.all([
    listBookings({
      view,
      q: p.q,
      statuses: status ? [status] : undefined,
      from: p.dari && isValidDate(p.dari) ? p.dari : undefined,
      to: p.sampai && isValidDate(p.sampai) ? p.sampai : undefined,
      channel: CHANNELS.includes(p.kanal as Channel) ? (p.kanal as Channel) : undefined,
      languageId: p.bahasa,
      guideId: p.guide,
      createdBy: p.staf,
      page,
    }),
    bookingFilterOptions(),
  ]);
  const sb = t.booking;
  const now = new Date();
  const pageHref = (n: number) => {
    const next = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]);
    next.set("page", String(n));
    return `/pemesanan?${next.toString()}`;
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title={sb.title}
        actions={
          <Button asChild className="hidden md:inline-flex">
            <Link href="/pemesanan/baru">
              <Plus />
              {sb.create}
            </Link>
          </Button>
        }
      />
      <UrlTabs param="view" active={view} tabs={BOOKING_VIEWS.map((v) => ({ value: v, label: sb.views[v] }))} />
      <FilterBar
        search={<SearchFilter placeholder={sb.searchPlaceholder} />}
        params={["status", "kanal", "bahasa", "guide", "staf", "dari", "sampai"]}
        chips={<FilterChips param="kanal" allLabel={sb.all.channel} options={CHANNELS.map((c) => ({ value: c, label: t.channels[c] }))} />}
      >
        <FilterField label={sb.filters.status}>
          <SelectFilter param="status" label={sb.filters.status} allLabel={sb.all.status} options={BOOKING_STATUSES.map((s) => ({ value: s, label: t.bookingStatus[s] }))} />
        </FilterField>
        <FilterField label={sb.filters.channel}>
          <SelectFilter param="kanal" label={sb.filters.channel} allLabel={sb.all.channel} options={CHANNELS.map((c) => ({ value: c, label: t.channels[c] }))} />
        </FilterField>
        <FilterField label={sb.filters.language}>
          <SelectFilter param="bahasa" label={sb.filters.language} allLabel={sb.all.language} options={options.languages.map((l) => ({ value: l.id, label: l.name }))} />
        </FilterField>
        <FilterField label={sb.filters.guide}>
          <SelectFilter param="guide" label={sb.filters.guide} allLabel={sb.all.guide} options={options.guides.map((g) => ({ value: g.id, label: g.name }))} />
        </FilterField>
        <FilterField label={sb.filters.createdBy}>
          <SelectFilter param="staf" label={sb.filters.createdBy} allLabel={sb.all.createdBy} options={options.staff.map((s) => ({ value: s.id, label: s.name }))} />
        </FilterField>
        <FilterField label={TOUR_DATE}>
          <DateRangeFilter label={TOUR_DATE} />
        </FilterField>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          decoration="carousel"
          title={sb.empty}
          action={
            <Button asChild>
              <Link href="/pemesanan/baru">{sb.create}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border bg-card shadow-card md:block">
            <Table>
              <TableHeader className="bg-surface-muted">
                <TableRow>
                  <TableHead scope="col">{sb.cols.code}</TableHead>
                  <TableHead scope="col">{sb.cols.customer}</TableHead>
                  <TableHead scope="col">{sb.cols.schedule}</TableHead>
                  <TableHead scope="col">{sb.cols.langPeople}</TableHead>
                  <TableHead scope="col">{sb.cols.guides}</TableHead>
                  <TableHead scope="col" className="text-right">{sb.cols.total}</TableHead>
                  <TableHead scope="col">{sb.cols.status}</TableHead>
                  <TableHead scope="col">{sb.cols.channel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="relative">
                    <TableCell>
                      <Link href={`/pemesanan/${r.id}`} className="flex items-center gap-1 font-medium tabular after:absolute after:inset-0">
                        {r.code}
                        {r.groupRef && <Link2 className="size-3.5 text-muted-foreground" aria-label={sb.linked} />}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {r.customerName}
                        <span className="rounded-sm bg-kabut-100 px-1 text-[0.6875rem] font-semibold text-kabut-700">{r.nationality}</span>
                        {r.visits >= 2 && <Repeat className="size-3.5 text-senja-700" aria-label="Pelanggan kembali" />}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateMedium(r.tourDate)}
                      <span className="block text-xs text-muted-foreground tabular">{formatSlot(r.slotStart, r.slotEnd)}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.languageCode.toUpperCase()} · {t.common.people(r.people)}
                    </TableCell>
                    <TableCell>{guideList(r.guideNames)}</TableCell>
                    <TableCell className="text-right tabular">{formatRupiah(r.totalAmount)}</TableCell>
                    <TableCell>
                      <StatusLine row={r} now={now} />
                    </TableCell>
                    <TableCell>
                      <ChannelBadge channel={r.channel} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/pemesanan/${r.id}`} className="block rounded-lg border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold tabular">{r.code}</span>
                    <StatusLine row={r} now={now} />
                  </div>
                  <p className="mt-1 font-medium">
                    {r.customerName} <span className="text-xs text-muted-foreground">{r.nationality}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateMedium(r.tourDate)} · {formatSlot(r.slotStart, r.slotEnd)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {r.languageCode.toUpperCase()} · {t.common.people(r.people)} · {guideList(r.guideNames)}
                  </p>
                  <p className="mt-2 font-semibold tabular">{formatRupiah(r.totalAmount)}</p>
                </Link>
              </li>
            ))}
          </ul>
          <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Halaman">
            <span className="text-muted-foreground">{sb.page((page - 1) * PAGE_SIZE + 1, Math.min(page * PAGE_SIZE, total), total)}</span>
            <span className="flex gap-2">
              {page > 1 && (
                <Button variant="secondary" size="sm" asChild>
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft />
                    {sb.prev}
                  </Link>
                </Button>
              )}
              {page * PAGE_SIZE < total && (
                <Button variant="secondary" size="sm" asChild>
                  <Link href={pageHref(page + 1)}>
                    {sb.next}
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

function guideList(names: string[]) {
  if (names.length === 0) return t.common.none;
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
}

function StatusLine({ row, now }: { row: BookingListRow; now: Date }) {
  const remaining = row.holdExpiresAt ? Date.parse(row.holdExpiresAt) - now.getTime() : null;
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge status={row.status} />
      {row.status === "awaiting_payment" && remaining !== null && remaining > 0 && (
        <span className={cn("text-xs", remaining < 2 * 3_600_000 ? "font-medium text-senja-800" : "text-muted-foreground")}>
          {t.booking.expiresIn(formatDuration(remaining))}
        </span>
      )}
      {row.checklist && row.status === "confirmed" && (
        <span className="text-xs text-muted-foreground tabular">
          {Number(row.checklist.done)}/{row.checklist.total}
        </span>
      )}
    </span>
  );
}
