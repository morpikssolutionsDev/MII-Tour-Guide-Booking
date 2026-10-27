"use client";

import { Bell, CheckCircle2, Clock, Mail, MessageCircle, Paperclip, RotateCw, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Pill } from "@/components/common/badges";
import { CopyButton } from "@/components/common/copy-button";
import { Disclosure } from "@/components/common/disclosure";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { waNumber } from "@/domain/phone";
import { useAction } from "@/hooks/use-action";
import { t } from "@/i18n/id";
import { formatDateTime } from "@/lib/format";
import { resendEmail } from "@/server/email/actions";
import { EVENT_LABELS } from "@/server/notify/templates";
import type { OutboxRow } from "@/server/notify/queries";

const so = t.outbox;
const se = t.emailSettings;

function ChannelPill({ channel }: { channel: OutboxRow["channel"] }) {
  if (channel === "email") {
    return (
      <Pill tone="batu" icon={Mail}>
        {so.channels.email}
      </Pill>
    );
  }
  return channel === "whatsapp_mock" ? (
    <Pill tone="rimba" icon={MessageCircle}>
      {so.channels.whatsapp_mock}
    </Pill>
  ) : (
    <Pill tone="danau" icon={Bell}>
      {so.channels.in_app}
    </Pill>
  );
}

/** 12 §3.7: delivery status for email rows. */
function DeliveryPill({ status }: { status: OutboxRow["deliveryStatus"] }) {
  if (status === "terkirim") return <Pill tone="rimba" icon={CheckCircle2}>{se.status.terkirim}</Pill>;
  if (status === "gagal") return <Pill tone="merah" icon={XCircle}>{se.status.gagal}</Pill>;
  return <Pill tone="kabut" icon={Clock}>{se.status.pending}</Pill>;
}

function statusText(row: OutboxRow) {
  if (row.channel === "whatsapp_mock") return so.simulated;
  if (row.channel === "email") return se.status[row.deliveryStatus ?? "pending"];
  return row.readAt ? so.read(formatDateTime(row.readAt)) : so.unread;
}

function recipientOf(r: OutboxRow) {
  if (r.channel === "email") return r.recipientEmail ?? r.recipientName;
  return r.recipientRole ? `${r.recipientName} · ${t.roles[r.recipientRole]}` : `${r.recipientName} · ${r.recipientPhone ?? ""}`;
}

/** Outbox list with a detail drawer: full body, copy, wa.me link, template context (09 §3.2). */
export function OutboxTable({ rows }: { rows: OutboxRow[] }) {
  const [selected, setSelected] = useState<OutboxRow | null>(null);
  const recipient = recipientOf;
  const resend = useAction(resendEmail, {
    successMessage: (r) => (r.ok ? se.resent : se.failed(r.error ?? "")),
    onSuccess: () => setSelected(null),
  });

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border bg-card shadow-card md:block">
        <Table>
          <TableHeader className="bg-surface-muted">
            <TableRow>
              <TableHead scope="col">{so.cols.time}</TableHead>
              <TableHead scope="col">{so.cols.channel}</TableHead>
              <TableHead scope="col">{so.cols.recipient}</TableHead>
              <TableHead scope="col">{so.cols.event}</TableHead>
              <TableHead scope="col">{so.cols.summary}</TableHead>
              <TableHead scope="col">{so.cols.booking}</TableHead>
              <TableHead scope="col">{so.cols.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                <TableCell className="whitespace-nowrap tabular">{formatDateTime(r.createdAt)}</TableCell>
                <TableCell>
                  <ChannelPill channel={r.channel} />
                </TableCell>
                <TableCell className="max-w-56 truncate">{recipient(r)}</TableCell>
                <TableCell>{EVENT_LABELS[r.eventKey] ?? r.eventKey}</TableCell>
                <TableCell className="max-w-72">
                  <button type="button" className="block w-full truncate text-left hover:underline" onClick={() => setSelected(r)}>
                    {r.title}
                  </button>
                </TableCell>
                <TableCell>
                  {r.bookingCode && (
                    <Link href={`/pemesanan/${r.bookingId}`} onClick={(e) => e.stopPropagation()} className="text-danau-700 tabular hover:underline">
                      {r.bookingCode}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.channel === "email" ? <DeliveryPill status={r.deliveryStatus} /> : statusText(r)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => setSelected(r)} className="block w-full rounded-lg border bg-card p-4 text-left shadow-card">
              <div className="flex items-center justify-between gap-2">
                <ChannelPill channel={r.channel} />
                <span className="text-xs text-muted-foreground tabular">{formatDateTime(r.createdAt)}</span>
              </div>
              <p className="mt-2 font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {EVENT_LABELS[r.eventKey] ?? r.eventKey} · {r.recipientName}
                {r.bookingCode ? ` · ${r.bookingCode}` : ""}
              </p>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={selected !== null} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{so.detail}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <ChannelPill channel={selected.channel} />
                <span className="text-sm">{EVENT_LABELS[selected.eventKey] ?? selected.eventKey}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {recipient(selected)} · {formatDateTime(selected.createdAt)} · {statusText(selected)}
              </p>
              {selected.channel === "email" && (
                <div className="space-y-2 rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <DeliveryPill status={selected.deliveryStatus} />
                    {selected.attachmentName && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Paperclip className="size-4" aria-hidden />
                        {se.attachment}: {selected.attachmentName}
                      </span>
                    )}
                  </div>
                  {selected.error && (
                    <p className="text-merah-700">
                      {se.error}: {selected.error}
                    </p>
                  )}
                  {selected.deliveryStatus === "gagal" && (
                    <Button size="sm" pending={resend.pending} onClick={() => resend.run({ notificationId: selected.id })}>
                      <RotateCw />
                      {se.resend}
                    </Button>
                  )}
                </div>
              )}
              <p className="rounded-md bg-surface-muted p-3 text-sm whitespace-pre-line" lang={selected.locale}>
                {selected.body}
              </p>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={selected.body} label={so.copy} />
                {selected.channel === "whatsapp_mock" && selected.recipientPhone && (
                  <Button variant="secondary" asChild>
                    <a href={`https://wa.me/${waNumber(selected.recipientPhone)}?text=${encodeURIComponent(selected.body)}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle />
                      {so.openWa}
                    </a>
                  </Button>
                )}
              </div>
              <Disclosure title={so.context} triggerClassName="text-sm font-medium">
                <pre className="mt-2 overflow-x-auto rounded-md bg-kabut-900 p-3 text-xs text-kabut-100">{JSON.stringify(selected.context, null, 2)}</pre>
              </Disclosure>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
