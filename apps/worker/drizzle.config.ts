import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../../packages/shared/src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  // Generation is offline; migration execution separately enforces the real secret.
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgresql://schema:only@localhost/soulseer" },
  strict: true,
  verbose: true,
});
