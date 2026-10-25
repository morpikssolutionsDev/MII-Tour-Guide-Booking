# Design System: "Senja di TMII"

> Status: **Draft v1** · Last updated: 2026-10-25
> Applies to every screen in the app. Module specs reference tokens and components by the names defined here. See [`00-overview.md`](00-overview.md) for product context.

---

## 1. Principles

The look comes from the TMII aerial photo (`webAsset/top_bg.jpg`): the **archipelago lake at dusk**. Misty sage-teal water, deep foliage, warm amber lights tracing the island edges, stone paths, and a blue-grey haze. The product is an **internal operations tool**, so the mood serves clarity first.

1. **Calm surfaces, warm signals.** Large areas are stone (Batu) and white. Colour is spent on meaning: status, selection, the one primary action on screen.
2. **Brand red is precious.** Merah TMII belongs to the logo and the primary action. It is never decoration, and never a status color (except the "Tidak Hadir" tint).
3. **The amber "glow line".** The lit island edges in the photo become the system's signature accent: a thin **Senja** line marking what is *current* (active nav item, today, the highlighted card).
4. **Dense on desktop, thumb-friendly on mobile.** Staff work at desks and at the counter; guides work in the park, on their phones.
5. **Never color alone.** Every status carries an icon and a label.
6. **Delight at the edges only.** The animated decorated logo and the illustrations appear on login, empty states, and the public feedback page. Never on data-dense screens.

## 2. Source palette

Colours sampled from the photo, from which the ramps in §3 are derived:

| Sample | Hex | Became |
|---|---|---|
| Lake water | `#84ADB2` | **Danau** 400 |
| Island grass | `#449487` | reference for **Rimba** 400 |
| Deep foliage | `#0D2D1F` | **Rimba** 900 |
| Warm lights (median) | `#F3AC69` | **Senja** 400 |
| Amber glow on tower | `#CB781A` | **Senja** 600 |
| Stone path | `#D3AD80` | **Batu** 400 |
| Haze sky / far trees | `#9DC8DC` / `#73AAC5` | reference for **Kabut** (blue-grey) |
| Brand | `#EC1B24` | **Merah** 500 (logo red, unchanged) |

## 3. Colour tokens

### 3.1 Ramps

| Step | Merah (brand) | Danau (lake) | Senja (dusk light) | Rimba (forest) | Batu (stone) | Kabut (haze, neutral) |
|---|---|---|---|---|---|---|
| 50 | `#FEF2F2` | `#F1F7F8` | `#FFF6EC` | `#EEF5F1` | `#FBF8F3` | `#F5F8F9` |
| 100 | `#FDE0E1` | `#DDECEE` | `#FEE9D2` | `#D6E8DE` | `#F5EFE5` | `#E8EEF0` |
| 200 | `#FBC0C3` | `#BCD8DC` | `#FBD3A8` | `#AED1BE` | `#EBDFCB` | `#D2DCE0` |
| 300 | `#F68F94` | `#9DC3C9` | `#F7BE86` | `#7FB49A` | `#DEC8A6` | `#B3C2C8` |
| 400 | `#F1555C` | `#84ADB2` | `#F3AC69` | `#4E9474` | `#D3AD80` | `#8FA2AA` |
| 500 | `#EC1B24` | `#3D8A99` | `#E8913F` | `#2F7757` | `#BA8F5E` | `#6E838C` |
| 600 | `#C8141C` | `#2B6F7C` | `#CB781A` | `#215E44` | `#977148` | `#566971` |
| 700 | `#A01017` | `#245B66` | `#A35E12` | `#184A35` | `#745737` | `#44545B` |
| 800 | `#7A0D12` | `#1E4950` | `#7B460E` | `#113A29` | `#533E28` | `#333F45` |
| 900 | `#540A0D` | `#16353B` | `#52300A` | `#0D2D1F` | `#35281A` | `#222B30` |

### 3.2 Semantic tokens

Components use **semantic tokens only**, never ramp steps directly.

| Token | Value | Use |
|---|---|---|
| `--background` | Batu 50 `#FBF8F3` | Page plane |
| `--surface` | `#FFFFFF` | Cards, tables, dialogs, inputs |
| `--surface-muted` | Batu 100 `#F5EFE5` | Table header, secondary panels, read-only fields |
| `--text` | Kabut 900 `#222B30` | Body text, headings |
| `--text-muted` | Kabut 600 `#566971` | Secondary text, captions, **placeholders** |
| `--border` | Kabut 200 `#D2DCE0` | Card / table hairlines, dividers |
| `--border-input` | Kabut 500 `#6E838C` | Input, select, and checkbox outlines (≥ 3:1) |
| `--primary` | Merah 600 `#C8141C` | Primary button fill, the main action |
| `--primary-hover` | Merah 700 `#A01017` | Primary hover / pressed |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--brand` | Merah 500 `#EC1B24` | Logo and brand marks **only** (see note) |
| `--selection` | Danau 50 bg + Danau 700 border/text | Selected slot chip, selected guide card, selected row |
| `--link` | Danau 700 `#245B66` | Inline links |
| `--focus-ring` | Danau 600 `#2B6F7C` | 2 px focus ring, 2 px offset |
| `--glow` | Senja 400 `#F3AC69` | The "glow line": active nav indicator, today marker, highlight edge |
| `--sidebar` | Rimba 900 `#0D2D1F` | Desktop sidebar, mobile drawer |
| `--sidebar-text` / `-muted` | Kabut 100 `#E8EEF0` / Kabut 400 `#8FA2AA` | Sidebar labels / section headings |
| `--sidebar-active` | Rimba 700 `#184A35` | Active nav item background (+ glow line on the left) |
| `--success` | Rimba 600 `#215E44` on Rimba 100 | Success text / alert |
| `--warning` | Senja 800 `#7B460E` on Senja 50 | Warning text / alert (e.g. "di bawah H-2", amount mismatch) |
| `--danger` | Merah 700 `#A01017` on Merah 50 | Errors, destructive confirmation |
| `--info` | Danau 800 `#1E4950` on Danau 50 | Informational alert |

> **Why the primary button is Merah 600, not the logo red:** white text on `#EC1B24` measures **4.42:1**, just below the WCAG AA 4.5:1 minimum for normal text. Merah 600 `#C8141C` measures **5.88:1**. The logo keeps pure `#EC1B24`.
>
> **Destructive vs primary:** both are red-family, so destructive actions are **never** a filled button on the page. "Batalkan Pemesanan", "Nonaktifkan" and similar actions are an *outline* button in `--danger`. They open a confirmation dialog whose confirm button is filled Merah 700 and names the action ("Ya, batalkan pemesanan").

### 3.3 Verified contrast (WCAG 2.2)

| Pair | Ratio | Requirement |
|---|---|---|
| Text Kabut 900 on Batu 50 / white | 13.61 / 14.42 | ✅ AA 4.5 |
| Muted Kabut 600 on Batu 50 / white | 5.42 / 5.75 | ✅ AA 4.5 |
| White on Merah 600 (primary) | 5.88 | ✅ AA 4.5 |
| White on Merah 500 (logo red) | 4.42 | ❌ text, so never used for button text |
| Link Danau 700 on white | 7.60 | ✅ AA 4.5 |
| Focus ring Danau 600 on Batu 50 | 5.40 | ✅ 3:1 non-text |
| Input border Kabut 500 on white | ≈ 3.9 | ✅ 3:1 non-text |
| Sidebar text Kabut 100 on Rimba 900 | 12.69 | ✅ |
| Sidebar muted Kabut 400 on Rimba 900 | 5.61 | ✅ |
| Glow Senja 400 on Rimba 900 | 7.73 | ✅ 3:1 non-text |
| All status badges (§3.4) | 6.5 – 8.2 | ✅ AA 4.5 |

### 3.4 Booking status

Badges use a tinted background, dark text, **and an icon**, so colour is never the only signal. Labels are exactly as written.

| Status (enum) | Label | Background | Text | Icon (lucide) | Contrast |
|---|---|---|---|---|---|
| `awaiting_payment` | Menunggu Pembayaran | Senja 100 | Senja 800 | `Clock` | 6.53 |
| `confirmed` | Terkonfirmasi | Danau 100 | Danau 800 | `BadgeCheck` | 8.15 |
| `ready` | Siap | Rimba 100 | Rimba 700 | `ClipboardCheck` | 7.95 |
| `completed` | Selesai | Rimba 600 | white | `CheckCheck` | 7.64 |
| `evaluated` | Dievaluasi | Batu 200 | Batu 800 | `Star` | 7.64 |
| `no_show` | Tidak Hadir | Merah 50 | Merah 700 | `UserX` | 7.44 |
| `cancelled` | Dibatalkan | Kabut 100 | Kabut 700 | `XCircle` | 6.72 |

Other recurring badges:

| Badge | Style |
|---|---|
| Kanal: Sales / Call Center / On the Spot | Neutral outline (Kabut 200 border, Kabut 700 text) + icon `Megaphone` / `Headset` / `MapPin` |
| Pelanggan kembali (×N) | Senja 50 bg, Senja 800 text, icon `Repeat` |
| di bawah H-2 | Warning style, icon `AlertTriangle` |
| Bahasa (EN / AR / RU) | Neutral pill, 2-letter code + full name in the tooltip |
| Cuti: Menunggu / Disetujui / Ditolak | Senja / Rimba / Kabut tints (same scheme as statuses) |
| Nonaktif | Kabut 100 bg, Kabut 700 text, icon `CircleOff` |

### 3.5 Chart palette (validated)

Charts are light-mode only (the product has no dark mode). Chart surface is `--surface` `#FFFFFF`.

**Categorical**, assigned in this fixed order and never cycled. Use it for multi-series charts such as a revenue trend split by channel:

| Slot | Name | Hex |
|---|---|---|
| 1 | Danau biru | `#1C7FA6` |
| 2 | Senja jingga | `#DC7A22` |
| 3 | Senja ungu | `#7A5AA8` |
| 4 | Batu emas | `#B8862B` |

Validated with the dataviz validator (`--mode light --surface #FFFFFF`): lightness band PASS · chroma floor PASS · CVD separation PASS (worst adjacent ΔE 19.4) · normal-vision floor PASS (worst adjacent ΔE 25.5) · contrast ≥ 3:1 PASS. **Maximum 4 series.** Anything beyond folds into "Lainnya" (other).

**Single-series charts** (bookings by channel, by language, by slot, by staff) are magnitude comparisons: **one colour, slot 1**, not one colour per bar. Category identity comes from the axis labels.

**Sequential** (e.g. a utilisation heatmap on the schedule): one hue, light → dark.
`#D3E8F2` · `#A8D0E5` · `#7CB8D8` · `#4F9FC7` · `#1C7FA6` · `#176A8B` · `#115370`

Chart rules:

- One y-axis only. No dual-axis charts.
- Bars: 4 px rounded data-end, 2 px gap between adjacent bars.
- Lines: 2 px, markers ≥ 8 px on hover.
- Gridlines: Kabut 100 hairlines. Axis text: `--text-muted`. Values and labels use text tokens, never the series colour.
- A legend is required for ≥ 2 series. Direct labels for ≤ 4 series.
- Every chart has a hover tooltip and a **table view toggle** ("Lihat tabel"), which also feeds the CSV export.
- Status colours (§3.4) are reserved and never used as series colours.

## 4. Typography

**Plus Jakarta Sans** (Google Fonts, via `next/font`) at weights 400 / 500 / 600 / 700. Fallback: `system-ui, -apple-system, "Segoe UI", sans-serif`.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 30 / 36 (mobile 26 / 32) | 700 | Login title, Beranda greeting |
| `h1` | 24 / 32 (mobile 20 / 28) | 700 | Page title |
| `h2` | 18 / 26 | 600 | Section / card title |
| `h3` | 16 / 24 | 600 | Sub-section, dialog title |
| `body` | 14 / 20 | 400 | Default text (desktop) |
| `body-lg` | 16 / 24 | 400 | Default text in the guide portal and on the public feedback page |
| `label` | 14 / 20 | 500 | Form labels, buttons |
| `caption` | 12 / 16 | 500 | Meta text, table headers (sentence case, not all caps) |
| `kpi` | 28 / 32 (mobile 24 / 28) | 700 | KPI tile value (proportional figures) |

- Form **inputs are 16 px on mobile** (prevents iOS zoom on focus).
- Use `font-variant-numeric: tabular-nums` for money and times in tables, the price summary, and booking codes.
- Booking codes (`TG-261025-004`) are set in 500 weight with tabular numerals.

## 5. Space, shape, depth

- **Spacing**: 4 px base. Common steps: 4, 8, 12, 16, 24, 32, 48. Page gutter 16 px mobile, 24 px tablet, 32 px desktop.
- **Radius**: `sm` 6 px (badges, small chips) · `md` 10 px (buttons, inputs) · `lg` 14 px (cards, tables) · `xl` 20 px (dialogs, bottom sheets, hero panels) · `full` (pills, avatars).
- **Elevation**:
  - `shadow-card`: `0 1px 2px rgb(13 45 31 / 0.06), 0 1px 1px rgb(13 45 31 / 0.04)`
  - `shadow-overlay`: `0 12px 32px rgb(13 45 31 / 0.18)` for dialogs, popovers, and sheets
  - Shadows are tinted with Rimba 900, never pure black.
- **Borders**: 1 px `--border`. Cards have border **and** `shadow-card`.
- **The glow line**: 3 px `--glow`, rounded ends. It appears on:
  - the left edge of the active sidebar item
  - the top edge of the "Hari ini" card in Beranda and the guide portal
  - the column header for today in Papan Jadwal
  - the underline of the active tab

## 6. Layout and responsiveness

### 6.1 Breakpoints

Tailwind defaults: `sm` 640 · **`md` 768** · **`lg` 1024** · `xl` 1280. Design at **360 px** (mobile), **768 px** (tablet), and **1280 px** (desktop).

### 6.2 App shell: Admin and Staff

| | Mobile (< 768) | Tablet (768–1023) | Desktop (≥ 1024) |
|---|---|---|---|
| Navigation | Top bar + **bottom tab bar (4 tabs)** + drawer | Collapsed sidebar (icons only, 72 px) | Full sidebar (248 px), collapsible to 72 px |
| Top bar | Page title, bell, avatar | Page title, bell, avatar | Breadcrumb, bell, user menu |
| Primary create action | Floating "Buat Pemesanan" button above the tab bar | In the page header | In the page header |
| Content width | Full width, 16 px gutter | Full width, 24 px gutter | Max 1280 px, 32 px gutter |

**Sidebar** (Rimba 900): white logo at the top, nav items grouped with Kabut 400 section labels. The active item uses `--sidebar-active` + the glow line. The user card and "Keluar" sit at the bottom.

| Group | Admin | Staff |
|---|---|---|
| Operasional | Beranda · Pemesanan · Papan Jadwal · Pelanggan | Beranda · Pemesanan · Papan Jadwal · Pelanggan |
| Master Data | Tour Guide · Harga · Pengaturan · Pengguna | Tour Guide (view) · Harga (view) |
| Analitik | Laporan · Outbox | Laporan |

**Mobile bottom tabs** (admin and staff): **Beranda · Pemesanan · Jadwal · Lainnya**. "Lainnya" (more) opens the drawer with the remaining items.

### 6.3 App shell: Guide portal (mobile-first)

- Top bar: logo mark, bell, avatar.
- **Bottom tabs: Hari Ini · Jadwal · Cuti · Akun**.
- On desktop the same content is centred in a 560 px column with the tabs as a top tab bar. No sidebar.
- Body text is `body-lg`. Tap targets are ≥ 48 px. Primary buttons are full-width at the bottom of the screen ("Saya siap", "Tandai Selesai").

### 6.4 Page patterns

| Pattern | Desktop | Mobile |
|---|---|---|
| **List page** (Pemesanan, Pelanggan, Tour Guide) | Filter row above a data table; sortable columns; pagination 20/page | Search + "Filter" button opening a bottom sheet; **each row becomes a stacked card** (code + status badge on top, customer, date · slot, guides); infinite "Muat lebih banyak" |
| **Detail page** (Pemesanan detail) | Two columns: main (info, guides, checklist, payment) + right rail 360 px (status, price summary, actions, Riwayat) | Single column; status + actions in a sticky header; Riwayat collapsed at the bottom |
| **Wizard** (Buat Pemesanan) | Steps on the left, form in the centre, **sticky "Ringkasan" (summary) panel on the right** showing the live price | Stepper at the top; **sticky bottom bar** with total + "Lanjut" (next); the summary opens as a bottom sheet |
| **Form** (master data) | Two-column grid of fields where they pair naturally (≤ 720 px wide) | Single column; actions in a sticky bottom bar |
| **Dialog** | Centred modal, max 520 px | **Bottom sheet**, full width, drag handle, max 90 vh |
| **Dashboard** (Beranda, Laporan) | Photo header band + KPI row (4–6 tiles) + 2-column card grid | Header band 160 px; KPI tiles in a horizontal scroll row (2.3 visible); cards stacked |

### 6.5 Header band (photo)

Used **only** at the top of Beranda and Laporan (and in the login hero, §8.3):

- Background `top_bg.jpg`, `object-fit: cover`, anchored to the lake (`object-position: 50% 40%`).
- Overlay `linear-gradient(180deg, rgb(13 45 31 / 0.55) 0%, rgb(13 45 31 / 0.85) 100%)` (Rimba 900). White text on it measures ≥ 12:1.
- Height 200 px desktop / 160 px mobile. KPI tiles overlap the band's bottom edge by 32 px.
- Content: greeting in `display` ("Selamat pagi, Rina"), the date in long format, and one summary line ("6 tur hari ini · 2 menunggu pembayaran").
- Ship the image as responsive WebP via `next/image` (≤ 200 KB at 1440 w).

## 7. Components

Base: **shadcn/ui**, themed with the tokens in §10. Only deviations and product-specific components are listed.

### 7.1 Buttons

| Variant | Style | Use |
|---|---|---|
| `primary` | `--primary` fill, white label | One per view: "Simpan", "Buat Pemesanan", "Tandai Lunas", "Saya siap" |
| `secondary` | White, `--border-input` outline, `--text` | Secondary actions |
| `ghost` | Transparent, `--text`, Kabut 100 hover | Toolbar and inline actions |
| `danger-outline` | White, Merah 700 outline + text | Destructive triggers (opens a confirm dialog) |
| `danger` | Merah 700 fill | Only inside a confirmation dialog |

Height 40 px desktop / 44 px mobile; radius `md`; icon 16 px with an 8 px gap. While loading, show a spinner in place of the icon and keep the label, the button keeps its width, and it is disabled.

### 7.2 Form controls

- Labels sit above inputs. Required fields are marked with " *". Helper text goes in `caption` `--text-muted`. Errors go in `caption` `--danger` with the icon `AlertCircle`; the field gets a Merah 700 border.
- **Phone input** (`PhoneInput`): country selector (flag + dial code) + number. Normalises to E.164 on blur. When the number matches an existing customer, an inline card appears ("Pelanggan ditemukan · Pelanggan kembali (×2)") with a "Gunakan data ini" (use this data) button.
- **Date picker**: calendar in a popover (bottom sheet on mobile). Days outside the booking horizon or in the past are disabled. Holidays carry a dot and a tooltip with the holiday name. Weekends are tinted Batu 100.
- **Money input**: "Rp" prefix, dot thousands separator while typing, stores an integer.
- **File upload** (payment proof, briefing PDF): drop zone with a dashed `--border-input` border + "Pilih file" button. Shows a thumbnail or PDF chip with name and size, a remove action, and type / size validation messages.
- **Rich text** (briefing material): minimal toolbar: bold, italic, bulleted list, numbered list, link.

### 7.3 Product components

| Component | Description |
|---|---|
| `StatusBadge` | §3.4. Sizes `sm` (tables) and `md` (detail header). |
| `SlotChip` | A slot in the availability check, three states. **Available**: white, `--border-input`, time + caption "3 guide tersedia". **Selected**: `--selection`. **Unavailable**: Kabut 50, Kabut 600 text, `Ban` icon, reason caption ("Butuh 2 guide, tersedia 1"). Past slots are hidden. |
| `GuideCard` | Avatar, name, language pills, "Beban minggu ini: 3 tur", average rating (★ 4.7). The top-ranked card shows a "Rekomendasi" badge (Senja 50 / Senja 800, `Sparkles` icon). Selectable (checkbox top-right) up to the number of guides needed. |
| `PriceSummary` | Line items (package × guides, surcharge line with the rule name, add-ons), divider, **Total** in `h2` tabular figures. Shows "Selisih harga: + Rp 100.000" in the warning style after a reschedule. |
| `Timeline` (Riwayat) | Vertical list: icon dot per event type, actor name, Indonesian description, relative time ("2 jam lalu") with an absolute tooltip. Newest first. |
| `ChecklistItem` | Checkbox + label + "oleh Rina · 14:20" (by Rina at 14:20) after it is ticked. The "Guide sudah dikonfirmasi" (guide confirmed) item is read-only and shows per-guide acknowledgement ("2/2 siap"). |
| `KpiTile` | Label (`caption`), value (`kpi`), delta or sub-line ("vs 30 hari sebelumnya"), optional icon. Delta text uses `--success` / `--danger` **with ▲/▼** arrows. White surface, `shadow-card`. |
| `ScheduleGrid` (Papan Jadwal) | Rows = guides (sticky left column: avatar + name + languages), columns = slots of the chosen date. Cell states: **free** (white, dashed border, "+" on hover/focus, opens the Buat Pemesanan wizard pre-filled), **booked** (status-tinted per §3.4 + booking code + customer short name), **leave** (Batu 100 with 45° Batu 200 hatching, label "Cuti"), **off day** (Kabut 50, "Libur"), **slot passed** (60 % opacity, not clickable). Mobile: one slot at a time (segmented control 09·12·16), with guides as a vertical list. |
| `NotificationBell` | Icon `Bell` with a Merah 600 count dot (max "9+"). Opens a popover (desktop) or full-screen sheet (mobile) listing notifications, with unread items shown on a Danau 50 background and "Tandai semua dibaca" (mark all read). |
| `EmptyState` | A single decoration illustration (§8.4) at 120 px, `h3` title, one line of body text, an optional primary action. |
| `FilterBar` | One row above lists and charts: search, date-range preset ("Hari ini", "7 hari", "30 hari", "Bulan ini", "Kustom"), dimension selects (Status, Kanal, Bahasa, Guide), "Reset". On mobile it collapses to search + a "Filter (N)" button. |

### 7.4 Feedback states

- **Toast** (Sonner): bottom-right on desktop, top on mobile; 4 s; success / error / info with icons. Used for "Pemesanan TG-261025-004 dibuat", "Pembayaran dikonfirmasi".
- **Inline alert**: for persistent conditions ("Pemesanan ini di bawah H-2: guide diberi tahu segera").
- **Skeletons** for loading lists, cards, and charts. No spinners for whole pages.
- **Error page**: friendly Indonesian copy + "Coba lagi" (try again) + "Kembali ke Beranda" (back to home).

### 7.5 Icons

**lucide-react**, stroke width 1.75. Sizes: 20 px in navigation, 16 px in buttons and badges, 24 px in empty states and KPI tiles. Icons that carry meaning need an `aria-label` or adjacent text.

## 8. Brand assets and illustration

### 8.1 Files

| Asset | Source | Ship to |
|---|---|---|
| Logo (full) | `webAsset/logo/tmii-logo.svg` | `public/brand/tmii-logo.svg` + inline React `<Logo />` (`fill="currentColor"`) |
| Letters (t, m, i, i) | `webAsset/logo/letter-*.svg` | Used inside `<DecoratedLogo />` |
| Transparent PNG | `webAsset/logo/tmii-logo-transparent.png` | Favicon / OG image source |
| Decorated logo | `webAsset/decoration/tmii-decorated.svg` | Inline React `<DecoratedLogo />` |
| Single decorations | `webAsset/decoration/{castle,snake,carousel,bird-perched,birds-flying,leaves}.svg` | Empty states, feedback page |
| Photo | `webAsset/top_bg.jpg` | `public/brand/top-bg.webp` (+ 768 w variant) |

All decorations are already coloured with this system's tokens (Rimba, Senja, Danau, Batu, Kabut, Merah). Do not recolour them per screen.

### 8.2 Logo usage

- **On light surfaces** (Batu 50, white): logo in `--brand` `#EC1B24`.
- **On dark surfaces** (sidebar, photo band): logo in **white**. Red on Rimba 900 measures under 3:1 and loses legibility.
- Minimum height: 20 px (sidebar collapsed), 28 px (sidebar), 24 px (mobile top bar).
- Clear space: at least the height of the "i" stem's width (≈ 8 % of the logo width) on every side.
- Never stretch, outline, add effects to, or recolour the logo outside these two options.
- ⚠️ *Assumption to verify with the TMII brand team: white reversal of the logo is acceptable.*

### 8.3 The decorated logo

`<DecoratedLogo animated? size? />` is an inline SVG built from `tmii-decorated.svg`. Its layer order is fixed: castle → leaves → snake-back → **logo** → snake-front → carousel → perched bird → flying birds.

Where it appears:

| Place | Variant |
|---|---|
| **Login** (`/masuk`) | Animated. **Desktop:** split screen, with the photo on the left (60 %, overlay, tagline "Layanan Tour Guide TMII untuk wisatawan mancanegara") and a Batu 50 panel on the right holding the decorated logo (max 360 px wide) above the form. **Mobile:** a 180 px photo band at the top, then the Batu 50 card overlapping it by 24 px with the decorated logo (max 280 px) and the form. |
| **Public feedback page** | Static, max 240 px, centred above the form. The thank-you screen plays the flying-birds loop once. |
| **404 / error page** | Static, max 240 px. |

Rules: always place it on a **light surface** (Batu 50 or white). On dark green the snake and wire details lose contrast. Never use it inside the app shell (sidebar, headers, data pages).

### 8.4 Decorations for empty states

One decoration at 120 px wide, cropped from its standalone SVG:

| Situation | Decoration |
|---|---|
| No bookings for the filter ("Belum ada pemesanan") | `carousel.svg` |
| No guides available for the slot | `bird-perched.svg` |
| No notifications ("Belum ada notifikasi") | `birds-flying.svg` |
| No leave requests / nothing pending | `leaves.svg` |
| No feedback yet | `castle.svg` |
| Feedback link expired or invalid | `snake.svg` (friendly: "Tautan ini sudah tidak berlaku") |

## 9. Motion

### 9.1 UI motion (CSS)

| Token | Duration | Easing | Use |
|---|---|---|---|
| `fast` | 120 ms | `ease-out` | Hover, press, focus |
| `base` | 200 ms | `cubic-bezier(0.2, 0, 0, 1)` | Popovers, tabs, toasts, accordions |
| `slow` | 320 ms | `cubic-bezier(0.2, 0, 0, 1)` | Dialogs, bottom sheets, drawer |

No motion on data updates other than a 200 ms fade. Charts animate in once on first render (≤ 400 ms) and not on filter changes.

### 9.2 Decorated logo choreography (Motion library)

The SVG's IDs and pivots are built for this (each animatable group is drawn around its pivot at local `0,0`).

| t (ms) | Element | Animation |
|---|---|---|
| 0 | `#letter-t`, `#letter-m`, `#letter-i-1`, `#letter-i-2` | Rise in: y 24 → 0, opacity 0 → 1, 400 ms ease-out, 60 ms stagger |
| 250 | `#castle` | Rise from behind: y 40 → 0, opacity 0 → 1, 600 ms |
| 450 | `.leaf` | Unfurl from the stem base: scale 0.6 → 1, rotate −12° → 0, spring, 70 ms stagger |
| 600 | `.snake-seg` (in `data-seq` order, front and back layers together) | Draw on via `stroke-dashoffset`, 110 ms per segment; then `#snake-tail` fades in |
| 1300 | `#snake-head` | Pop: scale 0.8 → 1, spring |
| 800 | `#carousel-canopy` | Drop in: y −30 → 0, spring with a small bounce |
| 1000 | `#bird-perched` | Hop in: y −16 → 0 |
| 1100 | `.bird-flying` | Glide in from the left: x −60 → 0, 700 ms |

Idle loops, started after the intro:

- `#carousel-horse`: bob y 0 ↔ −6 px, 1.6 s ease-in-out, infinite
- `.wing`: flap via scaleY 1 ↔ −0.5, 0.45 s alternate; the far wing is offset by 0.1 s
- `.leaf`: sway rotate ±3°, 4 s ease-in-out, random phase per leaf
- `#snake-tongue`: flick (scaleX 0 → 1 → 0, 300 ms) every 4 s
- `#bird-perched-head`: tilt rotate 0 → −12° → 0 every 3 s; `#bird-perched-tail`: sway ±2°
- `.castle-flag`, `#carousel-flag`: wave via skewY ±6°, 1.2 s

Performance and accessibility:

- Animate only `transform` and `opacity` (and `stroke-dashoffset` for the snake).
- Pause loops when the tab is hidden or the logo is off-screen (IntersectionObserver).
- **`prefers-reduced-motion: reduce`** renders the final static frame immediately, with no intro and no loops.
- When `<DecoratedLogo>` is rendered more than once on a page, prefix internal IDs with React `useId()`. The carousel uses a `clipPath` ID.

## 10. Implementation tokens (Tailwind v4 + shadcn/ui)

`src/app/globals.css` (excerpt; the full ramps are generated from §3.1):

```css
@import "tailwindcss";

@theme {
  --font-sans: var(--font-plus-jakarta), system-ui, -apple-system, "Segoe UI", sans-serif;

  --color-merah-50: #FEF2F2;  --color-merah-500: #EC1B24; --color-merah-600: #C8141C; --color-merah-700: #A01017;
  --color-danau-50: #F1F7F8;  --color-danau-600: #2B6F7C; --color-danau-700: #245B66; --color-danau-800: #1E4950;
  --color-senja-50: #FFF6EC;  --color-senja-400: #F3AC69; --color-senja-800: #7B460E;
  --color-rimba-100: #D6E8DE; --color-rimba-600: #215E44; --color-rimba-700: #184A35; --color-rimba-900: #0D2D1F;
  --color-batu-50: #FBF8F3;   --color-batu-100: #F5EFE5;  --color-batu-200: #EBDFCB;
  --color-kabut-100: #E8EEF0; --color-kabut-200: #D2DCE0; --color-kabut-500: #6E838C; --color-kabut-600: #566971; --color-kabut-900: #222B30;
  /* … remaining steps from §3.1 … */

  --color-chart-1: #1C7FA6; --color-chart-2: #DC7A22; --color-chart-3: #7A5AA8; --color-chart-4: #B8862B;

  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px; --radius-xl: 20px;
}

/* shadcn/ui semantic variables, mapped to §3.2 */
:root {
  --background: var(--color-batu-50);
  --foreground: var(--color-kabut-900);
  --card: #FFFFFF;            --card-foreground: var(--color-kabut-900);
  --popover: #FFFFFF;         --popover-foreground: var(--color-kabut-900);
  --primary: var(--color-merah-600);  --primary-foreground: #FFFFFF;
  --secondary: var(--color-batu-100); --secondary-foreground: var(--color-kabut-900);
  --muted: var(--color-batu-100);     --muted-foreground: var(--color-kabut-600);
  --accent: var(--color-danau-50);    --accent-foreground: var(--color-danau-800);
  --destructive: var(--color-merah-700);
  --border: var(--color-kabut-200);
  --input: var(--color-kabut-500);
  --ring: var(--color-danau-600);
  --sidebar: var(--color-rimba-900);
  --sidebar-foreground: var(--color-kabut-100);
  --sidebar-accent: var(--color-rimba-700);
  --sidebar-ring: var(--color-senja-400);
  --glow: var(--color-senja-400);
  --brand: var(--color-merah-500);
}
```

No `.dark` block. The prototype is light-only (`color-scheme: light`).

## 11. Accessibility checklist

- [ ] Every text/background pair uses a combination from §3.3 or §3.4.
- [ ] Visible focus ring (`--ring`, 2 px + 2 px offset) on every interactive element. Never `outline: none` without a replacement.
- [ ] Tap targets ≥ 44 px (≥ 48 px in the guide portal).
- [ ] Status, channel, and leave states always show **icon + label**.
- [ ] Data tables have proper `<th scope>`; mobile cards keep the same reading order.
- [ ] Charts have a "Lihat tabel" view; KPI deltas include ▲/▼ plus text.
- [ ] Dialogs and sheets trap focus, close on Esc, and return focus to their trigger.
- [ ] Form errors are announced (`aria-live="polite"`) and linked to their fields (`aria-describedby`).
- [ ] `lang="id"` on the app; `lang="en"` on `/ulasan/[token]`.
- [ ] `prefers-reduced-motion` is respected (§9.2).

## 12. Voice and copy (Indonesian UI)

- **Tone**: polite and efficient. Address users as **"Anda"**. No slang.
- **Buttons** are verbs: "Simpan", "Buat Pemesanan", "Cek Ketersediaan", "Tandai Lunas", "Jadwalkan Ulang".
- **Sentence case** everywhere ("Buat pemesanan baru"), except proper nouns and fixed labels from the glossary.
- **Errors** say what happened and what to do: "Slot 12.00–15.00 tidak cukup guide untuk 12 orang (butuh 2, tersedia 1). Pilih slot atau tanggal lain."
- **Confirmations** name the object: "Batalkan pemesanan TG-261025-004?"
- **Times** use the Indonesian dot separator in UI copy: "09.00–12.00". Store them as `HH:mm`.
- All copy lives in `src/i18n/id.ts`. The public feedback page and WhatsApp mocks use `src/i18n/en.ts` (English, warm and simple: "How was your tour with Rina?").
