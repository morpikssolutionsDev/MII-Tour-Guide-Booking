import {
  BadgeCheck,
  CheckCheck,
  CircleOff,
  ClipboardCheck,
  Clock,
  Headset,
  MapPin,
  Megaphone,
  Repeat,
  Star,
  TriangleAlert,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { BookingStatus, Channel, LeaveStatus } from "@/db/schema";
import { t } from "@/i18n/id";
import { cn } from "@/lib/utils";

export type Tone = "senja" | "danau" | "rimba" | "rimbaSolid" | "batu" | "merah" | "kabut" | "outline";

const TONES: Record<Tone, string> = {
  senja: "bg-senja-100 text-senja-800",
  danau: "bg-danau-100 text-danau-800",
  rimba: "bg-rimba-100 text-rimba-700",
  rimbaSolid: "bg-rimba-600 text-white",
  batu: "bg-batu-200 text-batu-800",
  merah: "bg-merah-50 text-merah-700",
  kabut: "bg-kabut-100 text-kabut-700",
  outline: "border border-kabut-200 bg-card text-kabut-700",
};

/** A tinted pill with an icon and label (colour is never the only signal, §3.4). */
export function Pill({
  tone,
  icon: Icon,
  children,
  size = "sm",
  className,
}: {
  tone: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-sm font-medium whitespace-nowrap",
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[0.8125rem]",
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />}
      {children}
    </span>
  );
}

const STATUS: Record<BookingStatus, { tone: Tone; icon: LucideIcon }> = {
  awaiting_payment: { tone: "senja", icon: Clock },
  confirmed: { tone: "danau", icon: BadgeCheck },
  ready: { tone: "rimba", icon: ClipboardCheck },
  completed: { tone: "rimbaSolid", icon: CheckCheck },
  evaluated: { tone: "batu", icon: Star },
  no_show: { tone: "merah", icon: UserX },
  cancelled: { tone: "kabut", icon: XCircle },
};

export function StatusBadge({ status, size = "sm" }: { status: BookingStatus; size?: "sm" | "md" }) {
  const s = STATUS[status];
  return (
    <Pill tone={s.tone} icon={s.icon} size={size}>
      {t.bookingStatus[status]}
    </Pill>
  );
}

const CHANNEL_ICON: Record<Channel, LucideIcon> = { sales: Megaphone, call_center: Headset, on_the_spot: MapPin };

export function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <Pill tone="outline" icon={CHANNEL_ICON[channel]}>
      {t.channels[channel]}
    </Pill>
  );
}

export const channelIcon = (channel: Channel) => CHANNEL_ICON[channel];

const LEAVE: Record<LeaveStatus, { tone: Tone; icon: LucideIcon }> = {
  pending: { tone: "senja", icon: Clock },
  approved: { tone: "rimba", icon: BadgeCheck },
  rejected: { tone: "kabut", icon: XCircle },
  cancelled: { tone: "kabut", icon: CircleOff },
};

export function LeaveBadge({ status, prefix = false }: { status: LeaveStatus; prefix?: boolean }) {
  const s = LEAVE[status];
  return (
    <Pill tone={s.tone} icon={s.icon}>
      {prefix ? `Cuti: ${t.leaveStatus[status]}` : t.leaveStatus[status]}
    </Pill>
  );
}

export function InactiveBadge() {
  return (
    <Pill tone="kabut" icon={CircleOff}>
      {t.common.inactive}
    </Pill>
  );
}

export function ReturningBadge({ visits }: { visits: number }) {
  return (
    <Pill tone="senja" icon={Repeat}>
      Pelanggan kembali (×{visits})
    </Pill>
  );
}

export function ShortNoticeBadge() {
  return (
    <Pill tone="senja" icon={TriangleAlert}>
      di bawah H-2
    </Pill>
  );
}

export function LanguagePill({ code, name }: { code: string; name?: string }) {
  return (
    <span
      title={name}
      className="inline-flex h-6 items-center rounded-full border border-kabut-200 bg-card px-2 text-xs font-semibold text-kabut-700"
    >
      {code.toUpperCase()}
    </span>
  );
}
