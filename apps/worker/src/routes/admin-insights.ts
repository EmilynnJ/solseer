import { Hono } from "hono";
import { eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  forumComments,
  forumFlags,
  forumPosts,
  readerProfiles,
  users,
} from "@soulseer/shared";
import type { AppBindings } from "../types";
import { requireRole, requireUser } from "../lib/auth";
import { createDatabase } from "../lib/db";
import { AppError } from "../lib/errors";
import { validateUuidParams } from "../lib/http";
import { AUTOMATED_FLAG_PREFIX } from "../lib/content-scan";

export const adminInsightRoutes = new Hono<AppBindings>();
adminInsightRoutes.use("*", requireUser, requireRole("admin"));

const DAY_MS = 24 * 60 * 60_000;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Inclusive calendar-day range in UTC; defaults to the last 30 days.
const rangeSchema = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .transform(({ from, to }) => {
    const end = to ? new Date(`${to}T00:00:00Z`) : new Date();
    const endExclusive = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) +
        DAY_MS,
    );
    const start = from
      ? new Date(`${from}T00:00:00Z`)
      : new Date(endExclusive.getTime() - 30 * DAY_MS);
    if (start >= endExclusive)
      throw new AppError(400, "INVALID_RANGE", "Start date must be before end date.");
    if (endExclusive.getTime() - start.getTime() > 3 * 366 * DAY_MS)
      throw new AppError(400, "RANGE_TOO_LONG", "Choose a range of three years or less.");
    return { start, endExclusive };
  });

const GROUP_UNITS = { day: "day", week: "week", month: "month" } as const;

type Row = Record<string, unknown>;
const rows = (result: { rows: unknown[] }) => result.rows as Row[];

// ---------------------------------------------------------------------------
// Transcripts

adminInsightRoutes.get("/transcripts", async (context) => {
  // Transcripts are searched across all time unless dates are given, so this
  // does not use rangeSchema's 30-day default or three-year cap.
  const query = z
    .object({
      q: z.string().trim().max(200).optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
    })
    .parse(context.req.query());
  const start = query.from ? new Date(`${query.from}T00:00:00Z`) : new Date(0);
  const endExclusive = query.to
    ? new Date(new Date(`${query.to}T00:00:00Z`).getTime() + DAY_MS)
    : new Date(Date.now() + DAY_MS);
  const { db } = createDatabase(context.env.DATABASE_URL);
  const search = query.q ? `%${query.q.replace(/[\\%_]/g, "\\$&")}%` : null;
  const result = await db.execute(sql`
    SELECT r.id, r.type, r.status, r.created_at AS "createdAt",
      r.duration_seconds AS "durationSeconds", r.total_price AS "totalPrice",
      jsonb_array_length(r.chat_transcript) AS "messageCount",
      c.full_name AS "clientName", c.username AS "clientUsername",
      rd.full_name AS "readerName", rd.username AS "readerUsername"
    FROM reading_sessions r
    LEFT JOIN users c ON c.id = r.client_id
    LEFT JOIN users rd ON rd.id = r.reader_id
    WHERE r.chat_transcript IS NOT NULL
      AND jsonb_typeof(r.chat_transcript) = 'array'
      AND jsonb_array_length(r.chat_transcript) > 0
      AND r.created_at >= ${start.toISOString()} AND r.created_at < ${endExclusive.toISOString()}
      ${
        search
          ? sql`AND (c.full_name ILIKE ${search} OR c.username ILIKE ${search}
              OR c.email ILIKE ${search} OR rd.full_name ILIKE ${search}
              OR rd.username ILIKE ${search} OR rd.email ILIKE ${search}
              OR r.chat_transcript::text ILIKE ${search})`
          : sql``
      }
    ORDER BY r.created_at DESC
    LIMIT 200
  `);
  return context.json({ transcripts: rows(result) });
});

// ---------------------------------------------------------------------------
// Content oversight

adminInsightRoutes.get("/moderation/queue", async (context) => {
  const { status } = z
    .object({
      status: z.enum(["open", "dismissed", "actioned"]).default("open"),
    })
    .parse(context.req.query());
  const { db } = createDatabase(context.env.DATABASE_URL);
  const result = await db.execute(sql`
    SELECT f.id, f.reason, f.status, f.created_at AS "createdAt",
      f.reviewed_at AS "reviewedAt",
      f.post_id AS "postId", f.comment_id AS "commentId",
      coalesce(p.title, cp.title) AS "postTitle",
      coalesce(p.body, c.body) AS "body",
      coalesce(p.status, c.status)::text AS "contentStatus",
      author.id AS "authorId", author.full_name AS "authorName",
      author.username AS "authorUsername", author.role::text AS "authorRole",
      author.status::text AS "authorStatus",
      reporter.full_name AS "reporterName",
      (f.reason LIKE ${`${AUTOMATED_FLAG_PREFIX}%`}
        AND f.reporter_id = author.id) AS "automated",
      (SELECT count(*)::int FROM forum_flags other
        WHERE other.status = 'open'
          AND (other.post_id = f.post_id OR other.comment_id = f.comment_id))
        AS "openReportsOnContent"
    FROM forum_flags f
    LEFT JOIN forum_posts p ON p.id = f.post_id
    LEFT JOIN forum_comments c ON c.id = f.comment_id
    LEFT JOIN forum_posts cp ON cp.id = c.post_id
    JOIN users author ON author.id = coalesce(p.author_id, c.author_id)
    JOIN users reporter ON reporter.id = f.reporter_id
    WHERE f.status = ${status}
    ORDER BY f.created_at DESC
    LIMIT 200
  `);
  return context.json({ flags: rows(result) });
});

const moderationActionSchema = z.object({
  action: z.enum(["dismiss", "hide", "remove", "restore"]),
  suspendAuthor: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
});

adminInsightRoutes.patch(
  "/moderation/flags/:id",
  validateUuidParams("id"),
  async (context) => {
    const input = moderationActionSchema.parse(await context.req.json());
    const actor = context.get("user");
    const { db } = createDatabase(context.env.DATABASE_URL);
    const [flag] = await db
      .select()
      .from(forumFlags)
      .where(eq(forumFlags.id, context.req.param("id")))
      .limit(1);
    if (!flag) throw new AppError(404, "FLAG_NOT_FOUND", "Report not found.");

    const contentStatus =
      input.action === "hide"
        ? "hidden"
        : input.action === "remove"
          ? "deleted"
          : input.action === "restore"
            ? "visible"
            : null;
    let authorId: string | undefined;
    if (flag.postId) {
      const [post] = contentStatus
        ? await db
            .update(forumPosts)
            .set({ status: contentStatus, updatedAt: new Date() })
            .where(eq(forumPosts.id, flag.postId))
            .returning({ authorId: forumPosts.authorId })
        : await db
            .select({ authorId: forumPosts.authorId })
            .from(forumPosts)
            .where(eq(forumPosts.id, flag.postId));
      authorId = post?.authorId;
    } else if (flag.commentId) {
      const [comment] = contentStatus
        ? await db
            .update(forumComments)
            .set({ status: contentStatus, updatedAt: new Date() })
            .where(eq(forumComments.id, flag.commentId))
            .returning({ authorId: forumComments.authorId })
        : await db
            .select({ authorId: forumComments.authorId })
            .from(forumComments)
            .where(eq(forumComments.id, flag.commentId));
      authorId = comment?.authorId;
    }

    // Resolve every open report on the same content together.
    const flagStatus =
      input.action === "dismiss" || input.action === "restore"
        ? "dismissed"
        : "actioned";
    await db
      .update(forumFlags)
      .set({ status: flagStatus, reviewedById: actor.id, reviewedAt: new Date() })
      .where(
        flag.postId
          ? sql`${forumFlags.postId} = ${flag.postId} AND ${forumFlags.status} = 'open'`
          : sql`${forumFlags.commentId} = ${flag.commentId} AND ${forumFlags.status} = 'open'`,
      );
    if (flag.status !== "open") {
      await db
        .update(forumFlags)
        .set({ status: flagStatus, reviewedById: actor.id, reviewedAt: new Date() })
        .where(eq(forumFlags.id, flag.id));
    }

    let suspended = false;
    if (input.suspendAuthor && authorId && authorId !== actor.id) {
      const updated = await db
        .update(users)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(sql`${users.id} = ${authorId} AND ${users.role} <> 'admin' AND ${users.status} = 'active'`)
        .returning({ id: users.id, role: users.role });
      suspended = updated.length > 0;
      if (updated[0]?.role === "reader") {
        await db
          .update(readerProfiles)
          .set({ isOnline: false, updatedAt: new Date() })
          .where(eq(readerProfiles.userId, authorId));
      }
    }

    await db.insert(auditLogs).values({
      actorId: actor.id,
      action: `moderation.${input.action}`,
      targetType: flag.postId ? "forum_post" : "forum_comment",
      targetId: (flag.postId ?? flag.commentId) as string,
      reason: input.note,
      metadata: { flagId: flag.id, suspendedAuthor: suspended, authorId },
    });
    return context.json({ status: flagStatus, contentStatus, suspendedAuthor: suspended });
  },
);

// ---------------------------------------------------------------------------
// Financial administration

const revenueColumns = sql`
  coalesce(-sum(amount) FILTER (WHERE type = 'reading_charge'), 0)::int AS "readingSales",
  coalesce(-sum(amount) FILTER (WHERE type = 'message_charge'), 0)::int AS "messageSales",
  coalesce(sum(amount) FILTER (WHERE type IN ('reader_earning', 'message_earning')), 0)::int AS "readerEarnings",
  coalesce(sum(amount) FILTER (WHERE type = 'refund'), 0)::int AS "refunds",
  coalesce(-sum(amount) FILTER (WHERE type = 'adjustment' AND reading_id IS NOT NULL), 0)::int AS "readerReversals",
  coalesce(sum(amount) FILTER (WHERE type = 'adjustment' AND reading_id IS NULL), 0)::int AS "manualAdjustments",
  coalesce(sum(amount) FILTER (WHERE type = 'top_up'), 0)::int AS "topUps",
  coalesce(-sum(amount) FILTER (WHERE type = 'payout'), 0)::int AS "payouts"
`;

adminInsightRoutes.get("/reports/revenue", async (context) => {
  const { groupBy } = z
    .object({ groupBy: z.enum(["day", "week", "month"]).default("day") })
    .parse(context.req.query());
  const { start, endExclusive } = rangeSchema.parse(context.req.query());
  const unit = sql.raw(`'${GROUP_UNITS[groupBy]}'`);
  const { db } = createDatabase(context.env.DATABASE_URL);
  const window = sql`created_at >= ${start.toISOString()} AND created_at < ${endExclusive.toISOString()}`;
  const [periods, totals, readings] = await Promise.all([
    db.execute(sql`
      SELECT to_char(date_trunc(${unit}, created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS "period", ${revenueColumns}
      FROM wallet_ledger_entries WHERE ${window}
      GROUP BY 1 ORDER BY 1
    `),
    db.execute(sql`SELECT ${revenueColumns} FROM wallet_ledger_entries WHERE ${window}`),
    db.execute(sql`
      SELECT type::text AS "type", count(*)::int AS "count",
        coalesce(sum(duration_seconds), 0)::int AS "seconds",
        coalesce(sum(total_price), 0)::int AS "revenue"
      FROM reading_sessions
      WHERE status = 'ended' AND ${window}
      GROUP BY type ORDER BY type
    `),
  ]);
  return context.json({
    from: start.toISOString(),
    to: new Date(endExclusive.getTime() - DAY_MS).toISOString(),
    groupBy,
    totals: rows(totals)[0] ?? {},
    periods: rows(periods),
    readingsByType: rows(readings),
  });
});

adminInsightRoutes.get("/ledger", async (context) => {
  const query = z
    .object({
      type: z
        .enum([
          "top_up",
          "reading_charge",
          "reader_earning",
          "platform_revenue",
          "refund",
          "adjustment",
          "payout",
          "message_charge",
          "message_earning",
        ])
        .optional(),
      q: z.string().trim().max(200).optional(),
    })
    .parse(context.req.query());
  const { start, endExclusive } = rangeSchema.parse(context.req.query());
  const search = query.q ? `%${query.q.replace(/[\\%_]/g, "\\$&")}%` : null;
  const filters: SQL[] = [
    sql`l.created_at >= ${start.toISOString()}`,
    sql`l.created_at < ${endExclusive.toISOString()}`,
  ];
  if (query.type) filters.push(sql`l.type = ${query.type}`);
  if (search)
    filters.push(
      sql`(u.full_name ILIKE ${search} OR u.username ILIKE ${search} OR u.email ILIKE ${search})`,
    );
  const { db } = createDatabase(context.env.DATABASE_URL);
  const result = await db.execute(sql`
    SELECT l.id, l.created_at AS "createdAt", l.type::text AS "type", l.amount,
      l.balance_after AS "balanceAfter", l.reason, l.reading_id AS "readingId",
      l.stripe_reference AS "stripeReference",
      u.full_name AS "userName", u.username, u.email, u.role::text AS "role",
      actor.full_name AS "actorName"
    FROM wallet_ledger_entries l
    JOIN users u ON u.id = l.user_id
    LEFT JOIN users actor ON actor.id = l.actor_id
    WHERE ${sql.join(filters, sql` AND `)}
    ORDER BY l.created_at DESC
    LIMIT 5000
  `);
  return context.json({ entries: rows(result) });
});

// ---------------------------------------------------------------------------
// Analytics

adminInsightRoutes.get("/analytics", async (context) => {
  const { months } = z
    .object({ months: z.coerce.number().int().min(3).max(36).default(12) })
    .parse(context.req.query());
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  );
  const last30 = new Date(now.getTime() - 30 * DAY_MS);
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [monthly, kpis, totals] = await Promise.all([
    db.execute(sql`
      WITH m AS (
        SELECT generate_series(${start.toISOString()}::timestamptz, date_trunc('month', now()), interval '1 month') AS month
      )
      SELECT to_char(m.month AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "month",
        (SELECT count(*)::int FROM users u WHERE u.role = 'client'
          AND date_trunc('month', u.created_at) = m.month) AS "newClients",
        (SELECT count(*)::int FROM users u WHERE u.role = 'reader'
          AND date_trunc('month', u.created_at) = m.month) AS "newReaders",
        (SELECT count(*)::int FROM reading_sessions r WHERE r.status = 'ended'
          AND date_trunc('month', r.created_at) = m.month) AS "readings",
        (SELECT count(*)::int FROM reading_sessions r WHERE r.status IN ('failed', 'cancelled')
          AND date_trunc('month', r.created_at) = m.month) AS "unsuccessfulReadings",
        (SELECT count(DISTINCT r.client_id)::int FROM reading_sessions r WHERE r.status = 'ended'
          AND date_trunc('month', r.created_at) = m.month) AS "activeClients",
        (SELECT coalesce(sum(r.duration_seconds), 0)::int FROM reading_sessions r WHERE r.status = 'ended'
          AND date_trunc('month', r.created_at) = m.month) AS "readingSeconds",
        (SELECT coalesce(-sum(l.amount), 0)::int FROM wallet_ledger_entries l
          WHERE l.type IN ('reading_charge', 'message_charge')
          AND date_trunc('month', l.created_at) = m.month) AS "grossSales",
        (SELECT count(*)::int FROM forum_posts p
          WHERE date_trunc('month', p.created_at) = m.month) AS "forumPosts"
      FROM m ORDER BY m.month
    `),
    db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM reading_sessions WHERE status = 'ended' AND created_at >= ${last30.toISOString()}) AS "readings30d",
        (SELECT count(*)::int FROM reading_sessions WHERE status IN ('failed', 'cancelled') AND created_at >= ${last30.toISOString()}) AS "unsuccessful30d",
        (SELECT count(DISTINCT client_id)::int FROM reading_sessions WHERE status = 'ended' AND created_at >= ${last30.toISOString()}) AS "activeClients30d",
        (SELECT coalesce(avg(duration_seconds), 0)::int FROM reading_sessions WHERE status = 'ended' AND created_at >= ${last30.toISOString()}) AS "avgSeconds30d",
        (SELECT coalesce(avg(total_price), 0)::int FROM reading_sessions WHERE status = 'ended' AND created_at >= ${last30.toISOString()}) AS "avgReadingValue30d",
        (SELECT count(*)::int FROM (
          SELECT client_id FROM reading_sessions WHERE status = 'ended'
          GROUP BY client_id HAVING count(*) >= 2) repeat_clients) AS "repeatClients",
        (SELECT count(DISTINCT client_id)::int FROM reading_sessions WHERE status = 'ended') AS "clientsWithReadings",
        (SELECT coalesce(round(avg(rating)::numeric, 2), 0)::float FROM reviews) AS "averageRating",
        (SELECT count(*)::int FROM reviews) AS "reviewCount",
        (SELECT count(*)::int FROM reader_profiles
          WHERE is_online AND last_heartbeat_at > now() - interval '2 minutes') AS "readersOnlineNow"
    `),
    db.execute(sql`
      SELECT role::text AS "role", count(*)::int AS "count"
      FROM users WHERE status <> 'deleted' GROUP BY role
    `),
  ]);
  return context.json({
    months,
    monthly: rows(monthly),
    kpis: rows(kpis)[0] ?? {},
    usersByRole: rows(totals),
  });
});
