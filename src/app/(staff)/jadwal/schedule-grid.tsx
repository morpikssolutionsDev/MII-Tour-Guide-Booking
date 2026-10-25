"use client";

import { Clock, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { InactiveBadge, StatusBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/empty-state";
import { GuideAvatar } from "@/components/common/guide-bits";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BookingStatus } from "@/db/schema";
import { t } from "@/i18n/id";
import { firstName, formatSlot, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Cell =
  | { kind: "booked"; booking: { bookingId: string; code: string; status: BookingStatus; people: number; customerName: string } }
  | { kind: "free"; href: string }
  | { kind: "leave" }
  | { kind: "off" }
  | { kind: "passed" };

type Row = {
  guide: { id: string; displayName: string; fullName: string; photoUrl: string | null; isActive: boolean; languages: { id: string; code: string }[] };
  dimmed: boolean;
  cells: Cell[];
};
type Column = { slot: { id: string; startTime: string; endTime: string; isActive: boolean }; booked: number; working: number };

const ts = t.schedule;

const TINT: Record<BookingStatus, string> = {
  awaiting_payment: "bg-senja-100 text-senja-800",
  confirmed: "bg-danau-100 text-danau-800",
  ready: "bg-rimba-100 text-rimba-700",
  completed: "bg-rimba-600 text-white",
  evaluated: "bg-batu-200 text-batu-800",
  no_show: "bg-merah-50 text-merah-700",
  cancelled: "bg-kabut-100 text-kabut-700",
};

function CellView({ cell, guideName, slotLabel }: { cell: Cell; guideName: string; slotLabel: string }) {
  switch (cell.kind) {
    case "booked": {
      const b = cell.booking;
      return (
        <Link href={`/pemesanan/${b.bookingId}`} className={cn("flex h-full min-h-16 flex-col justify-center rounded-md px-2 py-1.5 text-xs", TINT[b.status])}>
          <span className="flex items-center gap-1 font-semibold tabular">
            {b.status === "awaiting_payment" && <Clock className="size-3" aria-label={t.bookingStatus.awaiting_payment} />}
            {b.code}
          </span>
          <span className="truncate">
            {firstName(b.customerName)} · {b.people}
          </span>
          <span className="sr-only">{t.bookingStatus[b.status]}</span>
        </Link>
      );
    }
    case "free":
      return (
        <Link
          href={cell.href}
          aria-label={`${ts.bookHere}: ${guideName}, ${slotLabel}`}
          className="group flex h-full min-h-16 items-center justify-center rounded-md border border-dashed border-kabut-300 bg-card text-kabut-400 hover:border-danau-600 hover:text-danau-700 focus-visible:border-danau-600"
        >
          <Plus className="size-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </Link>
      );
    case "leave":
      return <div className="hatch-batu flex h-full min-h-16 items-center justify-center rounded-md text-xs font-medium text-batu-800">{ts.leave}</div>;
    case "off":
      return <div className="flex h-full min-h-16 items-center justify-center rounded-md bg-kabut-50 text-xs text-kabut-500">{ts.off}</div>;
    case "passed":
      return <div className="flex h-full min-h-16 items-center justify-center rounded-md bg-card text-xs text-kabut-400 opacity-60">{ts.passed}</div>;
  }
}

function GuideLabel({ guide }: { guide: Row["guide"] }) {
  return (
    <div className="flex items-center gap-2">
      <GuideAvatar name={guide.fullName} photoUrl={guide.photoUrl} size={32} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{guide.displayName}</p>
        <p className="flex flex-wrap gap-0.5">
          {guide.languages.map((l) => (
            <span key={l.id} className="text-[0.625rem] font-semibold text-muted-foreground">
              {l.code.toUpperCase()}
            </span>
          ))}
        </p>
      </div>
      {!guide.isActive && <InactiveBadge />}
    </div>
  );
}

/** design-system §7.3 ScheduleGrid. Desktop: full grid; mobile: one slot at a time. */
export function ScheduleGrid({ columns, rows, isToday }: { columns: Column[]; rows: Row[]; isToday: boolean }) {
  const [mobileSlot, setMobileSlot] = useState(columns[0]?.slot.id ?? "");
  if (rows.length === 0) return <EmptyState decoration="bird-perched" title={ts.noGuides} />;
  const mobileIndex = Math.max(0, columns.findIndex((c) => c.slot.id === mobileSlot));

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border bg-card shadow-card md:block">
        <table className="w-full border-separate border-spacing-1 p-1">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-48 bg-card px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                {t.nav.tourGuide}
              </th>
              {columns.map((c) => (
                <th key={c.slot.id} scope="col" className={cn("min-w-36 rounded-md px-2 py-2 text-left", isToday && "glow-top bg-senja-50")}>
                  <span className="block text-sm font-semibold tabular">{formatSlot(c.slot.startTime, c.slot.endTime)}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{ts.filled(c.booked, c.working)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.guide.id} className={cn(r.dimmed && "opacity-40")}>
                <th scope="row" className="sticky left-0 z-10 bg-card px-2 py-1 text-left font-normal">
                  <GuideLabel guide={r.guide} />
                </th>
                {r.cells.map((cell, i) => (
                  <td key={columns[i].slot.id} className="h-16">
                    <CellView cell={cell} guideName={r.guide.displayName} slotLabel={formatSlot(columns[i].slot.startTime, columns[i].slot.endTime)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        <ToggleGroup type="single" variant="outline" value={mobileSlot} onValueChange={(v) => v && setMobileSlot(v)} className="w-full">
          {columns.map((c) => (
            <ToggleGroupItem key={c.slot.id} value={c.slot.id} className="h-11 flex-1 tabular data-[state=on]:bg-danau-50 data-[state=on]:text-danau-800">
              {formatTime(c.slot.startTime)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {columns[mobileIndex] && (
          <p className="text-sm text-muted-foreground">
            {formatSlot(columns[mobileIndex].slot.startTime, columns[mobileIndex].slot.endTime)} · {ts.filled(columns[mobileIndex].booked, columns[mobileIndex].working)}
          </p>
        )}
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.guide.id} className={cn("grid grid-cols-[1fr_140px] items-stretch gap-2 rounded-lg border bg-card p-2", r.dimmed && "opacity-40")}>
              <GuideLabel guide={r.guide} />
              <CellView cell={r.cells[mobileIndex]} guideName={r.guide.displayName} slotLabel={formatTime(columns[mobileIndex].slot.startTime)} />
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs" aria-hidden>
        {(["awaiting_payment", "confirmed", "ready", "completed"] as const).map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
        <span className="hatch-batu rounded-sm px-2 py-1 font-medium text-batu-800">{ts.leave}</span>
        <span className="rounded-sm bg-kabut-50 px-2 py-1 text-kabut-500">{ts.off}</span>
      </div>
    </>
  );
}
