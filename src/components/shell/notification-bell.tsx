"use client";

import { Bell, CalendarOff, CheckCheck, CircleDollarSign, Clock, MessageSquareText, Star, UserMinus, UserPlus, XCircle, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsDesktop } from "@/hooks/use-media-query";
import { t } from "@/i18n/id";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getUnreadCount, listMyNotifications, markAllNotificationsRead, markNotificationRead } from "@/server/notify/actions";

type Item = { id: string; eventKey: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };

const ICONS: Record<string, LucideIcon> = {
  guide_assigned: UserPlus,
  booking_rescheduled: Clock,
  guide_released: UserMinus,
  booking_cancelled: XCircle,
  hold_expired: Clock,
  low_rating_alert: Star,
  leave_requested: CalendarOff,
  leave_decided: CalendarOff,
  leave_added_by_admin: CalendarOff,
  leave_cancelled_by_admin: CalendarOff,
  payment_confirmed: CircleDollarSign,
};

const sn = t.notifications;

/** design-system §7.3 NotificationBell (09 §3.1). Refreshes on focus and every 60 s. */
export function NotificationBell({ initialCount }: { initialCount: number }) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [items, setItems] = useState<Item[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [pending, startTransition] = useTransition();

  const refreshCount = useCallback(async () => {
    if (document.hidden) return;
    const result = await getUnreadCount({});
    if (result.ok) setCount(result.data);
  }, []);

  useEffect(() => {
    const timer = setInterval(refreshCount, 60_000);
    window.addEventListener("focus", refreshCount);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshCount);
    };
  }, [refreshCount]);

  const load = (cursor?: string) =>
    startTransition(async () => {
      const result = await listMyNotifications({ cursor });
      if (!result.ok) return;
      setItems((prev) => (cursor && prev ? [...prev, ...result.data.items] : result.data.items));
      setHasMore(result.data.hasMore);
    });

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) load();
  };

  const openItem = (item: Item) => {
    if (!item.readAt) {
      setCount((c) => Math.max(0, c - 1));
      setItems((list) => list?.map((x) => (x.id === item.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? null);
      void markNotificationRead({ id: item.id });
    }
    setOpen(false);
    if (item.link) router.push(item.link);
  };

  const markAll = () =>
    startTransition(async () => {
      const result = await markAllNotificationsRead({});
      if (result.ok) {
        setCount(0);
        setItems((list) => list?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? null);
      }
    });

  const trigger = (
    <Button variant="ghost" size="icon" className="relative" aria-label={count > 0 ? sn.unread(count) : sn.title} onClick={desktop ? undefined : () => onOpenChange(true)}>
      <Bell className="size-5" />
      {count > 0 && (
        <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold text-primary-foreground tabular">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Button>
  );

  const now = new Date();
  const panel = (
    <div className="flex max-h-[min(70vh,560px)] flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <p className="font-semibold">{sn.title}</p>
        <Button variant="ghost" size="xs" onClick={markAll} disabled={count === 0 || pending}>
          <CheckCheck />
          {sn.markAll}
        </Button>
      </div>
      <div className="overflow-y-auto">
        {items === null ? (
          <div className="space-y-2 p-4" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-kabut-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState decoration="birds-flying" title={sn.empty} />
        ) : (
          <ul>
            {items.map((item) => {
              const Icon = ICONS[item.eventKey] ?? MessageSquareText;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={cn("flex w-full gap-3 border-b px-4 py-3 text-left hover:bg-kabut-50", !item.readAt && "bg-danau-50")}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-danau-700" aria-hidden />
                    <span className="min-w-0">
                      <span className={cn("block text-sm", !item.readAt && "font-semibold")}>{item.title}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{formatRelative(item.createdAt, now)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {hasMore && items && (
          <div className="p-3">
            <Button variant="secondary" className="w-full" pending={pending} onClick={() => load(items[items.length - 1].createdAt)}>
              {t.common.loadMore}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (desktop) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="end" className="w-[380px] p-0 shadow-overlay">
          {panel}
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90dvh] gap-0 rounded-t-xl p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{sn.title}</SheetTitle>
          </SheetHeader>
          {panel}
        </SheetContent>
      </Sheet>
    </>
  );
}
