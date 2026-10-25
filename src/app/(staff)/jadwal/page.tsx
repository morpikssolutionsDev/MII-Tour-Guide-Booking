import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { isoWeekday, isValidDate, toWib, wibToUtc } from "@/domain/time";
import { t } from "@/i18n/id";
import { getScheduleBoard } from "@/server/bookings/queries";
import { requireRole } from "@/server/session";
import { listLanguages } from "@/server/settings-queries";
import { ScheduleGrid, type Cell } from "./schedule-grid";
import { ScheduleToolbar } from "./schedule-toolbar";

export const metadata: Metadata = { title: t.schedule.title };

/** 05 §3.6 Papan Jadwal. */
export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ tanggal?: string; bahasa?: string; nonaktif?: string }> }) {
  await requireRole("admin", "staff");
  const p = await searchParams;
  const now = new Date();
  const today = toWib(now).date;
  const date = p.tanggal && isValidDate(p.tanggal) ? p.tanggal : today;
  const [board, languages] = await Promise.all([getScheduleBoard(date, { includeInactive: p.nonaktif === "1" }), listLanguages(false)]);
  const weekday = isoWeekday(date);

  const rows = board.guides.map((g) => {
    const speaksFilter = !p.bahasa || g.languages.some((l) => l.id === p.bahasa);
    const working = g.isActive && g.weekdays.includes(weekday) && !g.onLeave;
    return {
      guide: g,
      dimmed: !speaksFilter,
      cells: board.slots.map((slot): Cell => {
        const booking = board.bookings.find((b) => b.guideId === g.id && b.slotId === slot.id);
        if (booking) return { kind: "booked", booking };
        if (g.onLeave) return { kind: "leave" };
        if (!g.isActive || !g.weekdays.includes(weekday)) return { kind: "off" };
        if (now >= wibToUtc(date, slot.startTime)) return { kind: "passed" };
        return { kind: "free", href: `/pemesanan/baru?date=${date}&slot=${slot.id}&guide=${g.id}` };
      }),
      working,
    };
  });
  const columns = board.slots.map((slot, index) => ({
    slot,
    booked: rows.filter((r) => r.cells[index].kind === "booked").length,
    working: rows.filter((r) => r.working).length,
  }));

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t.schedule.title} />
      <ScheduleToolbar date={date} today={today} languages={languages.map((l) => ({ id: l.id, name: l.nameId }))} />
      <ScheduleGrid columns={columns} rows={rows} isToday={date === today} />
    </PageContainer>
  );
}
