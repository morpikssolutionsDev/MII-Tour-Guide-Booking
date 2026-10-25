import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "file:local.db";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});
