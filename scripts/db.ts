// Database access for CLI scripts (seed, migrate, reset). App code uses src/db/client.ts,
// which is guarded by `server-only` and so cannot be imported from plain Node.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";

export const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

export const db = drizzle(client, { schema });
