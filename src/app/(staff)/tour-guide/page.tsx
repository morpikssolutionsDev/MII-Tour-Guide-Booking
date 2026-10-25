import { CalendarOff, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InactiveBadge, LanguagePill, LeaveBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { GuideAvatar, WeekdayDots } from "@/components/common/guide-bits";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { FilterBar, FilterChips, FilterField } from "@/components/common/filter-bar";
import { SearchFilter, SelectFilter } from "@/components/common/url-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { t } from "@/i18n/id";
import { formatDayMonth, formatRating } from "@/lib/format";
import { countPendingLeave, listActiveLanguages, listGuides, type GuideListItem } from "@/server/guides/queries";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: t.guides.title };

type Search = Promise<{ q?: string; bahasa?: string; status?: string }>;

/** 02 §3.1 */
export default async function GuidesPage({ searchParams }: { searchParams: Search }) {
  const me = await requireRole("admin", "staff");
  const params = await searchParams;
  const status = params.status === "inactive" || params.status === "all" ? params.status : "active";
  const [rows, languages, pending] = await Promise.all([
    listGuides({ q: params.q, languageId: params.bahasa, status }),
    listActiveLanguages(),
    me.role === "admin" ? countPendingLeave() : Promise.resolve(0),
  ]);
  const sg = t.guides;

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title={sg.title}
        actions={
          me.role === "admin" && (
            <>
              <Button variant="secondary" asChild>
                <Link href="/tour-guide/cuti">
                  <CalendarOff />
                  {sg.leaveRequests}
                  {pending > 0 && (
                    <span className="ml-1 rounded-full bg-senja-100 px-2 text-xs font-semibold text-senja-800 tabular">{pending}</span>
                  )}
                </Link>
              </Button>
              <Button asChild>
                <Link href="/tour-guide/baru">
                  <Plus />
                  {sg.add}
                </Link>
              </Button>
            </>
          )
        }
      />
      <FilterBar
        search={<SearchFilter placeholder={sg.searchPlaceholder} />}
        params={["bahasa", "status"]}
        chips={<FilterChips param="bahasa" allLabel={sg.allLanguages} options={languages.map((l) => ({ value: l.id, label: l.nameId }))} />}
      >
        <FilterField label={sg.colLanguages}>
          <SelectFilter param="bahasa" label={sg.colLanguages} allLabel={sg.allLanguages} options={languages.map((l) => ({ value: l.id, label: l.nameId }))} />
        </FilterField>
        <FilterField label={t.common.status}>
          <SelectFilter
            param="status"
            label={t.common.status}
            allLabel={t.common.active}
            options={[
              { value: "inactive", label: t.common.inactive },
              { value: "all", label: t.users.allStatuses },
            ]}
          />
        </FilterField>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState decoration="bird-perched" title={sg.emptyFilter} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border bg-card shadow-card md:block">
            <Table>
              <TableHeader className="bg-surface-muted">
                <TableRow>
                  <TableHead scope="col">{sg.colGuide}</TableHead>
                  <TableHead scope="col">{sg.colLanguages}</TableHead>
                  <TableHead scope="col">{sg.colWorkdays}</TableHead>
                  <TableHead scope="col">{sg.colUpcomingLeave}</TableHead>
                  <TableHead scope="col">{sg.colRating}</TableHead>
                  <TableHead scope="col" className="text-right">{sg.colTours30}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((g) => (
                  <TableRow key={g.id} className="relative">
                    <TableCell>
                      <Link href={`/tour-guide/${g.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                        <GuideAvatar name={g.fullName} photoUrl={g.photoUrl} />
                        <span>
                          <span className="block font-medium">{g.displayName}</span>
                          <span className="block text-xs text-muted-foreground">{g.fullName}</span>
                        </span>
                        {!g.isActive && <InactiveBadge />}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Languages guide={g} />
                    </TableCell>
                    <TableCell>
                      <WeekdayDots weekdays={g.weekdays} />
                    </TableCell>
                    <TableCell>
                      <UpcomingLeave guide={g} />
                    </TableCell>
                    <TableCell className="tabular">
                      {g.rating.avg === null ? <span className="text-muted-foreground">{sg.noRating}</span> : sg.ratingLine(formatRating(g.rating.avg), g.rating.count)}
                    </TableCell>
                    <TableCell className="text-right tabular">{g.tours30}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((g) => (
              <li key={g.id}>
                <Link href={`/tour-guide/${g.id}`} className="block rounded-lg border bg-card p-4 shadow-card">
                  <div className="flex items-center gap-3">
                    <GuideAvatar name={g.fullName} photoUrl={g.photoUrl} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{g.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{g.fullName}</p>
                    </div>
                    <span className="text-sm tabular">{g.rating.avg === null ? "" : `★ ${formatRating(g.rating.avg)}`}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Languages guide={g} />
                    {!g.isActive && <InactiveBadge />}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <WeekdayDots weekdays={g.weekdays} />
                    <UpcomingLeave guide={g} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageContainer>
  );
}

function Languages({ guide }: { guide: GuideListItem }) {
  return (
    <span className="flex flex-wrap gap-1">
      {guide.languages.map((l) => (
        <LanguagePill key={l.id} code={l.code} name={l.nameId} />
      ))}
    </span>
  );
}

function UpcomingLeave({ guide }: { guide: GuideListItem }) {
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      {guide.nextLeave
        ? guide.nextLeave.startDate === guide.nextLeave.endDate
          ? formatDayMonth(guide.nextLeave.startDate)
          : `${formatDayMonth(guide.nextLeave.startDate)} – ${formatDayMonth(guide.nextLeave.endDate)}`
        : !guide.hasPendingLeave && <span className="text-muted-foreground">{t.common.none}</span>}
      {guide.hasPendingLeave && <LeaveBadge status="pending" prefix />}
    </span>
  );
}
