import Link from "next/link";
import { t } from "@/i18n/id";
import { formatDateMedium, formatSlot } from "@/lib/format";
import type { BookingRef } from "@/server/bookings/conflicts";
import { StatusBadge } from "./badges";

/** Upcoming bookings that block a change, each linking to the booking and its reschedule page. */
export function ConflictList({ conflicts }: { conflicts: BookingRef[] }) {
  return (
    <ul className="divide-y rounded-md border">
      {conflicts.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
          <Link href={`/pemesanan/${c.id}`} className="font-medium text-danau-700 tabular hover:underline">
            {c.code}
          </Link>
          <StatusBadge status={c.status} />
          <span className="text-muted-foreground">
            {formatDateMedium(c.tourDate)} · {formatSlot(c.slotStart, c.slotEnd)} · {c.customerName}
          </span>
          <Link href={`/pemesanan/${c.id}/ubah`} className="ml-auto text-xs font-medium text-danau-700 hover:underline">
            {t.conflicts.reschedule}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function isBookingRefs(value: unknown): value is BookingRef[] {
  return Array.isArray(value) && value.every((v) => v && typeof v === "object" && "code" in v && "tourDate" in v);
}
