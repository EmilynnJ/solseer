import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@soulseer/shared/schema";

export function createDatabase(databaseUrl: string | undefined) {
  if (typeof databaseUrl !== "string" || !databaseUrl.trim()) {
    throw new Error("DATABASE_URL is required to connect to the application database.");
  }
  let sql;
  try {
    sql = neon(databaseUrl, { fullResults: true });
  } catch {
    // Neon can include the supplied connection string in parsing errors. Keep
    // credentials out of logs while identifying the configuration to correct.
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection string.");
  }
  return {
    db: drizzle(sql, { schema }),
    sql,
  };
}

export type Database = ReturnType<typeof createDatabase>["db"];
export type NeonSql = ReturnType<typeof createDatabase>["sql"];
