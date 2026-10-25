import { migrate } from "drizzle-orm/libsql/migrator";
import { client, db } from "./db";

async function main() {
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  console.log("Migrations applied.");
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
