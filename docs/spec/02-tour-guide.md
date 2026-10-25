# 02 — Tour Guide

> Status: **Draft v1** · Last updated: 2026-10-25 · Depends on: [`01-auth-pengguna.md`](01-auth-pengguna.md), [`04-pengaturan.md`](04-pengaturan.md) (languages)

## 1. Purpose

Maintains the guides who can be allocated to bookings: their profile, the **languages** they speak, their **working days**, and their **leave** (cuti). Together with existing bookings, these are the inputs to the real-time availability check and the allocation ranking in [`05-pemesanan.md`](05-pemesanan.md).

Serves flow steps **2 (Cek Ketersediaan)** and **3 (Alokasi Tour Guide)**, and pain points 1 (real-time availability of the 8 guides) and 3 (scheduling by language).

## 2. User stories

- As an **admin**, I want to add a guide with their languages, working days, and login in one step, so that they are immediately bookable and can use the portal.
- As an **admin**, I want to change a guide's languages or working days, and be warned if this conflicts with upcoming tours.
- As an **admin**, I want to approve or reject leave requests, and to add leave directly (e.g. sick leave), so that availability stays accurate.
- As a **guide**, I want to request leave from my phone, so that I am not booked on days I can't work (the request screen is in [`08-portal-guide.md`](08-portal-guide.md)).
- As a **staff** member, I want to see each guide's languages, schedule, and upcoming leave, so that I can answer tourists confidently.
- As an **admin**, I want to deactivate a guide who has left without losing their tour history.

## 3. Screens

### 3.1 Guide list: `/tour-guide` (admin edit, staff view)

Desktop table / mobile cards:

| Column | Content |
|---|---|
| Tour Guide | Avatar (photo or initials on Danau 100) + "Nama panggilan" + full name (caption) |
| Bahasa | Language pills (EN · AR · RU) |
| Hari kerja | Seven day dots "S S R K J S M" (Senin … Minggu), filled = working |
| Cuti mendatang | Next approved leave ("12–14 Nov") or "—"; a pending request shows the badge "Cuti: Menunggu" |
| Rating | ★ 4.7 (32), or "Belum ada" |
| Tur 30 hari | Count of completed and evaluated tours in the last 30 days |
| Status | "Aktif" / badge "Nonaktif" |

- Filters: search name, "Bahasa", "Status" (default: Aktif).
- Header actions (admin): "Tambah Tour Guide" (primary), "Permintaan Cuti" (secondary, with a count badge of pending requests).
- Row click → guide detail.
- Empty state (filter returns nothing): `bird-perched.svg`, "Tidak ada tour guide yang cocok dengan filter."

### 3.2 Guide detail: `/tour-guide/[id]` (admin edit, staff view)

Desktop: two columns. Mobile: stacked sections.

- **Header**: avatar, names, status badge, WhatsApp number (tap to copy), and admin actions "Ubah", "Tambah Cuti", "Nonaktifkan"/"Aktifkan".
- **Kemampuan Bahasa**: language pills.
- **Hari Kerja**: 7-day row.
- **Jadwal Mendatang**: the next 14 days of assignments (date, slot, booking code, status badge, people), linked to the booking.
- **Cuti**: upcoming and past leave with status badges. Admins see "Batalkan" on approved future leave.
- **Kinerja** (performance): average guide rating, number of ratings, tours in the last 30/90 days, no-shows (Tidak Hadir) in the last 90 days.
- **Catatan**: free-text internal notes.

### 3.3 Create / edit guide: `/tour-guide/baru`, `/tour-guide/[id]/ubah` (admin)

One form with four sections (desktop two-column grid; mobile single column, sticky "Simpan" bar):

| Section | Field | Rules |
|---|---|---|
| Profil | "Nama lengkap" * | 2–80 characters |
| | "Nama panggilan" * | 2–30 characters. Shown on cards, the schedule, and tourist messages ("Your guide: Rina"). |
| | "No. WhatsApp" * | `PhoneInput`, E.164, unique among guides |
| | "Foto" | Image ≤ 2 MB (JPEG/PNG/WebP), cropped square, stored via the storage adapter |
| | "Catatan" | Optional, ≤ 1 000 characters |
| Bahasa | "Bahasa yang dikuasai" * | Multi-select checkboxes of **active** languages, at least one |
| Hari Kerja | "Hari kerja" * | 7 toggles (Senin … Minggu), at least one. Default for new guides: all seven. |
| Akun Portal | "Email login" * | Unique across `users` |
| | "Kata sandi awal" * | Create only; same rules and one-time display as [`01` §3.3](01-auth-pengguna.md#33-create--edit-user-penggunabaru-penggunaid-admin) |

- Buttons: "Simpan" (primary), "Batal".
- On edit, if changing languages or working days would remove the guide from upcoming assignments (BR-02-5, BR-02-6), saving is blocked. A conflict dialog lists the affected bookings: "Perubahan ini bentrok dengan {n} tur mendatang. Jadwalkan ulang atau ganti guide terlebih dahulu." Each booking links to the booking with its "Jadwalkan Ulang" action open.

### 3.4 Leave requests: `/tour-guide/cuti` (admin)

Tabs: **"Menunggu"** (pending, oldest first) · **"Riwayat"** (approved / rejected / cancelled, newest first).

Each request card shows the guide, dates ("Sen, 10 Nov – Rab, 12 Nov 2026 · 3 hari"), reason, the time it was submitted, and the number of conflicting assignments if any. Actions:

- **"Setujui"** (primary). If there are conflicts, the button is disabled and a conflict list is shown, with links to reschedule or replace the guide on each booking first.
- **"Tolak"** (danger-outline) opens a dialog asking for "Alasan penolakan" (required, ≤ 300 characters).

Empty state "Menunggu": `leaves.svg`, "Tidak ada permintaan cuti yang menunggu."

### 3.5 Add leave (admin): dialog "Tambah Cuti" from the guide detail

Fields: "Tanggal mulai" *, "Tanggal selesai" *, "Alasan" *. It is created as **approved** immediately, subject to the same conflict check as approval.

## 4. Data model

### `guides`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `user_id` | text | FK `users.id`, unique, not null (a role-`guide` user) |
| `full_name` | text | not null |
| `display_name` | text | not null |
| `phone_e164` | text | not null, unique |
| `photo_url` | text, nullable | Storage URL |
| `notes` | text, nullable | |
| `is_active` | integer (bool) | default 1, kept in sync with `users.is_active` |
| `created_at`, `updated_at` | text | |

### `guide_languages`

`guide_id` (FK), `language_id` (FK `languages.id`). PK (`guide_id`, `language_id`).

### `guide_working_days`

`guide_id` (FK), `weekday` integer **1–7 (ISO: 1 = Senin … 7 = Minggu)**. PK (`guide_id`, `weekday`).

### `guide_leaves`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `guide_id` | text | FK |
| `start_date`, `end_date` | text `YYYY-MM-DD` | inclusive, `start_date ≤ end_date` |
| `reason` | text | not null, ≤ 300 characters |
| `status` | text enum | `pending` · `approved` · `rejected` · `cancelled` |
| `requested_by` | text | FK `users.id` (the guide, or the admin for direct leave) |
| `decided_by` | text, nullable | FK `users.id` |
| `decided_at` | text, nullable | ISO UTC |
| `decision_note` | text, nullable | Required when `rejected` |
| `created_at`, `updated_at` | text | |

Index: (`guide_id`, `status`, `start_date`).

## 5. Business rules

1. **BR-02-1 — Availability inputs.** On a given `date`, a guide is **working** when all of these hold:
   - `is_active = 1`;
   - the ISO weekday of `date` is in `guide_working_days`;
   - no `approved` leave covers `date`.

   `pending`, `rejected`, and `cancelled` leave do **not** affect availability. The full availability predicate, which adds language and existing assignments, is defined in [`05-pemesanan.md`](05-pemesanan.md) and implemented in `src/domain/availability.ts`.
2. **BR-02-2** An active guide must have at least one language and at least one working day.
3. **BR-02-3 — Create.** Creating a guide also creates its `users` row (role `guide`, same name) in **one transaction**. Renaming the guide (`full_name`) updates `users.name`.
4. **BR-02-4 — Deactivate.** Allowed only if the guide has **no future active assignments**: a `booking_guides` row on a booking with status `awaiting_payment`, `confirmed`, or `ready` whose date + slot start is in the future. Otherwise it is blocked with the conflict list. Deactivation also deactivates the linked user (their portal login stops working), and reactivation reactivates both.
5. **BR-02-5 — Removing a language** is blocked while the guide has future active assignments **in that language**.
6. **BR-02-6 — Removing a working day** is blocked while the guide has future active assignments **on that weekday**.
7. **BR-02-7 — Leave validity.**
   - `start_date ≥ today` (WIB) for guide requests.
   - Admins may add leave starting today or later; backdating is not allowed.
   - A single request covers at most **30 days**.
   - A request must not overlap the guide's own `pending` or `approved` leave ("Tanggal cuti bertumpuk dengan cuti lain.").
8. **BR-02-8 — Approval invariant.** **Approved leave never overlaps an active assignment.** Approving, or adding leave directly, is rejected while any `awaiting_payment` / `confirmed` / `ready` booking assigns this guide on a date within the range. The admin must first reschedule those bookings or replace the guide.
9. **BR-02-9 — Cancelling leave.**
   - A guide may cancel their own `pending` request.
   - An admin may cancel `approved` leave whose `end_date ≥ today`. If it is ongoing, it is shortened rather than cancelled: `end_date` = yesterday, or cancelled outright if it started today.
   - Cancelled leave stops blocking availability immediately.
10. **BR-02-10 — Rating shown.** The average of the guide's own `feedback_guide_ratings.rating` across all submitted feedback, with the count in brackets. Feedback is defined in [`10-ulasan.md`](10-ulasan.md). If there are no ratings yet, "Belum ada" is shown.
11. **BR-02-11** Guides are never hard-deleted (§8.4 of the overview).
12. **BR-02-12** Staff can view everything in this module, including "Catatan" (it is an internal tool), but see no edit, leave-decision, or deactivation actions.

## 6. Server actions / queries

| Action | Input | Roles | Side effects |
|---|---|---|---|
| `listGuides` | search?, languageId?, status? | admin, staff | — |
| `getGuide` | id | admin, staff | — |
| `createGuide` | profile, languageIds[], weekdays[], email, password | admin | Creates `users` + `guides` (transaction) |
| `updateGuide` | id, profile, languageIds[], weekdays[] | admin | Conflict check BR-02-5/6. Returns `{ conflicts: BookingRef[] }` when blocked. |
| `setGuideActive` | id, isActive | admin | BR-02-4; syncs `users.is_active` |
| `uploadGuidePhoto` | id, file | admin | Storage adapter |
| `listLeaves` | status?, guideId?, range? | admin (all), guide (own, via 08) | Lazy hold expiry runs first (see 05) so conflicts are accurate |
| `requestLeave` | startDate, endDate, reason | guide (own) | Notification `leave_requested` → all active admins |
| `createLeaveByAdmin` | guideId, startDate, endDate, reason | admin | Approved immediately (BR-02-8); notification `leave_added_by_admin` → guide |
| `approveLeave` | leaveId | admin | BR-02-8; notification `leave_decided` → guide |
| `rejectLeave` | leaveId, note | admin | Notification `leave_decided` → guide |
| `cancelLeave` | leaveId | guide (own pending) / admin (approved) | BR-02-9 |
| `getGuideWeekLoad` | guideId, date | (internal) | Used by allocation ranking in 05 |

## 7. Notifications

Templates are defined in [`09-notifikasi.md`](09-notifikasi.md).

| Event key | To | Channel |
|---|---|---|
| `leave_requested` | All active admins | in-app |
| `leave_decided` (approved / rejected, with note) | The guide | in-app |
| `leave_added_by_admin` | The guide | in-app |
| `leave_cancelled_by_admin` | The guide | in-app |

## 8. Edge cases

- **Overlapping assignments created while a request is pending:** the request stays pending. At approval time the conflict check runs and blocks approval until the bookings are resolved.
- **A hold expires while viewing a conflict list:** lazy expiry runs before the check, so an expired hold no longer blocks.
- **The last guide speaking a language is deactivated:** allowed (no future assignments). That language simply shows no availability in 05.
- **A guide speaks a language that is later deactivated:** the link remains. Inactive languages are hidden from booking forms but still shown greyed out on the guide profile.
- **A WhatsApp number is reused by another guide:** field error "Nomor WhatsApp sudah dipakai tour guide lain."

## 9. Out of scope

Availability by slot (part-day schedules), skills other than language, guide certification documents, payroll, an approval chain beyond one admin, public guide profiles.

## 10. Acceptance criteria

1. **Given** the create form filled with English + Arabic, Senin–Jumat, email and password, **when** saved, **then** a guide and a role-`guide` user exist, and the guide appears as available on a Monday for Arabic bookings.
2. **Given** a guide whose working days are Senin–Jumat, **when** availability is checked for a Saturday, **then** that guide is not available.
3. **Given** a guide with a **pending** leave on 12 Nov, **when** availability is checked for 12 Nov, **then** the guide is available.
4. **Given** a guide with an **approved** leave 12–14 Nov, **when** availability is checked for 13 Nov, **then** the guide is not available.
5. **Given** a pending leave 12–14 Nov and a `confirmed` booking assigning that guide on 13 Nov, **when** the admin clicks "Setujui", **then** approval is blocked and the booking is listed as a conflict.
6. **Given** the same leave, **when** the booking is rescheduled to another guide and the admin approves, **then** the leave becomes `approved` and the guide receives a `leave_decided` notification.
7. **Given** a guide with a future `ready` booking in Russian, **when** the admin removes Russian from their languages, **then** saving is blocked with a conflict dialog listing that booking.
8. **Given** a guide with no future active assignments, **when** deactivated, **then** the guide disappears from availability and their portal login fails.
9. **Given** a guide with a future `awaiting_payment` booking, **when** the admin tries to deactivate them, **then** it is blocked, unless that hold has already expired (lazy expiry), in which case deactivation succeeds.
10. **Given** a guide request where `end_date − start_date + 1 > 30`, **then** it is rejected with "Maksimal 30 hari per permintaan cuti."
11. **Given** a staff user, **when** viewing `/tour-guide/[id]`, **then** no edit, leave, or deactivate actions are shown, and calling `approveLeave` returns 403.
