# 03 — Harga (Pricing)

> Status: **Draft v1** · Last updated: 2026-10-25 · Depends on: [`00-overview.md`](00-overview.md) §8.2, [`01-auth-pengguna.md`](01-auth-pengguna.md)

## 1. Purpose

Lets the admin configure everything that determines what a tour costs: **packages** (price per guide, maximum people per guide, included facilities and add-ons), **add-ons**, **facilities**, **price rules** (weekend / holiday surcharge), and **holidays**. It also provides a **price simulator** that staff can use to quote a tourist. It owns the single price-calculation function used by bookings, so the simulator and real bookings can never disagree.

Serves flow step **4 (Konfirmasi & Pembayaran)** and pain point 4 (clear package and price information from the start). Realises the infographic's "Pilihan Paket & Harga" and "Fasilitas untuk Wisatawan" panels.

## 2. User stories

- As an **admin**, I want to create and edit packages with a price per guide and a maximum group size per guide, so that large groups automatically get more guides and are charged correctly.
- As an **admin**, I want to say which facilities and add-ons a package already includes, so that staff don't sell Fast Track to a Premium customer twice.
- As an **admin**, I want to set weekend and holiday surcharges and maintain the holiday calendar, so that prices follow TMII policy without manual maths.
- As **staff**, I want to simulate a price for a date, group size, package, and add-ons, so that I can quote a tourist on the phone before creating a booking.
- As **staff**, I want to see all packages and what they include, so that I can explain the options.

## 3. Screens

`/harga` is a tabbed page: **"Paket" · "Add-on" · "Fasilitas" · "Aturan Harga" · "Hari Libur" · "Simulasi"**. The tab is reflected in the URL (`?tab=`). On mobile the tabs become a horizontally scrollable tab bar.

Admins see edit actions. **Staff see every tab read-only** (no create, edit, or deactivate buttons) and can use **Simulasi** fully.

### 3.1 Tab "Paket"

Cards in a responsive grid (1 column mobile, 2 tablet, 3 desktop), ordered by `sort_order`:

- Package name (`h2`) + "Nonaktif" badge if inactive
- **"Rp 500.000 / guide"** (`kpi` size) + caption "maks. 8 orang per guide"
- Short description
- "Termasuk": facility chips with icons, plus included add-ons (e.g. "Fast Track (Angling)")
- Admin: "Ubah", "Nonaktifkan"/"Aktifkan" (row menu)

Header (admin): "Tambah Paket".

**Package form** (dialog on desktop, bottom sheet / full page on mobile):

| Field | Rules |
|---|---|
| "Nama paket" * | 2–40 characters, unique among active packages |
| "Deskripsi singkat" | ≤ 160 characters |
| "Harga per guide" * | Money input, integer ≥ 0 |
| "Maks. orang per guide" * | Integer 1–50 |
| "Fasilitas termasuk" | Multi-select of active facilities |
| "Add-on yang sudah termasuk" | Multi-select of active add-ons; they are given at no charge and hidden from the purchasable list |
| "Urutan tampil" | Integer, default last |

A live preview card on the form shows how the package will look.

### 3.2 Tab "Add-on"

Table / cards: "Nama", "Harga" (e.g. "Rp 50.000 / orang", "Rp 150.000 / pemesanan"), "Termasuk di paket" (the names of packages that include it), "Status".

**Add-on form**:

| Field | Rules |
|---|---|
| "Nama add-on" * | 2–40 characters, unique among active add-ons |
| "Deskripsi" | ≤ 160 characters |
| "Harga" * | Money input, integer ≥ 0 |
| "Satuan" * | Radio: "Per pemesanan" (`per_booking`) / "Per orang" (`per_person`) |
| "Urutan tampil" | Integer |

### 3.3 Tab "Fasilitas"

The list of non-chargeable items a package can include: "Nama fasilitas", "Ikon" (picked from a fixed set of lucide icons: `Cookie`, `GlassWater`, `Ticket`, `ShoppingBag`, `Armchair`, `Crown`, `Sparkles`, `Gift`), "Dipakai di paket" (package names), "Status". Form: name * (2–40 characters), icon *, sort order.

### 3.4 Tab "Aturan Harga"

There are exactly **two rule rows**, which can be edited but not added or removed (prototype):

| Rule | When it applies |
|---|---|
| **"Akhir pekan"** (`weekend`) | The tour date is Saturday or Sunday (WIB) |
| **"Hari libur nasional"** (`holiday`) | The tour date exists in the **Hari Libur** list |

Each row shows its kind and value ("+20 %"), status, and the explanatory caption "Jika keduanya berlaku, hanya yang terbesar yang dipakai. Berlaku untuk harga paket saja, tidak untuk add-on."

**Rule form**:

| Field | Rules |
|---|---|
| "Jenis penyesuaian" * | Radio: "Persentase" (`percent`) / "Nominal per guide" (`flat_per_guide`) |
| "Nilai" * | Percent: 0–100 (integer). Flat: money ≥ 0. |
| "Aktif" | Switch |

### 3.5 Tab "Hari Libur"

A year selector ("2026 ▾") with a list of dates: "Tanggal" (long format), "Nama hari libur", actions "Ubah" / "Hapus". Header: "Tambah Hari Libur".

Form: "Tanggal" * (date, unique), "Nama" * (2–60 characters).

Holidays may be **hard-deleted**: bookings keep their own price snapshot. Seeded with Indonesian national holidays for 2026–2027.

### 3.6 Tab "Simulasi" (admin and staff)

Desktop: inputs on the left, `PriceSummary` on the right. Mobile: inputs, then the summary.

| Input | Notes |
|---|---|
| "Tanggal tur" * | Date picker. Holidays are marked, and the applied rule is shown in the summary. |
| "Jumlah orang" * | Integer 1–200 |
| "Paket" * | Select of active packages |
| "Add-on" | Checkboxes of active add-ons that the selected package does not already include |

Output (`PriceSummary`, recomputed live, no save):

```
Paket Reguler — Rp 500.000 × 2 guide             Rp 1.000.000
Akhir pekan (+20%)                                 Rp   200.000
Fast Track (Angling) — Rp 50.000 × 12 orang        Rp   600.000
Dokumentasi foto                                   Rp   150.000
Termasuk: Snack, Air mineral, Voucher merchandise, …
────────────────────────────────────────────────────────────────
Total                                              Rp 1.950.000
Butuh 2 tour guide (maks. 8 orang per guide)
```

Simulation never checks availability. It is a price quote only. A button **"Buat Pemesanan dengan data ini"** opens the booking wizard ([`05`](05-pemesanan.md)) pre-filled with the date, people, package, and add-ons.

## 4. Data model

### `packages`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `name` | text | not null |
| `description` | text, nullable | |
| `price_per_guide` | integer | rupiah, ≥ 0 |
| `max_people_per_guide` | integer | 1–50 |
| `sort_order` | integer | |
| `is_active` | integer (bool) | |
| `created_at`, `updated_at` | text | |

### `facilities`

`id`, `name`, `icon` (text, one of the fixed lucide names), `sort_order`, `is_active`, timestamps.

### `package_facilities`

`package_id`, `facility_id`. PK of both.

### `addons`

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `name` | text | not null |
| `description` | text, nullable | |
| `price` | integer | rupiah, ≥ 0 |
| `unit` | text enum | `per_booking` · `per_person` |
| `sort_order`, `is_active`, timestamps | | |

### `package_included_addons`

`package_id`, `addon_id`. PK of both. Seed: Premium and VIP Private → Fast Track (Angling).

### `price_rules`

| Column | Type | Notes |
|---|---|---|
| `id` | text | PK |
| `type` | text enum, unique | `weekend` · `holiday` |
| `name` | text | "Akhir pekan" · "Hari libur nasional" |
| `kind` | text enum | `percent` · `flat_per_guide` |
| `value` | integer | percent (0–100) or rupiah |
| `is_active` | integer (bool) | |
| `updated_at` | text | |

### `holidays`

`id`, `date` (text `YYYY-MM-DD`, unique), `name`, timestamps.

### Price snapshot (stored on `bookings.price_snapshot`, JSON)

```jsonc
{
  "version": 1,
  "calculatedAt": "2026-10-25T03:12:00Z",
  "date": "2026-11-07",
  "people": 12,
  "package": { "id": "…", "name": "Reguler", "pricePerGuide": 500000, "maxPeoplePerGuide": 8 },
  "guidesNeeded": 2,
  "packageSubtotal": 1000000,
  "surcharge": { "ruleType": "weekend", "name": "Akhir pekan", "kind": "percent", "value": 20, "amount": 200000 },  // or null
  "addons": [
    { "id": "…", "name": "Fast Track (Angling)", "unit": "per_person", "unitPrice": 50000, "quantity": 12, "amount": 600000, "included": false },
    { "id": "…", "name": "Dokumentasi foto", "unit": "per_booking", "unitPrice": 150000, "quantity": 1, "amount": 150000, "included": false }
  ],
  "facilities": ["Snack", "Air mineral", "Voucher merchandise", "Voucher Sarinah & FnB", "Ruang tunggu"],
  "total": 1950000
}
```

`bookings.total_amount` (integer) duplicates `total` for querying and reports.

## 5. Business rules

The price calculation is `calculatePrice(input, config) → PriceSnapshot`, a pure function in `src/domain/pricing.ts`.

1. **BR-03-1 — Guides needed.** `guidesNeeded = ceil(people / package.maxPeoplePerGuide)`, with `people ≥ 1`.
2. **BR-03-2 — Package subtotal.** `packageSubtotal = package.pricePerGuide × guidesNeeded`.
3. **BR-03-3 — Candidate surcharges.** For each **active** rule that applies to the date:
   - `weekend` applies when the ISO weekday is 6 or 7.
   - `holiday` applies when the date is in `holidays`.

   Each candidate's amount:
   - `percent` → `round(packageSubtotal × value / 100)`, rounded half-up to whole rupiah.
   - `flat_per_guide` → `value × guidesNeeded`.
4. **BR-03-4 — Only the highest surcharge applies.** The rule with the largest amount is used. On a tie, `holiday` wins (its name is more informative). With no candidates, `surcharge = null`. **Surcharges never apply to add-ons.**
5. **BR-03-5 — Add-on lines.**
   - **Included add-ons** of the package always appear as lines with `included: true` and `amount: 0`, labelled "Termasuk paket".
   - **Selected add-ons** that the package already includes are ignored (they cannot be charged twice).
   - Otherwise, `per_booking` → `quantity = 1`, `per_person` → `quantity = people`, and `amount = unitPrice × quantity`.
6. **BR-03-6 — Total.** `total = packageSubtotal + (surcharge?.amount ?? 0) + Σ addon.amount`. All values are integer rupiah; there is no tax line (prices include tax, prototype assumption).
7. **BR-03-7 — Snapshot immutability.** A booking's snapshot is written when the booking is created and **recalculated only on reschedule** or when people, package, or add-ons are edited ([`05`](05-pemesanan.md)), always from the **current** configuration. Changing packages, add-ons, rules, or holidays never touches existing snapshots.
8. **BR-03-8 — Deactivation.** Inactive packages, add-ons, and facilities are hidden from the simulator and new bookings. Existing bookings keep displaying them from the snapshot. If an existing booking whose package is now inactive is rescheduled, it is recalculated with that package's current stored values. Deactivation does not block this.
9. **BR-03-9** A package must keep its `max_people_per_guide` ≥ 1. Editing it does not affect existing bookings' `guidesNeeded` until they are rescheduled or edited.
10. **BR-03-10 — Display.** Money is formatted `Rp 1.950.000` everywhere (`Intl.NumberFormat('id-ID')` with prefix "Rp ", no decimals). Percent rules display as "+20%". Flat rules display as "+Rp 100.000 / guide".
11. **BR-03-11** Guides never see prices ([overview §4](00-overview.md#4-roles-and-permissions)): nothing from this module is exposed through portal queries.

## 6. Server actions / queries

| Action | Input | Roles | Notes |
|---|---|---|---|
| `listPackages` / `getPackage` | includeInactive? | admin, staff | With facilities and included add-ons |
| `createPackage` / `updatePackage` | package fields, facilityIds[], includedAddonIds[] | admin | Name uniqueness among active packages |
| `setPackageActive` | id, isActive | admin | |
| `listAddons` / `createAddon` / `updateAddon` / `setAddonActive` | … | list: admin, staff · write: admin | |
| `listFacilities` / `createFacility` / `updateFacility` / `setFacilityActive` | … | list: admin, staff · write: admin | |
| `listPriceRules` / `updatePriceRule` | type, kind, value, isActive | list: admin, staff · write: admin | |
| `listHolidays` / `createHoliday` / `updateHoliday` / `deleteHoliday` | year? / date, name | list: admin, staff · write: admin | Date uniqueness |
| `simulatePrice` | date, people, packageId, addonIds[] | admin, staff | Returns `PriceSnapshot` (not persisted) and `guidesNeeded` |
| `getPricingConfig` | — | (internal) | Loads active packages, add-ons, rules, and holidays for `calculatePrice` |

## 7. Notifications

None.

## 8. Edge cases

| Case | Expected |
|---|---|
| 8 people, Reguler (max 8) | 1 guide |
| 9 people, Reguler | 2 guides; subtotal Rp 1.000.000 |
| 6 people, VIP Private (max 4) | 2 guides; subtotal Rp 2.400.000 |
| Saturday that is also a holiday, Reguler, 1 guide | weekend 20 % = Rp 100.000 vs holiday 25 % = Rp 125.000 → holiday applies, Rp 125.000 |
| Weekend rule inactive, Saturday | No surcharge |
| Premium + Fast Track selected | Fast Track shown as "Termasuk paket", Rp 0, not charged |
| Price changed after booking | Booking keeps its old snapshot and total |
| Holiday deleted | Only future calculations change |
| Saturday holiday, 2 guides Reguler; weekend = flat Rp 100.000 / guide, holiday = 25 % | weekend Rp 200.000 vs holiday Rp 250.000 → holiday, Rp 250.000 |

## 9. Out of scope

Rule types beyond weekend/holiday (seasonal, early-bird, language surcharge, promo codes), multi-currency, tax breakdown, per-channel pricing, discounts. These can be added as new `price_rules.type` values later.

## 10. Acceptance criteria

1. **Given** Reguler (Rp 500.000, max 8) and 12 people on a weekday with no add-ons, **when** calculated, **then** `guidesNeeded = 2`, total = **Rp 1.000.000**.
2. **Given** the same on a Saturday with weekend +20 %, **then** surcharge Rp 200.000 and total Rp 1.200.000.
3. **Given** a Saturday that is also a holiday (weekend +20 %, holiday +25 %), **then** only the holiday surcharge applies.
4. **Given** 12 people, Reguler, Fast Track (Rp 50.000 / orang) and Dokumentasi (Rp 150.000 / pemesanan) on a Saturday, **then** total = 1.000.000 + 200.000 + 600.000 + 150.000 = **Rp 1.950.000**.
5. **Given** Premium with Fast Track included and Fast Track also selected, **then** Fast Track appears once with `included: true`, amount 0.
6. **Given** a booking with total Rp 500.000, **when** the admin changes Reguler to Rp 600.000, **then** the booking still shows Rp 500.000.
7. **Given** the weekend rule switched to "Nominal per guide" Rp 100.000 and a 2-guide booking on Sunday, **then** surcharge = Rp 200.000.
8. **Given** a staff user on `/harga`, **then** no create, edit, or deactivate controls are visible, Simulasi works, and calling `updatePackage` returns 403.
9. **Given** a simulation, **when** "Buat Pemesanan dengan data ini" is clicked, **then** the booking wizard opens with the date, people, package, and add-ons pre-filled.
10. **Given** an inactive add-on, **then** it is not offered in Simulasi or new bookings, but existing bookings still show it in their price breakdown.
