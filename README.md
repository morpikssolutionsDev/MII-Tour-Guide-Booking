# TMII Tour Guide Booking

Prototype for booking TMII tour guides: staff take bookings by phone, sales and on the spot; guides confirm and run tours from their own portal; tourists leave feedback through a public link. The specs live in [docs/spec/](docs/spec/) (start with [00-overview.md](docs/spec/00-overview.md) and [design-system.md](docs/spec/design-system.md)).

The staff and guide UI is in Indonesian. The public feedback page (`/ulasan/[token]`) and the mock WhatsApp messages are in English.

## Stack

- **Next.js 16** (App Router, Cache Components, `proxy.ts`). This version differs from older Next.js, so read `node_modules/next/dist/docs/` before changing framework code.
- **SQLite via libSQL**: a local file in development, Turso in production. **Drizzle ORM** for the schema and queries.
- **Auth.js v5** with email and password (JWT sessions, 12 hours).
- **Tailwind CSS v4** and **shadcn/ui** (Radix), **Recharts** for reports.
- **Vitest** for the pure domain logic in `src/domain/`.

## Getting started

Requires Node.js 20 or later.

```bash
npm install
cp .env.example .env        # then set AUTH_SECRET (npx auth secret)
npm run db:migrate          # creates local.db
npm run db:seed             # demo data relative to today (WIB)
npm run dev                 # http://localhost:3000
```

`npm run db:seed` wipes and refills the database. Run it again any time you want fresh demo data. Bookings span from 60 days ago to 14 days ahead.

### Demo logins

Every account uses the password **`tmii1234`**.

| Role | Email |
|---|---|
| Admin | `admin@tmii.test` |
| Staff (Sales) | `sales@tmii.test` |
| Staff (Call Center) | `callcenter@tmii.test` |
| Staff (On the Spot) | `ops@tmii.test` |
| Tour guide | `rina@tmii.test`, `dimas@tmii.test`, `ayu@tmii.test`, `fajar@tmii.test`, `siti@tmii.test`, `yoga@tmii.test`, `putri@tmii.test`, `hendra@tmii.test` |

Staff and admin land on `/beranda`; guides land on `/portal`. To try the tourist feedback form, open a completed booking, copy its feedback link and open it in a private window.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts` (drizzle-kit) |
| `npm run db:migrate` | Apply migrations (`scripts/migrate.ts`, works for both a file and Turso) |
| `npm run db:seed` | Reset and seed demo data, including the notification outbox |
| `npm test` | Domain unit tests |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm run brand` | Regenerate the logo components from `webAsset/` |

## Project layout

```
src/
  app/            routes: (auth)/masuk, (staff)/…, (guide)/portal/…, ulasan/[token]
  components/     ui/ (shadcn), common/, booking/, reports/, shell/, brand/
  domain/         pure rules: pricing, availability, allocation, holds, metrics (unit-tested)
  server/         queries and server actions per module; session.ts, action.ts, notify/
  db/             Drizzle schema and SQL migrations
  i18n/           id.ts (UI copy), en.ts (tourist-facing copy)
scripts/          migrate, seed, brand generator
docs/spec/        module specs 01–11 and the design system
```

## Deploying to Vercel

1. **Database.** Create a Turso database. Then create a file named `.env.turso` in the project root (it is git-ignored) with:

   ```bash
   DATABASE_URL=libsql://<db>.turso.io
   DATABASE_AUTH_TOKEN=<token>
   APP_BASE_URL=https://<your-app>.vercel.app
   ```

   Then create the tables and, optionally, load the demo data:

   ```bash
   npm run db:migrate:turso
   npm run db:seed:turso      # optional: demo users and data
   ```

   Both commands print the database they write to. Check that it says `Turso libsql://…`. The plain `db:migrate` / `db:seed` commands use `.env`, which points to the local file.

2. **File storage.** Vercel's filesystem is read-only, so create a Vercel Blob store and use `STORAGE_DRIVER=vercel-blob`.
3. **Environment variables** in the Vercel project:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `libsql://<db>.turso.io` |
   | `DATABASE_AUTH_TOKEN` | Turso token |
   | `AUTH_SECRET` | output of `npx auth secret` |
   | `STORAGE_DRIVER` | `vercel-blob` |
   | `BLOB_READ_WRITE_TOKEN` | set automatically when the Blob store is connected |
   | `APP_BASE_URL` | the deployment URL, e.g. `https://tmii-guide.vercel.app` (used in feedback links) |

4. Deploy. No cron job is needed: expired payment holds are released lazily whenever bookings are read.

## Prototype notes

- **WhatsApp is mocked.** Messages to tourists are written to the outbox (`/outbox`, admin only) with a "Buka di WhatsApp" link instead of being sent.
- **Holiday dates are estimates.** The seeded Indonesian holidays use exact dates for fixed holidays. Lunar-calendar ones (Islamic, Chinese, Saka, Buddhist) are estimates, so check them against the official SKB and edit them under **Harga → Hari Libur**.
- **Uploads in development** go to `.data/uploads/` (git-ignored) and are served through `/uploads/…` with role checks.
- **Times are WIB** (UTC+7) throughout. Dates are stored as `YYYY-MM-DD` and instants as UTC ISO strings.
