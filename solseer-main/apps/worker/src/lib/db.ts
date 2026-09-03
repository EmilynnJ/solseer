import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@soulseer/shared/schema";

export function createDatabase(databaseUrl: string) {
  const sql = neon(databaseUrl, { fullResults: true });
  return {
    db: drizzle(sql, { schema }),
    sql,
  };
}

export type Database = ReturnType<typeof createDatabase>["db"];
export type NeonSql = ReturnType<typeof createDatabase>["sql"];
