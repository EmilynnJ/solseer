import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to apply migrations.");
}

const db = drizzle(neon(databaseUrl));
await migrate(db, {
  migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
});
