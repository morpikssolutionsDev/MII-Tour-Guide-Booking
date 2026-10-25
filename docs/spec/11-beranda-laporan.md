# 11 — Beranda & Laporan (Home Dashboard & Reports)

> Status: **Draft v1** · Last updated: 2026-10-25 · Depends on: every module (read-only) · Design: [design-system §3.5 (charts), §6.4–6.5, §7.3](design-system.md)

## 1. Purpose

Two read-only views over the data:

- **Beranda** (`/beranda`): the operational home for admin and staff. It answers *"what needs attention today?"*: today's tours, holds about to expire, preparation gaps, guides who haven't confirmed, pending leave, payment differences, and recent feedback.
- **Laporan** (`/laporan`): performance over a period. It covers bookings, revenue, guide utilisation, ratings, repeat customers, and H-2 compliance; breakdowns by channel, staff, language, and slot; guide performance; and the feedback list, with **CSV export** of every table.

Serves flow step **7 (Evaluasi & Follow Up)**: "Data Sales Performance", "Feedback Pelanggan", "Peluang Repeat Visit". Also pain point 5 (cross-team visibility).

## 2. User stories

- As **staff**, I want to open the app and see today's tours and everything that needs action, so that nothing slips.
- As an **admin**, I want to see how many bookings and how much revenue each channel and each staff member brought in a period.
- As an **admin**, I want to know how busy each guide is, how they are rated, and how often we met the H-2 target.
- As an **admin**, I want to see what share of customers return and how many say they would visit again.
- As **admin/staff**, I want to export any table to CSV for further analysis.

## 3. Screens

### 3.1 Beranda: `/beranda` (admin, staff)

**Header band** (photo, [design-system §6.5](design-system.md#65-header-band-photo)):

- greeting "Selamat pagi / siang / sore / malam, {nama}", based on WIB time: < 11:00 pagi, < 15:00 siang, < 18:00 sore, else malam;
- the long date;
- a summary line: "{x} tur hari ini · {y} menunggu pembayaran".

**KPI row** (4 tiles overlapping the band):

| Tile | Value | Sub-line |
|---|---|---|
| "Tur hari ini" | Bookings today in `confirmed` / `ready` / `completed` / `evaluated` / `no_show` | "{n} selesai" |
| "Menunggu pembayaran" | Count of `awaiting_payment` | "{m} kedaluwarsa < 6 jam" (warning style if > 0) |
| "Guide bertugas hari ini" | "{busy}/{working}" (distinct guides with active assignments today / guides working today) | "{k} sedang cuti" |
| "Belum konfirmasi" | Notified, unacknowledged assignments for tours in the next 7 days | "Terdekat: {tanggal}" |

**Attention widgets** (desktop: 2-column grid; mobile: stacked in this order; each card has a title, a count badge, up to 5 rows, and "Lihat semua →"):

| # | Widget | Rows | Row action | "Lihat semua" |
|---|---|---|---|---|
| 1 | **"Tur hari ini"** | Grouped by slot: time, code, customer, language · people, guides, `StatusBadge`; the ongoing slot gets the glow line | Open booking | `/pemesanan?view=hari-ini` |
| 2 | **"Segera kedaluwarsa"** | `awaiting_payment` with `hold_expires_at` within 6 h, soonest first: code, customer, countdown, total | "Tandai Lunas" (opens the 06 dialog) | `/pemesanan?view=menunggu-pembayaran` |
| 3 | **"Persiapan belum lengkap"** | `confirmed` bookings with tour date ≤ today + 2 and checklist not complete: code, date · slot, progress "2/4" | Open booking | `/pemesanan?view=perlu-persiapan` |
| 4 | **"Guide belum konfirmasi"** | Unacknowledged assignments, tour ≤ today + 7, oldest notice first: guide, code, tour date, "diberi tahu {relative}", "di bawah H-2" badge | "Kirim ulang" ([BR-07-7](07-persiapan.md#5-business-rules)) | — |
| 5 | **"Permintaan cuti"** (**admin only**) | Pending leave: guide, range, conflicts count | "Tinjau" → `/tour-guide/cuti` | `/tour-guide/cuti` |
| 6 | **"Selisih pembayaran"** | Bookings (not `awaiting_payment`, not `cancelled`) with balance ≠ 0: code, "Kurang bayar / Kelebihan bayar Rp x" | Open booking | — |
| 7 | **"Ulasan terbaru"** | The last 5 submitted feedback entries: stars, guide, short comment, time. Rows with any guide rating ≤ threshold are highlighted with a `--danger` left border and an `AlertTriangle` icon. | Open booking | `/laporan?tab=ulasan` |

- An empty widget shows a one-line positive state (e.g. "Semua guide sudah konfirmasi ✓") instead of a big illustration, to keep Beranda compact.
- Data refreshes on focus and every 60 s. Lazy hold expiry runs first ([BR-05-11](05-pemesanan.md#5-business-rules)).

### 3.2 Laporan: `/laporan` (admin; staff read-only, identical view)

**Header band** (photo, shorter: 160 px desktop / 120 px mobile) with the title "Laporan" and the active period.

**`FilterBar`** (one row, sticky under the top bar on desktop):

- "Periode": "7 hari terakhir" · "30 hari terakhir" (default) · "90 hari terakhir" · "Bulan ini" · "Bulan lalu" · "Kustom" (max 366 days);
- "Kanal", "Bahasa", "Paket", "Tour Guide" (multi-select each);
- "Reset".

Filters are reflected in the URL. Every widget on the page uses the same filters.

**Tabs**: **"Ringkasan"** · **"Tour Guide"** · **"Ulasan"**.

#### Tab "Ringkasan"

**KPI tiles** (6; a 3×2 grid on desktop, horizontal scroll on mobile). Each shows a delta vs the previous period of equal length, with ▲/▼ and colour per [design-system §7.3](design-system.md#73-product-components):

| Tile | Definition |
|---|---|
| "Pemesanan" | BR-11-2 count. Sub-line: "{c} dibatalkan ({p}%)" |
| "Pendapatan" | BR-11-3 |
| "Utilisasi guide" | BR-11-4, as % |
| "Rating rata-rata" | Mean `overall_rating` of feedback submitted in the period, "★ 4,6 (32 ulasan)" |
| "Pelanggan kembali" | BR-11-5, as % |
| "Kepatuhan H-2" | BR-07-10, as % |

The delta is green ▲ for an improvement and red ▼ for a decline. For "dibatalkan %", a lower value is better.

**Charts** (each card has a title, chart, "Lihat tabel" toggle, and "Unduh CSV"):

| Chart | Form | Notes |
|---|---|---|
| "Pemesanan per kanal" | Horizontal bar, single series (`--color-chart-1`) | 3 bars; value labels at bar ends |
| "Pemesanan per staf" | Horizontal bar, single series | Sorted descending; inactive staff marked "(nonaktif)" |
| "Pemesanan per bahasa" | Horizontal bar, single series | |
| "Pemesanan per slot" | Vertical bar, single series | Slot order (09.00, 12.00, 16.00…) |
| "Tren pendapatan" | Line (or columns for ≤ 14 points), single series; optional toggle "Pisah per kanal" → 3 series (chart slots 1–3) with a legend + direct labels | Granularity: ≤ 31 days daily, ≤ 120 days weekly (ISO weeks), otherwise monthly |
| "Status pemesanan" | Compact table (not a chart): count per status with `StatusBadge` | |

All charts follow [design-system §3.5](design-system.md#35-chart-palette-validated): one axis, hover tooltip with the exact value (Rupiah or count), and gridlines in Kabut 100.

**Table "Penjualan per staf"**: "Staf", "Kanal default", "Pemesanan", "Dibatalkan", "Pendapatan" (BR-11-6), "Rata-rata nilai pemesanan". With CSV.

#### Tab "Tour Guide"

**Table "Kinerja tour guide"** (sortable; cards on mobile):

| Column | Definition |
|---|---|
| Tour Guide | Name + languages |
| "Tur" | Count of the guide's non-released assignments on `completed` / `evaluated` bookings, tour date in the period |
| "Tidak hadir" | Same on `no_show` |
| "Rating guide" | AVG of `feedback_guide_ratings.rating` for the guide, feedback submitted in the period, "★ 4,8 (12)" |
| "Diisi oleh guide" | Count of the ratings above where `feedback.source = guide` (transparency, [`10` §8](10-ulasan.md#8-edge-cases)) |
| "Utilisasi" | BR-11-4 computed for this guide alone |
| "Kepatuhan H-2" | BR-07-10 for this guide's assignments |
| "Hari cuti" | Approved leave days within the period |

Row click → `/tour-guide/[id]`. With CSV.

#### Tab "Ulasan"

**Table** of submitted feedback in the period (newest first):

| Column | Content |
|---|---|
| Tanggal | Submission date |
| Kode | Booking code (link) |
| Pelanggan | Name + nationality |
| Tour Guide | Names with per-guide stars |
| Keseluruhan | Overall stars |
| Ingin kembali | "Ya" / "Mungkin" / "Tidak" |
| Persetujuan kontak | ✓ / — |
| Sumber | "Wisatawan" / "Staf" / "Guide" |
| Komentar | Expandable text |

Filters inside the tab: "Rating ≤ 2", "Ada komentar", "Sumber".

Above the table, a summary row: "Ingin berkunjung lagi: Ya {a}% · Mungkin {b}% · Tidak {c}%" as a 100 % stacked bar (3 segments; chart slots 1–3 with a 2 px gap; a legend + direct % labels), plus "Tingkat respons ulasan: {r}%" (BR-11-7). With CSV.

## 4. Data model

No tables of its own. Every figure is computed on request with SQL aggregates (Drizzle) over the existing tables. At prototype scale (thousands of rows) no pre-aggregation or caching is needed beyond a request-level memo. Report queries live in `src/server/reports/` and the pure metric maths (ratios, deltas, bucketing) in `src/domain/metrics.ts` (unit-tested).

## 5. Business rules

1. **BR-11-1 — Period basis.** All dates are WIB. Each metric uses a stated date basis:
   - **booking metrics**: `tour_date` in the period;
   - **revenue**: `paid_at` ([BR-06-9](06-pembayaran.md#5-business-rules));
   - **ratings**: `feedback.submitted_at`;
   - **utilisation**: calendar days in the period.

   The previous period for deltas is the period of equal length immediately before it.
2. **BR-11-2 — "Pemesanan"** = bookings with `tour_date` in the period and status ∉ {`cancelled`}. The cancelled count and % are shown separately. Filters (Kanal, Bahasa, Paket, Tour Guide) apply to the bookings. The Tour Guide filter means "at least one non-released assignment to the guide".
3. **BR-11-3 — "Pendapatan"** = Σ valid `payments.amount` (payments + adjustments) with `paid_at` in the period. Booking-level filters apply to each payment's booking.
4. **BR-11-4 — "Utilisasi guide"**:
   - **booked guide-slots** = non-released assignments on bookings with status ∈ {`confirmed`, `ready`, `completed`, `evaluated`, `no_show`} and `tour_date` in the period;
   - **available guide-slots** = Σ over each day in the period of (active slots that day × guides *working* that day, [BR-02-1](02-tour-guide.md#5-business-rules), using the current working days and approved leave);
   - utilisation = booked ÷ available, or "—" if available = 0.

   Unpaid holds are excluded. Filters: Bahasa restricts both sides to guides speaking it; Tour Guide restricts both sides to the selected guides.
5. **BR-11-5 — "Pelanggan kembali"** = among distinct customers with at least one `completed` / `evaluated` booking in the period, the share whose **lifetime** count of `completed` / `evaluated` bookings (up to the period end) is ≥ 2.
6. **BR-11-6 — Staff attribution.** Bookings and revenue per staff use `bookings.created_by`. Revenue attributes each payment to its booking's creator.
7. **BR-11-7 — "Tingkat respons ulasan"** = submitted feedback ÷ bookings that reached `completed` in the period (`completed_at` in the period, including those now `evaluated`).
8. **BR-11-8 — Beranda counts** ignore the Laporan filters and always use "now" (WIB). "Today" = the current WIB date.
9. **BR-11-9 — Permissions.** Admin and staff see identical reports and can export. The "Permintaan cuti" widget is admin-only. Guides have no access (BR-01-5).
10. **BR-11-10 — CSV export.**
    - UTF-8 **with BOM** (Excel-friendly), comma-separated, RFC 4180 quoting.
    - Header row in Indonesian (the same column labels as on screen).
    - Money as plain integers (no "Rp", no separators), dates `YYYY-MM-DD`, times `HH:mm`, ratings with a dot decimal (`4.6`), percentages as decimals (`0.82`).
    - The export reflects the current filters and the full result (not just the visible page).
    - Filename: `laporan-{tabel}-{YYYYMMDD}-{YYYYMMDD}.csv`, e.g. `laporan-kinerja-guide-20261001-20261031.csv`.
11. **BR-11-11 — Number display.** Indonesian formatting on screen: thousands "." and decimal "," ("4,6", "82%", "Rp 12.450.000"). KPI values over Rp 1 juta may be abbreviated ("Rp 12,4 jt") with the exact value in the tooltip.

## 6. Server actions / queries

| Query | Input | Roles | Output |
|---|---|---|---|
| `getDashboard` | — | admin, staff (leave widget admin only) | KPI tiles + widget rows (max 5 each) + counts |
| `getReportSummary` | period, filters | admin, staff | 6 KPIs with previous-period values |
| `getBookingsBreakdown` | period, filters, dimension (`channel` / `staff` / `language` / `slot` / `status`) | admin, staff | `[{ key, label, count }]` |
| `getRevenueTrend` | period, filters, splitByChannel? | admin, staff | `[{ bucketStart, amount, channel? }]` + granularity |
| `getStaffSales` | period, filters | admin, staff | Rows for "Penjualan per staf" |
| `getGuidePerformance` | period, filters | admin, staff | Rows for "Kinerja tour guide" |
| `listFeedbackReport` | period, filters, tab filters, page | admin, staff | Rows + revisit distribution + response rate |
| `exportCsv` | report key, period, filters | admin, staff | `text/csv` stream (route handler `/laporan/export/[key]`) |

## 7. Notifications

None.

## 8. Edge cases

| Case | Expected |
|---|---|
| A period with no data | KPI values "0" / "—"; charts show the empty state "Belum ada data untuk periode ini." (no illustration) |
| A future period (e.g. "Bulan ini" includes upcoming days) | Booking counts include confirmed future tours. Utilisation counts future available days, so it reads lower mid-month. A caption explains: "Termasuk jadwal mendatang." |
| A guide deactivated mid-period | Still listed in Kinerja for the period (with the "Nonaktif" badge) if they had assignments |
| A staff user deactivated | Still appears in "Pemesanan per staf" with "(nonaktif)" |
| A refund larger than the period's payments | Revenue can be negative for the period; shown in `--danger` with ▼ |
| Previous period with 0 | Delta shows "—" (no ∞ %) |
| Custom range > 366 days | Rejected: "Rentang maksimal 366 hari." |

## 9. Out of scope

Scheduled or emailed reports, PDF export, custom report builders, drill-down charts, real-time websockets, forecasting, cohort analysis, data warehouse or BI integration.

## 10. Acceptance criteria

1. **Given** seeded data, **when** staff open `/beranda` at 10:00 WIB, **then** the band greets "Selamat pagi", and today's tours are grouped by slot with the 09.00–12.00 slot highlighted as ongoing.
2. **Given** a booking whose hold expires in 2 hours, **then** it appears in "Segera kedaluwarsa" with a countdown, and "Tandai Lunas" opens the payment dialog.
3. **Given** a staff user, **then** the "Permintaan cuti" widget is not rendered. For an admin it is.
4. **Given** 10 bookings in the period (2 cancelled), **then** "Pemesanan" = 8 with the sub-line "2 dibatalkan (20%)".
5. **Given** payments of Rp 1.000.000 and Rp 500.000 and a refund of −Rp 200.000 in the period, **then** "Pendapatan" = Rp 1.300.000.
6. **Given** a 1-day period with 3 active slots, 8 working guides, and 6 booked guide-slots, **then** "Utilisasi guide" = 25 %.
7. **Given** 4 customers with completed visits in the period, one of whom also had an earlier completed visit, **then** "Pelanggan kembali" = 25 %.
8. **Given** the filter Kanal = Call Center, **then** every KPI, chart, and table reflects only Call Center bookings (and their payments).
9. **Given** "Unduh CSV" on "Kinerja tour guide", **then** the file opens in Excel with correct Indonesian headers and characters, includes all guides (not just the visible page), and money and ratings are plain numbers.
10. **Given** a 90-day period, **then** "Tren pendapatan" uses weekly buckets. With "Pisah per kanal" on, it shows 3 series with a legend, and the tooltip lists each channel's value.
11. **Given** the previous period had 0 bookings, **then** the "Pemesanan" delta shows "—".
12. **Given** a guide user, **when** opening `/laporan` or calling `getReportSummary`, **then** they are redirected / receive 403.
