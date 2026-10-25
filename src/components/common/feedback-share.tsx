"use client";

/* eslint-disable @next/next/no-img-element */
import { MessageCircle, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { waNumber } from "@/domain/phone";
import { t } from "@/i18n/id";
import { CopyButton } from "./copy-button";
import { ResponsiveDialog } from "./responsive-dialog";

/** QR code (client-side, 08 BR-08-7), copy link, and WhatsApp share (10 §3.2). */
export function FeedbackShare({
  url,
  expiresLabel,
  whatsappText,
  phone,
  layout = "row",
}: {
  url: string;
  expiresLabel: string;
  whatsappText: string;
  phone: string;
  layout?: "row" | "sheet";
}) {
  const [qrOpen, setQrOpen] = useState(layout === "sheet");
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!qrOpen && layout !== "sheet") return;
    let cancelled = false;
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#222b30", light: "#ffffff" } }).then((data) => {
      if (!cancelled) setQr(data);
    });
    return () => {
      cancelled = true;
    };
  }, [url, qrOpen, layout]);
  const fb = t.feedback;
  const wa = `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(whatsappText)}`;

  const qrBlock = (
    <div className="flex flex-col items-center gap-3">
      {qr ? <img src={qr} alt={url} className="size-64 rounded-md border" /> : <div className="size-64 animate-pulse rounded-md bg-kabut-100" />}
      <p className="text-center text-xs text-muted-foreground">{fb.validUntil(expiresLabel)}</p>
    </div>
  );

  if (layout === "sheet") {
    return (
      <div className="space-y-4">
        {qrBlock}
        <p className="rounded-md bg-surface-muted p-2 text-center text-xs break-all">{url}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <CopyButton value={url} label={fb.copyLink} />
          <Button variant="secondary" asChild>
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              Kirim via WhatsApp
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <CopyButton value={url} label={fb.copyLink} />
      <Button variant="secondary" onClick={() => setQrOpen(true)}>
        <QrCode />
        {fb.showQr}
      </Button>
      <Button variant="secondary" asChild>
        <a href={wa} target="_blank" rel="noopener noreferrer">
          <MessageCircle />
          {fb.openWhatsapp}
        </a>
      </Button>
      <ResponsiveDialog open={qrOpen} onOpenChange={setQrOpen} title={fb.shareTitle} footer={<Button onClick={() => setQrOpen(false)}>{t.common.close}</Button>}>
        {qrBlock}
      </ResponsiveDialog>
    </div>
  );
}
