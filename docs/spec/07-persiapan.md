# 07 — Persiapan (Preparation)

> Status: **Draft v1** · Last updated: 2026-10-25 · Depends on: [`04-pengaturan.md`](04-pengaturan.md), [`05-pemesanan.md`](05-pemesanan.md), [`06-pembayaran.md`](06-pembayaran.md) · Used by: [`08-portal-guide.md`](08-portal-guide.md), [`11-beranda-laporan.md`](11-beranda-laporan.md)

## 1. Purpose

Covers everything between payment and the tour:

1. **Notifying the assigned guides** as soon as a booking is confirmed (the H-2 target), flagging bookings confirmed with less notice.
2. Tracking each guide's **acknowledgement** ("Saya siap").
3. A per-booking **preparation checklist** (copied from the template) that operations tick off.
4. Moving the booking to **Siap** automatically when everything is done, and back to **Terkonfirmasi** if something is undone.

Serves flow step **5 (Persiapan Sebelum Tour)** (notification to guides, briefing material, facility preparation, operations confirmation) and pain points 2 (H-2) and 5 (cross-team coordination).

## 2. User stories

- As a **guide**, I want to be notified as soon as a tour is confirmed for me, at least two days ahead where possible, so that I can prepare.
- As **staff (operations)**, I want a checklist per booking and to see who ticked what, so that preparation is visible to everyone.
- As **staff**, I want to know which guides haven't confirmed yet, and to resend the notice, so that nobody is surprised on the day.
- As an **admin**, I want bookings confirmed with less than H-2 notice to be flagged, so that we can measure and improve.

## 3. Screens

### 3.1 Section "Persiapan" on the booking detail (`/pemesanan/[id]`)

Visible from `confirmed` onward. Editable in `confirmed` / `ready`; read-only afterwards.

- **Header**: "Persiapan" + a progress bar "3/4 selesai" + status hint:
  - "Semua siap. Status otomatis menjadi Siap." when complete;
  - "Selesaikan daftar periksa agar status menjadi Siap." otherwise.
- **"di bawah H-2"** inline alert (warning) when any guide notice was short: "Pemesanan dikonfirmasi kurang dari {notice_days} hari sebelum tur. Guide diberi tahu segera."
- **Checklist items** (`ChecklistItem`) in template order:
  - **Manual items**: checkbox + label + help text. Once ticked, a caption "oleh {nama} · {dd MMM HH.mm}". Unticking is allowed and the caption disappears.
  - **System item "Guide sudah dikonfirmasi"**: read-only, with a lock icon. It shows a sub-list per assigned guide:

    | State | Display |
    |---|---|
    | Acknowledged | "{nama} · Siap ✓ {waktu}" |
    | Not yet acknowledged | "{nama} · Belum konfirmasi · diberi tahu {relative}" + button **"Kirim ulang pemberitahuan"** |

    The item is ticked automatically when all guides have acknowledged (caption "oleh sistem").

### 3.2 Bookings list tab "Perlu Persiapan"

Defined in [`05` §3.1](05-pemesanan.md#31-bookings-list-pemesanan-admin-staff): `confirmed` bookings with a tour within 7 days and an incomplete checklist. Each row shows the progress "2/4" and an "unacknowledged guides" icon.

### 3.3 Beranda widgets

Defined in [`11`](11-beranda-laporan.md):

- "Checklist belum lengkap" (tours in the next 2 days that are not Siap);
- "Guide belum konfirmasi" (unacknowledged notices, oldest first, with a resend action).

## 4. Data model

### `booking_checklist_items`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `booking_id` | text | FK |
| `system_key` | text, nullable | `guide_ack` for the system item |
| `label` | text | Copied from the template |
| `description` | text, nullable | Copied |
| `sort_order` | integer | Copied |
| `checked_at` | text, nullable | |
| `checked_by` | text, nullable | FK `users.id`; null + `checked_at` set = system |

Unique (`booking_id`, `system_key`) where `system_key` is not null.

### Fields on `booking_guides` (owned by 05, behaviour defined here)

| Field | Meaning |
|---|---|
| `notified_at` | Time the latest notice for the current schedule was sent |
| `short_notice` | Notice sent with fewer than `notice_days` days before the tour (WIB calendar days) |
| `acknowledged_at` | The guide pressed "Saya siap" for the current schedule |

## 5. Business rules

1. **BR-07-1 — Checklist copy.** On the first transition to `confirmed` ([BR-06-2](06-pembayaran.md#5-business-rules)), every `checklist_template_items` row is copied into `booking_checklist_items`. If the booking already has items (it was confirmed before and its payment was undone), nothing is copied ([BR-04-5](04-pengaturan.md#5-business-rules)).
2. **BR-07-2 — Guide notice at confirmation.** In the same transaction as the confirmation, for each active assignment **not yet notified for its current schedule** (`notified_at IS NULL`):
   - `notified_at = now`;
   - `short_notice = (tour_date − today_WIB) < notice_days` (calendar days);
   - send the `guide_assigned` in-app notification;
   - append `notification_sent`.

   Notifying at confirmation means any booking confirmed at least `notice_days` ahead meets the H-2 target; later confirmations are flagged.
3. **BR-07-3 — Acknowledgement.** "Saya siap" ([`08`](08-portal-guide.md)) sets `acknowledged_at = now` on the guide's active assignment and appends `guide_acknowledged`. It is allowed while the booking is `confirmed` or `ready` and the slot hasn't started. It is idempotent: a second tap changes nothing.
4. **BR-07-4 — System item.** After every acknowledgement, assignment change, or acknowledgement reset, the system item `guide_ack` is recomputed:
   - **checked** iff every active assignment has `acknowledged_at` set;
   - when it becomes checked, set `checked_at = now`, `checked_by = null`, and append `checklist_ticked` (system actor);
   - when it becomes unchecked, clear it and append `checklist_unticked`.
5. **BR-07-5 — Automatic Siap.** After any checklist change (manual or system), for a booking in `confirmed` or `ready`:
   - all items checked → status `ready`;
   - otherwise → status `confirmed`.

   Each actual change appends `status_changed` with a system actor and the payload `{ "cause": "checklist" }`.
6. **BR-07-6 — Reschedule effects** (applied inside [BR-05-13](05-pemesanan.md#5-business-rules)), for bookings that have been notified (`confirmed` / `ready`):

   | Change | Effect |
   |---|---|
   | Date or slot changed | **All** assignments: reset `acknowledged_at`; send a fresh notice (`booking_rescheduled` to kept guides, `guide_assigned` to new ones) with a new `notified_at` / `short_notice` |
   | Only guides changed | New guides get `guide_assigned` and must acknowledge; kept guides keep their acknowledgement; released guides get `guide_released` |
   | Only language, people, package, or add-ons changed | Kept guides keep their acknowledgement and get an in-app `booking_rescheduled` "detail diperbarui" notice; new guides (if the people count grew) are notified |

   BR-07-4 and BR-07-5 then re-evaluate, so a `ready` booking may drop back to `confirmed`.

   For `awaiting_payment` bookings no notices are sent. If such a booking had been notified before (its payment was undone) and its date or slot changes, `notified_at` and `acknowledged_at` are cleared, so that the next confirmation notifies the guides again under BR-07-2.
7. **BR-07-7 — Resend.** "Kirim ulang pemberitahuan" sends another `guide_assigned` notification to that guide, with the flag "pengingat" (reminder) in its context. It updates neither `notified_at` nor `short_notice`, since those measure the first notice. Rate-limited to once per 10 minutes per guide and booking ("Pemberitahuan baru saja dikirim.").
8. **BR-07-8 — Manual items** may be ticked or unticked by admin and staff in `confirmed` / `ready` only. Every change appends `checklist_ticked` / `checklist_unticked` with the item label.
9. **BR-07-9 — Completion without Siap.** A booking may still be marked Selesai from `confirmed` ([BR-05-14](05-pemesanan.md#5-business-rules)). The incomplete checklist remains visible in the history and is reported in [`11`](11-beranda-laporan.md) ("tur tanpa persiapan lengkap").
10. **BR-07-10 — H-2 compliance** (metric for [`11`](11-beranda-laporan.md)): among assignments on bookings with status `completed` / `evaluated` / `no_show` in the period, the share where `short_notice = false`.

## 6. Server actions / queries

| Action | Input | Roles | Side effects |
|---|---|---|---|
| `getChecklist` | bookingId | admin, staff | Items + per-guide acknowledgement states |
| `setChecklistItem` | itemId, checked | admin, staff | BR-07-8 → BR-07-5 |
| `acknowledgeAssignment` | bookingId | guide (own assignment) | BR-07-3 → BR-07-4 → BR-07-5 |
| `resendGuideNotice` | bookingId, guideId | admin, staff | BR-07-7 |
| `notifyGuidesOnConfirm` | bookingId | (internal, called by `confirmPayment`) | BR-07-1, BR-07-2 |
| `applyRescheduleEffects` | bookingId, diff | (internal, called by `rescheduleBooking`) | BR-07-6 |
| `listPreparationQueue` | withinDays | admin, staff | For the "Perlu Persiapan" tab and Beranda |

## 7. Notifications

| Event key | To | Channel | Content (Indonesian) |
|---|---|---|---|
| `guide_assigned` | Assigned guide | in-app | "Tur baru: {tanggal}, {slot}, {bahasa}, {orang} orang ({code}). Ketuk untuk detail dan tekan 'Saya siap'." Includes the "di bawah H-2" flag or "pengingat" when applicable. |
| `booking_rescheduled` | Kept guides | in-app | "Jadwal tur {code} berubah: {lama} → {baru}. Mohon konfirmasi ulang." |
| `guide_released` | Released guides | in-app | "Anda tidak lagi bertugas pada tur {code} ({tanggal}, {slot})." |

Templates are in [`09-notifikasi.md`](09-notifikasi.md).

## 8. Edge cases

| Case | Expected |
|---|---|
| Booking confirmed today for tomorrow (notice_days = 2) | Guides notified immediately with `short_notice = true`; "di bawah H-2" badge on the booking and in the guide's notice |
| Booking confirmed today for a tour 5 days away | `short_notice = false` |
| A 2-guide booking where one guide acknowledges | System item unchecked; sub-list shows 1/2; status stays Terkonfirmasi |
| Every manual item ticked, then the second guide acknowledges | System item ticks; status → **Siap** automatically |
| Ops unticks "Fasilitas disiapkan" on a Siap booking | Status → Terkonfirmasi; events logged |
| A Siap booking rescheduled to another date | Acknowledgements reset, system item unchecked, status → Terkonfirmasi, guides re-notified |
| Payment undone after notices | Notices and acknowledgements kept; booking `awaiting_payment`; if re-confirmed, no new checklist copy and no duplicate notices for guides already notified for the same schedule (`notified_at` set) |
| A guide taps "Saya siap" after the slot started | Rejected: "Tur sudah dimulai." |

## 9. Out of scope

Scheduled reminders (e.g. automatic H-1 nudges; the Beranda list covers this), checklist item assignment to specific staff, due times per item, photo evidence per item, operations rosters.

## 10. Acceptance criteria

1. **Given** a booking confirmed 5 days before the tour, **then** each guide receives `guide_assigned` with `short_notice = false`, and the checklist has the template items with "Guide sudah dikonfirmasi" unchecked.
2. **Given** a booking confirmed 1 day before the tour (notice_days = 2), **then** `short_notice = true` and the booking shows "di bawah H-2".
3. **Given** a confirmed 2-guide booking with all manual items ticked, **when** guide A taps "Saya siap", **then** the status stays Terkonfirmasi. **When** guide B also taps, **then** the system item is ticked by the system and the status becomes **Siap**.
4. **Given** a Siap booking, **when** staff untick a manual item, **then** the status returns to Terkonfirmasi with a `status_changed` event (cause: checklist).
5. **Given** a Siap booking, **when** rescheduled to a new date, **then** all acknowledgements are cleared, guides receive `booking_rescheduled`, and the status becomes Terkonfirmasi.
6. **Given** a Siap booking where only guide B is replaced with guide C, **then** guide A keeps their acknowledgement, C receives `guide_assigned`, B receives `guide_released`, and the status becomes Terkonfirmasi until C acknowledges.
7. **Given** a template edited after a booking was confirmed, **then** that booking's checklist is unchanged.
8. **Given** "Kirim ulang pemberitahuan" pressed twice within 10 minutes, **then** only one reminder notification is created.
9. **Given** a guide not assigned to a booking, **when** calling `acknowledgeAssignment`, **then** 403.
10. **Given** 10 completed assignments in a month, 8 with `short_notice = false`, **then** H-2 compliance for that month is 80 %.
