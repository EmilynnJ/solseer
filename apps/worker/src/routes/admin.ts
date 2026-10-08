import { Hono } from "hono";
import { asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  adminBalanceAdjustmentSchema,
  adminRefundSchema,
  auditLogs,
  createReaderSchema,
  forumFlags,
  payoutRecords,
  pendingPayouts,
  readerInvitations,
  readerProfiles,
  readingEvents,
  readingSessions,
  refundRecords,
  users,
  walletLedgerEntries,
  wallets,
} from "@soulseer/shared";
import type { AppBindings } from "../types";
import { requireRole, requireUser } from "../lib/auth";
import { randomToken, sha256 } from "../lib/crypto";
import { createDatabase } from "../lib/db";
import { AppError } from "../lib/errors";
import { createStripe } from "../providers/stripe";
import { validateUuidParams } from "../lib/http";
import { assertNoLiveReading } from "../lib/account-status";

const readerAdminUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  bio: z.string().trim().max(4_000).optional(),
  specialties: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  pricingChat: z.number().int().min(100).max(100_000).optional(),
  pricingVoice: z.number().int().min(100).max(100_000).optional(),
  pricingVideo: z.number().int().min(100).max(100_000).optional(),
  verificationStatus: z
    .enum(["invited", "pending", "verified", "rejected"])
    .optional(),
});

const payoutRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(200),
});

const provisionReaderSchema = z.object({
  neonAuthUserId: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(254),
  fullName: z.string().trim().min(2).max(100),
});

export const adminRoutes = new Hono<AppBindings>();
adminRoutes.use("*", requireUser, requireRole("admin"));

adminRoutes.get("/users", async (context) => {
  const { db } = createDatabase(context.env.DATABASE_URL);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      balance: wallets.availableBalance,
      verificationStatus: readerProfiles.verificationStatus,
      isOnline: readerProfiles.isOnline,
      stripeOnboardingComplete: readerProfiles.stripeOnboardingComplete,
    })
    .from(users)
    .leftJoin(wallets, eq(wallets.userId, users.id))
    .leftJoin(readerProfiles, eq(readerProfiles.userId, users.id))
    .orderBy(desc(users.createdAt))
    .limit(500);
  return context.json({ users: rows });
});

const userStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().max(500).optional(),
});

// Suspend or reactivate any client or Reader. Suspended accounts are rejected
// by requireUser on every API call.
adminRoutes.patch("/users/:id/status", validateUuidParams("id"), async (context) => {
  const input = userStatusSchema.parse(await context.req.json());
  const id = context.req.param("id");
  const actor = context.get("user");
  if (id === actor.id)
    throw new AppError(400, "CANNOT_CHANGE_SELF", "You can't suspend your own account.");
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [target] = await db
    .select({ role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  if (target.role === "admin")
    throw new AppError(400, "CANNOT_CHANGE_ADMIN", "Admin accounts can't be suspended here.");
  if (target.status === "deleted")
    throw new AppError(400, "USER_DELETED", "This account has been deleted.");
  if (input.status === "suspended") await assertNoLiveReading(db, id);
  await db
    .update(users)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(users.id, id));
  if (input.status === "suspended" && target.role === "reader") {
    await db
      .update(readerProfiles)
      .set({ isOnline: false, updatedAt: new Date() })
      .where(eq(readerProfiles.userId, id));
  }
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: input.status === "suspended" ? "user.suspend" : "user.reactivate",
    targetType: "user",
    targetId: id,
    reason: input.reason,
    metadata: { role: target.role },
  });
  return context.json({ id, status: input.status });
});

adminRoutes.post("/readers/provision", async (context) => {
  const input = provisionReaderSchema.parse(await context.req.json());
  const username = `reader_${randomToken(9)}`;
  const { sql: neonSql } = createDatabase(context.env.DATABASE_URL);
  try {
    const result = await neonSql`
      WITH new_user AS (
        INSERT INTO public.users (neon_auth_user_id, email, username, full_name, role)
        VALUES (
          ${input.neonAuthUserId},
          ${input.email.toLowerCase()},
          ${username},
          ${input.fullName},
          'reader'
        )
        RETURNING id
      ), new_reader_profile AS (
        INSERT INTO public.reader_profiles (
          user_id, verification_status, pricing_chat, pricing_voice, pricing_video
        )
        SELECT id, 'pending', 500, 700, 1000 FROM new_user
        RETURNING user_id
      ), new_wallet AS (
        INSERT INTO public.wallets (user_id)
        SELECT id FROM new_user
        RETURNING user_id
      ), new_pending_payout AS (
        INSERT INTO public.pending_payouts (reader_id)
        SELECT id FROM new_user
        RETURNING reader_id
      ), new_audit_log AS (
        INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
        SELECT
          ${context.get("user").id}::uuid,
          'reader.provision',
          'user',
          id::text,
          jsonb_build_object('email', ${input.email.toLowerCase()}, 'username', ${username})
        FROM new_user
        RETURNING id
      )
      SELECT id AS user_id FROM new_user
    `;
    const userId = result.rows[0]?.user_id;
    if (typeof userId !== "string") {
      throw new AppError(
        500,
        "READER_SETUP_FAILED",
        "The Reader account could not be set up.",
      );
    }
    return context.json({ userId, username }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("users_email_lower_uidx")) {
      throw new AppError(
        409,
        "ACCOUNT_EXISTS",
        "An account with this email already exists in SoulSeer.",
      );
    }
    if (message.includes("users_neon_auth_user_id_uidx")) {
      throw new AppError(
        409,
        "IDENTITY_EXISTS",
        "This login is already connected to a SoulSeer account.",
      );
    }
    throw error;
  }
});

// Keep already-issued Reader invitation links and older clients working while
// the new account-provisioning workflow rolls out.
adminRoutes.post("/readers", async (context) => {
  const input = createReaderSchema.parse(await context.req.json());
  const token = randomToken(48);
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [existing] = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(
      sql`lower(${users.email}) = lower(${input.email}) OR lower(${users.username}) = lower(${input.username})`,
    )
    .limit(1);
  if (existing) {
    throw new AppError(
      409,
      "ACCOUNT_EXISTS",
      existing.email.toLowerCase() === input.email.toLowerCase()
        ? "An account with this email already exists. Remove or convert that account before inviting it as a Reader."
        : "That username is already taken. Choose a different username for this Reader.",
    );
  }
  try {
    const [invitation] = await db
      .insert(readerInvitations)
      .values({
        email: input.email.toLowerCase(),
        username: input.username,
        fullName: input.fullName,
        bio: input.bio,
        specialties: input.specialties,
        pricingChat: input.pricing.chat,
        pricingVoice: input.pricing.voice,
        pricingVideo: input.pricing.video,
        tokenHash: await sha256(token),
        verificationStatus: input.verified ? "verified" : "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
        invitedById: context.get("user").id,
      })
      .returning({ id: readerInvitations.id, expiresAt: readerInvitations.expiresAt });
    if (!invitation) {
      throw new AppError(
        500,
        "INVITATION_CREATE_FAILED",
        "The Reader invitation could not be created.",
      );
    }
    await db.insert(auditLogs).values({
      actorId: context.get("user").id,
      action: "reader.invite",
      targetType: "reader_invitation",
      targetId: invitation.id,
      metadata: {
        email: input.email.toLowerCase(),
        username: input.username,
        verified: input.verified,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    });
    return context.json(
      {
        invitation,
        inviteUrl: `${context.env.FRONTEND_ORIGIN}/login?readerInvite=${encodeURIComponent(token)}`,
      },
      201,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("reader_invitations_token_hash_uidx")) {
      throw new AppError(
        409,
        "INVITATION_CONFLICT",
        "A Reader invitation could not be created.",
      );
    }
    throw error;
  }
});

adminRoutes.get("/readers", async (context) => {
  const { db } = createDatabase(context.env.DATABASE_URL);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      fullName: users.fullName,
      status: users.status,
      bio: readerProfiles.bio,
      specialties: readerProfiles.specialties,
      pricingChat: readerProfiles.pricingChat,
      pricingVoice: readerProfiles.pricingVoice,
      pricingVideo: readerProfiles.pricingVideo,
      verificationStatus: readerProfiles.verificationStatus,
      hasImage: sql<boolean>`${readerProfiles.profileImageKey} IS NOT NULL`,
    })
    .from(readerProfiles)
    .innerJoin(users, eq(users.id, readerProfiles.userId))
    .orderBy(asc(users.fullName))
    .limit(500);
  return context.json({ readers: rows });
});

adminRoutes.patch("/readers/:id", validateUuidParams("id"), async (context) => {
  const input = readerAdminUpdateSchema.parse(await context.req.json());
  const id = context.req.param("id");
  const actor = context.get("user");
  const { db } = createDatabase(context.env.DATABASE_URL);
  const userChanges = {
    ...(input.fullName ? { fullName: input.fullName } : {}),
    updatedAt: new Date(),
  };
  const profileChanges = {
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
    ...(input.specialties ? { specialties: input.specialties } : {}),
    ...(input.pricingChat ? { pricingChat: input.pricingChat } : {}),
    ...(input.pricingVoice ? { pricingVoice: input.pricingVoice } : {}),
    ...(input.pricingVideo ? { pricingVideo: input.pricingVideo } : {}),
    ...(input.verificationStatus
      ? { verificationStatus: input.verificationStatus }
      : {}),
    updatedAt: new Date(),
  };
  const [profile] = await db
    .update(readerProfiles)
    .set(profileChanges)
    .where(eq(readerProfiles.userId, id))
    .returning();
  if (!profile)
    throw new AppError(404, "READER_NOT_FOUND", "Reader not found.");
  await db.update(users).set(userChanges).where(eq(users.id, id));
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "reader.update",
    targetType: "reader",
    targetId: id,
    metadata: input,
  });
  return context.json({ reader: profile });
});

adminRoutes.post("/readers/:id/connect", validateUuidParams("id"), async (context) => {
  const readerId = context.req.param("id");
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [reader] = await db
    .select({
      email: users.email,
      fullName: users.fullName,
      stripeAccountId: readerProfiles.stripeAccountId,
    })
    .from(readerProfiles)
    .innerJoin(users, eq(users.id, readerProfiles.userId))
    .where(eq(readerProfiles.userId, readerId))
    .limit(1);
  if (!reader) throw new AppError(404, "READER_NOT_FOUND", "Reader not found.");
  const stripe = createStripe(context.env);
  const accountId =
    reader.stripeAccountId ??
    (
      await stripe.accounts.create({
        type: "express",
        email: reader.email,
        capabilities: { transfers: { requested: true } },
        business_profile: {
          product_description: "Spiritual reading services through SoulSeer",
        },
        metadata: { soulseerReaderId: readerId },
      })
    ).id;
  if (!reader.stripeAccountId) {
    await db
      .update(readerProfiles)
      .set({ stripeAccountId: accountId, updatedAt: new Date() })
      .where(eq(readerProfiles.userId, readerId));
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${context.env.FRONTEND_ORIGIN}/dashboard?connect=refresh`,
    return_url: `${context.env.FRONTEND_ORIGIN}/dashboard?connect=complete`,
    type: "account_onboarding",
  });
  return context.json({ url: link.url, expiresAt: link.expires_at });
});

const readingClients = alias(users, "reading_clients");
const readingReaders = alias(users, "reading_readers");

adminRoutes.get("/readings", async (context) => {
  const { db } = createDatabase(context.env.DATABASE_URL);
  const rows = await db
    .select({
      id: readingSessions.id,
      status: readingSessions.status,
      type: readingSessions.type,
      clientId: readingSessions.clientId,
      readerId: readingSessions.readerId,
      clientName: readingClients.fullName,
      readerName: readingReaders.fullName,
      durationSeconds: readingSessions.durationSeconds,
      totalPrice: readingSessions.totalPrice,
      paymentStatus: readingSessions.paymentStatus,
      failureReason: readingSessions.failureReason,
      createdAt: readingSessions.createdAt,
      eventCount: sql<number>`(select count(*)::int from ${readingEvents} e where e.reading_id = ${readingSessions.id})`,
    })
    .from(readingSessions)
    .leftJoin(readingClients, eq(readingClients.id, readingSessions.clientId))
    .leftJoin(readingReaders, eq(readingReaders.id, readingSessions.readerId))
    .orderBy(desc(readingSessions.createdAt))
    .limit(500);
  return context.json({ readings: rows });
});

// Admin-only record of a single reading for resolving disputes: who took part,
// timing, billing, provider events and the saved chat transcript.
adminRoutes.get("/readings/:id", validateUuidParams("id"), async (context) => {
  const id = context.req.param("id");
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [reading] = await db
    .select({
      id: readingSessions.id,
      type: readingSessions.type,
      status: readingSessions.status,
      pricePerMinute: readingSessions.pricePerMinute,
      createdAt: readingSessions.createdAt,
      startedAt: readingSessions.startedAt,
      completedAt: readingSessions.completedAt,
      durationSeconds: readingSessions.durationSeconds,
      totalPrice: readingSessions.totalPrice,
      paymentStatus: readingSessions.paymentStatus,
      failureReason: readingSessions.failureReason,
      endedById: readingSessions.endedById,
      chatTranscript: readingSessions.chatTranscript,
      client: {
        id: readingClients.id,
        fullName: readingClients.fullName,
        username: readingClients.username,
        email: readingClients.email,
      },
      reader: {
        id: readingReaders.id,
        fullName: readingReaders.fullName,
        username: readingReaders.username,
        email: readingReaders.email,
      },
    })
    .from(readingSessions)
    .leftJoin(readingClients, eq(readingClients.id, readingSessions.clientId))
    .leftJoin(readingReaders, eq(readingReaders.id, readingSessions.readerId))
    .where(eq(readingSessions.id, id))
    .limit(1);
  if (!reading)
    throw new AppError(404, "READING_NOT_FOUND", "Reading not found.");
  const [events, ledger] = await Promise.all([
    db
      .select({
        id: readingEvents.id,
        eventType: readingEvents.eventType,
        occurredAt: readingEvents.occurredAt,
      })
      .from(readingEvents)
      .where(eq(readingEvents.readingId, id))
      .orderBy(asc(readingEvents.occurredAt)),
    db
      .select({
        id: walletLedgerEntries.id,
        userId: walletLedgerEntries.userId,
        type: walletLedgerEntries.type,
        amount: walletLedgerEntries.amount,
        reason: walletLedgerEntries.reason,
        createdAt: walletLedgerEntries.createdAt,
      })
      .from(walletLedgerEntries)
      .where(eq(walletLedgerEntries.readingId, id))
      .orderBy(asc(walletLedgerEntries.createdAt)),
  ]);
  await db.insert(auditLogs).values({
    actorId: context.get("user").id,
    action: "reading.view_record",
    targetType: "reading",
    targetId: id,
    metadata: {},
  });
  return context.json({ reading, events, ledger });
});

adminRoutes.get("/transactions", async (context) => {
  const { db } = createDatabase(context.env.DATABASE_URL);
  const transactions = await db
    .select()
    .from(walletLedgerEntries)
    .orderBy(desc(walletLedgerEntries.createdAt))
    .limit(1_000);
  return context.json({ transactions });
});

adminRoutes.post("/balance-adjust", async (context) => {
  const input = adminBalanceAdjustmentSchema.parse(await context.req.json());
  const { sql: neonSql } = createDatabase(context.env.DATABASE_URL);
  const result = await neonSql`
    SELECT public.adjust_wallet_balance(
      ${input.userId}::uuid,
      ${input.amountCents}::integer,
      ${context.get("user").id}::uuid,
      ${input.reason},
      ${input.idempotencyKey}
    ) AS result
  `;
  return context.json({ result: result.rows[0]?.result });
});

adminRoutes.post("/refunds/:readingId", validateUuidParams("readingId"), async (context) => {
  const input = adminRefundSchema.parse(await context.req.json());
  const { sql: neonSql } = createDatabase(context.env.DATABASE_URL);
  try {
    const result = await neonSql`
      SELECT public.refund_reading_to_wallet(
        ${context.req.param("readingId")}::uuid,
        ${context.get("user").id}::uuid,
        ${input.reason},
        ${input.idempotencyKey}
      ) AS result
    `;
    return context.json({ refund: result.rows[0]?.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("reading_not_refundable") ||
      message.includes("reading_already_refunded")
    ) {
      throw new AppError(
        409,
        "READING_NOT_REFUNDABLE",
        "This reading cannot be refunded.",
      );
    }
    throw error;
  }
});

adminRoutes.post("/payouts/:readerId", validateUuidParams("readerId"), async (context) => {
  const input = payoutRequestSchema.parse(await context.req.json());
  const { sql: neonSql, db } = createDatabase(context.env.DATABASE_URL);
  let reservation: {
    payoutId: string;
    amount: number;
    stripeAccountId: string;
    duplicate: boolean;
  };
  try {
    const result = await neonSql`
      SELECT public.reserve_reader_payout(
        ${context.req.param("readerId")}::uuid,
        ${context.get("user").id}::uuid,
        ${input.idempotencyKey}
      ) AS result
    `;
    reservation = result.rows[0]?.result as typeof reservation;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("connect_onboarding_required")) {
      throw new AppError(
        409,
        "CONNECT_REQUIRED",
        "Complete Stripe Connect onboarding before payout.",
      );
    }
    if (message.includes("payout_below_threshold")) {
      throw new AppError(
        409,
        "PAYOUT_BELOW_THRESHOLD",
        "Reader earnings have not reached the $15 payout threshold.",
      );
    }
    throw error;
  }
  if (reservation.duplicate) {
    const [record] = await db
      .select()
      .from(payoutRecords)
      .where(eq(payoutRecords.id, reservation.payoutId));
    return context.json({ payout: record });
  }
  const stripe = createStripe(context.env);
  try {
    const transfer = await stripe.transfers.create(
      {
        amount: reservation.amount,
        currency: "usd",
        destination: reservation.stripeAccountId,
        metadata: { payoutRecordId: reservation.payoutId },
      },
      { idempotencyKey: `payout:${reservation.payoutId}` },
    );
    return context.json({
      payout: {
        id: reservation.payoutId,
        status: "processing",
        amount: reservation.amount,
      },
      transferId: transfer.id,
    });
  } catch (error) {
    await neonSql`
      SELECT public.fail_reader_payout(
        ${reservation.payoutId}::uuid,
        ${error instanceof Error ? error.message.slice(0, 500) : "Stripe transfer failed"}
      )
    `;
    throw error;
  }
});

adminRoutes.get("/forum/flagged", async (context) => {
  const { db } = createDatabase(context.env.DATABASE_URL);
  const flags = await db
    .select()
    .from(forumFlags)
    .where(eq(forumFlags.status, "open"))
    .orderBy(desc(forumFlags.createdAt));
  return context.json({ flags });
});

adminRoutes.patch("/forum/flags/:id", validateUuidParams("id"), async (context) => {
  const input = z
    .object({ status: z.enum(["dismissed", "actioned"]) })
    .parse(await context.req.json());
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [flag] = await db
    .update(forumFlags)
    .set({
      status: input.status,
      reviewedById: context.get("user").id,
      reviewedAt: new Date(),
    })
    .where(eq(forumFlags.id, context.req.param("id")))
    .returning();
  if (!flag) throw new AppError(404, "FLAG_NOT_FOUND", "Flag not found.");
  return context.json({ flag });
});

adminRoutes.get("/financial-summary", async (context) => {
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [pending] = await db
    .select({
      total: sql<number>`coalesce(sum(${pendingPayouts.availableAmount}), 0)::int`,
    })
    .from(pendingPayouts);
  const payouts = await db
    .select()
    .from(payoutRecords)
    .orderBy(desc(payoutRecords.createdAt))
    .limit(200);
  const refunds = await db
    .select()
    .from(refundRecords)
    .orderBy(desc(refundRecords.createdAt))
    .limit(200);
  return context.json({
    pendingPayoutTotal: pending?.total ?? 0,
    payouts,
    refunds,
  });
});
