import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { libsql?: ReturnType<typeof createClient> };

/** Local dev falls back to the SQLite file; on Vercel a missing setting fails loudly instead. */
function connectionConfig() {
  const url = process.env.DATABASE_URL?.trim();
  const authToken = process.env.DATABASE_AUTH_TOKEN?.trim() || undefined;
  if (process.env.VERCEL) {
    if (!url) throw new Error("DATABASE_URL is not set. Add the Turso libsql:// URL in Vercel → Settings → Environment Variables, then redeploy.");
    if (url.startsWith("file:")) throw new Error("DATABASE_URL points to a local file, which does not exist on Vercel. Use the Turso libsql:// URL.");
    if (!authToken) throw new Error("DATABASE_AUTH_TOKEN is not set. Create a token for the Turso database and add it in Vercel, then redeploy.");
  }
  return { url: url || "file:local.db", authToken };
}

// Reuse one connection across hot reloads in development.
const client = globalForDb.libsql ?? createClient(connectionConfig());
if (process.env.NODE_ENV !== "production") globalForDb.libsql = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Anything that can run queries: the db itself or an open transaction. */
export type Executor = Db | Tx;
