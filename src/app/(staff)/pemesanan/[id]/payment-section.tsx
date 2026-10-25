"use client";

/* eslint-disable @next/next/no-img-element */
import { Plus, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PaymentMethod } from "@/db/schema";
import { t } from "@/i18n/id";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdjustmentDialog, METHOD_ICONS, VoidPaymentDialog } from "./payment-dialogs";

type PaymentView = {
  id: string;
  kind: "payment" | "adjustment";
  method: PaymentMethod;
  amount: number;
  paidAt: string;
  reference: string | null;
  proofUrl: string | null;
  note: string | null;
  recordedByName: string;
  voidedAt: string | null;
  voidedByName: string | null;
  voidReason: string | null;
};

const sp = t.payment;

/** 06 §3.1 section "Pembayaran". */
export function PaymentSection({
  bookingId,
  summary,
  payments,
  emptyText,
  canAdjust,
  voidablePaymentId,
  holdHours,
}: {
  bookingId: string;
  summary: { total: number; paid: number; balance: number };
  payments: PaymentView[];
  emptyText: string;
  canAdjust: boolean;
  voidablePaymentId: string | null;
  holdHours: number;
}) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const balanceText =
    summary.balance > 0 ? sp.underpaid(formatRupiah(summary.balance)) : summary.balance < 0 ? sp.overpaid(formatRupiah(-summary.balance)) : formatRupiah(0);

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{sp.total}</dt>
          <dd className="font-semibold tabular">{formatRupiah(summary.total)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{sp.paid}</dt>
          <dd className="font-semibold tabular">{formatRupiah(summary.paid)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{sp.balance}</dt>
          <dd className={cn("font-semibold tabular", summary.balance !== 0 && summary.paid !== 0 && "rounded-sm bg-senja-50 px-1 text-senja-800")}>{balanceText}</dd>
        </div>
      </dl>

      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {payments.map((p) => {
            const Icon = METHOD_ICONS[p.method];
            const voided = Boolean(p.voidedAt);
            return (
              <li key={p.id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
                <Icon className="mt-0.5 size-4 text-danau-700" aria-hidden />
                <div className={cn("min-w-0 flex-1", voided && "line-through opacity-70")}>
                  <p className="font-medium">
                    {sp.kind[p.kind]} · {t.paymentMethods[p.method]} · <span className="tabular">{p.kind === "adjustment" && p.amount > 0 ? "+" : ""}{formatRupiah(p.amount)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sp.paidAt} {formatDateTime(p.paidAt)}
                    {p.reference && ` · ${p.reference}`} · {sp.by(p.recordedByName)}
                  </p>
                  {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                </div>
                {p.proofUrl && (
                  <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" aria-label={sp.fields.proof}>
                    <img src={p.proofUrl} alt="" className="size-12 rounded border object-cover" />
                  </a>
                )}
                {voided && <p className="w-full text-xs font-medium text-merah-700">{sp.voidedBy(p.voidedByName ?? "", p.voidReason ?? "")}</p>}
                {voidablePaymentId === p.id && (
                  <Button variant="danger-outline" size="xs" onClick={() => setVoidId(p.id)}>
                    <Undo2 />
                    {sp.voidAction}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canAdjust && (
        <Button variant="secondary" size="sm" onClick={() => setAdjustOpen(true)}>
          <Plus />
          {sp.adjust}
        </Button>
      )}
      {adjustOpen && <AdjustmentDialog bookingId={bookingId} balance={summary.balance} onClose={() => setAdjustOpen(false)} />}
      {voidId && <VoidPaymentDialog paymentId={voidId} holdHours={holdHours} onClose={() => setVoidId(null)} />}
    </div>
  );
}
