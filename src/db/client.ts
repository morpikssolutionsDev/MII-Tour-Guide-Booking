import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { libsql?: ReturnType<typeof createClient> };

// Reuse one connection across hot reloads in development.
const client =
  globalForDb.libsql ??
  createClient({
    url: process.env.DATABASE_URL ?? "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
if (process.env.NODE_ENV !== "production") globalForDb.libsql = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Anything that can run queries: the db itself or an open transaction. */
export type Executor = Db | Tx;
