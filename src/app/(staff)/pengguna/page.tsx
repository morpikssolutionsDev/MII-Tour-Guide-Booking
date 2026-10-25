import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InactiveBadge } from "@/components/common/badges";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { FilterBar, FilterChips, FilterField } from "@/components/common/filter-bar";
import { SearchFilter, SelectFilter } from "@/components/common/url-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLES, type Role } from "@/db/schema";
import { t } from "@/i18n/id";
import { formatRelative } from "@/lib/format";
import { requireRole } from "@/server/session";
import { listUsers } from "@/server/users/queries";
import { UserRowActions } from "./user-row-actions";

export const metadata: Metadata = { title: t.users.title };

const STATUS_OPTIONS = [
  { value: "inactive", label: t.common.inactive },
  { value: "all", label: t.users.allStatuses },
];

type Search = Promise<{ q?: string; peran?: string; status?: string }>;

export default async function UsersPage({ searchParams }: { searchParams: Search }) {
  const me = await requireRole("admin");
  const params = await searchParams;
  const role = ROLES.includes(params.peran as Role) ? (params.peran as Role) : undefined;
  const status = params.status === "inactive" || params.status === "all" ? params.status : "active";
  const rows = await listUsers({ q: params.q, role, status });
  const now = new Date();
  const roleOptions = ROLES.map((r) => ({ value: r, label: t.roles[r] }));

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title={t.users.title}
        actions={
          <Button asChild>
            <Link href="/pengguna/baru">
              <Plus />
              {t.users.add}
            </Link>
          </Button>
        }
      />
      <FilterBar
        search={<SearchFilter placeholder={t.users.searchPlaceholder} />}
        params={["peran", "status"]}
        chips={<FilterChips param="peran" allLabel={t.users.allRoles} options={roleOptions} />}
      >
        <FilterField label={t.users.colRole}>
          <SelectFilter param="peran" label={t.users.colRole} allLabel={t.users.allRoles} options={roleOptions} />
        </FilterField>
        <FilterField label={t.common.status}>
          <SelectFilter param="status" label={t.common.status} allLabel={t.common.active} options={STATUS_OPTIONS} />
        </FilterField>
      </FilterBar>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border bg-card shadow-card md:block">
        <Table>
          <TableHeader className="bg-surface-muted">
            <TableRow>
              <TableHead scope="col">{t.users.colName}</TableHead>
              <TableHead scope="col">{t.users.colRole}</TableHead>
              <TableHead scope="col">{t.users.colChannel}</TableHead>
              <TableHead scope="col">{t.common.status}</TableHead>
              <TableHead scope="col">{t.users.colLastLogin}</TableHead>
              <TableHead scope="col" className="w-12">
                <span className="sr-only">{t.common.actions}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell>
                  {t.roles[u.role]}
                  {u.role === "guide" && <p className="text-xs text-muted-foreground">{t.users.managedInGuide}</p>}
                </TableCell>
                <TableCell>{u.defaultChannel ? t.channels[u.defaultChannel] : t.common.none}</TableCell>
                <TableCell>{u.isActive ? t.common.active : <InactiveBadge />}</TableCell>
                <TableCell className="text-muted-foreground">
                  {u.lastLoginAt ? formatRelative(u.lastLoginAt, now) : t.common.never}
                </TableCell>
                <TableCell>
                  <UserRowActions user={u} isSelf={u.id === me.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((u) => (
          <li key={u.id} className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-card">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{u.name}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-sm bg-kabut-100 px-2 py-1 font-medium text-kabut-700">{t.roles[u.role]}</span>
                {u.defaultChannel && <span className="text-muted-foreground">{t.channels[u.defaultChannel]}</span>}
                {!u.isActive && <InactiveBadge />}
              </div>
            </div>
            <UserRowActions user={u} isSelf={u.id === me.id} />
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
