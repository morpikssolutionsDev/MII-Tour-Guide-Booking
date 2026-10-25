# 10 — Ulasan (Feedback)

> Status: **Draft v1** · Last updated: 2026-10-25 · Depends on: [`05`](05-pemesanan.md), [`08`](08-portal-guide.md), [`09`](09-notifikasi.md), [`04`](04-pengaturan.md) (settings) · Used by: [`02`](02-tour-guide.md) (rating), [`11`](11-beranda-laporan.md)

## 1. Purpose

Collects the tourist's evaluation after a completed tour, through the system's **only public page**, `/ulasan/[token]`, in English. There is a **staff/guide fallback** for tourists who can't or won't use their phone. The results feed guide ratings (allocation ranking, [`05`](05-pemesanan.md)), low-rating alerts, repeat-visit signals, and marketing consent.

Serves flow step **7 (Evaluasi & Follow Up)**: "Feedback Pelanggan" and "Peluang Repeat Visit".

## 2. User stories

- As a **tourist**, I want a quick mobile page (no login) to rate my tour and my guide, and say whether I'd come back.
- As a **guide**, I want to show a QR code at the end of the tour so the tourist can give feedback on the spot ([`08`](08-portal-guide.md)).
- As **staff or a guide**, I want to enter feedback on the tourist's behalf when they give it verbally.
- As an **admin**, I want to be alerted immediately when a guide receives a low rating.
- As **staff**, I want to know which customers agreed to be contacted with offers.

## 3. Screens

### 3.1 Public feedback page: `/ulasan/[token]` (public, `lang="en"`)

Standalone layout (no app shell), Batu 50 background, centred column max 480 px, `body-lg`. `<meta name="robots" content="noindex">`.

1. **Header**: static decorated logo (max 240 px) + "Taman Mini Indonesia Indah".
2. **Tour card**: "Your tour on **Saturday, 7 November 2026**", "09:00–12:00 WIB · English", "with **Rina**" (guide display names). Greeting "Hi {firstName}!" using the customer's first name only.
3. **Form**:

| Field | Control | Rules |
|---|---|---|
| "How was your overall experience?" * | 5 large tappable stars (≥ 48 px), labels under the selection: Poor · Fair · Good · Very good · Excellent | 1–5 |
| "How was your guide, {name}?" * | 5 stars, **one row per assigned guide** (each with a photo or initials) | 1–5 per guide |
| "Anything you'd like to share?" | Textarea, placeholder "Tell us what you enjoyed or what we can improve (optional)" | ≤ 1 000 characters |
| "Would you visit TMII again?" * | Segmented: "Yes" · "Maybe" · "No" | |
| Consent | Checkbox, unchecked by default: "TMII may contact me via WhatsApp or email about future visits and offers." | Optional |

4. **Button**: "Send feedback" (primary, full width).
5. **Footer caption**: "Your feedback is shared with TMII's tour guide team."

**Thank-you screen** (same URL after submit): the flying-birds loop plays once, then the text "Thank you, {firstName}! 🙏 We hope to see you again at Taman Mini Indonesia Indah." No further actions.

**Invalid states** (shown with `snake.svg`, friendly copy, no form):

| State | Message |
|---|---|
| Unknown token | "This feedback link is not valid." |
| Expired | "This feedback link has expired. Thank you for visiting TMII!" |
| Already used | "You've already shared your feedback. Thank you!" |

### 3.2 Section "Ulasan" on the booking detail (admin, staff)

| Booking state | Display |
|---|---|
| `completed`, link active | "Menunggu ulasan wisatawan · berlaku sampai {tanggal}", with actions "Salin tautan", "Tampilkan QR", "Buka di WhatsApp" (the `feedback_request` text), and **"Isi ulasan"** (fallback) |
| `completed`, link expired, no feedback | "Tautan kedaluwarsa", with actions **"Buat tautan baru"** and "Isi ulasan" |
| `evaluated` | Overall rating (stars + number), each guide's rating, comment, "Ingin berkunjung lagi: Ya / Mungkin / Tidak", consent ✓/—, submitted time, and **source badge**: "Diisi wisatawan" / "Diisi oleh staf: {nama}" / "Diisi oleh guide: {nama}" |
| Other statuses | Section hidden |

### 3.3 Dialog "Isi ulasan" (admin, staff, assigned guide)

The same fields in Indonesian:

- "Pengalaman keseluruhan" *
- "Rating guide: {nama}" * (one per guide)
- "Komentar wisatawan"
- "Ingin berkunjung lagi?" *
- Consent checkbox: "Wisatawan menyetujui dihubungi untuk penawaran (tanyakan langsung)"

An info alert says: "Isi sesuai jawaban wisatawan. Ulasan ini akan ditandai diisi oleh {nama Anda}." Button: "Simpan Ulasan".

## 4. Data model

### `feedback`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `booking_id` | text | FK, **unique** (one feedback per booking) |
| `token` | text | **unique**, 32 bytes random, base64url (≥ 128-bit, [overview §8.7](00-overview.md#87-security-baseline-prototype)) |
| `token_expires_at` | text (ISO UTC) | `created_at + feedback_link_days` |
| `submitted_at` | text, nullable | null = still pending |
| `source` | text enum, nullable | `tourist` · `staff` · `guide` |
| `entered_by` | text, nullable | FK `users.id` (staff or guide fallback) |
| `overall_rating` | integer, nullable | 1–5 |
| `comment` | text, nullable | ≤ 1 000 characters |
| `would_revisit` | text enum, nullable | `yes` · `maybe` · `no` |
| `contact_consent` | integer (bool), nullable | |
| `created_at`, `updated_at` | text | |

The row is created **pending** (with its token) when the booking is completed, and filled in when submitted.

### `feedback_guide_ratings`

`feedback_id` (FK), `guide_id` (FK), `rating` integer 1–5. PK (`feedback_id`, `guide_id`).

Guide average rating ([BR-02-10](02-tour-guide.md#5-business-rules), allocation [BR-05-6](05-pemesanan.md#5-business-rules)) = AVG(`rating`) over this table for the guide, on submitted feedback.

## 5. Business rules

1. **BR-10-1 — Token creation.** When a booking transitions to `completed` ([BR-05-14](05-pemesanan.md#5-business-rules)), create a pending `feedback` row with a new token and `token_expires_at = now + feedback_link_days`, then `notify('feedback_request')` to the tourist. Bookings marked `no_show` get no token.
2. **BR-10-2 — Token validity.** A token is valid iff the row exists, `submitted_at IS NULL`, `token_expires_at > now`, and the booking status is `completed`. Lookups use a constant-time comparison, and responses for unknown, expired, and used tokens don't reveal any booking data.
3. **BR-10-3 — Public submit.** Server-side validation:
   - every rating is an integer 1–5;
   - there is exactly one rating per assigned (non-released) guide;
   - the comment is ≤ 1 000 characters, trimmed, plain text (HTML escaped on display).

   In one transaction:
   1. fill the feedback (`source = tourist`);
   2. insert the guide ratings;
   3. set booking status `evaluated`;
   4. append `feedback_received` + `status_changed`;
   5. apply BR-10-5 and BR-10-6.

   The token then becomes **used** (single-use).
4. **BR-10-4 — Fallback entry** (admin, staff, or a guide assigned to the booking): allowed while the booking is `completed` and the feedback is not yet submitted, **regardless of token expiry**. It sets `source` = `staff` or `guide` and `entered_by`, with the same effects as BR-10-3. After this, the public link shows "already used".
5. **BR-10-5 — Low-rating alert.** If **any** guide rating ≤ `low_rating_threshold` (default 2), `notify('low_rating_alert')` sends one in-app alert per admin, naming the lowest-rated guide (BR-09-4 dedupe).
6. **BR-10-6 — Consent.** If `contact_consent = true`, set `customers.marketing_consent = 1` and `marketing_consent_at = now`. A later feedback with consent unchecked does **not** revoke an earlier consent (revocation is out of scope; noted for production).
7. **BR-10-7 — Regenerate link.** "Buat tautan baru" (admin, staff) is available only while the booking is `completed` and unsubmitted. It replaces `token` and `token_expires_at` (the old link becomes invalid) and sends a new `feedback_request` (dedupe key per token).
8. **BR-10-8 — Immutability.** Submitted feedback cannot be edited or deleted in the prototype. Moderation (hiding abusive comments) is out of scope.
9. **BR-10-9 — Visibility.**
   - Admin and staff see all feedback.
   - Guides see feedback on their own tours: their own rating and the comment, but not their co-guide's individual rating.
   - The public page never shows other people's names except the guides' display names, and never shows the customer's surname, phone, or email.
10. **BR-10-10 — Abuse protection (light).** The public submit endpoint accepts only POST, with a same-origin check, a body size limit of 8 KB, and a simple per-token attempt limit (max 5 invalid submissions, after which the form is locked with "Please try again later"). No captcha in the prototype.

## 6. Server actions / queries

| Action | Input | Roles | Notes |
|---|---|---|---|
| `createFeedbackToken` | bookingId | (internal, on completion) | BR-10-1 |
| `getPublicFeedbackForm` | token | public | `{ state: 'open' / 'expired' / 'used' / 'invalid', tour?: { dateEn, slotEn, languageEn, guides: [{ id, displayName, photoUrl }], firstName } }` |
| `submitPublicFeedback` | token, overall, guideRatings[], comment?, wouldRevisit, consent | public | BR-10-3, 10-5, 10-6, 10-10 |
| `submitFeedbackByStaff` | bookingId, (same fields) | admin, staff, guide (assigned) | BR-10-4 |
| `getFeedbackShare` | bookingId | admin, staff, guide (assigned) | `{ url, expiresAt, whatsappText, state }` |
| `regenerateFeedbackLink` | bookingId | admin, staff | BR-10-7 |
| `getBookingFeedback` | bookingId | admin, staff; guide (scoped, BR-10-9) | |
| `listFeedback` | filters, page | admin, staff | For [`11`](11-beranda-laporan.md) |

## 7. Notifications

| Event key | To | Channel |
|---|---|---|
| `feedback_request` | Tourist | whatsapp_mock (EN) |
| `low_rating_alert` | All admins | in-app |

Templates are in [`09` §7](09-notifikasi.md#7-event-catalogue-and-templates).

## 8. Edge cases

| Case | Expected |
|---|---|
| Two guides on a booking | The public form shows two guide rating rows; both are required |
| A guide was released before the tour (reschedule) | Not rated (only non-released assignments) |
| A tourist opens the link on day 15 (default 14 days) | "Expired" state; staff may regenerate or enter it themselves |
| The tourist submits twice quickly (double tap) | The first succeeds; the second gets the "already used" state |
| The tourist gives the guide 2 stars | Booking Dievaluasi; every admin gets a `low_rating_alert` |
| A booking marked Tidak Hadir | No token, no feedback section |
| A guide enters feedback for their own tour | Allowed (agreed fallback); marked "Diisi oleh guide: {nama}" so admins can judge it. Reports show a source breakdown ([`11`](11-beranda-laporan.md)). |

## 9. Out of scope

Multi-language feedback pages (Arabic, Russian), photo uploads, public reviews or testimonials, replying to feedback, editing or hiding feedback, consent revocation flows, NPS calculations, incentives or vouchers for feedback.

## 10. Acceptance criteria

1. **Given** a booking marked Selesai, **then** a pending feedback row with a token expiring in 14 days exists, and a `feedback_request` WhatsApp mock contains `/ulasan/{token}`.
2. **Given** a valid token, **when** the tourist opens the link on a phone, **then** the page is in English, shows the tour date, slot, and guide names, and has no app navigation.
3. **Given** the tourist submits overall 5, guide 5, "Yes", and consent ticked, **then** the booking is Dievaluasi, the customer's `marketing_consent = 1`, the guide's average includes the new 5, and the thank-you screen shows.
4. **Given** the same link opened again, **then** "You've already shared your feedback" is shown.
5. **Given** a token past `token_expires_at`, **then** the expired state is shown and submitting is impossible (server rejects).
6. **Given** a guide rating of 2, **then** each active admin has exactly one `low_rating_alert` in-app notification.
7. **Given** an expired link and no feedback, **when** staff click "Buat tautan baru", **then** the old URL shows "not valid", a new URL works, and a new `feedback_request` exists.
8. **Given** a guide assigned to the booking, **when** they use "Isi untuk wisatawan" in the portal, **then** the feedback is saved with `source = guide` and shown as "Diisi oleh guide: {nama}".
9. **Given** a no-show booking, **then** no feedback token exists and "Isi ulasan" is not offered.
10. **Given** a comment containing `<script>alert(1)</script>`, **then** it is displayed as literal text everywhere.
11. **Given** a 2-guide booking, **when** guide A views the feedback in the portal, **then** they see their own rating and the comment, but not guide B's rating.
