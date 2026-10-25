// Message templates (09-notifikasi.md §7). Pure: no I/O, so the seed can reuse them.
// In-app copy is Indonesian; WhatsApp mocks to tourists are English (BR-09-2, BR-09-5).
import {
  firstName,
  formatDateLong,
  formatDateLongEn,
  formatDateTimeEn,
  formatRupiah,
  formatSlot,
  formatSlotEn,
} from "@/lib/format";

export type Rendered = { title: string; body: string; link?: string };

/** Booking facts every booking template may use. */
export type BookingFacts = {
  bookingId: string;
  code: string;
  customerName: string;
  tourDate: string;
  slotStart: string;
  slotEnd: string;
  languageId: string; // Indonesian name, e.g. "Inggris"
  languageEn: string;
  people: number;
  packageName: string;
  guidesNeeded: number;
  guideNames: string[];
  facilities: string[];
  total: number;
  holdExpiresAt: string | null;
};

const scheduleId = (b: Pick<BookingFacts, "tourDate" | "slotStart" | "slotEnd">) =>
  `${formatDateLong(b.tourDate)}, ${formatSlot(b.slotStart, b.slotEnd)}`;
const scheduleEn = (b: Pick<BookingFacts, "tourDate" | "slotStart" | "slotEnd">) =>
  `${formatDateLongEn(b.tourDate)}, ${formatSlotEn(b.slotStart, b.slotEnd)} WIB`;
const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
const lines = (...parts: (string | false | null | undefined)[]) => parts.filter((p) => p !== false && p != null).join("\n");

/* ---------------- WhatsApp mocks to tourists (English) ---------------- */

export function waBookingCreated(b: BookingFacts, paymentInstructions: string): Rendered {
  const body = lines(
    `Hello ${b.customerName}, thank you for booking a TMII tour guide!`,
    "",
    `Booking code: ${b.code}`,
    `Date: ${scheduleEn(b)}`,
    `Language: ${b.languageEn} · ${b.people} people`,
    `Package: ${b.packageName} (${b.guidesNeeded} guide${b.guidesNeeded > 1 ? "s" : ""})`,
    `Total: ${formatRupiah(b.total)}`,
    paymentInstructions.trim() ? `\n${paymentInstructions.trim()}` : null,
    "",
    b.holdExpiresAt
      ? `Please complete your payment before ${formatDateTimeEn(b.holdExpiresAt)}. Unpaid bookings are released automatically.`
      : null,
    "— TMII Tour Guide Service",
  );
  return { title: `Hello ${b.customerName}, thank you for booking a TMII tour guide!`, body };
}

export function waPaymentConfirmed(b: BookingFacts): Rendered {
  const body = lines(
    `Hi ${b.customerName}, we have received your payment. Booking ${b.code} is confirmed ✅`,
    "",
    `📅 ${scheduleEn(b)}`,
    `🗣 ${b.languageEn}-speaking guide: ${joinNames(b.guideNames)}`,
    `👥 ${b.people} people · ${b.packageName}`,
    b.facilities.length ? `🎁 Included: ${b.facilities.join(", ")}` : null,
    "",
    "Please come to the TMII Tour Guide counter 15 minutes before your tour. See you at Taman Mini Indonesia Indah!",
  );
  return { title: `Booking ${b.code} is confirmed`, body };
}

export function waBookingRescheduled(
  b: BookingFacts,
  opts: { confirmed: boolean; awaitingPayment: boolean; priceDiff: number },
): Rendered {
  let priceLine: string | null = null;
  if (opts.awaitingPayment) priceLine = `New total: ${formatRupiah(b.total)}`;
  else if (opts.priceDiff !== 0)
    priceLine = `Price difference: ${opts.priceDiff > 0 ? "+" : ""}${formatRupiah(opts.priceDiff)}. Our staff will contact you.`;
  const body = lines(
    `Hi ${b.customerName}, your booking ${b.code} has been updated.`,
    "",
    `New schedule: ${scheduleEn(b)}`,
    `${b.languageEn} · ${b.people} people · ${b.packageName}`,
    opts.confirmed && b.guideNames.length ? `Your guide: ${joinNames(b.guideNames)}` : null,
    priceLine,
    "",
    "Questions? Just reply to this message.",
  );
  return { title: `Booking ${b.code} has been updated`, body };
}

export function waBookingCancelled(b: BookingFacts, refundAmount: number | null): Rendered {
  const body = lines(
    `Hi ${b.customerName}, your booking ${b.code} for ${scheduleEn(b)} has been cancelled.`,
    refundAmount ? `A refund of ${formatRupiah(refundAmount)} will be processed.` : null,
    "We hope to welcome you at TMII another time.",
  );
  return { title: `Booking ${b.code} has been cancelled`, body };
}

export function waHoldExpired(b: BookingFacts): Rendered {
  const body = lines(
    `Hi ${b.customerName}, we did not receive payment for booking ${b.code} (${scheduleEn(b)}), so the reservation has been released.`,
    "Reply to this message if you would like to book again.",
  );
  return { title: `Booking ${b.code} has been released`, body };
}

export function waFeedbackRequest(b: BookingFacts, url: string, expiresAt: string): Rendered {
  const body = lines(
    `Thank you for exploring TMII with ${joinNames(b.guideNames)}, ${firstName(b.customerName)}! 🙏`,
    `How was your tour? It takes one minute: ${url}`,
    `(This link is valid until ${formatDateLongEn(expiresAt.slice(0, 10))}.)`,
  );
  return { title: "How was your TMII tour?", body };
}

/* ---------------- In-app (Indonesian) ---------------- */

export function inAppGuideAssigned(b: BookingFacts, variant: "normal" | "short" | "reminder"): Rendered {
  const link = `/portal/tur/${b.bookingId}`;
  if (variant === "reminder") {
    return {
      title: `Pengingat: konfirmasi tur ${b.code}`,
      body: `${scheduleId(b)}. Anda belum menekan "Saya siap".`,
      link,
    };
  }
  const body = `${formatSlot(b.slotStart, b.slotEnd)} · ${b.languageId} · ${b.people} orang · ${b.packageName} (${b.code}). Buka detail lalu tekan "Saya siap".`;
  return variant === "short"
    ? { title: `Tur baru (di bawah H-2): ${formatDateLong(b.tourDate)}`, body: `${body} Mohon segera konfirmasi.`, link }
    : { title: `Tur baru: ${formatDateLong(b.tourDate)}`, body, link };
}

export function inAppGuideRescheduled(
  b: BookingFacts,
  opts: { scheduleChanged: true; before: Pick<BookingFacts, "tourDate" | "slotStart" | "slotEnd"> } | { scheduleChanged: false; summary: string },
): Rendered {
  const link = `/portal/tur/${b.bookingId}`;
  return opts.scheduleChanged
    ? {
        title: `Jadwal tur ${b.code} berubah`,
        body: `${scheduleId(opts.before)} → ${scheduleId(b)}. Mohon konfirmasi ulang dengan "Saya siap".`,
        link,
      }
    : { title: `Detail tur ${b.code} diperbarui`, body: opts.summary, link };
}

export function inAppGuideReleased(b: Pick<BookingFacts, "code" | "tourDate" | "slotStart" | "slotEnd">): Rendered {
  return {
    title: "Tugas tur dilepas",
    body: `Anda tidak lagi bertugas pada tur ${b.code} (${scheduleId(b)}).`,
    link: "/portal/jadwal?view=riwayat",
  };
}

export function inAppBookingCancelled(b: BookingFacts, reasonLabel: string): Rendered {
  return {
    title: `Tur ${b.code} dibatalkan`,
    body: `${scheduleId(b)}. Alasan: ${reasonLabel}.`,
    link: "/portal/jadwal?view=riwayat",
  };
}

export function inAppHoldExpired(b: BookingFacts): Rendered {
  return {
    title: `Pemesanan ${b.code} kedaluwarsa`,
    body: `${b.customerName} · ${scheduleId(b)}. Pembayaran tidak diterima; slot dan guide sudah dilepas.`,
    link: `/pemesanan/${b.bookingId}`,
  };
}

export function inAppLowRating(b: BookingFacts, guideName: string, rating: number, comment: string | null): Rendered {
  const snippet = comment ? `"${comment.length > 120 ? `${comment.slice(0, 117)}…` : comment}"` : "Tanpa komentar";
  return {
    title: `Rating rendah untuk ${guideName}`,
    body: `★${rating} pada ${b.code} (${formatDateLong(b.tourDate)}). ${snippet}`,
    link: `/pemesanan/${b.bookingId}`,
  };
}

/* ---------------- Leave (02) ---------------- */

export type LeaveFacts = { guideName: string; startDate: string; endDate: string; reason: string; days: number };

const leaveRange = (l: LeaveFacts) =>
  l.startDate === l.endDate ? formatDateLong(l.startDate) : `${formatDateLong(l.startDate)} – ${formatDateLong(l.endDate)}`;

export function inAppLeaveRequested(l: LeaveFacts): Rendered {
  return {
    title: `Permintaan cuti: ${l.guideName}`,
    body: `${leaveRange(l)} (${l.days} hari). Alasan: ${l.reason}`,
    link: "/tour-guide/cuti",
  };
}

export function inAppLeaveDecided(l: LeaveFacts, approved: boolean, note: string | null): Rendered {
  return {
    title: approved ? "Cuti disetujui" : "Cuti ditolak",
    body: `${leaveRange(l)}.${!approved && note ? ` Catatan: ${note}` : ""}`,
    link: "/portal/cuti",
  };
}

export function inAppLeaveAddedByAdmin(l: LeaveFacts): Rendered {
  return { title: "Cuti ditambahkan oleh admin", body: `${leaveRange(l)}. Alasan: ${l.reason}`, link: "/portal/cuti" };
}

export function inAppLeaveCancelledByAdmin(l: LeaveFacts): Rendered {
  return { title: "Cuti dibatalkan oleh admin", body: `${leaveRange(l)} tidak lagi tercatat sebagai cuti.`, link: "/portal/cuti" };
}

/** Outbox "Peristiwa" labels (09 §7). */
export const EVENT_LABELS: Record<string, string> = {
  booking_created: "Pemesanan dibuat",
  payment_confirmed: "Pembayaran dikonfirmasi",
  guide_assigned: "Penugasan guide",
  booking_rescheduled: "Jadwal diubah",
  guide_released: "Guide dilepas",
  booking_cancelled: "Pemesanan dibatalkan",
  hold_expired: "Kedaluwarsa otomatis",
  feedback_request: "Permintaan ulasan",
  low_rating_alert: "Rating rendah",
  leave_requested: "Permintaan cuti",
  leave_decided: "Keputusan cuti",
  leave_added_by_admin: "Cuti ditambahkan admin",
  leave_cancelled_by_admin: "Cuti dibatalkan admin",
};
