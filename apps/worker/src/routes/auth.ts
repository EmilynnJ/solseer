import { Hono } from "hono";
import { desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import {
  bootstrapProfileSchema,
  forumComments,
  forumPosts,
  readerProfiles,
  readingSessions,
  reviews,
  walletLedgerEntries,
  wallets,
} from "@soulseer/shared";
import type { AppBindings } from "../types";
import { requireIdentity, requireUser } from "../lib/auth";
import { sha256 } from "../lib/crypto";
import { createDatabase } from "../lib/db";
import { AppError } from "../lib/errors";

export const authRoutes = new Hono<AppBindings>();

authRoutes.post("/bootstrap", requireIdentity, async (context) => {
  const input = bootstrapProfileSchema.parse(await context.req.json());
  const identity = context.get("identity");
  const { sql } = createDatabase(context.env.DATABASE_URL);

  try {
    const response = input.readerInviteToken
      ? await sql`
          SELECT public.accept_reader_invitation(
            ${identity.subject}, ${identity.email}, ${await sha256(input.readerInviteToken)}
          ) AS id
        `
      : await sql`
          SELECT public.bootstrap_client(
            ${identity.subject}, ${identity.email}, ${input.username}, ${input.fullName}
          ) AS id
        `;
    const id = response.rows[0]?.id;
    if (typeof id !== "string")
      throw new Error("Profile bootstrap did not return a user id.");
    return context.json({ id }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("invalid_or_expired_reader_invitation")) {
      throw new AppError(
        400,
        "INVALID_READER_INVITE",
        "This Reader invitation is invalid or expired.",
      );
    }
    if (
      message.includes("users_email_lower_uidx") ||
      message.includes("users_username_lower_uidx")
    ) {
      throw new AppError(
        409,
        "PROFILE_CONFLICT",
        "That email or username is already in use.",
      );
    }
    throw error;
  }
});

authRoutes.get("/me", requireUser, async (context) => {
  const user = context.get("user");
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, user.id))
    .limit(1);
  const [reader] =
    user.role === "reader"
      ? await db
          .select()
          .from(readerProfiles)
          .where(eq(readerProfiles.userId, user.id))
          .limit(1)
      : [];
  return context.json({
    user,
    balance: wallet?.availableBalance ?? 0,
    reader: reader ?? null,
  });
});

authRoutes.get("/export", requireUser, async (context) => {
  const user = context.get("user");
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [wallet, readings, transactions, posts, comments, submittedReviews] =
    await Promise.all([
      db.select().from(wallets).where(eq(wallets.userId, user.id)).limit(1),
      db
        .select()
        .from(readingSessions)
        .where(
          or(
            eq(readingSessions.clientId, user.id),
            eq(readingSessions.readerId, user.id),
          ),
        )
        .orderBy(desc(readingSessions.createdAt)),
      db
        .select()
        .from(walletLedgerEntries)
        .where(eq(walletLedgerEntries.userId, user.id))
        .orderBy(desc(walletLedgerEntries.createdAt)),
      db
        .select()
        .from(forumPosts)
        .where(eq(forumPosts.authorId, user.id))
        .orderBy(desc(forumPosts.createdAt)),
      db
        .select()
        .from(forumComments)
        .where(eq(forumComments.authorId, user.id))
        .orderBy(desc(forumComments.createdAt)),
      db
        .select()
        .from(reviews)
        .where(eq(reviews.clientId, user.id))
        .orderBy(desc(reviews.createdAt)),
    ]);
  return context.json({
    exportedAt: new Date().toISOString(),
    profile: user,
    wallet: wallet[0] ?? null,
    readings,
    transactions,
    forum: { posts, comments },
    reviews: submittedReviews,
  });
});

authRoutes.post("/delete-account", requireUser, async (context) => {
  const input = z
    .object({ confirmation: z.literal("DELETE MY ACCOUNT") })
    .parse(await context.req.json());
  const user = context.get("user");
  const { db, sql } = createDatabase(context.env.DATABASE_URL);
  const [reader] = await db
    .select({ profileImageKey: readerProfiles.profileImageKey })
    .from(readerProfiles)
    .where(eq(readerProfiles.userId, user.id))
    .limit(1);
  try {
    await sql`SELECT public.request_account_deletion(${user.id}::uuid, ${input.confirmation})`;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("active_reading_prevents_deletion")
    ) {
      throw new AppError(
        409,
        "ACTIVE_READING",
        "End your active reading before deleting your account.",
      );
    }
    throw error;
  }
  if (reader?.profileImageKey) {
    context.executionCtx.waitUntil(
      context.env.PROFILE_IMAGES.delete(reader.profileImageKey),
    );
  }
  return context.json({ deleted: true, providerAccountDeletionRequired: true });
});
