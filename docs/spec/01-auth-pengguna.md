# 01 — Auth & Pengguna (Authentication & Users)

> Status: **Draft v1** · Last updated: 2026-10-25 · Depends on: [`00-overview.md`](00-overview.md), [`design-system.md`](design-system.md)

## 1. Purpose

Lets the three roles (**Admin**, **Staff**, **Guide**) sign in and land on the right home screen, and enforces role-based access on every page and server action. Gives admins a place to manage staff and admin accounts, and lets every user change their own password. Guide login accounts are created together with the guide profile in [`02-tour-guide.md`](02-tour-guide.md). This module owns the `users` table they live in.

Serves: cross-team coordination (pain point 5). Every action in the system is attributable to a person.

## 2. User stories

- As **any user**, I want to log in with my email and password, so that I reach the screens for my role.
- As **any user**, I want to change my own password, so that I can replace the initial one.
- As an **admin**, I want to create staff and admin accounts with an initial password, so that new team members can start working.
- As an **admin**, I want to give a staff user a default channel, so that their booking form is pre-filled with Sales, Call Center, or On the Spot.
- As an **admin**, I want to deactivate an account, so that someone who leaves can no longer log in without losing their history.
- As an **admin**, I want to set a new password for a user who forgot theirs, since there is no email reset in the prototype.

## 3. Screens

### 3.1 Login: `/masuk` (public)

Layout per [design-system §8.3](design-system.md#83-the-decorated-logo): photo + animated decorated logo.

| Element | Label / behaviour |
|---|---|
| Title | "Masuk" (`display`) |
| Subtitle | "Layanan Tour Guide TMII" |
| Field | "Email" (type `email`, autocomplete `username`) |
| Field | "Kata sandi" (type `password`, autocomplete `current-password`, eye toggle "Tampilkan") |
| Button | "Masuk" (primary, full width) |
| Error (wrong credentials or inactive account) | Inline alert: "Email atau kata sandi salah, atau akun tidak aktif." Never reveal which part was wrong. |
| Footer note | caption: "Lupa kata sandi? Hubungi admin." |

- Successful login redirects by role: `admin`/`staff` → `/beranda`, `guide` → `/portal`. If the user was sent to `/masuk` from a protected URL (`?next=`), redirect there instead, provided the role may access it.
- A logged-in user visiting `/masuk` is redirected to their home.
- States: submitting (button loading); error (alert, password field cleared and focused).

### 3.2 User list: `/pengguna` (admin)

| Desktop table column | Content |
|---|---|
| Nama | Name + email beneath (caption) |
| Peran | "Admin" · "Staff" · "Guide" |
| Kanal default | "Sales" · "Call Center" · "On the Spot" · "—" |
| Status | "Aktif" or the badge "Nonaktif" |
| Terakhir masuk | Relative time ("3 jam lalu") or "Belum pernah" |
| Actions (row menu) | "Ubah", "Atur ulang kata sandi", "Nonaktifkan" / "Aktifkan" |

- Filters: search (name/email), "Peran", "Status". Default: active users, sorted by name.
- Header action: "Tambah Pengguna" (primary).
- Rows with role `guide` show the hint "Dikelola di Tour Guide" and link to the guide profile. They have no "Ubah" action here.
- Mobile: cards showing name, role badge, status, and a row menu.
- Empty state: not applicable (the seeded admin always exists).

### 3.3 Create / edit user: `/pengguna/baru`, `/pengguna/[id]` (admin)

| Field | Rules |
|---|---|
| "Nama lengkap" * | 2–80 characters |
| "Email" * | Valid email, unique (case-insensitive), stored lowercase |
| "Peran" * | Radio: "Admin" / "Staff". The `guide` role is not offered here. |
| "Kanal default" | Shown only when Peran = Staff. Select: "Sales", "Call Center", "On the Spot", "Tidak ada". |
| "Kata sandi awal" * | Create only. Min 8 characters, with a "Buat acak" (generate) button and a copy button. |

- Buttons: "Simpan" (primary), "Batal" (secondary).
- After creating: toast "Pengguna dibuat", then a dialog showing the email and initial password once, with a copy button: "Berikan kata sandi ini kepada pengguna. Kata sandi tidak akan ditampilkan lagi."

### 3.4 Reset password (admin): dialog from the row menu

"Atur ulang kata sandi untuk {nama}". A "Kata sandi baru" field (min 8, with generate and copy) and the button "Simpan kata sandi". The same one-time display rule applies.

### 3.5 My account: `/akun` (admin, staff) and the Akun tab in `/portal` (guide)

- Read-only: name, email, role, default channel.
- Section "Ubah kata sandi": "Kata sandi saat ini", "Kata sandi baru", "Ulangi kata sandi baru", button "Ubah kata sandi".
- Button "Keluar" (secondary). Admin and staff can also reach it from the user menu in the sidebar or top bar.

## 4. Data model

### `users`

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `name` | text | not null |
| `email` | text | not null, unique, lowercase |
| `password_hash` | text | not null, bcrypt (cost 10) |
| `role` | text enum | `admin` · `staff` · `guide` |
| `default_channel` | text enum, nullable | `sales` · `call_center` · `on_the_spot`. Only meaningful for `staff`. |
| `is_active` | integer (bool) | default 1 |
| `last_login_at` | text (ISO UTC), nullable | |
| `password_changed_at` | text (ISO UTC) | Used to invalidate older sessions |
| `created_at`, `updated_at` | text (ISO UTC) | |

## 5. Business rules

1. **BR-01-1** Login matches email case-insensitively. Only `is_active = 1` users may log in.
2. **BR-01-2** Passwords: minimum 8 characters, no other composition rules (prototype). Hashed with bcrypt and never logged or returned.
3. **BR-01-3** Sessions use Auth.js v5 with the **JWT** strategy (required by the Credentials provider). The token holds `userId`, `role`, `name`, and `iat`. Max age **12 hours**, sliding.
4. **BR-01-4** **Every** server action and protected page loads the current user from the database via `requireUser()` / `requireRole(...roles)`. If the user is missing, inactive, or `password_changed_at` is later than the token's `iat`, the session is treated as signed out (redirect to `/masuk`). This makes deactivation and password resets take effect immediately.
5. **BR-01-5** Route access by role:

   | Route prefix | Roles |
   |---|---|
   | `/beranda`, `/pemesanan`, `/jadwal`, `/pelanggan`, `/laporan`, `/tour-guide`, `/harga`, `/akun` | admin, staff |
   | `/pengaturan`, `/pengguna`, `/outbox` | admin |
   | `/portal` | guide |
   | `/masuk`, `/ulasan/[token]` | public |

   Unauthorised access to a page redirects to the user's home with the toast "Anda tidak memiliki akses ke halaman tersebut." Unauthorised server actions throw a `403` error and are never silently ignored.
6. **BR-01-6** Admins cannot deactivate themselves or change their own role. The system must always keep **at least one active admin**: deactivating or demoting the last one is rejected with "Harus ada minimal satu admin aktif."
7. **BR-01-7** Users with role `guide` cannot be created, edited, or re-roled here. Their account is created, renamed, and deactivated through [`02-tour-guide.md`](02-tour-guide.md), so a guide profile and its login always exist together. Admins may still reset a guide's password here.
8. **BR-01-8** Role changes are limited to `admin` ↔ `staff`. Changing a user to `admin` clears `default_channel`.
9. **BR-01-9** Deactivating a user never changes historical records (`bookings.created_by`, `payments.confirmed_by`, events). Their name still appears there, with the caption "(nonaktif)".
10. **BR-01-10** A successful login updates `last_login_at`. A password change (own or by admin) updates `password_changed_at`.

## 6. Server actions / queries

| Action | Input | Output | Roles | Side effects |
|---|---|---|---|---|
| `login` | email, password | redirect | public | `last_login_at` updated |
| `logout` | — | redirect `/masuk` | any | — |
| `listUsers` | search?, role?, status? | User[] | admin | — |
| `createUser` | name, email, role (`admin`/`staff`), defaultChannel?, password | User | admin | — |
| `updateUser` | id, name, email, role, defaultChannel? | User | admin | Rejects guide users (BR-01-7) and the last-admin violation (BR-01-6) |
| `setUserActive` | id, isActive | User | admin | BR-01-6, BR-01-7 |
| `resetUserPassword` | id, newPassword | ok | admin | `password_changed_at` |
| `changeOwnPassword` | currentPassword, newPassword | ok | any logged-in | `password_changed_at`; the session is re-issued so the user stays logged in |
| `requireUser` / `requireRole` | — | CurrentUser | (helper) | Used by every other module |

Validation uses shared **zod** schemas, also reused by the client forms.

## 7. Notifications

None.

## 8. Edge cases

- Two admins edit the same user at once: last write wins (prototype). `updated_at` is shown on the form.
- An email changed to one that already exists: field error "Email sudah digunakan."
- An admin resets their own password through the reset dialog: allowed, and their session is re-issued like `changeOwnPassword`.
- A staff user's default channel is changed: affects only bookings created afterwards.
- A deactivated user with an open browser tab: their next action redirects to `/masuk`.

## 9. Out of scope

Self-registration, email password reset, SSO, 2FA, login rate limiting (noted for production), per-user permission overrides, profile photos for admin and staff.

## 10. Acceptance criteria

1. **Given** an active staff user, **when** they log in with the correct password, **then** they land on `/beranda` and `last_login_at` is set.
2. **Given** an active guide user, **when** they log in, **then** they land on `/portal`.
3. **Given** a deactivated user, **when** they submit correct credentials, **then** login fails with the generic error message.
4. **Given** a logged-in staff user, **when** they open `/pengaturan`, **then** they are redirected to `/beranda` with the no-access toast.
5. **Given** a logged-in staff user, **when** they call `createUser` directly, **then** the action fails with 403.
6. **Given** exactly one active admin, **when** that admin tries to deactivate themselves or another admin tries to demote them, **then** the change is rejected with "Harus ada minimal satu admin aktif."
7. **Given** a user logged in on two devices, **when** an admin resets that user's password, **then** both sessions are signed out on their next request.
8. **Given** the create form with role Staff and default channel Call Center, **when** saved, **then** the user's new bookings default to channel Call Center.
9. **Given** a user with role `guide`, **when** an admin opens the row menu in `/pengguna`, **then** only "Atur ulang kata sandi" is available, with a link to the guide profile.
10. **Given** `?next=/pemesanan/abc` on the login URL and a staff login, **then** the user is redirected to `/pemesanan/abc`. With a guide login, they go to `/portal`.
