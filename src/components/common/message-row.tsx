"use client";

import { Bell, ChevronDown, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import type { NotificationChannel } from "@/db/schema";
import { waNumber } from "@/domain/phone";
import { t } from "@/i18n/id";
import { formatDateTime } from "@/lib/format";
import { EVENT_LABELS } from "@/server/notify/templates";

export type MessageView = {
  id: string;
  eventKey: string;
  channel: NotificationChannel;
  recipientName: string;
  recipientPhone: string | null;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  recipientEmail?: string | null;
  deliveryStatus?: "pending" | "terkirim" | "gagal" | null;
};

/** A notification row: channel, recipient, event, body (expandable), copy and wa.me (09 §3.2–3.3). */
export function MessageRow({ message }: { message: MessageView }) {
  const [open, setOpen] = useState(false);
  const isWa = message.channel === "whatsapp_mock";
  const isEmail = message.channel === "email";
  const Icon = isWa ? MessageCircle : isEmail ? Mail : Bell;
  const waLink = isWa && message.recipientPhone ? `https://wa.me/${waNumber(message.recipientPhone)}?text=${encodeURIComponent(message.body)}` : null;
  return (
    <li className="py-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        <Icon className={isWa ? "mt-0.5 size-4 text-rimba-600" : "mt-0.5 size-4 text-danau-700"} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{message.title}</span>
          <span className="block text-xs text-muted-foreground">
            {EVENT_LABELS[message.eventKey] ?? message.eventKey} · {isEmail ? message.recipientEmail : message.recipientName} · {formatDateTime(message.createdAt)}
            {isWa
              ? " · WhatsApp (simulasi)"
              : isEmail
                ? ` · Email ${message.deliveryStatus === "gagal" ? "gagal" : message.deliveryStatus === "terkirim" ? "terkirim" : "diproses"}`
                : message.readAt
                  ? " · Dibaca"
                  : " · Belum dibaca"}
          </span>
        </span>
        <ChevronDown className={open ? "size-4 rotate-180 transition-transform" : "size-4 transition-transform"} aria-hidden />
      </button>
      {open && (
        <div className="mt-2 ml-7 space-y-2">
          <p className="rounded-md bg-surface-muted p-3 text-sm whitespace-pre-line" lang={isWa ? "en" : "id"}>
            {message.body}
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={message.body} label={t.common.copy} />
            {waLink && (
              <Button variant="secondary" asChild>
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle />
                  Buka di WhatsApp
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
