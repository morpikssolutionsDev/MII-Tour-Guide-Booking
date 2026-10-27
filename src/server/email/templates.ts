import "server-only";
import { formatPhone } from "@/domain/phone";
import { t } from "@/i18n/id";
import { countryNameId, formatDateLong, formatDateMedium, formatRupiah, formatSlot } from "@/lib/format";
import type { BookingEmailFacts } from "./facts";

export type RenderedEmail = { subject: string; html: string; text: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 12 BR-12-E5: Indonesian team email for a new booking (inline-styled, table layout). */
export function bookingCreatedEmail(f: BookingEmailFacts, baseUrl: string, opts: { test?: boolean } = {}): RenderedEmail {
  const slot = formatSlot(f.slotStart, f.slotEnd);
  const prefix = opts.test ? "[UJI] " : "";
  const subject = `${prefix}Pemesanan baru ${f.code} · ${formatDateMedium(f.tourDate)} ${slot}`;
  const link = `${baseUrl.replace(/\/$/, "")}/pemesanan/${f.bookingId}`;
  const addons = f.snapshot.addons.filter((a) => !a.included).map((a) => a.name);
  const rows: [string, string][] = [
    ["Kode", f.code],
    ["Jadwal", `${formatDateLong(f.tourDate)} · ${slot} WIB`],
    ["Bahasa · orang", `${f.languageName} · ${t.common.people(f.people)}`],
    ["Paket", addons.length ? `${f.snapshot.package.name} + ${addons.join(", ")}` : f.snapshot.package.name],
    ["Tour guide", f.guides.map((g) => g.name).join(", ") || t.common.none],
    ["Total", formatRupiah(f.snapshot.total)],
    ["Kanal", t.channels[f.channel]],
    ["Dibuat oleh", f.createdByName],
    ["Pelanggan", `${f.customer.name} · ${formatPhone(f.customer.phone)} · ${countryNameId(f.customer.nationality)}`],
    ...(f.specialNeeds ? ([["Kebutuhan khusus", f.specialNeeds]] as [string, string][]) : []),
  ];

  const text = [
    opts.test ? "Ini email uji dari Pengaturan → Email.\n" : null,
    `Pemesanan baru ${f.code}`,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Buka pemesanan: ${link}`,
    "",
    "Rincian lengkap ada di lampiran.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = `<!doctype html>
<html lang="id"><body style="margin:0;padding:0;background:#f4f1ec;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#b3261e;color:#ffffff;padding:16px 24px;font-size:16px;font-weight:bold">TMII Tour Guide${opts.test ? " · Email uji" : ""}</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 4px;font-size:13px;color:#6b7280">Pemesanan baru</p>
<p style="margin:0 0 16px;font-size:22px;font-weight:bold;letter-spacing:.5px">${esc(f.code)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:8px 12px 8px 0;border-top:1px solid #ece7df;color:#6b7280;width:140px;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;border-top:1px solid #ece7df;font-weight:bold">${esc(v)}</td></tr>`,
  )
  .join("\n")}
</table>
<p style="margin:24px 0 8px"><a href="${esc(link)}" style="display:inline-block;background:#1d5c7a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">Buka pemesanan</a></p>
<p style="margin:16px 0 0;font-size:12px;color:#6b7280">Rincian lengkap ada di lampiran <b>pemesanan-${esc(f.code)}.xlsx</b>.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return { subject, html, text };
}
