import {
  BadgeCheck,
  Bell,
  CalendarClock,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardX,
  Clock,
  NotebookPen,
  PlusCircle,
  Star,
  UserMinus,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { BookingStatus, CancelReason, Channel, PaymentMethod } from "@/db/schema";
import { t } from "@/i18n/id";
import { formatDateTime, formatRelative, formatRupiah } from "@/lib/format";
import type { BookingDetail } from "@/server/bookings/queries";
import { EVENT_LABELS } from "@/server/notify/templates";

const tl = t.timeline;

type Event = BookingDetail["events"][number];
type Payload = Record<string, unknown>;

const SOURCE_LABEL: Record<string, string> = { tourist: "wisatawan", staff: "staf", guide: "guide" };

function describe(e: Event): { icon: LucideIcon; text: string } {
  const p = (e.payload ?? {}) as Payload;
  const guide = e.guideName ?? "Guide";
  const actor = e.actorName ?? tl.system;
  switch (e.type) {
    case "created":
      return { icon: PlusCircle, text: tl.created(t.channels[p.channel as Channel] ?? String(p.channel)) };
    case "guide_assigned":
      return { icon: UserPlus, text: tl.guide_assigned(guide) };
    case "guide_released":
      return { icon: UserMinus, text: tl.guide_released(guide) };
    case "status_changed": {
      // A booking created already paid by the system has no "from" status (12 BR-12-P3).
      if (!p.from) return { icon: BadgeCheck, text: tl.status_set(t.bookingStatus[p.to as BookingStatus] ?? "") };
      const text = tl.status_changed(t.bookingStatus[p.from as BookingStatus] ?? "", t.bookingStatus[p.to as BookingStatus] ?? "");
      return { icon: BadgeCheck, text: p.cause === "checklist" ? `${text} (${tl.statusAuto})` : text };
    }
    case "rescheduled":
      return { icon: CalendarClock, text: tl.rescheduled(String(p.reason ?? "")) };
    case "payment_confirmed":
      if (p.by === "system") return { icon: CircleDollarSign, text: tl.paid_by_system(formatRupiah(Number(p.amount))) };
      return { icon: CircleDollarSign, text: tl.payment_confirmed(t.paymentMethods[p.method as PaymentMethod] ?? "", formatRupiah(Number(p.amount))) };
    case "payment_voided":
      return { icon: XCircle, text: tl.payment_voided(String(p.reason ?? "")) };
    case "adjustment_recorded":
      if (p.by === "system") return { icon: CircleDollarSign, text: tl.adjustment_by_system(formatRupiah(Number(p.amount))) };
      return { icon: CircleDollarSign, text: tl.adjustment_recorded(formatRupiah(Number(p.amount))) };
    case "checklist_ticked":
      return { icon: ClipboardCheck, text: tl.checklist_ticked(String(p.label ?? "")) };
    case "checklist_unticked":
      return { icon: ClipboardX, text: tl.checklist_unticked(String(p.label ?? "")) };
    case "guide_acknowledged":
      if (p.forced) return { icon: BadgeCheck, text: tl.guide_ack_forced(actor, guide, String(p.reason ?? "")) };
      return { icon: BadgeCheck, text: tl.guide_acknowledged(guide) };
    case "notification_sent":
      return { icon: Bell, text: tl.notification_sent(EVENT_LABELS[String(p.eventKey)] ?? String(p.eventKey), Number(p.recipients ?? 0)) };
    case "notes_updated":
      return { icon: NotebookPen, text: tl.notes_updated };
    case "feedback_received":
      return { icon: Star, text: tl.feedback_received(SOURCE_LABEL[String(p.source)] ?? String(p.source ?? "")) };
    case "cancelled":
      return { icon: XCircle, text: tl.cancelled(t.cancelReasons[p.reason as CancelReason] ?? String(p.reason ?? "")) };
    case "hold_expired":
      return { icon: Clock, text: tl.hold_expired };
    default:
      return { icon: Bell, text: e.type };
  }
}

/** design-system §7.3 Timeline (Riwayat), newest first. */
export function Timeline({ events }: { events: Event[] }) {
  const now = new Date();
  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-border">
      {events.map((e) => {
        const { icon: Icon, text } = describe(e);
        return (
          <li key={e.id} className="relative flex gap-3">
            <span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-card">
              <Icon className="size-3.5 text-danau-700" aria-hidden />
            </span>
            <div className="min-w-0 text-sm">
              <p>{text}</p>
              <p className="text-xs text-muted-foreground">
                {e.actorName ?? tl.system} · <time dateTime={e.at} title={formatDateTime(e.at)}>{formatRelative(e.at, now)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
