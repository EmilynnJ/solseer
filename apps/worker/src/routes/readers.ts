import { Hono } from "hono";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import {
  READER_HEARTBEAT_FRESH_MS,
  readerNotificationSettingsSchema,
  readerPricingSchema,
  readerProfileUpdateSchema,
  readerProfiles,
  pendingPayouts,
  readerStatusSchema,
  reviews,
  users,
  walletLedgerEntries,
} from "@soulseer/shared";
import type { AppBindings } from "../types";
import { requireRole, requireUser } from "../lib/auth";
import { createDatabase } from "../lib/db";
import { AppError } from "../lib/errors";

export const readerRoutes = new Hono<AppBindings>();

// Optimization: Pre-aggregate reviews per reader in a subquery to avoid M*N row expansion
// during joins with reader profiles and users, eliminating expensive full table GROUP BYs.
function getReaderQuery(db: ReturnType<typeof createDatabase>["db"]) {
  const reviewStats = db
    .select({
      readerId: reviews.readerId,
      rating: sql<number>`coalesce(avg(${reviews.rating}), 0)::float`.as("rating"),
      reviewCount: sql<number>`count(${reviews.id})::int`.as("review_count"),
    })
    .from(reviews)
    .groupBy(reviews.readerId)
    .as("review_stats");

  return {
    reviewStats,
    selection: {
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      bio: readerProfiles.bio,
      specialties: readerProfiles.specialties,
      pricingChat: readerProfiles.pricingChat,
      pricingVoice: readerProfiles.pricingVoice,
      pricingVideo: readerProfiles.pricingVideo,
      isOnline: readerProfiles.isOnline,
      lastHeartbeatAt: readerProfiles.lastHeartbeatAt,
      profileImageKey: readerProfiles.profileImageKey,
      rating: sql<number>`coalesce(${reviewStats.rating}, 0)::float`,
      reviewCount: sql<number>`coalesce(${reviewStats.reviewCount}, 0)::int`,
    },
  };
}

async function listReaders(env: Env, onlineOnly: boolean) {
  const { db } = createDatabase(env.DATABASE_URL);
  const freshness = new Date(Date.now() - READER_HEARTBEAT_FRESH_MS);
  const condition = onlineOnly
    ? and(
        eq(readerProfiles.verificationStatus, "verified"),
        eq(users.status, "active"),
        eq(readerProfiles.isOnline, true),
        gt(readerProfiles.lastHeartbeatAt, freshness),
      )
    : and(
        eq(readerProfiles.verificationStatus, "verified"),
        eq(users.status, "active"),
      );

  const { reviewStats, selection } = getReaderQuery(db);

  return db
    .select(selection)
    .from(readerProfiles)
    .innerJoin(users, eq(users.id, readerProfiles.userId))
    .leftJoin(reviewStats, eq(reviewStats.readerId, readerProfiles.userId))
    .where(condition)
    .orderBy(
      desc(
        sql`${readerProfiles.isOnline} AND ${readerProfiles.lastHeartbeatAt} > ${freshness}`,
      ),
      users.fullName,
    );
}

readerRoutes.get("/", async (context) =>
  context.json({ readers: await listReaders(context.env, false) }),
);
readerRoutes.get("/online", async (context) =>
  context.json({ readers: await listReaders(context.env, true) }),
);

readerRoutes.get("/:id", async (context) => {
  const { db } = createDatabase(context.env.DATABASE_URL);
  const id = context.req.param("id");
  const { reviewStats, selection } = getReaderQuery(db);

  const [reader] = await db
    .select(selection)
    .from(readerProfiles)
    .innerJoin(users, eq(users.id, readerProfiles.userId))
    .leftJoin(reviewStats, eq(reviewStats.readerId, readerProfiles.userId))
    .where(
      and(
        eq(readerProfiles.userId, id),
        eq(readerProfiles.verificationStatus, "verified"),
        eq(users.status, "active"),
      ),
    )
    .limit(1);
  if (!reader) throw new AppError(404, "READER_NOT_FOUND", "Reader not found.");
  const recentReviews = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      text: reviews.text,
      createdAt: reviews.createdAt,
      clientName: users.username,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.clientId))
    .where(eq(reviews.readerId, id))
    .orderBy(desc(reviews.createdAt))
    .limit(12);
  return context.json({ reader, reviews: recentReviews });
});

readerRoutes.get("/:id/image", async (context) => {
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [reader] = await db
    .select({ key: readerProfiles.profileImageKey })
    .from(readerProfiles)
    .innerJoin(users, eq(users.id, readerProfiles.userId))
    .where(
      and(
        eq(readerProfiles.userId, context.req.param("id")),
        eq(readerProfiles.verificationStatus, "verified"),
        eq(users.status, "active"),
      ),
    )
    .limit(1);
  if (!reader?.key)
    throw new AppError(404, "IMAGE_NOT_FOUND", "Profile image not found.");
  const object = await context.env.PROFILE_IMAGES.get(reader.key);
  if (!object)
    throw new AppError(404, "IMAGE_NOT_FOUND", "Profile image not found.");
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set(
    "Cache-Control",
    "public, max-age=3600, stale-while-revalidate=86400",
  );
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
});

readerRoutes.patch(
  "/status",
  requireUser,
  requireRole("reader"),
  async (context) => {
    const input = readerStatusSchema.parse(await context.req.json());
    const user = context.get("user");
    const { db } = createDatabase(context.env.DATABASE_URL);
    const [updated] = await db
      .update(readerProfiles)
      .set({
        isOnline: input.isOnline,
        lastHeartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(readerProfiles.userId, user.id))
      .returning();
    return context.json({ reader: updated });
  },
);

readerRoutes.patch(
  "/heartbeat",
  requireUser,
  requireRole("reader"),
  async (context) => {
    const user = context.get("user");
    const { db } = createDatabase(context.env.DATABASE_URL);
    await db
      .update(readerProfiles)
      .set({ lastHeartbeatAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(readerProfiles.userId, user.id),
          eq(readerProfiles.isOnline, true),
        ),
      );
    return context.json({ ok: true });
  },
);

readerRoutes.patch(
  "/pricing",
  requireUser,
  requireRole("reader"),
  async (context) => {
    const input = readerPricingSchema.parse(await context.req.json());
    const { db } = createDatabase(context.env.DATABASE_URL);
    const [reader] = await db
      .update(readerProfiles)
      .set({
        pricingChat: input.chat,
        pricingVoice: input.voice,
        pricingVideo: input.video,
        updatedAt: new Date(),
      })
      .where(eq(readerProfiles.userId, context.get("user").id))
      .returning();
    return context.json({ reader });
  },
);

readerRoutes.patch(
  "/profile",
  requireUser,
  requireRole("reader"),
  async (context) => {
    const input = readerProfileUpdateSchema.parse(await context.req.json());
    const { db } = createDatabase(context.env.DATABASE_URL);
    const [reader] = await db
      .update(readerProfiles)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(readerProfiles.userId, context.get("user").id))
      .returning();
    return context.json({ reader });
  },
);

readerRoutes.patch(
  "/notifications",
  requireUser,
  requireRole("reader"),
  async (context) => {
    const input = readerNotificationSettingsSchema.parse(
      await context.req.json(),
    );
    const { db } = createDatabase(context.env.DATABASE_URL);
    const [reader] = await db
      .update(readerProfiles)
      .set({
        phoneNumber: input.phoneNumber,
        smsNotificationsEnabled: input.smsNotificationsEnabled,
        smsConsentAt: input.smsNotificationsEnabled ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(readerProfiles.userId, context.get("user").id))
      .returning();
    return context.json({ reader });
  },
);

readerRoutes.get(
  "/dashboard/summary",
  requireUser,
  requireRole("reader"),
  async (context) => {
    const user = context.get("user");
    const { db } = createDatabase(context.env.DATABASE_URL);
    const [summary] = await db
      .select({
        pendingPayout: pendingPayouts.availableAmount,
        historicalEarnings: sql<number>`coalesce(sum(case when ${walletLedgerEntries.type} in ('reader_earning', 'message_earning') then ${walletLedgerEntries.amount} else 0 end), 0)::int`,
        todayEarnings: sql<number>`coalesce(sum(case when ${walletLedgerEntries.type} in ('reader_earning', 'message_earning') and ${walletLedgerEntries.createdAt} >= date_trunc('day', now()) then ${walletLedgerEntries.amount} else 0 end), 0)::int`,
      })
      .from(pendingPayouts)
      .leftJoin(
        walletLedgerEntries,
        eq(walletLedgerEntries.userId, pendingPayouts.readerId),
      )
      .where(eq(pendingPayouts.readerId, user.id))
      .groupBy(pendingPayouts.readerId);
    const receivedReviews = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        text: reviews.text,
        createdAt: reviews.createdAt,
        clientName: users.username,
      })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.clientId))
      .where(eq(reviews.readerId, user.id))
      .orderBy(desc(reviews.createdAt))
      .limit(100);
    return context.json({
      summary: summary ?? {
        pendingPayout: 0,
        historicalEarnings: 0,
        todayEarnings: 0,
      },
      reviews: receivedReviews,
    });
  },
);
