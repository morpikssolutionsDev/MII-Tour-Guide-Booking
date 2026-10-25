import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ReturningBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { FilterBar, FilterField } from "@/components/common/filter-bar";
import { SearchFilter, SelectFilter } from "@/components/common/url-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPhone } from "@/domain/phone";
import { t } from "@/i18n/id";
import { countryNameId, formatDateMedium } from "@/lib/format";
import { listCustomers, PAGE_SIZE } from "@/server/bookings/queries";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: t.customers.title };

/** 05 §3.7 customer list. Customers are created through the booking wizard only. */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; negara?: string; page?: string }> }) {
  await requireRole("admin", "staff");
  const p = await searchParams;
  const page = Math.max(1, Number(p.page) || 1);
  const { rows, total, nationalities } = await listCustomers({ q: p.q, nationality: p.negara, page });
  const sc = t.customers;
  const pageHref = (n: number) => `/pelanggan?${new URLSearchParams({ ...(p.q ? { q: p.q } : {}), ...(p.negara ? { negara: p.negara } : {}), page: String(n) })}`;

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={sc.title} />
      <FilterBar search={<SearchFilter placeholder={sc.searchPlaceholder} />} params={["negara"]}>
        <FilterField label={sc.cols.nationality}>
          <SelectFilter
            param="negara"
            label={sc.cols.nationality}
            allLabel={sc.allNationalities}
            options={nationalities.map((c) => ({ value: c, label: countryNameId(c) })).sort((a, b) => a.label.localeCompare(b.label, "id"))}
          />
        </FilterField>
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState decoration="carousel" title={sc.empty} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border bg-card shadow-card md:block">
            <Table>
              <TableHeader className="bg-surface-muted">
                <TableRow>
                  <TableHead scope="col">{sc.cols.name}</TableHead>
                  <TableHead scope="col">{sc.cols.nationality}</TableHead>
                  <TableHead scope="col">{sc.cols.phone}</TableHead>
                  <TableHead scope="col" className="text-right">{sc.cols.visits}</TableHead>
                  <TableHead scope="col">{sc.cols.lastVisit}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} className="relative">
                    <TableCell>
                      <Link href={`/pelanggan/${c.id}`} className="flex items-center gap-2 font-medium after:absolute after:inset-0">
                        {c.name}
                        {c.visits >= 2 && <ReturningBadge visits={c.visits} />}
                      </Link>
                    </TableCell>
                    <TableCell>{countryNameId(c.nationality)}</TableCell>
                    <TableCell className="tabular">{formatPhone(c.phoneE164)}</TableCell>
                    <TableCell className="text-right tabular">{c.visits}</TableCell>
                    <TableCell>{c.lastVisit ? formatDateMedium(c.lastVisit) : t.common.none}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/pelanggan/${c.id}`} className="block rounded-lg border bg-card p-4 shadow-card">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {c.name}
                    {c.visits >= 2 && <ReturningBadge visits={c.visits} />}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {countryNameId(c.nationality)} · <span className="tabular">{formatPhone(c.phoneE164)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {sc.cols.visits}: {c.visits}
                    {c.lastVisit ? ` · ${formatDateMedium(c.lastVisit)}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Halaman">
            <span className="text-muted-foreground">{t.booking.page((page - 1) * PAGE_SIZE + 1, Math.min(page * PAGE_SIZE, total), total)}</span>
            <span className="flex gap-2">
              {page > 1 && (
                <Button variant="secondary" size="sm" asChild>
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft />
                    {t.booking.prev}
                  </Link>
                </Button>
              )}
              {page * PAGE_SIZE < total && (
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
