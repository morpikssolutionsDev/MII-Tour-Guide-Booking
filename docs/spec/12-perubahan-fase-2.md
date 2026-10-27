# 12 — Perubahan Fase 2 (Phase-2 changes)

> Status: implemented · Depends on: 05, 06, 07, 08, 09, 11 · Overrides parts of 05, 06, 07, 09 (each overridden rule carries a "Diubah oleh 12" note).

## 1. Purpose

Four changes requested after the prototype went live:

| # | Feature | In one line |
|---|---|---|
| **M** | Gabungkan pemesanan (merge) | Admin joins bookings with the same date, slot and language into one **shared tour** served by the same guide(s), if the guides have capacity. |
| **P** | Bypass konfirmasi pembayaran | With `PAYMENT_CONFIRMATION=false` (the default), a booking is **confirmed and paid by the system** as soon as it is created. The payment module stays in the code, switched off. |
| **E** | Email tim (SMTP) | When a booking is created, the team gets an email with the order details and an **xlsx attachment**. Admin controls on/off and recipients. |
| **F** | Konfirmasi paksa (force confirm) | Admin marks a guide's "Saya siap" on the guide's behalf, with a reason, when the guide can't do it from their phone. |

The decisions in this document were settled in a design interview (grilling, rounds Q1–Q27). This document is the single source for implementing them; §11 is the execution plan.

## 2. User stories

**Merge (M)**
- As an **admin**, I want to merge a booking into another booking with the same date, slot and language, so one guide team serves both groups and the freed guides can take other tours.
- As an **admin**, I want the merge to work even when the bookings use different packages, while each customer keeps the price they agreed to.
- As an **admin**, I want to split a booking off again before the tour starts if I merged by mistake.
- As a **guide**, I want to see the merged groups as one tour with the total number of people.

**Payment bypass (P)**
- As **staff**, I want to finish a booking without a payment step and land on a clear "order created" screen with a link to the order.
- As the **business**, I want every booking still recorded as paid (by the system) so revenue reports keep working, and I want to switch payment confirmation back on later with one setting.

**Email (E)**
- As an **admin**, I want the team to receive an email for every new booking, with the details attached as an Excel file.
- As an **admin**, I want to turn this on or off, choose the recipients, and send a test email from Pengaturan.
- As an **admin**, I want to see failed emails and resend them.

**Force confirm (F)**
- As an **admin**, I want to confirm a guide's assignment on their behalf, with a reason, so the booking can become Siap even when the guide can't open the portal.

## 3. Screens

### 3.1 Booking detail `/pemesanan/[id]`: merge (admin only)

**Button "Gabungkan pemesanan"** (`Merge` icon, secondary), in the actions area. Shown only to admin, only when this booking is eligible as a host (BR-12-M2) and has guides.

**Dialog "Gabungkan pemesanan"** (`ResponsiveDialog`):

- Header: "Gabungkan ke {kode} · {tanggal} · {slot} · {bahasa}".
- Capacity line: "Kapasitas: {terisi}/{kapasitas} orang · {n} guide" ([BR-12-M4](#5-business-rules)).
- List of **eligible** bookings only (BR-12-M2, BR-12-M3, BR-12-M4 already checked server-side). Each row:
  - code, customer name + nationality;
  - people, package name;
  - status badge;
  - "Akan melepas: {nama guide…}" (the guides that will be released).
- Bookings that match date/slot/language but fail capacity are listed **disabled**, with "Kapasitas tidak cukup (+{x} orang)".
- Empty state: "Tidak ada pemesanan lain yang bisa digabung pada jadwal ini."
- Selecting one row enables **"Gabungkan"**. A confirm step repeats: "{kode} akan dilayani oleh {guide…}. Guide {nama…} dilepas. Harga tidak berubah."
- Errors from the server (state changed meanwhile) are shown inline with `ConflictList` where applicable.

**Block "Tur gabungan"** on every booking in a group (host and members), above Persiapan:

- Title "Tur gabungan · {total} orang".
- One row per booking in the group: code (link), customer, people, package, status; the host row is labelled "Pemilik guide".
- Admin, for each member row while the slot hasn't started: **"Pisahkan"** (confirm dialog, BR-12-M8).

**Guides section on a member**: shows the host's guides read-only with the note "Dari {kode host}". Guide swap and resend act on the host.

### 3.2 Bookings list, Papan Jadwal, Beranda "Tur hari ini"

- **List** (`/pemesanan`): merged bookings show a `Merge` icon next to the code (tooltip "Digabung dengan {kode…}"). Guides column shows the shared guides.
- **Papan Jadwal**: a group occupies the host's guide cells once; the card shows "{kode host} +{n}" and the summed people.
- **Beranda "Tur hari ini"**: group members are shown under one row with "+{n} digabung" and the summed people.

### 3.3 Guide portal (`/portal`, `/portal/tur/[bookingId]`)

- The tour card for a group shows the **total** people and "{n} pemesanan digabung".
- Tour detail lists each booking in the group: code, customer (as today), people, package, special needs. Briefing materials are the union across the packages.
- "Saya siap" is one tap for the whole group (it is the host assignment).
- Finishing: **"Selesaikan semua"** marks every booking in the group Selesai. Each booking row also keeps its own "Selesai" / "Tidak hadir" (BR-12-M11).

### 3.4 Wizard end: splash "Pemesanan berhasil dibuat" (flag off)

With `PAYMENT_CONFIRMATION=false`, pressing **"Buat Pemesanan"** saves and opens a full-screen splash **instead of** the current success panel with payment content (`/pemesanan/[id]?baru=1`):

- ✓ illustration (brand decoration), title "Pemesanan berhasil dibuat".
- Booking code, large, with a copy button.
- Summary: date · slot, language · people, package, guides, total with a **Lunas** badge.
- Buttons:
  - **"Lihat detail pemesanan"** (primary) → `/pemesanan/[id]`;
  - **"Buat pemesanan lain"** → `/pemesanan/baru`;
  - **"Salin pesan WhatsApp"**: copies the tourist message (BR-12-P9).

With the flag on, the current flow and success panel are unchanged.

### 3.5 Payment UI when the flag is off

| Place | Flag off |
|---|---|
| Booking detail, section "Pembayaran" | **Hidden.** A **Lunas** badge sits next to the status badge. |
| Booking detail actions | "Tandai Lunas", "Catat Penyesuaian", "Batalkan Tandai Lunas" hidden. |
| Cancel dialog | No "Jumlah dikembalikan" field. |
| Reschedule result | No "Kurang bayar / Kelebihan bayar" message. |
| `/pemesanan` tabs | "Menunggu Pembayaran" tab hidden (and its URL falls back to "Mendatang"). Status filter hides "Menunggu pembayaran". |
| Beranda | KPI "Menunggu pembayaran" → **"Pemesanan baru hari ini"** (count created today, sub-line "{n} lewat telepon"). Widgets "Segera kedaluwarsa" and "Selisih pembayaran" hidden. |
| Laporan | Unchanged. Revenue comes from the system payments. |
| Timeline | Shows "Dibayar oleh sistem" (and "Penyesuaian otomatis oleh sistem" after reschedules). |

### 3.6 Pengaturan → tab "Email" (admin)

- **Status koneksi** (read-only card): "Server SMTP: {host}:{port} · Pengirim: {from}" with a green "Siap" pill, or a red "Belum dikonfigurasi" pill listing the missing env variables. The password is never shown.
- **Switch "Kirim email saat pemesanan dibuat"** (`email_enabled`). Disabled with a hint while SMTP isn't configured.
- **Penerima** (`email_recipients`): a chip input. Type an address and press Enter or comma to add; × to remove. Up to 20, each validated ("Alamat email tidak valid."), duplicates ignored.
- **"Kirim email uji"**: sends a sample booking email with a sample xlsx to all recipients and shows the result per address ("Terkirim" / "Gagal: {error}"). Test emails are logged in the Outbox with event `email_test`.
- **"Simpan"**.

### 3.7 Outbox `/outbox`: email channel

- Channel filter gains **"Email"**. Rows show recipient email, subject, **status pill** "Terkirim" / "Gagal", and a 📎 "pemesanan-{kode}.xlsx" marker.
- Detail sheet shows the error text for failed rows and **"Kirim ulang"** (admin). Resend rebuilds the email and the attachment from the booking's current data (BR-12-E8).

### 3.8 Force confirm (admin)

**Entry points**

- Booking detail → Persiapan → guide rows that are notified but not acknowledged: button **"Konfirmasi atas nama guide"**.
- Beranda widget "Guide belum konfirmasi": the same button on each row, next to "Kirim ulang".

**Dialog "Konfirmasi atas nama {guide}"**

- Text: "Gunakan ini jika {guide} tidak bisa membuka portal. {guide} akan diberi tahu."
- Field **"Alasan"** (required, 5–200 characters), e.g. "Dikonfirmasi lewat telepon".
- Buttons "Batal" / **"Konfirmasi"**.

After saving, the row shows "Siap · dikonfirmasi oleh {admin}" with the reason in a tooltip.

## 4. Data model

One migration (`src/db/migrations/0001_phase2.sql`, generated by drizzle-kit).

### `bookings` (new columns)

| Column | Type | Notes |
|---|---|---|
| `merge_group_id` | text, nullable, FK → `bookings.id` | The **host** booking's id, on every booking in a group, including the host itself. NULL = not merged. Index `ix_bookings_merge_group`. |
| `merged_at` | text (ISO), nullable | When this booking joined its group. |

### `booking_guides` (new columns)

| Column | Type | Notes |
|---|---|---|
| `acknowledged_by` | text, nullable, FK → `users.id` | NULL when the guide confirmed; admin user id when force-confirmed. |
| `ack_note` | text, nullable | Reason for a force confirm. |

The partial unique index `ux_guide_slot` stays as it is: in a group only the host has active assignments.

### `payments` (changes)

| Change | Notes |
|---|---|
| `recorded_by` becomes **nullable** | NULL = recorded by the system. SQLite needs a table rebuild; drizzle-kit generates it. |
| `PAYMENT_METHODS` gains **`system`** | Label "Sistem". Never offered in the Tandai Lunas dialog. |

### `notifications` (changes)

| Change | Notes |
|---|---|
| `NOTIFICATION_CHANNELS` gains **`email`** | |
| `recipient_email` text, nullable | For channel `email`. |
| `delivery_status` text, nullable, enum `pending` / `terkirim` / `gagal` | Email only. |
| `error` text, nullable | SMTP error message on failure. |
| `sent_at` text, nullable | |
| `attachment_name` text, nullable | e.g. `pemesanan-TG-261027-004.xlsx`. The file itself is not stored. |

### `settings` (new keys)

| Key | Default | Notes |
|---|---|---|
| `email_enabled` | `false` | |
| `email_recipients` | `[]` | JSON array of up to 20 addresses. |

### Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PAYMENT_CONFIRMATION` | unset = **off** | Only the exact value `true` turns payment confirmation on. |
| `SMTP_HOST` | — | Required for email. |
| `SMTP_PORT` | `587` | |
| `SMTP_SECURE` | `false` | `true` for port 465 (implicit TLS). |
| `SMTP_USER` / `SMTP_PASSWORD` | — | Secret. Never shown in the UI. |
| `SMTP_FROM` | — | e.g. `"TMII Tour Guide" <noreply@example.com>`. |

## 5. Business rules

### M — Merge (shared tour)

1. **BR-12-M1 — Model.** Merged bookings stay separate records: own customer, package, price snapshot, payments, checklist, feedback and code. They are linked by `merge_group_id = host.id`. The **host** is the only booking in the group with active `booking_guides` rows; members have none (their own rows are released at merge). The host's guides serve every booking in the group.
2. **BR-12-M2 — Eligibility.** Admin only. Host H and joining booking J must:
   - have the same `tour_date`, `slot_id` and `language_id`;
   - each have status `confirmed` or `ready` (also `awaiting_payment` while `PAYMENT_CONFIRMATION=true`);
   - have a slot that hasn't started (`now < tour_date + slot_start`, WIB);
   - not be the same booking, and J must not already be in another group (split it first).

   If H is itself a member of a group, the action targets that group's host.
3. **BR-12-M3 — Group size.** A group may hold any number of bookings as long as BR-12-M4 holds.
4. **BR-12-M4 — Capacity.** Let G = H's active guides count, P = the sum of `people` across the group including J, and m = the **minimum** `maxPeoplePerGuide` across the price snapshots (`priceSnapshot.package.maxPeoplePerGuide`) of every booking in the group including J. The merge is allowed only if `P ≤ G × m`. No guide is added automatically. Otherwise it fails with VALIDATION "Kapasitas guide tidak cukup: {P} orang, maksimal {G × m}." This is pure logic in `src/domain/merge.ts` (unit-tested).
5. **BR-12-M5 — Prices.** Merging never changes any booking's price, total, payments or balance.
6. **BR-12-M6 — Merge transaction.** In one transaction (BEGIN IMMEDIATE, re-checking BR-12-M2/M4):
   1. set `merge_group_id = H.id` on H (if NULL) and J, and `merged_at = now` on J;
   2. release J's active assignments (`released_at = now`);
   3. J's checklist item `guide_ack` is recomputed from H's guides (BR-12-M10), then BR-07-5 runs for J;
   4. events: `merged` on J (`{ hostId, hostCode, releasedGuideIds }`) and `merge_joined` on H (`{ bookingId, code, people }`);
   5. notifications (BR-12-M7).
7. **BR-12-M7 — Notifications on merge.**
   - J's released guides that had been notified get `guide_released` (existing template).
   - H's guides get the new in-app **`tour_merged`**: title "Tur digabung: {kode H}", body "{kode J} ({orang} orang) ikut tur Anda. Total {P} orang · {tanggal}, {slot}." Link to the portal tour.
   - Tourists get **no** WhatsApp (their date, time and price don't change).
   - Existing acknowledgements of H's guides **stay valid**.
8. **BR-12-M8 — Pisahkan (split).** Admin only, before the slot starts. For member J:
   1. rank eligible guides for J's date/slot/language with the existing allocation (`rankEligibleGuides`, [BR-05-6](05-pemesanan.md#5-business-rules)) and assign the top `J.guidesNeeded`;
   2. if not enough guides are free, fail with CONFLICT "Tidak ada guide tersedia untuk memisahkan {kode}." and change nothing;
   3. clear J's `merge_group_id` / `merged_at`; if only the host remains, clear the host's `merge_group_id` too;
   4. J's new guides are notified at once (`guide_assigned`) when J is `confirmed` / `ready`;
   5. H's guides get `tour_merged` with body "{kode J} dipisahkan dari tur Anda. Total {P'} orang.";
   6. event `merge_split` on both.

   The host itself can't be split; split the members instead.
9. **BR-12-M9 — Changes after a merge.**
   - **Reschedule of a member**: the member is split first (BR-12-M8 steps 3, 5, 6, but without allocation), then rescheduled through the normal wizard, which allocates guides as usual.
   - **Reschedule of the host** with members: changing the date, slot, language, package or people is blocked with "Pisahkan pemesanan gabungan terlebih dahulu." A **guide-only change** on the same schedule (the guide swap, which goes through `rescheduleBooking`) is allowed. It applies to the whole group, and BR-12-M4 is re-checked with the new guides.
   - **Cancel of a member**: it leaves the group (merge fields cleared), with no guide effects.
   - **Cancel of the host**: its active guide rows are **moved** to the oldest remaining member by `merged_at` (rows released on the host, inserted on the new host with the same `notified_at`, `short_notice` and `acknowledged_*`). `merge_group_id` on the remaining bookings becomes the new host's id. Event `merge_host_changed`. If no member remains, the group dissolves.
10. **BR-12-M10 — Checklist on members.** A member's system item `guide_ack` is checked iff every active assignment of its **host** is acknowledged. `recomputeGuideAck` resolves the host when `merge_group_id` is set. Acknowledging or force-confirming on the host recomputes every booking in the group, then BR-07-5 runs for each.
11. **BR-12-M11 — Completion.** Selesai / Tidak hadir stay per booking ([BR-05-14](05-pemesanan.md#5-business-rules)). Guides of the host may complete any booking in the group from the portal. "Selesaikan semua" completes every group booking still in `confirmed` / `ready`, one transaction per booking, each sending its own feedback request.
12. **BR-12-M12 — Reports.** Utilisation counts host assignments only, so guides are counted once. Bookings, revenue and ratings stay per booking. A guide's "Tur" count in Kinerja counts every completed booking in the groups it hosted.
13. **BR-12-M13 — Visibility in the portal.** A guide may open any booking whose group host it is assigned to. Portal queries resolve membership through `merge_group_id`.

### P — Payment confirmation bypass

1. **BR-12-P1 — Flag.** `isPaymentConfirmationEnabled()` (in `src/lib/flags.ts`) returns `process.env.PAYMENT_CONFIRMATION === "true"`. It is read on the server only; client components receive it as a prop. Changing it requires a redeploy.
2. **BR-12-P2 — Code stays.** Nothing under the payment module is deleted (`src/server/payments/*`, `src/app/(staff)/pemesanan/[id]/payment-*.tsx`, hold logic, templates). It is skipped or hidden behind the flag, so setting `PAYMENT_CONFIRMATION=true` restores the current behaviour exactly.
3. **BR-12-P3 — Create when off.** `createBooking` ([BR-05-9](05-pemesanan.md#5-business-rules)) runs as today up to inserting the booking. Then, in the **same transaction**:
   - the booking is inserted directly as **`confirmed`**, `hold_expires_at = NULL`;
   - a **system payment** is inserted: kind `payment`, method `system`, `amount = total`, `paid_at = now`, `recorded_by = NULL`, `reference = NULL`;
   - the same confirmation side-effects as [BR-06-2](06-pembayaran.md#5-business-rules) run: checklist copy ([BR-07-1](07-persiapan.md#5-business-rules)) and guide notices with H-2 detection ([BR-07-2](07-persiapan.md#5-business-rules));
   - events: `created`, then `payment_confirmed` with payload `{ method: "system", amount, by: "system" }`, then `status_changed` (`awaiting_payment` is never entered, so the payload is `{ from: null, to: "confirmed", cause: "system_payment" }`).

   Implementation: extract the confirmation core of `confirmPayment` into `confirmPaidBooking(tx, bookingId, payment, actor)` in `src/server/payments/core.ts` and call it from both paths.
4. **BR-12-P4 — Existing holds when off.** Wherever `expireHolds()` runs today, the flag-off variant `confirmPendingBookings()` runs instead. Each `awaiting_payment` booking is confirmed with a system payment (BR-12-P3), even if its hold time has passed. Nothing expires while the flag is off. Idempotent: only bookings still `awaiting_payment` are touched, inside BEGIN IMMEDIATE.
5. **BR-12-P5 — Reschedule when off.** If the new snapshot total differs from the old one, a system **adjustment** of `new − old` is inserted in the same transaction (`method = system`, `recorded_by = NULL`, note "Penyesuaian otomatis: jadwal ulang"). The balance stays 0. Tourist and guide notices are as today, but with no price-difference text.
6. **BR-12-P6 — Cancel when off.** No refund input and no automatic refund adjustment. Refunds, if any, are handled outside the system for now. The booking keeps its system payment, so revenue for a cancelled booking still counts. **Known limitation**, see §9.
7. **BR-12-P7 — Hidden UI when off.** As listed in §3.5. Server actions `confirmPayment`, `recordAdjustment` and `voidPayment` reject with INVALID_STATE "Konfirmasi pembayaran tidak aktif." while the flag is off.
8. **BR-12-P8 — Display.** `recorded_by = NULL` is shown as "Sistem". Method `system` is labelled "Sistem". Laporan revenue ([BR-06-9](06-pembayaran.md#5-business-rules)) includes system rows.
9. **BR-12-P9 — Tourist WhatsApp when off.** `booking_created` uses the new template **`waBookingConfirmed`**: greeting, booking details (code, date, slot, language, people, package, guides, total) and "Your booking is confirmed. See you at TMII!". No payment instructions and no deadline. `payment_confirmed` is **not** sent separately when off.
10. **BR-12-P10 — Switching on again.** Bookings created while off keep their system payments. New bookings follow 05/06 again. No data migration is needed in either direction.

### E — Team email (SMTP)

1. **BR-12-E1 — Configuration split.** The SMTP connection comes from env variables (§4). On/off and recipients come from `settings`. "Configured" = `SMTP_HOST` and `SMTP_FROM` set, and `SMTP_USER` / `SMTP_PASSWORD` either both set or both empty.
2. **BR-12-E2 — Trigger.** Event **`booking_created`** only. It is sent when `email_enabled = true`, SMTP is configured, and there is at least one recipient. Events are registered in `src/server/email/events.ts` (`{ eventKey, subject(facts), html(facts), text(facts), attachment?(bookingId) }`), so adding an event later is one entry.
3. **BR-12-E3 — After commit.** `createBooking` schedules the email with Next's `after()` once the transaction has committed. An SMTP failure never affects the booking or the action's response.
4. **BR-12-E4 — Logging.** Before sending, one `notifications` row per recipient is written with `channel = email`, `delivery_status = pending`, `recipient_email`, subject in `title`, plain text in `body`, `booking_id` and `attachment_name`. After the send attempt the row is updated to `terkirim` + `sent_at`, or to `gagal` + `error`. One SMTP message per recipient, so a bad address fails only its own row.
5. **BR-12-E5 — Subject and body.** Indonesian.
   - Subject: `Pemesanan baru {kode} · {tanggal medium} {slot}`.
   - Body (HTML + plain text):
     - title "Pemesanan baru";
     - code;
     - date · slot;
     - language · people;
     - package + add-ons;
     - guides (names);
     - total (Rupiah);
     - channel;
     - created by;
     - customer name + WhatsApp + nationality;
     - special needs;
     - a button **"Buka pemesanan"** → `{APP_BASE_URL}/pemesanan/{id}`.

   The HTML is inline-styled and table-based for email clients, using the brand colours (Merah, Danau).
6. **BR-12-E6 — Attachment `pemesanan-{kode}.xlsx`** (built with `exceljs`):
   - **Sheet "Detail"**, columns `Field | Nilai`, with these rows:
     - Kode, Status, Kanal, Dibuat oleh, Dibuat pada (`YYYY-MM-DD HH:mm` WIB);
     - Tanggal tur, Slot, Bahasa, Jumlah orang, Paket;
     - Tour guide (one row per guide: name + WhatsApp);
     - Nama pelanggan, WhatsApp, Kewarganegaraan;
     - Kebutuhan khusus, Catatan internal.
   - **Sheet "Rincian harga"**, columns `Item | Qty | Harga satuan | Jumlah`:
     - one row per line of the price snapshot: package × guides, each add-on, each rule (surcharge or discount);
     - then a **Total** row.

     Money cells are numbers with the format `"Rp" #,##0`.
   - Header row bold, column widths set, sheet names in Indonesian.
7. **BR-12-E7 — Test email.** "Kirim email uji" sends the booking template with fixed sample data and a sample xlsx to the current recipients (unsaved changes included), logged with `event_key = email_test`. Admin only.
8. **BR-12-E8 — Resend.** "Kirim ulang" on a `gagal` row rebuilds subject, body and attachment from the booking's **current** data and updates the same row (`delivery_status`, `error`, `sent_at`). Admin only. It ignores `email_enabled` (an explicit admin action) but requires SMTP to be configured.
9. **BR-12-E9 — Timeouts.** Connection and send timeouts are 10 s each, so `after()` work finishes well inside the function's time limit. No automatic retries; failures are resent manually.
10. **BR-12-E10 — No secrets in logs.** Errors are stored without credentials (nodemailer error `message` only, truncated to 500 characters).

### F — Force confirm

1. **BR-12-F1 — Permission and state.** Admin only. Allowed for an active assignment that is notified (`notified_at` set) and not acknowledged, on a booking in `confirmed` / `ready` whose slot hasn't started. For a group member, the action applies to the host's assignment.
2. **BR-12-F2 — Effect.** In one transaction:
   - set `acknowledged_at = now`, `acknowledged_by = admin.id` and `ack_note = reason` on the assignment;
   - run `recomputeGuideAck` and `reconcileStatusWithChecklist` (`src/server/preparation/core.ts`) for the booking, and for every booking in its group (BR-12-M10). The booking may become **Siap**.
   - append the event `guide_acknowledged` with payload `{ guideId, by: adminId, forced: true, reason }`. The timeline reads "Dikonfirmasi oleh admin {nama} atas nama {guide}: {alasan}".
3. **BR-12-F3 — Notice to the guide.** In-app **`guide_ack_forced`**: title "Tur {kode} sudah dikonfirmasi", body "Admin {nama} mengonfirmasi tur {kode} ({tanggal}, {slot}) atas nama Anda. Alasan: {alasan}". Link to the portal tour.
4. **BR-12-F4 — No undo.** A force confirm can't be reverted (guides can't revert "Saya siap" either). A mistake is corrected by swapping the guide on the booking ([BR-07-6](07-persiapan.md#5-business-rules)).
5. **BR-12-F5 — Booking status.** Force confirm never sets a booking status directly. Status only follows the checklist (BR-07-5).
6. **BR-12-F6 — Reporting.** Force-confirmed assignments count as acknowledged everywhere. H-2 compliance ([BR-07-10](07-persiapan.md#5-business-rules)) is unaffected, because it measures `short_notice`.

## 6. Server actions / queries

| Action / query | File | Roles | Input → output |
|---|---|---|---|
| `listMergeCandidates` | `src/server/bookings/merge.ts` | admin | `{ hostId }` → `{ capacity: { used, max, guides }, candidates: [{ id, code, customer, people, package, status, releasesGuides[], fits, overBy }] }` |
| `mergeBooking` | `src/server/bookings/merge.ts` | admin | `{ hostId, bookingId }` → `{ groupId, totalPeople }` · errors VALIDATION (capacity), INVALID_STATE, CONFLICT |
| `splitBooking` | `src/server/bookings/merge.ts` | admin | `{ bookingId }` → `{ guideIds }` · CONFLICT when no guides |
| `completeGroup` | `src/server/bookings/actions.ts` | guide (host assignment), admin, staff | `{ hostId }` → `{ completed: string[] }` |
| `confirmPaidBooking` (internal) | `src/server/payments/core.ts` | — | shared by `confirmPayment` and the system-payment path |
| `confirmPendingBookings` (internal) | `src/server/bookings/holds.ts` | — | flag-off counterpart of `expireHolds` |
| `forceAcknowledge` | `src/server/preparation/actions.ts` | admin | `{ bookingId, guideId, reason }` → `null` |
| `getEmailSettings` | `src/server/email/queries.ts` | admin | → `{ enabled, recipients, smtp: { configured, host, port, from, missing[] } }` |
| `saveEmailSettings` | `src/server/email/actions.ts` | admin | `{ enabled, recipients[] }` → `null` |
| `sendTestEmail` | `src/server/email/actions.ts` | admin | `{ recipients[] }` → `[{ email, ok, error? }]` |
| `resendEmail` | `src/server/email/actions.ts` | admin | `{ notificationId }` → `{ ok, error? }` |
| `sendEventEmail` (internal) | `src/server/email/send.ts` | — | `(eventKey, bookingId)`: logs rows, sends, updates rows |
| `buildBookingXlsx` (internal) | `src/server/email/xlsx.ts` | — | `(bookingId)` → `{ filename, buffer }` |

All actions use `defineAction` (`src/server/action.ts`). Admin-only paths are also protected in `src/lib/routes.ts` where they are pages.

## 7. Notifications

| Event | Channel | Recipients | Template | New? |
|---|---|---|---|---|
| `booking_created` (flag off) | WhatsApp mock | tourist | `waBookingConfirmed` (BR-12-P9) | new template |
| `booking_created` | **email** | `email_recipients` | BR-12-E5 + xlsx | new channel |
| `tour_merged` | in-app | host guides | BR-12-M7 / M8 | new event |
| `guide_released` | in-app | J's released guides | existing | — |
| `guide_ack_forced` | in-app | the guide | BR-12-F3 | new event |
| `email_test` | email | given recipients | sample | new event |

New keys are added to `EVENT_LABELS` (`src/server/notify/templates.ts`): "Tur digabung", "Dikonfirmasi admin", "Email uji".

## 8. Edge cases

| Case | Expected |
|---|---|
| Two admins merge different bookings into the same host at once | Both run BEGIN IMMEDIATE. The second re-checks capacity and fails with "Kapasitas guide tidak cukup" if the first used it up. |
| J is merged while its own guide had already acknowledged | J's assignment is released; that acknowledgement no longer matters. J's `guide_ack` follows the host. |
| Host guides are swapped and the new team is smaller | The swap is refused if BR-12-M4 would fail: "Guide terlalu sedikit untuk tur gabungan ({P} orang)." |
| Merge across different packages with different briefing materials | The portal shows the union of materials. |
| Member reschedules to the same slot again | It leaves the group (BR-12-M9) and gets its own guides; admin may merge again. |
| One booking in a group is a no-show | Only that booking becomes `no_show`; the others complete normally. |
| Flag switched off while a booking is awaiting payment past its hold | Confirmed with a system payment on the next read (BR-12-P4), not expired. |
| Flag switched on with bookings that have system payments | They stay paid; their detail shows the Pembayaran section with the "Sistem" row (read-only, no void). |
| SMTP host unreachable | Booking is created. Rows become `gagal` with "Connection timeout". The admin sees them in the Outbox and resends later. |
| Email enabled but recipients empty | Nothing is sent and nothing is logged. Pengaturan shows the hint "Tambahkan minimal satu penerima." |
| SMTP env missing on Vercel | The Pengaturan card shows "Belum dikonfigurasi" with the missing variables. The switch is disabled; bookings are unaffected. |
| Force confirm on an already acknowledged assignment | No change; returns success (idempotent), no notice sent. |
| Guide taps "Saya siap" after a force confirm | No change (already acknowledged); the original `acknowledged_by` stays. |
| Staff tries `mergeBooking`, `splitBooking`, `forceAcknowledge` or the email settings | FORBIDDEN (or the proxy redirect for pages). |

## 9. Out of scope

- Merging bookings with a different slot, date or language; adding guides automatically to make a merge fit; re-pricing on merge.
- Automatic refunds while payment confirmation is off (BR-12-P6). Cancelled bookings keep their system revenue until this is revisited. Revisit before real payments are taken.
- Email to tourists or guides; emails for events other than booking created; HTML template editing in the UI; storing SMTP credentials in the database; scheduled or automatic email retries.
- Undoing a force confirm.

## 10. Acceptance criteria

**Merge**
1. **Given** bookings A (host, 2 guides, package max 20) and B with the same date, slot and language, A with 12 people and B with 15, **when** admin merges B into A, **then** it succeeds: B's guides are released and notified, A's guides get "Tur digabung" with total 27, both bookings show "Tur gabungan · 27 orang", and both prices are unchanged.
2. **Given** the same, but B uses a package with max 10 per guide, **then** the limit is 2 × 10 = 20 and the merge fails with "Kapasitas guide tidak cukup: 27 orang, maksimal 20."
3. **Given** B in a different slot or language, **then** B is not listed as a candidate and `mergeBooking` fails with INVALID_STATE.
4. **Given** a merged B, **when** admin presses "Pisahkan" and a guide is free, **then** B gets its own guides (notified) and leaves the group; **when** no guide is free, **then** it fails and nothing changes.
5. **Given** a group A+B+C, **when** host A is cancelled, **then** A's guides move to B (the oldest member), and B becomes the host of B+C.
6. **Given** a group, **when** the host guide taps "Saya siap", **then** every booking in the group gets `guide_ack` checked and becomes Siap if its other items are done.
7. **Given** a guide assigned to host A, **then** the portal shows one card with the total people, and "Selesaikan semua" completes A and B, each getting its own feedback link.

**Payment bypass**

8. **Given** `PAYMENT_CONFIRMATION` unset, **when** staff create a booking, **then**:
   - it is `confirmed` immediately;
   - a payment with method `system` for the full total exists;
   - guides are notified;
   - the splash "Pemesanan berhasil dibuat" shows with "Lihat detail pemesanan";
   - the tourist WhatsApp has no payment text.
9. **Given** an `awaiting_payment` booking created before the switch, **when** any booking list loads, **then** it becomes `confirmed` with a system payment.
10. **Given** the flag off, **when** a booking is rescheduled to a pricier date, **then** a system adjustment for the difference exists and the booking shows no balance message.
11. **Given** the flag off, **then** the Pembayaran section, "Tandai Lunas", the "Menunggu Pembayaran" tab, and the Beranda "Segera kedaluwarsa" / "Selisih pembayaran" widgets are not rendered, and `confirmPayment` returns INVALID_STATE.
12. **Given** `PAYMENT_CONFIRMATION=true`, **then** all 05/06 acceptance criteria pass unchanged.

**Email**

13. **Given** email on with 2 recipients and SMTP configured, **when** a booking is created, **then** each recipient receives one email with subject "Pemesanan baru {kode} · …" and `pemesanan-{kode}.xlsx` containing the sheets "Detail" and "Rincian harga", and the Outbox shows 2 "Terkirim" rows.
14. **Given** a wrong SMTP password, **when** a booking is created, **then** the booking is created normally, the Outbox shows "Gagal" with the error, and "Kirim ulang" works after the password is fixed.
15. **Given** email off, **then** no email is sent and no email rows are logged.
16. **Given** "Kirim email uji", **then** each recipient gets the sample email and the result per address is shown.
17. **Given** the xlsx, **then** money cells are numeric with the Rupiah format, and the totals match the booking's price summary.

**Force confirm**

18. **Given** a confirmed booking whose only unchecked item is "Konfirmasi guide", **when** admin force-confirms with reason "Dikonfirmasi lewat telepon", **then**:
    - the booking becomes Siap;
    - the timeline shows "Dikonfirmasi oleh admin {nama} atas nama {guide}: Dikonfirmasi lewat telepon";
    - the guide gets the in-app notice.
19. **Given** a staff user, **then** the button is not rendered and `forceAcknowledge` returns FORBIDDEN.
20. **Given** an empty or 3-character reason, **then** validation fails with "Alasan minimal 5 karakter."

## 11. Execution plan

### 11.1 Build order

Each step ends green: typecheck, lint, Vitest, and the smoke checks for that step.

| Step | Scope | Why this order |
|---|---|---|
| 0 | Migration + schema enums + `src/lib/flags.ts` + env docs | Everything else depends on it. |
| 1 | **P** Payment bypass | Changes `createBooking` and the hold path, which merge and email build on. |
| 2 | **F** Force confirm | Small and independent; also needed by the group checklist logic. |
| 3 | **M** Merge | Largest. Relies on the step-1 statuses and the step-2 ack recompute. |
| 4 | **E** Email | Hooks into the final `createBooking`. Needs new dependencies. |
| 5 | Seed, README, smoke suite, Vercel env | Demo data and deploy. |

### 11.2 Step 0: foundation

**Schema (`src/db/schema.ts`)**
- New columns per §4.
- `PAYMENT_METHODS += "system"`, `NOTIFICATION_CHANNELS += "email"`.
- New `EMAIL_DELIVERY_STATUSES`.

**Migration**
- `npm run db:generate`, then check that the generated SQL rebuilds `payments` (nullable `recorded_by`) without losing rows.
- `npm run db:migrate` locally and `npm run db:migrate:turso`.

**Flags and env**
- `src/lib/flags.ts`: `isPaymentConfirmationEnabled()`, `smtpConfig()` (reads and validates the SMTP env, returns `{ configured, missing[], … }`).
- `.env.example`, README env table, `00-overview.md` §9.2: add `PAYMENT_CONFIRMATION` and the `SMTP_*` variables.

**i18n (`src/i18n/id.ts`)**
- New sections: `merge`, `forceAck`, `emailSettings`, `splash`.
- Labels: `paymentMethods.system = "Sistem"`, `outbox.channels.email = "Email"`, new `EVENT_LABELS`.

### 11.3 Step 1: payment bypass (P)

**Server**
- `src/server/payments/core.ts` (new): extract `confirmPaidBooking()` from `confirmPayment` (checklist copy, `notifyUnnotifiedGuides`, events).
- `src/server/payments/actions.ts`:
  - `confirmPayment` calls it;
  - all three actions reject when the flag is off (BR-12-P7).
- `src/server/bookings/actions.ts`:
  - `createBooking` takes the flag-off branch (BR-12-P3);
  - `rescheduleBooking` records a system adjustment (BR-12-P5);
  - `cancelBooking` ignores refund input when off.
- `src/server/bookings/holds.ts`: add `confirmPendingBookings()`, plus `syncHolds()`, which picks it or `expireHolds()` by the flag. Replace every `expireHolds()` call site with `syncHolds()` (grep: queries, conflicts, dashboard, portal, availability).
- `src/server/notify/templates.ts` + `index.ts`: `waBookingConfirmed`; `notify.bookingCreated` picks the template by flag.

**UI**
- `src/components/booking/wizard.tsx` + new `src/components/booking/created-splash.tsx`. On success with the flag off, render the splash (§3.4) instead of `router.push(…?baru=1)`.
- `src/app/(staff)/pemesanan/[id]/page.tsx`: hide the payment section and actions, add the Lunas badge. `payment-section.tsx` shows "Sistem" for NULL `recorded_by`.
- `src/app/(staff)/pemesanan/page.tsx` + `src/server/bookings/queries.ts`: hide the tab and status option when off.
- `src/app/(staff)/beranda/page.tsx` + `src/server/dashboard/queries.ts`: swap the KPI, hide the two widgets.
- Cancel dialog in `booking-actions.tsx`: hide refund when off.

**Tests**
- Domain unit tests stay.
- Smoke: AC 8–12, run once with the flag unset and once with `PAYMENT_CONFIRMATION=true` (existing `smoke-booking` suite must pass in the latter).

### 11.4 Step 2: force confirm (F)

- `src/server/preparation/actions.ts`: `forceAcknowledge` (BR-12-F1–F5). Reuse `recomputeGuideAck` / `reconcileStatusWithChecklist`.
- `src/server/notify/templates.ts` / `index.ts`: `inAppGuideAckForced`, `notify.guideAckForced`.
- UI:
  - `checklist-panel.tsx`: button + dialog (`ResponsiveDialog`, `Textarea` with counter);
  - `src/app/(staff)/beranda/widget-actions.tsx`: `ForceAckButton`;
  - timeline renders the forced variant.
- `getBookingDetail` returns `acknowledgedBy` name + `ackNote`.
- Smoke: AC 18–20.

### 11.5 Step 3: merge (M)

**Domain** (`src/domain/merge.ts` + `merge.test.ts`)
- `mergeCapacity(group, guides)`.
- `canMerge(host, joining, now)`.
- `nextHost(members)`.
- Cases: different packages, minimum max per guide, exact fit, over by one, started slot, statuses with the flag on and off.

**Server**
- `src/server/bookings/merge.ts` (new): `listMergeCandidates`, `mergeBooking`, `splitBooking`, and a `transferHost(tx, groupId)` helper.
- `rankEligibleGuides` (`src/server/bookings/availability.ts`) is reused for split.
- `src/server/bookings/actions.ts`:
  - `rescheduleBooking`: split a member first; for the host, allow a guide-only change and re-check capacity, block anything else;
  - `cancelBooking`: leave the group / `transferHost`;
  - new `completeGroup`.
- `src/server/preparation/core.ts`: `recomputeGuideAck` resolves the host; add `recomputeGroup(tx, groupId)`.
- `src/server/preparation/actions.ts`: `acknowledgeAssignment` recomputes the group.
- `src/server/portal/queries.ts`: tours include group members; access check through the host (BR-12-M13).
- `src/server/bookings/queries.ts` (`getBookingDetail`, `listBookings`, `getScheduleBoard`) and `src/server/dashboard/queries.ts`: return group info and the summed people.
- `src/server/notify`: `tour_merged` template + `notify.tourMerged` / `notify.tourSplit`.

**UI**
- Booking detail: merge dialog, "Tur gabungan" block, "Pisahkan".
- List icon; schedule-grid card; Beranda grouping.
- Portal tour card and detail; "Selesaikan semua" in `tour-action-bar.tsx`.

**Smoke**: AC 1–7, including two concurrent merges into one host (exactly one succeeds when capacity allows only one).

### 11.6 Step 4: email (E)

**Dependencies**
- `npm i nodemailer exceljs` and `npm i -D @types/nodemailer`.
- Add both to `serverExternalPackages` in `next.config.ts` if bundling complains.

**Server** (new `src/server/email/`)
- `transport.ts`: a nodemailer transport from `smtpConfig()`, with 10 s timeouts.
- `xlsx.ts`: `buildBookingXlsx` (BR-12-E6), returning a Buffer.
- `templates.ts`: subject / html / text for `booking_created` and `email_test`.
- `events.ts`: the registry (BR-12-E2).
- `send.ts`: `sendEventEmail` (log → send per recipient → update rows).
- `queries.ts` / `actions.ts`: settings, test, resend.

**Wiring**
- `src/server/settings.ts`: `email_enabled`, `email_recipients` with zod (array of emails, max 20).
- `createBooking`: `after(() => sendEventEmail("booking_created", id))` after the transaction.

**UI**
- `src/app/(staff)/pengaturan/`: new tab "Email" (`email-client.tsx`) per §3.6.
- `src/app/(staff)/outbox/outbox-table.tsx` + `src/server/notify/queries.ts`: email channel, status pill, attachment marker, error, "Kirim ulang".

**Local test**
- Run an SMTP sink (`npx maildev` or Mailpit/smtp4dev) on port 1025.
- Set `SMTP_HOST=localhost SMTP_PORT=1025 SMTP_FROM=…`, create a booking, check the email and open the xlsx in Excel.
- Smoke: AC 13–17. AC 14 uses a wrong port to force failure.

### 11.7 Step 5: seed, docs, deploy

**Seed** (`scripts/seed.ts`, `scripts/seed-notifications.ts`)
- 2–3 merged groups in the coming days (one with different packages).
- A few force-confirmed assignments with reasons.
- System payments for bookings created after the switch, with the flag off as the default.
- A handful of `email` outbox rows (mostly "Terkirim", one "Gagal").

**Docs**
- README: env table (`PAYMENT_CONFIRMATION`, `SMTP_*`), the local SMTP sink tip.
- Spec cross-references are already in 00/05/06/07/09.

**Deploy**
- Vercel: add `SMTP_*`. `PAYMENT_CONFIRMATION` stays unset.
- `npm run db:migrate:turso` before deploying the new code.

### 11.8 Definition of done

- AC 1–20 pass as HTTP smoke checks against `next start`, with the flag both unset and `true` where relevant.
- `npm test`, `npm run typecheck` and `npm run lint` are clean; `next build` succeeds.
- The existing smoke suites (`smoke`, `smoke-master`, `smoke-actions-master`, `smoke-booking`) still pass with `PAYMENT_CONFIRMATION=true`.
- Turso migrated; the Vercel deployment sends a real email to a test inbox.
