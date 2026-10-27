// Database access for CLI scripts (seed, migrate, reset). App code uses src/db/client.ts,
// which is guarded by `server-only` and so cannot be imported from plain Node.
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";

// `--turso`: always use .env.turso, even when the shell already has DATABASE_URL set
// (a plain --env-file never overrides an existing variable).
if (process.argv.includes("--turso")) {
  const loaded = config({ path: ".env.turso", override: true, quiet: true });
  if (loaded.error) throw new Error("--turso needs a .env.turso file in the project root (see README).");
  if (!process.env.DATABASE_URL?.startsWith("libsql://")) throw new Error("DATABASE_URL in .env.turso must be the libsql:// URL.");
}

const url = process.env.DATABASE_URL?.trim() || "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN?.trim() || undefined;
if (url.startsWith("libsql://") && !authToken) {
  throw new Error("DATABASE_AUTH_TOKEN is required for a Turso (libsql://) database.");
}

/** Printed by every script so it is obvious which database is being written. */
export const target = url.startsWith("file:") ? `local file ${url.slice(5)}` : `Turso ${url}`;

export const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });
