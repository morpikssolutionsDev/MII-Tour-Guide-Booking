# 08 — Portal Guide (Guide Portal)

> Status: **Draft v1** · Last updated: 2026-10-25 · Depends on: [`01`](01-auth-pengguna.md), [`02`](02-tour-guide.md), [`04`](04-pengaturan.md), [`05`](05-pemesanan.md), [`07`](07-persiapan.md) · Used by: [`10`](10-ulasan.md)

## 1. Purpose

A **mobile-first** portal where each guide sees only their own work:

- today's tours and upcoming schedule;
- full tour details with briefing material;
- the "Saya siap" acknowledgement;
- marking a tour as finished or a no-show;
- sharing the tourist feedback link (with a QR code);
- requesting leave.

It keeps guides in the loop without phone calls and is the guide's side of cross-team coordination.

Serves flow steps **5 (Persiapan: guide notified, briefing)**, **6 (Pelaksanaan Tour)**, and the start of **7 (feedback)**.

## 2. User stories

- As a **guide**, I want to open the app and immediately see today's tours and anything I still need to confirm.
- As a **guide**, I want each tour's details (tourists, language, group size, special needs, facilities, co-guides, briefing), so that I arrive prepared.
- As a **guide**, I want to tap "Saya siap" on a new assignment, so that operations know I've seen it.
- As a **guide**, I want to mark the tour Selesai (or Tidak Hadir if the tourists never came), then show the tourist a QR code for feedback.
- As a **guide**, I want to request leave and see whether it was approved.
- As a **guide**, I want to change my password.

## 3. Screens

App shell per [design-system §6.3](design-system.md#63-app-shell-guide-portal-mobile-first):

- top bar: logo mark, title, `NotificationBell`, avatar;
- **bottom tabs**: "Hari Ini" · "Jadwal" · "Cuti" · "Akun";
- on desktop, a centred 560 px column with top tabs;
- body text `body-lg`, tap targets ≥ 48 px.

### 3.1 "Hari Ini": `/portal` (default)

1. **Greeting**: "Selamat pagi, {nama panggilan}" + the long date.
2. **"Perlu konfirmasi"** (shown only if any exist): upcoming assignments without `acknowledged_at`, soonest first. Compact cards: date, slot, code, language · people, "di bawah H-2" badge if short. Each card has an inline **"Saya siap"** button (primary, small) and taps through to the detail.
3. **"Tur hari ini"**: `TourCard` list in slot order. The next or ongoing tour gets the **glow line** on top. Each card shows:
   - the slot time ("09.00–12.00") in `h2`;
   - customer name + nationality flag;
   - language pill, "{n} orang", package name;
   - a co-guides line ("Bersama: Dimas");
   - a state chip: "Belum konfirmasi" (warning) / "Siap" / "Berlangsung" (between slot start and end) / "Selesai" / "Tidak Hadir";
   - a contextual primary action: "Saya siap" (before start, unacknowledged) or "Tandai Selesai" (after start).
4. **Empty state** for today: `bird-perched.svg`, "Tidak ada tur hari ini." + the next tour's date if any ("Tur berikutnya: Sab, 7 Nov · 09.00").

### 3.2 "Jadwal": `/portal/jadwal`

Segmented control: **"Mendatang"** · **"Kalender"** · **"Riwayat"**.

- **Mendatang**: tours from tomorrow up to the booking horizon, grouped by date headers ("Sabtu, 7 Nov 2026"), as `TourCard`s. It also shows approved leave days as a Batu-tinted row "Cuti".
- **Kalender**: month view. Days with tours show a dot (Danau 600; two dots for 2+ tours), and leave days are tinted Batu 100. Tapping a day lists its tours below the calendar.
- **Riwayat**: the last 90 days of `completed` / `evaluated` / `no_show` / `cancelled` tours, newest first, with status badges. Evaluated tours show the guide rating received ("★ 5").

### 3.3 Tour detail: `/portal/tur/[bookingId]`

| Section | Content |
|---|---|
| Header | Long date, slot, `StatusBadge`, code, "di bawah H-2" badge |
| **Wisatawan** | Customer name, nationality (flag + country), "{n} orang", language, WhatsApp with a "Chat WhatsApp" link (`https://wa.me/{number}`, opens externally) |
| **Kebutuhan khusus** | `special_needs` (if any), highlighted in an info alert |
| **Paket & fasilitas** | Package name, the included facilities list, add-ons by name only ("Fast Track (Angling)", "Dokumentasi foto"). **No prices.** |
| **Tim** | Co-guides: name, phone, acknowledgement state |
| **Materi Briefing** | Relevant materials ([BR-04-7](04-pengaturan.md#5-business-rules)): title, expandable body (sanitised HTML), "Buka tautan", "Buka PDF" |
| **Ulasan** | After completion: the feedback state from [`10`](10-ulasan.md) |

Sticky bottom action bar (one primary action at a time):

| Booking state | Actions |
|---|---|
| `confirmed` / `ready`, before slot start, not acknowledged | **"Saya siap"** |
| `confirmed` / `ready`, before slot start, acknowledged | Disabled chip "Anda sudah siap ✓" |
| `confirmed` / `ready`, after slot start | **"Tandai Selesai"** + secondary "Tidak Hadir" (both open confirm dialogs, BR-08-5) |
| `completed`, feedback not submitted | **"Bagikan Ulasan"** (opens the share sheet) + secondary "Isi untuk wisatawan" ([`10`](10-ulasan.md) fallback) |
| `evaluated` | Read-only rating summary |
| `cancelled` (and the guide had been notified) | Info alert "Tur ini dibatalkan pada {tanggal}." No actions. |

**Confirm dialogs**:

- "Tandai tur {code} selesai?" → "Ya, selesai".
- "Tandai wisatawan tidak hadir?" with an optional "Catatan" (≤ 200 characters) → "Ya, tidak hadir".

**Share sheet "Bagikan Ulasan"**:

- a large **QR code** of the feedback URL (`/ulasan/{token}`) for the tourist to scan on the spot;
- the URL with a "Salin tautan" button;
- "Kirim via WhatsApp", which opens `wa.me/{tourist}?text=` with the English message from template `feedback_request`;
- caption: "Tautan berlaku sampai {expires_at}".

### 3.4 "Cuti": `/portal/cuti`

- Button **"Ajukan Cuti"** (primary, top).
- A list of own leave requests, newest first. Each card shows the dates ("Sen, 10 – Rab, 12 Nov · 3 hari"), the reason, a status badge ("Menunggu" / "Disetujui" / "Ditolak" / "Dibatalkan"), and the admin's note when rejected.
- Pending requests have a "Batalkan permintaan" action (danger-outline, with confirmation).
- Empty state: `leaves.svg`, "Belum ada permintaan cuti."

**"Ajukan Cuti" form** (full-screen sheet):

| Field | Rules |
|---|---|
| "Tanggal mulai" * / "Tanggal selesai" * | Date pickers ([BR-02-7](02-tour-guide.md#5-business-rules): from today, max 30 days, no overlap with own pending or approved leave) |
| "Alasan" * | ≤ 300 characters |
| Conflict hint | If the range overlaps the guide's own upcoming tours, a warning lists them: "Anda memiliki {n} tur pada tanggal ini. Admin perlu mengatur ulang tur tersebut sebelum menyetujui cuti." Submission is still allowed. |

Button: "Kirim Permintaan". Toast: "Permintaan cuti terkirim. Menunggu persetujuan admin."

### 3.5 "Akun": `/portal/akun`

- Read-only profile: photo, full and display name, WhatsApp, languages, working days.
- "Ubah kata sandi" form ([`01` §3.5](01-auth-pengguna.md#35-my-account-akun-admin-staff-and-the-akun-tab-in-portal-guide)).
- "Keluar".
- Caption: "Perubahan data profil? Hubungi admin."

### 3.6 Notifications

`NotificationBell` in the top bar. On mobile, tapping it opens a full-screen list. Tapping a notification marks it read and deep-links:

| Notification | Opens |
|---|---|
| `guide_assigned`, `booking_rescheduled` | `/portal/tur/{bookingId}` |
| `leave_decided`, `leave_added_by_admin`, `leave_cancelled_by_admin` | `/portal/cuti` |
| `guide_released`, `booking_cancelled` | `/portal/jadwal?view=riwayat` |

## 4. Data model

No tables of its own. It reads `bookings`, `booking_guides`, `customers`, `booking_checklist_items` (not shown), `briefing_materials`, `guide_leaves`, `notifications`, and `feedback`. Writes go through actions owned by other modules: `acknowledgeAssignment` (07), `completeBooking` (05), `requestLeave` / `cancelLeave` (02), `submitFeedbackByStaff` (10), `changeOwnPassword` (01).

Portal queries return a **dedicated DTO** (`GuideTourView`) that structurally excludes prices, payments, internal notes, channel, and `created_by`. Never reuse the staff `getBooking` payload.

## 5. Business rules

1. **BR-08-1 — Scope.** Every portal query filters by the session's `guide_id`. A guide can see a booking only if they have an assignment on it, either currently active or released after having been notified (so cancellations and releases show in history). Anything else returns 404 (not 403, to avoid confirming that the booking exists).
2. **BR-08-2 — Visible statuses.** Bookings in `awaiting_payment` are **never** shown to guides (they are notified at confirmation, [BR-07-2](07-persiapan.md#5-business-rules)). `cancelled` bookings are shown only if the guide had `notified_at` set.
3. **BR-08-3 — Hidden fields.** `GuideTourView` omits `price_snapshot`, `total_amount`, payments, `internal_notes`, `channel`, `created_by`, and the customer's email. Customer WhatsApp, name, nationality, people, language, package name, facilities, add-on names, and special needs are included.
4. **BR-08-4 — "Saya siap"** follows [BR-07-3](07-persiapan.md#5-business-rules). After success: toast "Terima kasih! Tim operasional sudah diberi tahu." and the card moves out of "Perlu konfirmasi".
5. **BR-08-5 — Selesai / Tidak Hadir** follow [BR-05-14](05-pemesanan.md#5-business-rules) (only after the slot starts, from `confirmed` / `ready`). Any assigned guide may do it, and once one guide does, it applies to the whole booking. If another guide already completed it, the action shows "Tur ini sudah ditandai {status} oleh {nama}." and refreshes.
6. **BR-08-6 — "Berlangsung"** is a display-only state on `confirmed` / `ready` bookings between slot start and slot end. It is not a stored status.
7. **BR-08-7 — Feedback share** is available only when the booking is `completed` and its feedback token is valid ([`10`](10-ulasan.md)). The QR code is generated client-side (e.g. the `qrcode` package) from the absolute URL using `APP_BASE_URL`.
8. **BR-08-8 — Freshness.** The "Hari Ini" and "Jadwal" data revalidate on focus and every 60 s while visible, so newly confirmed tours appear without a manual refresh. Lazy hold expiry runs on these queries ([BR-05-11](05-pemesanan.md#5-business-rules)).
9. **BR-08-9 — Times** are shown in WIB with the label "WIB" on the tour detail header (guides may have devices set to other zones).

## 6. Server actions / queries

| Query / action | Input | Roles | Notes |
|---|---|---|---|
| `getGuideToday` | — | guide | Needs-confirmation list + today's tours + next tour |
| `listGuideTours` | view (`upcoming` / `history`), month? | guide | Upcoming, calendar month, and 90-day history |
| `getGuideTour` | bookingId | guide | `GuideTourView`, BR-08-1..3 |
| `acknowledgeAssignment` | bookingId | guide | → 07 |
| `completeBooking` | bookingId, outcome, note? | guide (assigned) | → 05 |
| `getFeedbackShare` | bookingId | guide (assigned), admin, staff | `{ url, expiresAt, whatsappText }` → 10 |
| `listOwnLeaves` / `requestLeave` / `cancelLeave` | … | guide | → 02 |
| `getOwnProfile` | — | guide | Read-only |

## 7. Notifications

Consumes notifications created by 02, 05, and 07 (listed in §3.6). It emits none of its own. Its actions trigger `guide_acknowledged` (event only), the `completed` → `feedback_request` flow (10), and `leave_requested` (02).

## 8. Edge cases

| Case | Expected |
|---|---|
| A guide opens a link to a booking from which they were released before ever being notified | 404 page "Tur tidak ditemukan" |
| A guide is deactivated while logged in | The next request redirects to `/masuk` ([BR-01-4](01-auth-pengguna.md#5-business-rules)) |
| Two guides on one booking both tap "Tandai Selesai" | The first wins; the second sees the "sudah ditandai" message |
| A guide taps "Saya siap" on a booking rescheduled a moment ago | Succeeds for the new schedule if it is still assigned; otherwise 404 with a refresh |
| The tourist has no smartphone for the QR code | The guide uses "Isi untuk wisatawan" ([`10`](10-ulasan.md)) |
| Leave request covering a day with a tour | Allowed with a warning; admin approval is blocked until the tour is reassigned ([BR-02-8](02-tour-guide.md#5-business-rules)) |
| Weak connection in the park | Actions show a loading state and retry on failure with the toast "Gagal terhubung. Coba lagi." No offline queue (out of scope). |

## 9. Out of scope

Offline mode, push notifications (web push), installing as a PWA (a web manifest may be added cheaply, but it is not required), GPS check-in, guides editing their own profile, languages, or working days, guides seeing other guides' schedules, guide-to-guide swaps.

## 10. Acceptance criteria

1. **Given** a guide with a `confirmed` tour today at 12:00 that is not acknowledged, **when** they open `/portal` at 08:00, **then** it appears under "Perlu konfirmasi" and in "Tur hari ini" with "Saya siap".
2. **Given** that tour, **when** "Saya siap" is tapped, **then** `acknowledged_at` is set, the toast shows, and the booking's system checklist item updates ([`07`](07-persiapan.md)).
3. **Given** an `awaiting_payment` booking assigning the guide, **then** it does not appear anywhere in the portal.
4. **Given** the tour detail response, **then** it contains no price, payment, channel, or internal-notes fields.
5. **Given** a tour at 09:00–12:00 viewed at 10:00, **then** the card shows "Berlangsung" and the action "Tandai Selesai".
6. **Given** "Tandai Selesai" is confirmed, **then** the booking becomes Selesai and the share sheet with the QR code and link is available.
7. **Given** guide A is not assigned to booking X, **when** they open `/portal/tur/X`, **then** a 404 is shown.
8. **Given** a leave request from 10–12 Nov while the guide has a tour on 11 Nov, **then** the conflict warning is shown and the request is still created as Menunggu.
9. **Given** a pending leave request, **when** "Batalkan permintaan" is confirmed, **then** its status becomes Dibatalkan.
10. **Given** a newly confirmed booking for the guide, **when** the portal tab is focused again, **then** the new tour appears without a manual reload.
11. **Given** a 360 px-wide screen, **then** all primary actions are reachable with one thumb (sticky bottom bar) and no content scrolls horizontally.
