# 05 — Pemesanan (Booking)

> Status: **Draft v1** · Last updated: 2026-10-25
> Depends on: [`00-overview.md`](00-overview.md) §7–8, [`02-tour-guide.md`](02-tour-guide.md), [`03-harga.md`](03-harga.md), [`04-pengaturan.md`](04-pengaturan.md)
> Used by: [`06`](06-pembayaran.md), [`07`](07-persiapan.md), [`08`](08-portal-guide.md), [`10`](10-ulasan.md), [`11`](11-beranda-laporan.md)

## 1. Purpose

The heart of the system. Staff record a tourist (**Pelanggan**), check **real-time availability** for a date, language, and group size, accept or adjust the **recommended guides**, and create a **booking** that holds the guides and slot until payment. This module also owns:

- the bookings list and booking detail;
- the **Papan Jadwal** (schedule board);
- the customer directory;
- **reschedule** and **cancellation**;
- the lazy **hold expiry**;
- the **Riwayat** (history) timeline.

Serves flow steps **1 (Inquiry, via channel)**, **2 (Cek Ketersediaan & Penjadwalan)**, **3 (Alokasi Tour Guide)**, and the "Detail Pemesanan" part of **4**. Addresses pain points 1, 3, 4, and 5.

## 2. User stories

- As **staff**, I want to type a tourist's WhatsApp number and have a returning customer filled in automatically, so that I don't retype data and I know they are a repeat visitor.
- As **staff**, I want to see which slots have enough guides speaking the tourist's language for their group size, across the next few days, so that I can offer alternatives on the phone.
- As **staff**, I want the system to suggest the fairest guides, and to override the suggestion, so that work is spread evenly but I stay in control.
- As **staff**, I want the booking to hold the guides and slot until the tourist pays, and to release them automatically if they don't.
- As **staff**, I want to see all bookings, filtered by what needs action, and open a booking to see everything about it, including who did what and when.
- As **staff**, I want to reschedule or cancel a booking with the price recalculated and the affected people notified.
- As **staff/admin**, I want a schedule board showing every guide's slots for a day, so that I can see the load at a glance and start a booking from an empty cell.
- As **staff**, I want a group needing two languages to become two linked bookings.

## 3. Screens

### 3.1 Bookings list: `/pemesanan` (admin, staff)

**Quick tabs** (URL `?view=`):

| Tab | Shows |
|---|---|
| "Mendatang" (default) | Status `awaiting_payment` / `confirmed` / `ready`, tour date ≥ today, sorted by date and slot |
| "Menunggu Pembayaran" | `awaiting_payment`, sorted by `hold_expires_at` (soonest first) |
| "Perlu Persiapan" | `confirmed` with an incomplete checklist and a tour within 7 days ([`07`](07-persiapan.md)) |
| "Hari Ini" | Tour date = today, any status |
| "Semua" | Everything, newest created first |

**Filters** (`FilterBar`): search (code, customer name, WhatsApp), "Status" (multi), "Tanggal tur" (range), "Kanal", "Bahasa", "Tour Guide", "Dibuat oleh".

**Desktop columns**:

| Column | Content |
|---|---|
| Kode | `TG-261025-004` (tabular), with "Terkait" icon if `group_ref` is set |
| Pelanggan | Name + nationality flag/country code, "Pelanggan kembali" icon |
| Jadwal | "Sab, 7 Nov 2026" + "09.00–12.00" |
| Bahasa · Orang | "EN · 12 orang" |
| Tour Guide | Display names (comma-separated, max 2 shown + "+1") |
| Total | `Rp 1.950.000` |
| Status | `StatusBadge`. Under `awaiting_payment`: caption "Kedaluwarsa dalam 3 j 20 m" (Senja 800 when < 2 h) |
| Kanal | Channel badge |

- Mobile: stacked cards (code + status top row; customer; date · slot; language · people · guides; total).
- Header action: "Buat Pemesanan" (primary; a floating button on mobile).
- Empty state: `carousel.svg`, "Belum ada pemesanan." + "Buat Pemesanan".

### 3.2 New booking wizard: `/pemesanan/baru` (admin, staff)

> **Diubah oleh 12:** with `PAYMENT_CONFIRMATION` off, the wizard ends on the splash "Pemesanan berhasil dibuat" ([`12` §3.4](12-perubahan-fase-2.md#34-wizard-end-splash-pemesanan-berhasil-dibuat-flag-off)), not the payment success panel.

Wizard pattern per [design-system §6.4](design-system.md#64-page-patterns). Steps: **1 Pelanggan → 2 Jadwal → 3 Tour Guide → 4 Ringkasan**. The sticky **"Ringkasan"** panel (desktop) / bottom bar (mobile) shows the live total once a package is chosen.

**Pre-fill** via query parameters (each optional):

- `date`, `slot`, `guide` (from Papan Jadwal)
- `people`, `package`, `addons` (from the Harga simulator)
- `customer`, `group` (linked booking)

Unknown or invalid values are ignored silently.

**Step 1 — "Pelanggan"**

| Field | Rules |
|---|---|
| "No. WhatsApp" * | `PhoneInput`, normalised to E.164. **Lookup on blur.** When it matches, a card appears: name, nationality, "Pelanggan kembali (×N)" (N = completed visits, BR-05-20), last visit date, button "Gunakan data ini" (fills the fields below). |
| "Nama" * | 2–80 characters |
| "Kewarganegaraan" * | Searchable country select (ISO 3166-1 alpha-2, Indonesian country names, flag) |
| "Email" | Optional, valid email |
| "Catatan pelanggan" | Optional, ≤ 500 characters. Persistent notes (e.g. "pengguna kursi roda", "halal") that carry to future bookings. |
| "Kanal" * | Segmented: "Sales" / "Call Center" / "On the Spot". Defaults to the user's `default_channel`. |

Editing an existing customer's fields here updates the customer record (with a caption: "Perubahan akan memperbarui data pelanggan").

**Step 2 — "Jadwal"**

| Field | Rules |
|---|---|
| "Bahasa" * | Segmented / select of active languages (name_id) |
| "Jumlah orang" * | Stepper, 1–200 |
| "Paket" * | Radio cards: name, "Rp 500.000 / guide · maks. 8 orang", included facilities. Below the cards: "Butuh {n} tour guide" for the current people count. |
| "Tanggal tur" * | Date picker: today … today + `booking_horizon_days`; holidays marked |
| **Ketersediaan 7 hari** | Strip of 7 days starting at the chosen date (as in the infographic: "Sen 12 · Sel 13 · Rab 14 …"). Each day shows the number of available slots ("2 slot") or "Penuh". Tapping a day selects it. |
| **"Slot"** * | `SlotChip` list for the chosen date (BR-05-3): available ("4 guide tersedia"), unavailable with reason, past slots hidden |
| "Add-on" | Checkboxes of active add-ons not included in the package, with price and unit |
| "Kebutuhan khusus tur" | Optional, ≤ 500 characters. Shown to the guides. Pre-filled from "Catatan pelanggan" if present. |

Availability refreshes automatically (debounced 300 ms) whenever language, people, package, or date changes. No separate button is needed; the explicit button "Cek Ketersediaan" exists only as a manual refresh. Skeleton chips appear while loading.

**Step 3 — "Tour Guide"**

- Header: "Pilih {n} tour guide · {k} tersedia untuk {slot}, {tanggal}, bahasa {Bahasa}".
- Ranked `GuideCard` list (BR-05-6). The top **n** are pre-selected and badged **"Rekomendasi"**.
- Staff can deselect and select others. The selection count must equal **n** exactly before continuing ("Pilih tepat {n} guide").
- A guide pre-filled from Papan Jadwal is pre-selected if eligible. Otherwise a warning says: "{nama} tidak tersedia untuk kriteria ini."

**Step 4 — "Ringkasan"**

- Read-only recap: customer, channel, date · slot, language, people, package, guides, add-ons, special needs, and the full `PriceSummary`.
- Info alert: "Slot dan guide akan ditahan sampai **{hold_expires_at}** ({x} jam). Pemesanan otomatis dibatalkan jika belum lunas." (BR-05-11).
- Optional "Catatan internal" (≤ 500 characters, never shown to guides or tourists).
- Button **"Buat Pemesanan"** (primary).

**On success**: redirect to the booking detail with toast "Pemesanan {code} dibuat". A dismissible success panel at the top offers:

- "Salin pesan untuk wisatawan" (copies the English `booking_created` message);
- "Buat pemesanan terkait (bahasa lain)": opens the wizard pre-filled with the same customer, date, and slot (language and people left blank), and `group` = this booking's `group_ref` (BR-05-17).

**Leaving the wizard** with data entered prompts "Tinggalkan halaman? Data yang belum disimpan akan hilang." The draft is kept in `sessionStorage` per tab and restored on reload.

### 3.3 Booking detail: `/pemesanan/[id]` (admin, staff)

> **Diubah oleh 12:** admin can merge bookings into a shared tour ("Gabungkan pemesanan", "Tur gabungan", "Pisahkan"), see [`12` §3.1](12-perubahan-fase-2.md#31-booking-detail-pemesananid-merge-admin-only).

Desktop: main column + right rail (360 px). Mobile: single column with a sticky header holding code, status, and a "Tindakan" (actions) menu.

**Header**: code, `StatusBadge`, channel badge, "di bawah H-2" badge if applicable ([`07`](07-persiapan.md)), and "Terkait: TG-…" chips for linked bookings. For `awaiting_payment`: countdown "Kedaluwarsa {relative} ({absolute})".

**Right rail** (desktop):

- `PriceSummary` from the snapshot, plus "Dibayar" and "Sisa" (balance) from [`06`](06-pembayaran.md).
- **Action buttons** (shown by status and permission, BR-05-12):

  | Action | Shown when |
  |---|---|
  | "Tandai Lunas" (primary) | `awaiting_payment` (06) |
  | "Jadwalkan Ulang" | `awaiting_payment` / `confirmed` / `ready` and slot not started |
  | "Tandai Selesai" / "Tidak Hadir" | `confirmed` / `ready` and slot started (BR-05-14) |
  | "Bagikan tautan ulasan" / "Isi ulasan" | `completed` ([`10`](10-ulasan.md)) |
  | "Batalkan Pemesanan" (danger-outline) | `awaiting_payment` / `confirmed` / `ready` and slot not ended |
  | "Batalkan Tandai Lunas" | Admin; `confirmed` / `ready`; slot not started (06) |

- **Riwayat** timeline (newest first).

**Main column sections**:

1. **Pelanggan**: name, nationality, WhatsApp (copy button + `wa.me` link), email, "Pelanggan kembali (×N)", customer notes, link to `/pelanggan/[id]`.
2. **Jadwal**: tour date (long), slot, language, people, package, guides needed.
3. **Tour Guide**: one card per assigned guide: name, languages, phone, and acknowledgement state ("Siap ✓ 25 Okt 14:20" / "Belum konfirmasi" / "Belum diberi tahu" while `awaiting_payment`).
4. **Add-on & Fasilitas**: from the snapshot, with "Termasuk paket" lines.
5. **Kebutuhan khusus tur** and **Catatan internal**: editable inline (pencil → textarea → "Simpan") in any non-terminal status.
6. **Pembayaran**: [`06`](06-pembayaran.md).
7. **Persiapan**: [`07`](07-persiapan.md) (visible from `confirmed` on).
8. **Materi Briefing**: relevant materials ([`04` BR-04-7](04-pengaturan.md)), collapsed by default.
9. **Ulasan**: [`10`](10-ulasan.md).
10. **Pesan**: notifications about this booking (time, recipient, channel, template), with the body expandable. Admin and staff can see them here; the global Outbox is admin-only.

On mobile, the rail's price summary sits after "Jadwal", and Riwayat is a collapsed section at the end.

### 3.4 Reschedule: "Jadwalkan Ulang" (full page `/pemesanan/[id]/ubah`)

Reuses wizard steps **2 → 3 → 4**, pre-filled with the current values. Language, people, package, add-ons, date, slot, and guides can all change. Customer and channel cannot (edit the customer in `/pelanggan`).

- Availability treats this booking's **own** current assignments as free (BR-05-4), so keeping the same slot and guides is always possible unless the people count increases.
- Step 3 keeps the current guides pre-selected when they are still eligible, then fills the remaining picks from the ranking.
- Step 4 shows a **comparison**: old vs new schedule, guides (added / kept / released), and price.
  - If the booking has payments: "Selisih harga: + Rp 100.000 (tagih ke wisatawan)" or "− Rp 50.000 (kembalikan ke wisatawan)", in the warning style.
  - Caption: "Catat penyesuaian di bagian Pembayaran setelah selisih diselesaikan." (06)
- Button **"Simpan Perubahan"**. Required field: "Alasan perubahan" (≤ 200 characters, stored in the event).

### 3.5 Cancel dialog: "Batalkan Pemesanan"

| Field | Rules |
|---|---|
| "Alasan pembatalan" * | Select: "Permintaan wisatawan" · "Wisatawan tidak membayar" · "Guide tidak tersedia" · "Cuaca / kondisi taman" · "Pemesanan ganda" · "Lainnya" (then "Keterangan" * ≤ 200 characters) |
| "Catatan refund" | Shown only if the booking has payments. Free text ≤ 300 characters. |
| "Jumlah dikembalikan" | Shown only if the booking has payments. Optional money input. If filled, it records a refund adjustment ([`06`](06-pembayaran.md)). |

Confirm button: "Ya, batalkan pemesanan" (danger). The system reason "Kedaluwarsa otomatis" is never selectable.

### 3.6 Papan Jadwal: `/jadwal` (admin, staff)

- Toolbar: "‹", "Hari ini", "›", date picker, "Bahasa" filter (dims guides not speaking it), toggle "Tampilkan guide nonaktif" (off).
- `ScheduleGrid` ([design-system §7.3](design-system.md#73-product-components)):
  - rows = active guides (+ inactive ones that have bookings that day);
  - columns = active slots (+ inactive slots that have bookings that day).
- Column header: slot label + "{booked}/{working} guide terisi" (booked = guides with active assignments; working = guides working that day).
- **Cells**:
  - **Free**: click opens `/pemesanan/baru?date=&slot=&guide=`.
  - **Booked**: status tint + code + customer's first name + people. `awaiting_payment` cells also show a clock icon. Click opens the booking.
  - **Cuti**, **Libur** (non-working day), **Lewat** (passed) as specified.
- Mobile: segmented slot selector + guide list, same cell semantics.
- Today's column header carries the glow line.

### 3.7 Customers: `/pelanggan` and `/pelanggan/[id]` (admin, staff)

**List**: "Nama", "Kewarganegaraan", "No. WhatsApp", "Kunjungan" (completed visits), "Kunjungan terakhir", "Pelanggan kembali" badge (N ≥ 2 total completed visits). Search by name or number; filter by nationality. There is no "create" button: customers are created via the booking wizard.

**Detail**: an editable profile (name, nationality, email, notes; WhatsApp is editable with a uniqueness check), consent status ("Bersedia dihubungi untuk penawaran" from feedback, [`10`](10-ulasan.md)), a table of the customer's bookings, and their ratings given.

## 4. Data model

### `customers`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `name` | text | not null |
| `phone_e164` | text | **unique**, not null |
| `nationality` | text | ISO 3166-1 alpha-2, not null |
| `email` | text, nullable | |
| `notes` | text, nullable | Persistent special needs |
| `marketing_consent` | integer (bool) | default 0; set from feedback |
| `marketing_consent_at` | text, nullable | |
| `created_at`, `updated_at` | text | |

### `bookings`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `code` | text | **unique**, `TG-YYMMDD-NNN` |
| `customer_id` | text | FK |
| `channel` | text enum | `sales` · `call_center` · `on_the_spot` |
| `created_by` | text | FK `users.id` |
| `language_id` | text | FK |
| `package_id` | text | FK |
| `slot_id` | text | FK |
| `slot_start`, `slot_end` | text `HH:mm` | **Copied** from the slot at create / reschedule |
| `tour_date` | text `YYYY-MM-DD` | WIB |
| `people` | integer | 1–200 |
| `guides_needed` | integer | From the snapshot |
| `status` | text enum | See [overview §7](00-overview.md#7-booking-lifecycle) |
| `price_snapshot` | text (JSON) | [`03` §4](03-harga.md#4-data-model) |
| `total_amount` | integer | = `price_snapshot.total` |
| `hold_expires_at` | text (ISO UTC), nullable | Set while `awaiting_payment` (BR-05-11) |
| `special_needs` | text, nullable | Shown to guides |
| `internal_notes` | text, nullable | Staff only |
| `group_ref` | text, nullable | Shared by linked bookings (= code of the first booking) |
| `cancel_reason` | text enum, nullable | `tourist_request` · `unpaid` · `guide_unavailable` · `weather` · `duplicate` · `other` · `expired` |
| `cancel_detail`, `refund_note` | text, nullable | |
| `cancelled_at`, `cancelled_by` | text, nullable | `cancelled_by` null = system |
| `completed_at`, `completed_by` | text, nullable | Also used for `no_show` |
| `created_at`, `updated_at` | text | |

Indexes: (`tour_date`, `slot_id`), (`status`, `hold_expires_at`), (`customer_id`), (`created_at`).

### `booking_guides`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `booking_id` | text | FK |
| `guide_id` | text | FK |
| `tour_date`, `slot_id` | text | Denormalised from the booking for the uniqueness guard |
| `assigned_at` | text | |
| `released_at` | text, nullable | Set when removed by reschedule, cancellation, or expiry |
| `notified_at` | text, nullable | First notice sent ([`07`](07-persiapan.md)) |
| `short_notice` | integer (bool) | "di bawah H-2" at notice time |
| `acknowledged_at` | text, nullable | "Saya siap" ([`08`](08-portal-guide.md)) |

**Double-booking guard**: `CREATE UNIQUE INDEX ux_guide_slot ON booking_guides(guide_id, tour_date, slot_id) WHERE released_at IS NULL;`

### `booking_addons`

`booking_id`, `addon_id`, `quantity`, `unit_price`, `amount`, `included` (bool). PK (`booking_id`, `addon_id`). Rewritten from the snapshot on every recalculation; used by reports.

### `booking_events`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `booking_id` | text | FK |
| `type` | text enum | [Overview §8.3](00-overview.md#83-audit-trail-booking_events) |
| `actor_user_id` | text, nullable | null = system |
| `payload` | text (JSON) | E.g. `{ "from": "awaiting_payment", "to": "confirmed" }`, `{ "reason": "…", "before": {…}, "after": {…} }` |
| `at` | text (ISO UTC) | |

Append-only: there is no update or delete code path.

## 5. Business rules

### Availability: `src/domain/availability.ts`

1. **BR-05-1 — Date window.** `today ≤ tour_date ≤ today + booking_horizon_days` (WIB). Dates outside the window are disabled in the picker and rejected server-side.
2. **BR-05-2 — Active assignment.** A `booking_guides` row is *active* when `released_at IS NULL` **and** its booking status is `awaiting_payment` (with `hold_expires_at > now`), `confirmed`, or `ready`. Lazy expiry (BR-05-11) runs before every availability computation.

    > **Diubah oleh 12:** in a merged group only the host booking holds active assignments ([BR-12-M1](12-perubahan-fase-2.md#5-business-rules)).
3. **BR-05-3 — Slot availability.** For a date, language L, and `guidesNeeded` n (from [BR-03-1](03-harga.md#5-business-rules)), each **active** slot S is evaluated as follows:
   - **Hidden** if `tour_date = today` and `S.start ≤ now` (WIB).
   - `eligible(S)` = guides that are *working* on the date ([BR-02-1](02-tour-guide.md#5-business-rules)), speak L, and have no active assignment on (date, S).
   - **Available** if `|eligible(S)| ≥ n`. Otherwise **unavailable**, with reason:
     - "Tidak ada guide berbahasa {L} yang bertugas" if |eligible| = 0 and no working L-speaker exists that day;
     - otherwise "Butuh {n} guide, tersedia {k}".
4. **BR-05-4 — Self-exclusion on edit.** When rescheduling booking B, B's own active assignments are treated as free.
5. **BR-05-5 — 7-day strip.** For each of the 7 days from the chosen date (clipped to the window), it shows the count of available slots under BR-05-3.

### Allocation: `src/domain/allocation.ts`

6. **BR-05-6 — Ranking.** Eligible guides for (date, S, L) are sorted by:
   1. **weekly load ascending**: the count of the guide's non-released assignments on bookings with status ∈ {`awaiting_payment`, `confirmed`, `ready`, `completed`, `evaluated`, `no_show`} whose `tour_date` falls in the **ISO week (Mon–Sun) of the requested date**;
   2. **average guide rating descending**, with unrated guides after rated ones;
   3. `display_name` ascending.

   The top n are pre-selected and badged "Rekomendasi". The card shows "Beban minggu ini: {x} tur" and "★ {rating}".
7. **BR-05-7** Staff must pick **exactly** n distinct eligible guides. Nothing is auto-assigned without the staff member pressing "Buat Pemesanan" / "Simpan Perubahan".

### Creation

8. **BR-05-8 — Customer upsert.** Match on `phone_e164`. If found, update name, nationality, email, and notes with the submitted values; otherwise insert.
9. **BR-05-9 — Atomic create.** In one transaction:
   1. Run lazy expiry.
   2. Re-validate the date window, slot availability, and every chosen guide's eligibility.
   3. Compute the price with `calculatePrice` ([`03`](03-harga.md)).
   4. Generate the code (BR-05-10).
   5. Insert the customer (upsert), booking, `booking_guides`, `booking_addons`, and the event `created` (+ `guide_assigned` per guide).
   6. Commit.

   A unique-index violation on `ux_guide_slot` aborts with: "{nama} baru saja dipesan untuk slot ini. Silakan pilih ulang guide." The wizard returns to step 3 with refreshed data.
10. **BR-05-10 — Booking code.** `TG-` + creation date in WIB as `YYMMDD` + `-` + a 3-digit daily sequence (001, 002, …), computed inside the transaction as `1 + count(bookings created that WIB day)`. On a unique collision, retry up to 3 times. Beyond 999 per day the sequence widens to 4 digits.
11. **BR-05-11 — Hold.** A new booking starts as `awaiting_payment` with `hold_expires_at = min(created_at + hold_expiry_hours, tour_date + slot_start in WIB)`. **Payment must happen before the tour starts.**

    **Lazy expiry**, `expireHolds(now)`, runs at the start of every booking list or detail query, availability check, Papan Jadwal, Beranda, guide portal query, and leave-approval check. In one transaction, for each booking with `status = awaiting_payment AND hold_expires_at ≤ now` it:
    - sets `status = cancelled`, `cancel_reason = expired`, `cancelled_at = now`, `cancelled_by = null`;
    - releases its guides;
    - appends `hold_expired`;
    - emits the `hold_expired` notifications.

    It must be idempotent and safe under concurrent calls: use a conditional `UPDATE … WHERE status = 'awaiting_payment'` and act only on the rows it changed.

    > **Diubah oleh 12:** with `PAYMENT_CONFIRMATION` off there is no hold: bookings start `confirmed` with a system payment ([BR-12-P3](12-perubahan-fase-2.md#5-business-rules)), and existing holds are confirmed instead of expired ([BR-12-P4](12-perubahan-fase-2.md#5-business-rules)).

### Status and actions

12. **BR-05-12 — Transitions** are validated centrally (`src/domain/booking-status.ts`), per the [overview state diagram](00-overview.md#7-booking-lifecycle). Any action requested from a status it doesn't allow fails with "Tindakan tidak tersedia untuk status {label}."
13. **BR-05-13 — Reschedule** is allowed in `awaiting_payment`, `confirmed`, and `ready`, before the current slot starts. In one transaction it:
    - re-runs BR-05-3 / BR-05-4 / BR-05-7;
    - recalculates the snapshot and `total_amount`;
    - updates `slot_start` / `slot_end`;
    - sets `released_at` on removed guides and inserts new `booking_guides` rows;
    - appends `rescheduled` (before / after / reason), plus `guide_released` / `guide_assigned`.

    `hold_expires_at` is **not** extended, but is capped to the new slot start if that is earlier. Effects on notices, acknowledgements, and the checklist are defined in [`07` BR-07-6](07-persiapan.md).

    > **Diubah oleh 12:** merged bookings: members are split first, the host allows guide-only changes ([BR-12-M9](12-perubahan-fase-2.md#5-business-rules)). With payment confirmation off, price differences become system adjustments ([BR-12-P5](12-perubahan-fase-2.md#5-business-rules)).
14. **BR-05-14 — Selesai / Tidak Hadir** are allowed from `confirmed` or `ready` once `now ≥ tour_date + slot_start` (WIB), by assigned guides ([`08`](08-portal-guide.md)), staff, or admin. They set `completed_at` / `completed_by` and append `status_changed`. `completed` triggers the feedback request ([`10`](10-ulasan.md)).
15. **BR-05-15 — Cancel** is allowed from `awaiting_payment`, `confirmed`, or `ready` until the slot ends. It:
    - sets the cancel fields;
    - releases all guides;
    - records an optional refund adjustment (06);
    - appends `cancelled`;
    - notifies the tourist and any guide with `notified_at` set.

    > **Diubah oleh 12:** cancelling a merged booking leaves the group or hands the guides to the next host ([BR-12-M9](12-perubahan-fase-2.md#5-business-rules)). With payment confirmation off there is no refund input ([BR-12-P6](12-perubahan-fase-2.md#5-business-rules)).
16. **BR-05-16 — Inline edits** (`special_needs`, `internal_notes`) are allowed in any non-terminal status. Each save appends a `notes_updated` event with the before and after text.
17. **BR-05-17 — Linked bookings.** "Buat pemesanan terkait" sets `group_ref` on the new booking to the source booking's `group_ref`, or its `code` if empty (also written back to the source). Linked bookings are independent in status, payment, and guides. They only display each other as "Terkait".
18. **BR-05-18 — One language per booking.** Guides on a booking must all speak `language_id` (BR-05-3 guarantees this; it is re-checked on save).
19. **BR-05-19 — Visibility.** Admin and staff see all bookings. Guides access bookings only through the portal, scoped to their own assignments ([`08`](08-portal-guide.md)).
20. **BR-05-20 — Visit count.** N = the customer's bookings with status `completed` or `evaluated`. The wizard badge "Pelanggan kembali (×N)" appears when N ≥ 1 (the customer has visited before). The customer list badge appears when N ≥ 2.

## 6. Server actions / queries

All actions here are admin + staff unless noted. Every action calls `requireRole` and, where it reads bookings, `expireHolds` first.

| Action | Input | Output / side effects |
|---|---|---|
| `findCustomerByPhone` | phone | Customer + visit count, or null |
| `checkAvailability` | date, languageId, people, packageId, excludeBookingId? | `{ guidesNeeded, slots: [{ slotId, label, available, eligibleCount, reason? }] }` |
| `checkAvailabilityRange` | startDate, days (≤ 7), languageId, people, packageId | `[{ date, availableSlots }]` |
| `rankGuides` | date, slotId, languageId, excludeBookingId? | `GuideCandidate[]` (load, rating, recommended flag) |
| `quotePrice` | date, people, packageId, addonIds[] | `PriceSnapshot` (via 03) |
| `createBooking` | customer{…}, channel, languageId, people, packageId, date, slotId, guideIds[], addonIds[], specialNeeds?, internalNotes?, groupRef? | Booking. Events `created`, `guide_assigned`. Notification `booking_created`. |
| `rescheduleBooking` | id, (same scheduling fields), reason | Booking + price diff. Events. Notifications `booking_rescheduled`, `guide_released` / `guide_assigned` (per 07). |
| `cancelBooking` | id, reason, detail?, refundNote?, refundAmount? | Events. Notification `booking_cancelled`. |
| `completeBooking` | id, outcome (`completed` / `no_show`) | Admin, staff, guide (assigned). Event. `completed` → [`10`](10-ulasan.md) feedback request. |
| `updateBookingNotes` | id, specialNeeds?, internalNotes? | Event `notes_updated` |
| `listBookings` | view, filters, page | Paged list |
| `getBooking` | id | Full detail incl. events, payments, checklist, notifications |
| `getScheduleBoard` | date, languageId? | Grid data |
| `listCustomers` / `getCustomer` / `updateCustomer` | … | Phone uniqueness on update |
| `expireHolds` | now | (internal) |

## 7. Notifications

Templates are in [`09-notifikasi.md`](09-notifikasi.md).

| Event key | To | Channel | When |
|---|---|---|---|
| `booking_created` | Tourist | whatsapp_mock (EN) | Booking created. Includes details, total, hold deadline, `payment_instructions_en`. |
| `booking_rescheduled` | Tourist; kept guides already notified | whatsapp_mock; in-app | Reschedule saved |
| `guide_released` | Released guides with `notified_at` set | in-app | Reschedule / cancel |
| `booking_cancelled` | Tourist; guides with `notified_at` set | whatsapp_mock; in-app | Cancelled by staff |
| `hold_expired` | Tourist; the creating staff user | whatsapp_mock; in-app | Lazy expiry |

Guides are **not** notified while a booking is `awaiting_payment`. Their first notice comes at confirmation ([`07`](07-persiapan.md)).

## 8. Edge cases

| Case | Expected |
|---|---|
| Two staff book the last Arabic guide for the same slot simultaneously | One succeeds; the other gets the BR-05-9 conflict message and returns to step 3 |
| 17 people, Reguler (max 8) → 3 guides, only 2 Arabic speakers work that day | Slot unavailable: "Butuh 3 guide, tersedia 2"; the 7-day strip suggests other days |
| Same-day booking at 11:40 for slot 12:00 | Allowed; hold expires at 12:00 (BR-05-11) |
| A tourist wants English for 6 and Russian for 4 | Two bookings with the same `group_ref` |
| Reschedule of a `confirmed` booking to a Saturday | Price recalculated (+ weekend); a positive difference is shown; staff record an adjustment in 06 |
| Reschedule that only changes add-ons | Guides and acknowledgements unchanged; price diff shown |
| Booking increased from 8 to 9 people | Needs a second guide; step 3 keeps the current guide and asks for one more |
| A hold expires while staff are on the "Tandai Lunas" dialog | Confirm fails: "Pemesanan sudah kedaluwarsa" ([`06`](06-pembayaran.md)) |
| Customer changes WhatsApp number | Edit on `/pelanggan/[id]`; if the new number exists → "Nomor ini sudah terdaftar atas nama {nama}" (merging customers is out of scope) |
| Package deactivated after booking | Detail still shows it from the snapshot; reschedule keeps it selectable for this booking only |

## 9. Out of scope

Tourist self-booking, waitlists, partial guide allocation, recurring bookings, merging duplicate customers, per-slot capacity other than guide count, meeting-point management, overbooking.

## 10. Acceptance criteria

1. **Given** 8 active guides (3 speak Arabic, all work Saturday, none booked), **when** checking Saturday, Arabic, 12 people, Reguler, **then** every slot shows available with "3 guide tersedia" and `guidesNeeded = 2`.
2. **Given** the same, but 2 Arabic guides already hold 09:00–12:00, **then** 09:00–12:00 shows "Butuh 2 guide, tersedia 1" and the other slots are available.
3. **Given** today at 12:30 WIB, **then** the slots 09:00–12:00 and 12:00–15:00 are hidden for today.
4. **Given** guides A (2 tours this week, ★4.9), B (0 tours, ★4.5), C (0 tours, unrated), **then** the ranking is B, C, A.
5. **Given** a completed wizard, **when** "Buat Pemesanan" is clicked, **then** a booking `TG-YYMMDD-NNN` exists with status Menunggu Pembayaran, `hold_expires_at` = creation + 24 h, guides held (they disappear from availability for that slot), a `booking_created` WhatsApp mock in the outbox, and events `created` + `guide_assigned`.
6. **Given** an `awaiting_payment` booking whose hold time has passed, **when** anyone opens the bookings list, **then** it is Dibatalkan with reason "Kedaluwarsa otomatis", its guides are available again, and `hold_expired` notifications exist exactly once.
7. **Given** two concurrent `createBooking` calls for the same guide, date, and slot, **then** exactly one succeeds.
8. **Given** a returning customer's number, **when** typed in step 1, **then** their data is offered with "Pelanggan kembali (×N)".
9. **Given** a `confirmed` weekday booking (Rp 1.000.000, paid), **when** rescheduled to Saturday, **then** the new total is Rp 1.200.000, the detail shows "Selisih harga: + Rp 200.000", and event `rescheduled` stores before and after.
10. **Given** a `confirmed` booking whose slot started 10 minutes ago, **then** "Tandai Selesai" and "Tidak Hadir" are available and "Jadwalkan Ulang" is not.
11. **Given** a `ready` booking, **when** cancelled with "Permintaan wisatawan", refund note, and refund Rp 500.000, **then** the status is Dibatalkan, guides are released and notified, and a −Rp 500.000 adjustment is recorded.
12. **Given** Papan Jadwal for a date, **when** a free cell (guide Rina, 12:00–15:00) is clicked, **then** the wizard opens with that date and slot, and Rina is pre-selected if she is eligible for the chosen language.
13. **Given** a booking, **when** "Buat pemesanan terkait" is used, **then** both bookings share `group_ref` and show each other as "Terkait".
14. **Given** a guide user, **when** calling `getBooking` for a booking they are not assigned to, **then** 403.
