import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/lib/db";

describe("application database configuration", () => {
  it.each([undefined, "", "   "])(
    "identifies a missing DATABASE_URL before a query is attempted (%s)",
    (value) => {
      expect(() => createDatabase(value)).toThrow("DATABASE_URL is required");
    },
  );

  it.each([
    "invalid connection string with private-password",
    "https://user:private-password@example.test/database",
  ])("rejects invalid configuration without exposing credentials", (value) => {
    expect(() => createDatabase(value)).toThrow(
      /^DATABASE_URL must be a valid PostgreSQL connection string\.$/,
    );
  });

  it.each(["postgres", "postgresql"])(
    "accepts %s URLs without querying the database",
    (protocol) => {
      const database = createDatabase(
        `${protocol}://test:test@localhost:5432/test?sslmode=require`,
      );
      expect(database.db).toBeDefined();
      expect(database.sql).toBeTypeOf("function");
    },
  );
});
