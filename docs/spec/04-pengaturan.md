# 04 — Pengaturan (Settings)

> Status: **Draft v1** · Last updated: 2026-10-25 · Depends on: [`00-overview.md`](00-overview.md), [`01-auth-pengguna.md`](01-auth-pengguna.md), [`03-harga.md`](03-harga.md) (packages, for briefing tags)

## 1. Purpose

Admin-only configuration for the operational building blocks:

- the **time slots** tours run in;
- the **languages** guides can offer;
- the **preparation checklist template**;
- the **briefing material** guides read before a tour;
- the **general limits**: hold expiry, booking horizon, H-2 notice, feedback link lifetime, low-rating threshold, and the payment instructions sent to tourists.

Serves flow steps **2** (slot-based scheduling, the infographic's "Jadwal Rekomendasi") and **5** (Persiapan: "Materi Tour & Briefing", checklist), plus pain points 2 and 3.

## 2. User stories

- As an **admin**, I want to manage the tour slots and switch one off temporarily, so that staff can only book times TMII actually runs.
- As an **admin**, I want to add a language when a new guide brings one, so that it becomes bookable.
- As an **admin**, I want to edit the preparation checklist, so that operations follow the current SOP for every confirmed booking.
- As an **admin**, I want to publish briefing material per package, so that guides see the right content for each tour.
- As an **admin**, I want to tune limits such as hold expiry and the H-2 notice, so that the process matches operations without a code change.

## 3. Screens

`/pengaturan` (admin only) is a tabbed page: **"Slot" · "Bahasa" · "Daftar Periksa" · "Materi Briefing" · "Umum"**, with the tab in the URL (`?tab=`).

### 3.1 Tab "Slot"

List ordered by start time: label **"09.00–12.00"** (derived), "Durasi" ("3 jam"), "Pemesanan mendatang" (count of future active bookings), "Status". Admin actions: "Ubah", "Nonaktifkan"/"Aktifkan". Header: "Tambah Slot".

**Slot form**:

| Field | Rules |
|---|---|
| "Jam mulai" * | `HH:mm`, 06:00–21:00, 15-minute steps |
| "Jam selesai" * | `HH:mm`, after the start, duration 30 min – 8 h |

- Editing times is disabled while the slot has future active bookings. The caption says: "Slot ini memiliki {n} pemesanan mendatang. Nonaktifkan dan buat slot baru untuk mengubah jam."
- Deactivating such a slot is blocked with a conflict list (BR-04-3).

### 3.2 Tab "Bahasa"

List: "Bahasa" (Indonesian name), "Nama (EN)", "Kode", "Tour guide" (count of active guides speaking it), "Status". Actions: "Ubah", "Nonaktifkan"/"Aktifkan". Header: "Tambah Bahasa".

**Language form**:

| Field | Rules |
|---|---|
| "Nama bahasa" * | Indonesian label shown in the UI, e.g. "Inggris", "Arab", "Rusia" (2–30 characters, unique) |
| "Nama dalam bahasa Inggris" * | Used in tourist-facing English text, e.g. "English", "Arabic", "Russian" |
| "Kode" * | ISO 639-1, lowercase, 2 letters, unique (`en`, `ar`, `ru`). Displayed uppercase on pills ("EN"). |

### 3.3 Tab "Daftar Periksa" (preparation checklist template)

An ordered list with drag handles (on mobile, "Naikkan"/"Turunkan" buttons; keyboard-accessible reordering is required):

| Item (seeded) | Type |
|---|---|
| "Guide sudah dikonfirmasi" | **Sistem**, ticked automatically when every assigned guide taps "Saya siap" ([`07`](07-persiapan.md), [`08`](08-portal-guide.md)) |
| "Materi briefing sudah dibaca" | Manual |
| "Fasilitas disiapkan (snack, air mineral, voucher)" | Manual |
| "Konfirmasi ke tim operasional" | Manual |

- Each item has a "Label" * (≤ 80 characters) and an optional "Keterangan" (help text, ≤ 200 characters).
- System items can be relabelled and reordered but **not deleted**; they are marked with a "Sistem" badge and a lock icon.
- Header: "Tambah Item".
- Caption: "Perubahan berlaku untuk pemesanan yang dikonfirmasi setelah ini."

### 3.4 Tab "Materi Briefing"

List: "Judul", "Berlaku untuk" ("Semua paket" or package names), attachments (link icon / PDF chip), "Diperbarui" (relative time + by whom), "Status". Header: "Tambah Materi". Empty state: `castle.svg`, "Belum ada materi briefing."

**Briefing form** (full page on mobile):

| Field | Rules |
|---|---|
| "Judul" * | 3–100 characters |
| "Isi" * | Rich text (bold, italic, lists, links), ≤ 20 000 characters |
| "Tautan" | Optional `https://` URL, e.g. a video or Google Drive folder |
| "Lampiran PDF" | Optional, a single PDF ≤ 10 MB, via the storage adapter |
| "Berlaku untuk" * | Radio "Semua paket" / "Paket tertentu" (+ multi-select of packages, at least one) |

Preview button: "Pratinjau tampilan guide" renders it the way the guide portal will.

### 3.5 Tab "Umum" (general settings)

A single form with a "Simpan" button. Each field has its help text:

| Label | Key | Default | Range | Help text |
|---|---|---|---|---|
| "Batas waktu pembayaran" | `hold_expiry_hours` | 24 | 1–168 jam | "Pemesanan yang belum lunas otomatis dibatalkan setelah waktu ini." |
| "Pemesanan paling jauh" | `booking_horizon_days` | 90 | 7–365 hari | "Batas tanggal tur terjauh yang dapat dipesan." |
| "Target pemberitahuan guide" | `notice_days` | 2 | 1–7 hari (H-n) | "Guide diberi tahu minimal H-n sebelum tur." |
| "Masa berlaku tautan ulasan" | `feedback_link_days` | 14 | 1–60 hari | |
| "Ambang rating rendah" | `low_rating_threshold` | 2 | 1–4 | "Rating guide ≤ nilai ini mengirim peringatan ke admin." |
| "Instruksi pembayaran (EN)" | `payment_instructions_en` | Seeded sample text | ≤ 1 000 characters | "Dikirim ke wisatawan (WhatsApp simulasi) saat pemesanan dibuat. Ditulis dalam bahasa Inggris." |

Seeded `payment_instructions_en` (sample, not real account details):

> Please complete your payment within 24 hours to secure your guide. Bank transfer: Bank Mandiri 123-00-0000000-0 a.n. PT Taman Wisata Mini Indonesia Indah (sample). QRIS and card payments are also accepted at the TMII Tour Guide counter. Please send your payment receipt to this WhatsApp number with your booking code.

## 4. Data model

### `slots`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `start_time`, `end_time` | text `HH:mm` | WIB, `end_time > start_time` |
| `is_active` | integer (bool) | |
| `created_at`, `updated_at` | text | |

Display label: `start_time`–`end_time` with dots ("09.00–12.00"). Ordered by `start_time`.

### `languages`

`id`, `code` (unique), `name_id` (unique), `name_en`, `sort_order`, `is_active`, timestamps.

### `checklist_template_items`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `system_key` | text, nullable, unique | `guide_ack` for the system item; null for manual items |
| `label` | text | not null |
| `description` | text, nullable | |
| `sort_order` | integer | |
| `created_at`, `updated_at` | text | |

Manual items may be hard-deleted (bookings copy items, [overview §8.4](00-overview.md#84-soft-delete-only)).

### `briefing_materials`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `title` | text | |
| `body_html` | text | **Sanitised** HTML (allowlist: `p, br, strong, em, ul, ol, li, a[href]`). Links get `rel="noopener noreferrer" target="_blank"`. |
| `link_url` | text, nullable | `https://` only |
| `file_url`, `file_name`, `file_size` | text / text / integer, nullable | PDF via the storage adapter |
| `applies_to_all` | integer (bool) | |
| `is_active` | integer (bool) | |
| `updated_by` | text | FK `users.id` |
| `created_at`, `updated_at` | text | |

### `briefing_material_packages`

`material_id`, `package_id`. PK of both. Used only when `applies_to_all = 0`.

### `settings`

| Column | Type | Notes |
|---|---|---|
| `key` | text | PK |
| `value` | text (JSON) | |
| `updated_by` | text, nullable | FK `users.id` |
| `updated_at` | text | |

Read through `getSettings()`, which validates with zod and falls back to the defaults above for missing keys.

## 5. Business rules

1. **BR-04-1 — Active slots never overlap.** Saving a slot whose `[start, end)` intersects another **active** slot is rejected: "Jam slot bertumpuk dengan slot {label}." This guarantees a guide is in at most one tour at a time, given one assignment per guide per slot.
2. **BR-04-2 — Slot times are immutable once used.** `start_time` and `end_time` cannot change while future active bookings (`awaiting_payment` / `confirmed` / `ready`) reference the slot. Past bookings always display the slot's stored times.
3. **BR-04-3 — Deactivating a slot** is blocked while it has future active bookings (conflict list with links). Inactive slots disappear from availability checks and Papan Jadwal columns for future dates. Past dates still show them if bookings exist.
4. **BR-04-4 — Deactivating a language** is allowed at any time, with a warning dialog if future active bookings use it: "{n} pemesanan mendatang memakai bahasa ini dan tetap berjalan." It is then hidden from new booking forms and guide forms. Existing guide links and bookings keep it.
5. **BR-04-5 — Checklist copy timing.** The template is copied onto a booking **when it becomes `confirmed`** (Tandai Lunas, [`06`](06-pembayaran.md) / [`07`](07-persiapan.md)). Template edits never change checklists already copied. If a booking returns to `awaiting_payment` (payment undone) and is confirmed again, its existing checklist is kept and not re-copied.
6. **BR-04-6** There is exactly one `guide_ack` system item. It cannot be deleted, and seeding or migrations must ensure it exists.
7. **BR-04-7 — Briefing relevance.** A booking's briefing materials are the **active** materials where `applies_to_all = 1` or the booking's package is tagged. Guides see them on the tour detail ([`08`](08-portal-guide.md)), and staff see them on the booking detail ([`05`](05-pemesanan.md)). Deactivated materials disappear everywhere.
8. **BR-04-8 — Settings take effect for new events only.**
   - `hold_expiry_hours` is applied when a booking is created (stored as `bookings.hold_expires_at`), so changing it does not shorten or extend existing holds.
   - `notice_days` applies to notices generated after the change.
   - `feedback_link_days` is applied when the token is created.
   - `booking_horizon_days` and `low_rating_threshold` apply immediately.
9. **BR-04-9** Every save in this module writes `updated_by` / `updated_at`. There is no booking event, since these are not booking changes.
10. **BR-04-10** Uploaded PDFs are validated server-side (MIME `application/pdf`, ≤ 10 MB). Rich text is sanitised server-side on save. Client-side sanitising is not trusted.

## 6. Server actions / queries

| Action | Input | Roles | Notes |
|---|---|---|---|
| `listSlots` | includeInactive? | admin, staff (read, used by 05) | |
| `createSlot` / `updateSlot` / `setSlotActive` | startTime, endTime / id, isActive | admin | BR-04-1..3; blocked calls return `{ conflicts: BookingRef[] }` |
| `listLanguages` | includeInactive? | admin, staff, guide (read) | |
| `createLanguage` / `updateLanguage` / `setLanguageActive` | code, nameId, nameEn | admin | BR-04-4 |
| `listChecklistTemplate` | — | admin, staff (read) | |
| `createChecklistItem` / `updateChecklistItem` / `deleteChecklistItem` / `reorderChecklistItems` | label, description / ids[] | admin | BR-04-6 |
| `listBriefingMaterials` | packageId?, includeInactive? | admin; staff and guide via booking context only | |
| `createBriefingMaterial` / `updateBriefingMaterial` / `setBriefingMaterialActive` | fields, packageIds[], file? | admin | BR-04-10 |
| `getBriefingForBooking` | bookingId | admin, staff, guide (assigned only) | BR-04-7 |
| `getSettings` | — | (internal; admin for the form) | zod-validated with defaults |
| `updateSettings` | partial settings | admin | Range validation per §3.5 |

## 7. Notifications

None directly. The settings feed other modules: `payment_instructions_en` → the `booking_created` message, `notice_days` → H-2 notices, `low_rating_threshold` → the low-rating alert ([`09`](09-notifikasi.md)).

## 8. Edge cases

- **Admin adds a 19:00–21:00 slot:** allowed (no overlap with 16:00–19:00 since ranges are half-open).
- **Admin wants to shift 12:00–15:00 to 13:00–16:00 with bookings next week:** blocked by BR-04-2. Workflow: deactivate after those bookings pass, or reschedule them, then create the new slot. The caption explains this.
- **All slots inactive:** the availability check shows an empty state "Belum ada slot aktif. Hubungi admin." (staff) or a link to settings (admin).
- **Briefing material tagged only to a package that is later deactivated:** remains visible on that package's existing bookings, and is unused for new ones.
- **The admin clears `payment_instructions_en`:** the message is sent without the instructions paragraph, and the field shows a warning.

## 9. Out of scope

Slot capacity limits per day, different slot sets per weekday or season, per-language checklist templates, versioned briefing material, a translated (multi-language) briefing body, editable notification templates.

## 10. Acceptance criteria

1. **Given** active slots 09:00–12:00 and 12:00–15:00, **when** the admin adds 11:00–13:00, **then** it is rejected for overlap. Adding 19:00–21:00 succeeds.
2. **Given** slot 16:00–19:00 with one future `confirmed` booking, **when** the admin tries to change its end time or deactivate it, **then** both are blocked and the booking is listed.
3. **Given** slot 16:00–19:00 is deactivated (no bookings), **then** it no longer appears in availability checks for future dates.
4. **Given** the admin adds a manual checklist item "Siapkan kursi roda", **when** a booking is confirmed afterwards, **then** its checklist contains the new item. An already-confirmed booking does not.
5. **Given** the template, **when** the admin tries to delete "Guide sudah dikonfirmasi", **then** no delete action is available, and calling `deleteChecklistItem` on it returns an error.
6. **Given** a briefing material tagged to Premium only, **then** a guide assigned to a Premium booking sees it and a guide on a Reguler booking does not. A material set to "Semua paket" is seen by both.
7. **Given** `hold_expiry_hours` changed from 24 to 6, **then** a booking created before the change still expires 24 h after creation, and one created after expires after 6 h.
8. **Given** a briefing body containing `<script>` or an `onclick` attribute, **when** saved, **then** the stored HTML has them removed.
9. **Given** a staff user, **when** opening `/pengaturan`, **then** they are redirected (BR-01-5), while `listSlots` and `listLanguages` still work for their booking forms.
10. **Given** a language "Mandarin" (`zh`) is added and assigned to a guide, **then** it appears in the booking language selector and that guide shows as available for Mandarin bookings.
