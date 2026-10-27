import "server-only";
import ExcelJS from "exceljs";
import { formatPhone } from "@/domain/phone";
import { toWib } from "@/domain/time";
import { t } from "@/i18n/id";
import { countryNameId, formatSlot } from "@/lib/format";
import type { BookingEmailFacts } from "./facts";

const RUPIAH = '"Rp" #,##0';

/** 12 BR-12-E6: `pemesanan-{kode}.xlsx` with the sheets "Detail" and "Rincian harga". */
export async function buildBookingXlsx(f: BookingEmailFacts): Promise<{ filename: string; content: Buffer }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TMII Tour Guide";
  wb.created = new Date();

  const detail = wb.addWorksheet("Detail");
  detail.columns = [
    { header: "Field", key: "field", width: 24 },
    { header: "Nilai", key: "value", width: 56 },
  ];
  const created = toWib(new Date(f.createdAt));
  const rows: [string, string | number][] = [
    ["Kode", f.code],
    ["Status", t.bookingStatus[f.status]],
    ["Kanal", t.channels[f.channel]],
    ["Dibuat oleh", f.createdByName],
    ["Dibuat pada", `${created.date} ${created.time}`],
    ["Tanggal tur", f.tourDate],
    ["Slot", formatSlot(f.slotStart, f.slotEnd)],
    ["Bahasa", f.languageName],
    ["Jumlah orang", f.people],
    ["Paket", f.snapshot.package.name],
    ...f.guides.map((g, i): [string, string] => [f.guides.length > 1 ? `Tour guide ${i + 1}` : "Tour guide", `${g.name} · ${formatPhone(g.phone)}`]),
    ["Nama pelanggan", f.customer.name],
    ["WhatsApp", formatPhone(f.customer.phone)],
    ["Kewarganegaraan", countryNameId(f.customer.nationality)],
    ["Kebutuhan khusus", f.specialNeeds ?? ""],
    ["Catatan internal", f.internalNotes ?? ""],
  ];
  for (const [field, value] of rows) detail.addRow({ field, value });
  detail.getColumn("value").alignment = { wrapText: true, vertical: "top" };

  const price = wb.addWorksheet("Rincian harga");
  price.columns = [
    { header: "Item", key: "item", width: 40 },
    { header: "Qty", key: "qty", width: 8 },
    { header: "Harga satuan", key: "unit", width: 18 },
    { header: "Jumlah", key: "amount", width: 18 },
  ];
  const s = f.snapshot;
  price.addRow({ item: `Paket ${s.package.name} (per guide)`, qty: s.guidesNeeded, unit: s.package.pricePerGuide, amount: s.packageSubtotal });
  for (const a of s.addons) {
    price.addRow({ item: a.included ? `${a.name} (termasuk paket)` : a.name, qty: a.quantity, unit: a.unitPrice, amount: a.amount });
  }
  if (s.surcharge) {
    const label = s.surcharge.holidayName ? `${s.surcharge.name}: ${s.surcharge.holidayName}` : s.surcharge.name;
    price.addRow({ item: label, qty: 1, unit: s.surcharge.amount, amount: s.surcharge.amount });
  }
  const totalRow = price.addRow({ item: "Total", amount: s.total });
  totalRow.font = { bold: true };
  for (const key of ["unit", "amount"]) price.getColumn(key).numFmt = RUPIAH;

  for (const sheet of [detail, price]) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  const content = Buffer.from(await wb.xlsx.writeBuffer());
  return { filename: `pemesanan-${f.code}.xlsx`, content };
}
