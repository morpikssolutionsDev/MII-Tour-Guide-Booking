# 09 — Notifikasi (Notifications)

> Status: **Draft v1** · Last updated: 2026-10-25 · Depends on: [`00-overview.md`](00-overview.md) §8.5 · Used by: [`02`](02-tour-guide.md), [`05`](05-pemesanan.md), [`06`](06-pembayaran.md), [`07`](07-persiapan.md), [`08`](08-portal-guide.md), [`10`](10-ulasan.md)

## 1. Purpose

One mechanism for every message the system "sends". In the prototype **nothing leaves the system**. Every message is written to a `notifications` outbox table:

- **Internal** messages to admins, staff, and guides are `in_app` (Indonesian). They appear in each user's **notification bell**.
- **Tourist** messages are `whatsapp_mock` (English). They are visible on the booking's "Pesan" section and in the admin **Outbox**, where staff can copy the text or open WhatsApp with it pre-filled to send it by hand.

Serves flow steps **4, 5, and 7** and pain points 2 (H-2 notice) and 5 (coordination). The outbox is designed so that a real WhatsApp or email sender can later be attached by consuming `whatsapp_mock` rows, without changing any caller.

## 2. User stories

- As a **guide or staff member**, I want a bell showing my unread notifications, linking to the right page.
- As an **admin**, I want to see every message the system generated (who, what, when, about which booking), so that I can verify communications during the prototype.
- As **staff**, I want to copy a tourist message or open it in WhatsApp, so that I can actually send it while there is no WhatsApp integration.
- As a **developer**, I want one `notify()` entry point with typed templates, so that adding a channel later is a small change.

## 3. Screens

### 3.1 Notification bell (all logged-in users)

- Admin and staff: in the top bar / sidebar header. Guides: in the portal top bar.
- Badge: unread `in_app` count for the current user (Merah 600 dot, "9+" max).
- Panel (popover 380 px on desktop, full-screen sheet on mobile):
  - title "Notifikasi" + "Tandai semua dibaca";
  - list of the last 30 days, newest first. Each item has an icon per event, a bold **title**, a 2-line **body**, a relative time, and a Danau 50 background while unread;
  - clicking an item marks it read and navigates to its `link`.
- Empty state: `birds-flying.svg`, "Belum ada notifikasi."
- Refresh: on window focus and every 60 s while the tab is visible. No websockets.

### 3.2 Outbox: `/outbox` (admin)

- `FilterBar`: search (recipient, booking code), "Kanal" (In-app / WhatsApp simulasi), "Peristiwa" (event key, Indonesian label), date range.
- Table (cards on mobile):

  | Column | Content |
  |---|---|
  | Waktu | Date and time |
  | Kanal | Badge "In-app" (`Bell`) / "WhatsApp (simulasi)" (`MessageCircle`) |
  | Penerima | Name + role, or tourist name + phone |
  | Peristiwa | Indonesian event label (§7) |
  | Ringkasan | Title or first line |
  | Pemesanan | Code link |
  | Status | In-app: "Dibaca {waktu}" / "Belum dibaca". WhatsApp: "Simulasi". |

- Row click opens a detail drawer with the full rendered body (monospace-free, preserving line breaks) and these actions:
  - "Salin pesan";
  - **"Buka di WhatsApp"** (WhatsApp rows only): opens `https://wa.me/{phone}?text={encoded body}` in a new tab;
  - "Lihat konteks" (collapsible JSON of the template context, for debugging).
- Pagination: 50 per page.

### 3.3 Section "Pesan" on the booking detail (admin, staff)

All notifications with this `booking_id`, newest first, in the same row format, with "Salin pesan" and "Buka di WhatsApp" for WhatsApp rows (see [`05` §3.3](05-pemesanan.md#33-booking-detail-pemesananid-admin-staff)).

## 4. Data model

### `notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `event_key` | text | §7 catalogue key |
| `channel` | text enum | `in_app` · `whatsapp_mock` |
| `locale` | text | `id` (in-app) · `en` (WhatsApp) |
| `recipient_user_id` | text, nullable | For `in_app` |
| `recipient_phone` | text, nullable | E.164, for `whatsapp_mock` |
| `recipient_name` | text | Snapshot for display |
| `booking_id` | text, nullable | FK |
| `leave_id` | text, nullable | FK `guide_leaves.id` |
| `title` | text | In-app title. WhatsApp: the first line. |
| `body` | text | Rendered text |
| `link` | text, nullable | In-app deep link (relative path) |
| `context` | text (JSON) | Template variables used |
| `dedupe_key` | text, nullable, **unique** | Prevents duplicates (BR-09-4) |
| `read_at` | text, nullable | In-app only |
| `created_at` | text | |

Indexes: (`recipient_user_id`, `read_at`, `created_at`), (`booking_id`), (`channel`, `created_at`).

## 5. Business rules

1. **BR-09-1 — Single entry point.** Modules call `notify(eventKey, context, { tx })` from `src/lib/notify/`. For the event it:
   1. resolves the recipients (§7);
   2. renders each template with the recipient's locale;
   3. inserts the rows **inside the caller's transaction**, so a rolled-back action leaves no messages;
   4. for booking-related events, appends one `notification_sent` booking event with `{ eventKey, recipients: n }`.
2. **BR-09-2 — Templates are code.** They live in `src/lib/notify/templates.ts` as typed functions `(ctx) => { title, body, link? }`, one per event and channel. They are not editable in the UI (agreed scope). Copy for in-app messages follows [design-system §12](design-system.md#12-voice-and-copy-indonesian-ui). English copy is warm and simple.
3. **BR-09-3 — Recipients.**
   - In-app messages go only to **active** users.
   - Tourist messages go to the booking customer's `phone_e164`.
   - Guide recipients are resolved through `guides.user_id`.
   - "All admins" means all active users with role `admin`.
4. **BR-09-4 — Idempotency.** Events that may be triggered more than once set `dedupe_key`, and a conflict is silently skipped. The keys are:
   - `hold_expired:{bookingId}:{recipient}`;
   - `payment_confirmed:{paymentId}`;
   - `feedback_request:{tokenId}`;
   - `low_rating_alert:{feedbackId}:{adminId}`.
5. **BR-09-5 — Formatting in templates.**
   - Indonesian: dates in long format ("Sabtu, 7 Nov 2026"), times "09.00–12.00", money "Rp 1.950.000".
   - English: "Saturday, 7 November 2026", "09:00–12:00 WIB", money still "Rp 1.950.000" (IDR).
   - Guide names are display names.
   - Never include payment proof URLs or internal notes.
6. **BR-09-6 — Read state.** Opening a notification marks it read. "Tandai semua dibaca" marks all of the current user's unread rows. Users can only read and mark their own rows. Admins see everyone's in the Outbox, read-only.
7. **BR-09-7 — "Buka di WhatsApp"** only builds a `wa.me` link. The system never sends anything itself and does not record whether the staff member actually sent it (out of scope).
8. **BR-09-8 — Retention.** The bell shows 30 days. The Outbox keeps everything for the prototype.

## 6. Server actions / queries

| Action | Input | Roles | Notes |
|---|---|---|---|
| `notify` | eventKey, context, tx | (internal) | BR-09-1..4 |
| `listMyNotifications` | cursor? | any logged-in | Last 30 days + unread count |
| `markNotificationRead` | id | owner | |
| `markAllNotificationsRead` | — | any logged-in | |
| `listOutbox` | filters, page | admin | |
| `listBookingMessages` | bookingId | admin, staff | |
| `getWhatsappLink` | notificationId | admin, staff | `wa.me` URL for `whatsapp_mock` rows |

## 7. Event catalogue and templates

Variables are in `{braces}`. 🟢 = in-app (Indonesian), 💬 = WhatsApp mock (English). Labels in the "Peristiwa" column are the Outbox filter labels.

### 7.1 Booking lifecycle

| Key | Peristiwa (label) | Trigger (module) | Recipients |
|---|---|---|---|
| `booking_created` | Pemesanan dibuat | createBooking (05) | 💬 tourist |
| `payment_confirmed` | Pembayaran dikonfirmasi | confirmPayment (06) | 💬 tourist |
| `guide_assigned` | Penugasan guide | confirmation / reschedule / resend (07) | 🟢 each newly assigned guide (or the reminder target) |
| `booking_rescheduled` | Jadwal diubah | rescheduleBooking (05/07) | 💬 tourist · 🟢 kept guides already notified |
| `guide_released` | Guide dilepas | reschedule / cancel (05/07) | 🟢 released guides with `notified_at` |
| `booking_cancelled` | Pemesanan dibatalkan | cancelBooking (05) | 💬 tourist · 🟢 guides with `notified_at` |
| `hold_expired` | Kedaluwarsa otomatis | expireHolds (05) | 💬 tourist · 🟢 the creating staff user |
| `feedback_request` | Permintaan ulasan | completion / regenerate (10) | 💬 tourist |
| `low_rating_alert` | Rating rendah | feedback submitted (10) | 🟢 all admins |

**💬 `booking_created`**

```
Hello {customerName}, thank you for booking a TMII tour guide!

Booking code: {code}
Date: {tourDateEn}, {slotEn} WIB
Language: {languageEn} · {people} people
Package: {packageName} ({guidesNeeded} guide(s))
Total: {total}

{paymentInstructions}

Please complete your payment before {holdExpiresEn}. Unpaid bookings are released automatically.
— TMII Tour Guide Service
```

**💬 `payment_confirmed`**

```
Hi {customerName}, we have received your payment. Booking {code} is confirmed ✅

📅 {tourDateEn}, {slotEn} WIB
🗣 {languageEn}-speaking guide: {guideNames}
👥 {people} people · {packageName}
🎁 Included: {facilities}

Please come to the TMII Tour Guide counter 15 minutes before your tour. See you at Taman Mini Indonesia Indah!
```

**💬 `booking_rescheduled`**

```
Hi {customerName}, your booking {code} has been updated.

New schedule: {tourDateEn}, {slotEn} WIB
{languageEn} · {people} people · {packageName}
{guideLine}            ← "Your guide: {guideNames}" (only if confirmed)
{priceLine}            ← awaiting payment: "New total: {total}" · paid with a difference: "Price difference: {diff}. Our staff will contact you." · otherwise omitted

Questions? Just reply to this message.
```

**💬 `booking_cancelled`**

```
Hi {customerName}, your booking {code} for {tourDateEn}, {slotEn} WIB has been cancelled.
{refundLine}           ← "A refund of {refundAmount} will be processed." (only if a refund amount was recorded)
We hope to welcome you at TMII another time.
```

**💬 `hold_expired`**

```
Hi {customerName}, we did not receive payment for booking {code} ({tourDateEn}, {slotEn} WIB), so the reservation has been released.
Reply to this message if you would like to book again.
```

**💬 `feedback_request`**

```
Thank you for exploring TMII with {guideNames}, {customerName}! 🙏
How was your tour? It takes one minute: {feedbackUrl}
(This link is valid until {expiresEn}.)
```

**🟢 `guide_assigned`** → link `/portal/tur/{bookingId}`

| Variant | Title | Body |
|---|---|---|
| Normal | Tur baru: {tanggal} | {slot} · {bahasa} · {orang} orang · {paket} ({code}). Buka detail lalu tekan "Saya siap". |
| Short notice | Tur baru (di bawah H-2): {tanggal} | Same body + " Mohon segera konfirmasi." |
| Reminder | Pengingat: konfirmasi tur {code} | {tanggal}, {slot}. Anda belum menekan "Saya siap". |

**🟢 `booking_rescheduled`** (guides) → `/portal/tur/{bookingId}`

| Variant | Title | Body |
|---|---|---|
| Schedule changed | Jadwal tur {code} berubah | {jadwalLama} → {jadwalBaru}. Mohon konfirmasi ulang dengan "Saya siap". |
| Details changed | Detail tur {code} diperbarui | {ringkasanPerubahan} (e.g. "Jumlah orang 6 → 8; add-on: Dokumentasi foto") |

**🟢 `guide_released`** → `/portal/jadwal?view=riwayat`
Title "Tugas tur dilepas" · Body "Anda tidak lagi bertugas pada tur {code} ({tanggal}, {slot})."

**🟢 `booking_cancelled`** (guides) → `/portal/jadwal?view=riwayat`
Title "Tur {code} dibatalkan" · Body "{tanggal}, {slot}. Alasan: {alasan}."

**🟢 `hold_expired`** (staff) → `/pemesanan/{bookingId}`
Title "Pemesanan {code} kedaluwarsa" · Body "{pelanggan} · {tanggal}, {slot}. Pembayaran tidak diterima; slot dan guide sudah dilepas."

**🟢 `low_rating_alert`** (admins) → `/pemesanan/{bookingId}`
Title "Rating rendah untuk {guide}" · Body "★{rating} pada {code} ({tanggal}). \"{cuplikanKomentar}\"" (comment truncated to 120 characters, or "Tanpa komentar").

### 7.2 Leave

| Key | Peristiwa | Trigger (02) | Recipients | Title · Body · Link |
|---|---|---|---|---|
| `leave_requested` | Permintaan cuti | requestLeave | 🟢 all admins | "Permintaan cuti: {guide}" · "{rentang} ({n} hari). Alasan: {alasan}" · `/tour-guide/cuti` |
| `leave_decided` | Keputusan cuti | approveLeave / rejectLeave | 🟢 guide | "Cuti disetujui" or "Cuti ditolak" · "{rentang}." + rejected: " Catatan: {catatan}" · `/portal/cuti` |
| `leave_added_by_admin` | Cuti ditambahkan admin | createLeaveByAdmin | 🟢 guide | "Cuti ditambahkan oleh admin" · "{rentang}. Alasan: {alasan}" · `/portal/cuti` |
| `leave_cancelled_by_admin` | Cuti dibatalkan admin | cancelLeave (admin) | 🟢 guide | "Cuti dibatalkan oleh admin" · "{rentang} tidak lagi tercatat sebagai cuti." · `/portal/cuti` |

## 8. Edge cases

| Case | Expected |
|---|---|
| The action creating a booking fails after `notify` was called | Transaction rollback; no notification rows |
| `expireHolds` runs concurrently in two requests | `dedupe_key` ensures one tourist and one staff message |
| The creating staff user has been deactivated when a hold expires | No in-app row for them (BR-09-3); the tourist message is still created |
| A tourist phone number changes after messages were created | Old rows keep the old number (snapshot); new rows use the new one |
| A guide has 120 unread notifications | Badge shows "9+"; the panel paginates (20 per page, "Muat lebih banyak") |
| `payment_instructions_en` is empty | That paragraph is omitted from `booking_created` ([`04`](04-pengaturan.md)) |

## 9. Out of scope

Real delivery (WhatsApp Business API, email, SMS, web push), delivery receipts, user notification preferences, editable templates, scheduled or digest notifications, multi-language tourist messages beyond English.

## 10. Acceptance criteria

1. **Given** a new booking, **then** exactly one `whatsapp_mock` row `booking_created` exists for the tourist's phone, in English, containing the code, date, total, and payment instructions.
2. **Given** a payment confirmation for a 2-guide booking, **then** there is one `payment_confirmed` WhatsApp row and two `guide_assigned` in-app rows, each linking to `/portal/tur/{id}`.
3. **Given** a guide with 3 unread notifications, **when** they open the bell and tap one, **then** it is marked read, the badge shows 2, and the app navigates to the link.
4. **Given** "Tandai semua dibaca", **then** the badge disappears and all of that user's rows have `read_at`.
5. **Given** an admin on `/outbox`, **when** filtering Kanal = WhatsApp (simulasi) and Peristiwa = Kedaluwarsa otomatis, **then** only those rows are listed, and "Buka di WhatsApp" opens a `wa.me` link with the encoded body.
6. **Given** a staff user, **when** opening `/outbox`, **then** they are redirected (admin only), but the booking detail "Pesan" section works for them.
7. **Given** `createBooking` fails at the final insert, **then** no `booking_created` row exists.
8. **Given** two simultaneous `expireHolds` runs on the same booking, **then** exactly one tourist `hold_expired` row exists.
9. **Given** any WhatsApp mock row, **then** its body contains no internal notes, payment proof URLs, or staff names.
