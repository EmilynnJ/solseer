import { sql } from "drizzle-orm";
import type { Database } from "./db";
import { AppError } from "./errors";

const LIVE_READING_STATUSES = ["accepted", "preflight", "connecting", "active", "ending"];

// A suspension only blocks new API calls. Someone already in a reading keeps
// their RealtimeKit connection (and billing keeps running), so refuse until
// the reading has ended.
export async function assertNoLiveReading(db: Database, userId: string) {
  const result = await db.execute(sql`
    SELECT 1 FROM reading_sessions
    WHERE (client_id = ${userId} OR reader_id = ${userId})
      AND status::text IN (${sql.join(
        LIVE_READING_STATUSES.map((status) => sql`${status}`),
        sql`, `,
      )})
    LIMIT 1
  `);
  if (result.rows.length) {
    throw new AppError(
      409,
      "ACTIVE_READING",
      "This person is in a reading right now. End the reading first, then suspend them.",
    );
  }
}
