"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { InactiveBadge } from "@/components/common/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { t } from "@/i18n/id";
import { formatPercent, formatRating } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GuideRow = {
  id: string;
  name: string;
  inactive: boolean;
  languages: string[];
  tours: number;
  noShows: number;
  rating: number | null;
  ratingCount: number;
  byGuide: number;
  utilisation: number | null;
  notice: number | null;
  leaveDays: number;
};

type SortKey = "name" | "tours" | "noShows" | "rating" | "byGuide" | "utilisation" | "notice" | "leaveDays";
const c = t.reports.guides.cols;
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "tours", label: c.tours },
  { key: "noShows", label: c.noShows },
  { key: "rating", label: c.rating },
  { key: "byGuide", label: c.byGuide },
  { key: "utilisation", label: c.utilisation },
  { key: "notice", label: c.notice },
  { key: "leaveDays", label: c.leave },
];

const pct = (v: number | null) => (v === null ? t.common.none : formatPercent(v));
const stars = (g: GuideRow) => (g.rating === null ? t.common.none : `★ ${formatRating(g.rating)} (${g.ratingCount})`);

function cell(g: GuideRow, key: SortKey) {
  if (key === "rating") return stars(g);
  if (key === "utilisation" || key === "notice") return pct(g[key]);
  return String(g[key]);
}

/** 11 §3.2 "Kinerja tour guide": sortable table on desktop, cards on mobile. */
export function GuideTable({ rows }: { rows: GuideRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "tours", dir: -1 });
  const sorted = [...rows].sort((a, b) => {
    if (sort.key === "name") return a.name.localeCompare(b.name, "id") * sort.dir;
    const av = a[sort.key] ?? -1;
    const bv = b[sort.key] ?? -1;
    return (av - bv) * sort.dir || a.name.localeCompare(b.name, "id");
  });
  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));

  const header = (key: SortKey, label: string, align: "left" | "right" = "right") => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <TableHead scope="col" className={align === "right" ? "text-right" : undefined} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggle(key)} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
          {label}
          <Icon className="size-3.5" aria-hidden />
        </button>
      </TableHead>
    );
  };

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border bg-card shadow-card md:block">
        <Table>
          <TableHeader className="bg-surface-muted">
            <TableRow>
              {header("name", c.guide, "left")}
              {COLUMNS.map((col) => header(col.key, col.label))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((g) => (
              <TableRow key={g.id} className="relative">
                <TableCell>
                  <Link href={`/tour-guide/${g.id}`} className="font-medium after:absolute after:inset-0">
                    {g.name}
                  </Link>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {g.languages.map((l) => l.toUpperCase()).join(" · ")}
                    {g.inactive && <InactiveBadge />}
                  </span>
                </TableCell>
                {COLUMNS.map((col) => (
                  <TableCell key={col.key} className="text-right tabular">
                    {cell(g, col.key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="space-y-3 md:hidden">
        {sorted.map((g) => (
          <li key={g.id}>
            <Link href={`/tour-guide/${g.id}`} className="block rounded-lg border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{g.name}</span>
                <span className="text-sm font-medium tabular">{stars(g)}</span>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {g.languages.map((l) => l.toUpperCase()).join(" · ")}
                {g.inactive && <InactiveBadge />}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                {COLUMNS.filter((col) => col.key !== "rating").map((col) => (
                  <div key={col.key}>
                    <dt className="text-xs text-muted-foreground">{col.label}</dt>
                    <dd className="font-medium tabular">{cell(g, col.key)}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
