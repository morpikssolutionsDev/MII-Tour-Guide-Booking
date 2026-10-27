# 06 — Pembayaran (Payment)

> **Diubah oleh 12:** this whole module is active only when `PAYMENT_CONFIRMATION=true`. Off (the default), bookings are paid by the system at creation (method `system`, `recorded_by` NULL) and the payment UI is hidden; see [`12` BR-12-P1–P10](12-perubahan-fase-2.md#5-business-rules).

> Status: **Draft v1** · Last updated: 2026-10-25 · Depends on: [`05-pemesanan.md`](05-pemesanan.md), [`04-pengaturan.md`](04-pengaturan.md)

## 1. Purpose

Records how a booking was paid and moves it from **Menunggu Pembayaran** to **Terkonfirmasi**. There is **no online payment**. The tourist pays by bank transfer, QRIS, cash, or card at the counter, and **staff confirm it** by attaching proof (an image) or a reference number and pressing **"Tandai Lunas"**. This module also records **adjustments**: extra charges or refunds after a reschedule or cancellation. Admins can undo a mistaken confirmation.

Serves flow step **4 (Konfirmasi & Pembayaran)**.

## 2. User stories

- As **staff**, I want to mark a booking as paid with the method, amount, and proof or reference, so that the guides are confirmed and preparation can start.
- As **staff**, I want to be warned when the amount received differs from the total, but still be able to confirm.
- As **staff**, I want to record an extra payment or a refund after a reschedule or cancellation, so that the balance and revenue are correct.
- As an **admin**, I want to undo a "Tandai Lunas" made by mistake, with a reason, so that the record stays honest.
- As **staff/admin**, I want to view the payment proof from the booking.

## 3. Screens

### 3.1 Section "Pembayaran" on the booking detail (`/pemesanan/[id]`)

- **Summary rows**: "Total" (snapshot total), "Dibayar" (Σ valid payments and adjustments), and **"Sisa"** (Total − Dibayar). When Sisa ≠ 0 on a confirmed booking, it is shown in the warning style:
  - "Kurang bayar Rp 200.000" when positive;
  - "Kelebihan bayar Rp 50.000" when negative.
- **Payment list** (newest first). Each row shows:
  - kind ("Pembayaran" / "Penyesuaian");
  - method icon + label;
  - amount (signed for adjustments);
  - "Dibayar pada" (date and time);
  - reference;
  - proof thumbnail (click → lightbox);
  - "oleh {staff}";
  - note.

  Voided rows are struck through with "Dibatalkan oleh {admin}: {alasan}".
- **Actions**:

  | Action | Who | Shown when |
  |---|---|---|
  | **"Tandai Lunas"** (primary) | Staff, admin | `awaiting_payment` |
  | "Catat Penyesuaian" (secondary) | Staff, admin | `confirmed` / `ready` / `completed` / `evaluated` / `cancelled` with existing payments |
  | "Batalkan Tandai Lunas" (danger-outline) | **Admin only** | `confirmed` / `ready`, slot not started |
- Empty state while `awaiting_payment`: "Belum ada pembayaran. Kedaluwarsa {relative}."

### 3.2 Dialog "Tandai Lunas" (bottom sheet on mobile)

Title: "Tandai Lunas · {code}". Subtitle: "Total Rp 1.950.000".

| Field | Rules |
|---|---|
| "Metode pembayaran" * | Segmented: **"Transfer Bank"** · **"QRIS"** · **"Tunai"** · **"EDC"** |
| "Jumlah diterima" * | Money input, pre-filled with the total, integer > 0 |
| "Tanggal & jam bayar" * | Defaults to now (WIB); not in the future; not before the booking's `created_at` |
| "Bukti pembayaran" | Image (JPEG/PNG/WebP) ≤ 5 MB, single file, with preview |
| "Nomor referensi" | ≤ 60 characters (bank transaction ID, QRIS RRN, EDC approval code) |
| "Catatan" | ≤ 300 characters |

- **Validation**: for Transfer Bank, QRIS, and EDC, at least one of "Bukti pembayaran" or "Nomor referensi" is required ("Lampirkan bukti atau isi nomor referensi."). For Tunai, neither is required.
- **Amount mismatch**: if "Jumlah diterima" ≠ total, a warning alert appears: "Jumlah berbeda dari total (selisih Rp {x}). Pastikan sudah benar." The checkbox "Saya sudah memeriksa jumlahnya" must be ticked before the button is enabled.
- Button: **"Tandai Lunas"** (primary). After success: toast "Pembayaran dikonfirmasi · {code} Terkonfirmasi"; the page refreshes to show the new status, the checklist, and guide notice states.

### 3.3 Dialog "Catat Penyesuaian"

| Field | Rules |
|---|---|
| "Jenis" * | Radio: "Tagihan tambahan (diterima)" → positive; "Pengembalian dana (refund)" → negative |
| "Jumlah" * | Money > 0. The sign comes from "Jenis". Pre-filled with the absolute current Sisa when non-zero. |
| "Metode" * | Same four methods |
| "Tanggal & jam" * | As above |
| "Bukti" / "Nomor referensi" | Same rule as Tandai Lunas: required for non-cash methods |
| "Catatan" * | ≤ 300 characters (e.g. "Selisih jadwal ulang ke Sabtu") |

Button: "Simpan Penyesuaian".

### 3.4 Dialog "Batalkan Tandai Lunas" (admin)

Text: "Status akan kembali ke Menunggu Pembayaran dan slot ditahan selama {hold_expiry_hours} jam." Field: "Alasan" * (≤ 200 characters). Confirm button: "Ya, batalkan tandai lunas" (danger).

## 4. Data model

### `payments`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `booking_id` | text | FK |
| `kind` | text enum | `payment` · `adjustment` |
| `method` | text enum | `bank_transfer` · `qris` · `cash` · `edc` |
| `amount` | integer | Rupiah. `payment` > 0; `adjustment` ≠ 0 (signed) |
| `paid_at` | text (ISO UTC) | When the money moved |
| `reference` | text, nullable | |
| `proof_url`, `proof_name` | text, nullable | Storage adapter |
| `note` | text, nullable | |
| `recorded_by` | text | FK `users.id` |
| `created_at` | text | |
| `voided_at`, `voided_by`, `void_reason` | text, nullable | Only `payment` rows can be voided |

A payment is **valid** when `voided_at IS NULL`. Paid amount = Σ `amount` over valid rows (payments + adjustments).

Fixed lists in code: methods with their labels (`bank_transfer` "Transfer Bank", `qris` "QRIS", `cash` "Tunai", `edc` "EDC") and lucide icons (`Landmark`, `QrCode`, `Banknote`, `CreditCard`).

## 5. Business rules

1. **BR-06-1 — Full payment only.** A booking has **at most one valid `payment`** row. Instalments are not supported. Differences are handled with adjustments.
2. **BR-06-2 — Tandai Lunas** is allowed only when `status = awaiting_payment` **and** `hold_expires_at > now` (re-checked server-side after running `expireHolds`). In one transaction it:
   1. inserts the `payment` row;
   2. sets `status = confirmed`, `hold_expires_at = null`;
   3. appends `payment_confirmed` (method, amount, reference, mismatch flag) + `status_changed`;
   4. copies the checklist template if the booking has none yet ([BR-04-5](04-pengaturan.md#5-business-rules));
   5. sends the guide notices ([`07`](07-persiapan.md));
   6. emits `payment_confirmed` to the tourist.
3. **BR-06-3 — Expired race.** If the hold has expired, the action fails with "Pemesanan sudah kedaluwarsa dan dibatalkan otomatis. Buat pemesanan baru." The dialog offers **"Buat ulang pemesanan"**, which opens the wizard pre-filled from the expired booking (customer, language, people, package, date, slot, add-ons). The guides must be re-checked.
4. **BR-06-4 — Proof requirement.** Non-cash methods require `proof_url` or `reference` (server-side validation). Uploads: image MIME only, ≤ 5 MB, renamed to `payments/{bookingId}/{uuid}.{ext}`.
5. **BR-06-5 — Amount mismatch** is allowed but must be acknowledged on the client and is recorded as `mismatch: true` in the event payload. The resulting Sisa is shown on the booking and in Beranda's attention list ([`11`](11-beranda-laporan.md)).
6. **BR-06-6 — Adjustments** may be recorded on any booking that has a valid payment, in any status except `awaiting_payment`. They append `adjustment_recorded`. They never change booking status.
7. **BR-06-7 — Refund at cancellation.** "Jumlah dikembalikan" in the cancel dialog ([`05` §3.5](05-pemesanan.md#35-cancel-dialog-batalkan-pemesanan)) creates a negative adjustment with method = the original payment's method and note = the refund note. The refund amount may not exceed the paid amount.
8. **BR-06-8 — Undo (admin only).** Allowed when status is `confirmed` or `ready` and the slot has not started. In one transaction it:
   - voids the payment;
   - sets `status = awaiting_payment` and `hold_expires_at = min(now + hold_expiry_hours, slot start)`;
   - appends `payment_voided` + `status_changed`.

   Guide assignments, notices, acknowledgements, and the copied checklist are **kept** ([BR-04-5](04-pengaturan.md#5-business-rules)). No tourist notification is sent; staff contact the tourist directly. Undo is **blocked once the booking has any adjustment rows**, with the message: "Pembayaran ini sudah memiliki penyesuaian. Gunakan penyesuaian untuk koreksi."
9. **BR-06-9 — Revenue definition** (used by [`11`](11-beranda-laporan.md)): revenue in a period = Σ amounts of valid `payment` and `adjustment` rows with `paid_at` in the period. Refunds therefore reduce revenue in the period they are paid.
10. **BR-06-10 — Visibility.** Payment data and proofs are visible to admin and staff only. They are never included in guide portal queries. Proof URLs are unguessable (Vercel Blob random suffix). Signed URLs are out of scope for the prototype; this is noted as a production requirement.
11. **BR-06-11** Payment rows are never deleted. Corrections happen through void (admin) or opposite adjustments.

## 6. Server actions / queries

| Action | Input | Roles | Side effects |
|---|---|---|---|
| `confirmPayment` | bookingId, method, amount, paidAt, proofFile?, reference?, note?, mismatchAcknowledged | admin, staff | BR-06-2 chain |
| `recordAdjustment` | bookingId, direction (`charge` / `refund`), amount, method, paidAt, proofFile?, reference?, note | admin, staff | Event `adjustment_recorded` |
| `voidPayment` | paymentId, reason | admin | BR-06-8 |
| `getPaymentSummary` | bookingId | admin, staff | `{ total, paid, balance, rows[] }` |
| `uploadPaymentProof` | bookingId, file | admin, staff | Returns the storage URL. Used inside the confirm and adjustment actions. |

## 7. Notifications

| Event key | To | Channel | Content |
|---|---|---|---|
| `payment_confirmed` | Tourist | whatsapp_mock (EN) | "Your booking {code} is confirmed": date, slot, guide names, meeting instructions ("Please come to the TMII Tour Guide counter 15 minutes before your tour"), facilities |
| Guide notice (`guide_assigned`) | Each assigned guide | in-app | Defined in [`07`](07-persiapan.md) |

## 8. Edge cases

| Case | Expected |
|---|---|
| Paid Rp 1.900.000 on a Rp 1.950.000 booking (transfer fee) | Mismatch warning acknowledged; booking confirmed; "Kurang bayar Rp 50.000" until an adjustment or acceptance. Staff may record a +50.000 adjustment or leave it (Beranda flags it). |
| Tourist pays cash at the counter for a same-day tour | Method Tunai, no proof; confirmed immediately; guides notified "di bawah H-2" |
| Reschedule after payment adds Rp 200.000 | Sisa shows "Kurang bayar Rp 200.000"; staff record a "Tagihan tambahan" adjustment when collected |
| Wrong booking marked paid | Admin "Batalkan Tandai Lunas" with reason; the booking returns to a hold; correct booking confirmed separately |
| Admin tries to undo after the tour started | Not offered. Server rejects: "Tidak dapat dibatalkan setelah tur dimulai." |
| Proof file is a PDF | Rejected: "Bukti harus berupa gambar (JPG, PNG, WebP)." |

## 9. Out of scope

Payment gateways, automatic bank reconciliation, invoices or receipts as PDF, instalments and down payments, tax invoices (faktur pajak), multi-currency, automatic refund calculation.

## 10. Acceptance criteria

1. **Given** an `awaiting_payment` booking (Rp 1.950.000) with an active hold, **when** staff confirm with QRIS, amount 1.950.000, and reference "RRN123", **then** the status becomes Terkonfirmasi, `hold_expires_at` is cleared, the checklist exists, each guide has an in-app notice, and the tourist has a `payment_confirmed` WhatsApp mock.
2. **Given** method Transfer Bank with neither proof nor reference, **then** "Tandai Lunas" fails validation (client and server).
3. **Given** method Tunai with neither proof nor reference, **then** confirmation succeeds.
4. **Given** amount 1.900.000 vs total 1.950.000, **then** the button stays disabled until "Saya sudah memeriksa jumlahnya" is ticked. After confirming, Sisa shows "Kurang bayar Rp 50.000" and the event payload has `mismatch: true`.
5. **Given** a booking whose hold expired 1 minute ago, **when** confirming, **then** it fails with the expired message, and "Buat ulang pemesanan" opens a pre-filled wizard.
6. **Given** a second "Tandai Lunas" on an already-confirmed booking (double submit), **then** it fails with the transition error and only one payment row exists.
7. **Given** a `confirmed` booking and an admin, **when** "Batalkan Tandai Lunas" is submitted with a reason, **then** the payment is voided (struck through), the status is Menunggu Pembayaran with a new hold, and events `payment_voided` + `status_changed` exist.
8. **Given** a staff user, **then** "Batalkan Tandai Lunas" is not shown, and calling `voidPayment` returns 403.
9. **Given** a paid booking cancelled with "Jumlah dikembalikan" Rp 500.000, **then** a −500.000 adjustment exists and the period's revenue is reduced by 500.000.
10. **Given** a guide user, **when** loading their tour detail, **then** the response contains no payment fields and no proof URLs.
