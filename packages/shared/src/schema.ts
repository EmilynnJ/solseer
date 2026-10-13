import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["client", "reader", "admin"]);
export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "deleted",
]);
export const readerVerificationEnum = pgEnum("reader_verification_status", [
  "invited",
  "pending",
  "verified",
  "rejected",
]);
export const readingTypeEnum = pgEnum("reading_type", [
  "chat",
  "voice",
  "video",
]);
export const readingStatusEnum = pgEnum("reading_status", [
  "pending",
  "accepted",
  "preflight",
  "connecting",
  "active",
  "ending",
  "ended",
  "failed",
  "cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "refunded",
  "partially_refunded",
]);
export const ledgerTypeEnum = pgEnum("ledger_type", [
  "top_up",
  "reading_charge",
  "reader_earning",
  "platform_revenue",
  "refund",
  "adjustment",
  "payout",
  "message_charge",
  "message_earning",
]);
export const forumCategoryEnum = pgEnum("forum_category", [
  "general",
  "readings",
  "spiritual_growth",
  "ask_a_reader",
  "announcements",
]);
export const moderationStatusEnum = pgEnum("moderation_status", [
  "visible",
  "hidden",
  "deleted",
]);
export const flagStatusEnum = pgEnum("flag_status", [
  "open",
  "dismissed",
  "actioned",
]);
export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
]);
export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "succeeded",
  "failed",
  "cancelled",
]);
export const notificationDeliveryStatusEnum = pgEnum(
  "notification_delivery_status",
  ["pending", "sent", "failed"],
);
export const directMessageKindEnum = pgEnum("direct_message_kind", [
  "client_message",
  "reader_free",
  "reader_paid",
]);

const createdAt = timestamp("created_at", { withTimezone: true, mode: "date" })
  .defaultNow()
  .notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true, mode: "date" })
  .defaultNow()
  .notNull();

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    neonAuthUserId: text("neon_auth_user_id").notNull(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    fullName: text("full_name").notNull(),
    role: userRoleEnum("role").default("client").notNull(),
    status: userStatusEnum("status").default("active").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("users_neon_auth_user_id_uidx").on(table.neonAuthUserId),
    uniqueIndex("users_email_lower_uidx").on(sql`lower(${table.email})`),
    uniqueIndex("users_username_lower_uidx").on(sql`lower(${table.username})`),
  ],
);

export const clientProfiles = pgTable("client_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  preferences: jsonb("preferences")
    .$type<Record<string, string | boolean | number>>()
    .default({}),
  createdAt,
  updatedAt,
});

export const readerProfiles = pgTable(
  "reader_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    bio: text("bio").default("").notNull(),
    specialties: text("specialties")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    profileImageKey: text("profile_image_key"),
    verificationStatus: readerVerificationEnum("verification_status")
      .default("invited")
      .notNull(),
    pricingChat: integer("pricing_chat").default(0).notNull(),
    pricingVoice: integer("pricing_voice").default(0).notNull(),
    pricingVideo: integer("pricing_video").default(0).notNull(),
    isOnline: boolean("is_online").default(false).notNull(),
    lastHeartbeatAt: timestamp("last_heartbeat_at", {
      withTimezone: true,
      mode: "date",
    }),
    stripeAccountId: text("stripe_account_id"),
    stripeOnboardingComplete: boolean("stripe_onboarding_complete")
      .default(false)
      .notNull(),
    phoneNumber: text("phone_number"),
    smsNotificationsEnabled: boolean("sms_notifications_enabled")
      .default(false)
      .notNull(),
    smsConsentAt: timestamp("sms_consent_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("reader_profiles_online_idx").on(
      table.isOnline,
      table.lastHeartbeatAt,
    ),
    check(
      "reader_profiles_nonnegative_rates",
      sql`${table.pricingChat} >= 0 AND ${table.pricingVoice} >= 0 AND ${table.pricingVideo} >= 0`,
    ),
  ],
);

export const messageConversations = pgTable(
  "message_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    readerId: uuid("reader_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    clientLastReadAt: timestamp("client_last_read_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    readerLastReadAt: timestamp("reader_last_read_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    lastMessageAt: timestamp("last_message_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("message_conversations_client_reader_uidx").on(
      table.clientId,
      table.readerId,
    ),
    index("message_conversations_client_idx").on(
      table.clientId,
      table.lastMessageAt,
    ),
    index("message_conversations_reader_idx").on(
      table.readerId,
      table.lastMessageAt,
    ),
    check(
      "message_conversations_distinct_participants",
      sql`${table.clientId} <> ${table.readerId}`,
    ),
  ],
);

export const directMessages = pgTable(
  "direct_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => messageConversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: directMessageKindEnum("kind").notNull(),
    body: text("body").notNull(),
    priceCents: integer("price_cents").default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("direct_messages_conversation_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    check(
      "direct_messages_body_length",
      sql`char_length(${table.body}) BETWEEN 1 AND 8000`,
    ),
    check(
      "direct_messages_price_matches_kind",
      sql`(${table.kind} = 'reader_paid' AND ${table.priceCents} BETWEEN 100 AND 100000) OR (${table.kind} <> 'reader_paid' AND ${table.priceCents} = 0)`,
    ),
  ],
);

export const messageUnlocks = pgTable(
  "message_unlocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => directMessages.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    readerId: uuid("reader_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    priceCents: integer("price_cents").notNull(),
    readerShare: integer("reader_share").notNull(),
    platformShare: integer("platform_share").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("message_unlocks_message_uidx").on(table.messageId),
    uniqueIndex("message_unlocks_idempotency_uidx").on(table.idempotencyKey),
    index("message_unlocks_client_idx").on(table.clientId, table.createdAt),
    index("message_unlocks_reader_idx").on(table.readerId, table.createdAt),
    check(
      "message_unlocks_split_valid",
      sql`${table.priceCents} > 0 AND ${table.readerShare} >= 0 AND ${table.platformShare} >= 0 AND ${table.readerShare} + ${table.platformShare} = ${table.priceCents}`,
    ),
  ],
);

export const wallets = pgTable(
  "wallets",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "restrict" }),
    availableBalance: integer("available_balance").default(0).notNull(),
    currency: text("currency").default("usd").notNull(),
    version: integer("version").default(0).notNull(),
    updatedAt,
  },
  (table) => [
    check("wallets_nonnegative_balance", sql`${table.availableBalance} >= 0`),
    check("wallets_valid_version", sql`${table.version} >= 0`),
  ],
);

export const readingSessions = pgTable(
  "reading_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    readerId: uuid("reader_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: readingTypeEnum("type").notNull(),
    status: readingStatusEnum("status").default("pending").notNull(),
    pricePerMinute: integer("price_per_minute").notNull(),
    cloudflareMeetingId: text("cloudflare_meeting_id"),
    cloudflareSessionId: text("cloudflare_session_id"),
    clientParticipantId: text("client_participant_id"),
    readerParticipantId: text("reader_participant_id"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastBilledThrough: timestamp("last_billed_through", {
      withTimezone: true,
      mode: "date",
    }),
    nextBillAt: timestamp("next_bill_at", { withTimezone: true, mode: "date" }),
    billingSequence: integer("billing_sequence").default(0).notNull(),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    totalPrice: integer("total_price").default(0).notNull(),
    paymentStatus: paymentStatusEnum("payment_status")
      .default("pending")
      .notNull(),
    chatTranscript: jsonb("chat_transcript").$type<unknown[] | null>(),
    failureReason: text("failure_reason"),
    endedById: uuid("ended_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("reading_sessions_client_idx").on(table.clientId, table.createdAt),
    index("reading_sessions_reader_idx").on(table.readerId, table.createdAt),
    index("reading_sessions_status_idx").on(table.status, table.createdAt),
    uniqueIndex("reading_sessions_meeting_uidx").on(table.cloudflareMeetingId),
    check(
      "reading_sessions_distinct_participants",
      sql`${table.readerId} <> ${table.clientId}`,
    ),
    check(
      "reading_sessions_nonnegative_price",
      sql`${table.pricePerMinute} >= 0`,
    ),
    check(
      "reading_sessions_nonnegative_totals",
      sql`${table.billingSequence} >= 0 AND ${table.durationSeconds} >= 0 AND ${table.totalPrice} >= 0`,
    ),
  ],
);

export const walletLedgerEntries = pgTable(
  "wallet_ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: ledgerTypeEnum("type").notNull(),
    amount: integer("amount").notNull(),
    balanceBefore: integer("balance_before").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    readingId: uuid("reading_id").references(() => readingSessions.id, {
      onDelete: "restrict",
    }),
    messageId: uuid("message_id").references(() => directMessages.id, {
      onDelete: "restrict",
    }),
    stripeReference: text("stripe_reference"),
    idempotencyKey: text("idempotency_key").notNull(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    metadata: jsonb("metadata")
      .$type<Record<string, string | number | boolean | null>>()
      .default({}),
    createdAt,
  },
  (table) => [
    uniqueIndex("wallet_ledger_idempotency_uidx").on(table.idempotencyKey),
    index("wallet_ledger_user_idx").on(table.userId, table.createdAt),
    index("wallet_ledger_reading_idx").on(table.readingId),
    index("wallet_ledger_message_idx").on(table.messageId),
    check(
      "wallet_ledger_balances_nonnegative",
      sql`${table.balanceBefore} >= 0 AND ${table.balanceAfter} >= 0`,
    ),
  ],
);

export const readingEvents = pgTable(
  "reading_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    readingId: uuid("reading_id")
      .notNull()
      .references(() => readingSessions.id, { onDelete: "cascade" }),
    providerEventKey: text("provider_event_key").notNull(),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("reading_events_provider_key_uidx").on(table.providerEventKey),
    index("reading_events_reading_idx").on(table.readingId, table.occurredAt),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    readingId: uuid("reading_id")
      .notNull()
      .references(() => readingSessions.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    readerId: uuid("reader_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    rating: integer("rating").notNull(),
    text: text("text"),
    createdAt,
  },
  (table) => [
    uniqueIndex("reviews_reading_uidx").on(table.readingId),
    index("reviews_reader_idx").on(table.readerId, table.createdAt),
    check("reviews_rating_range", sql`${table.rating} BETWEEN 1 AND 5`),
  ],
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    readingId: uuid("reading_id").references(() => readingSessions.id, {
      onDelete: "cascade",
    }),
    messageId: uuid("message_id").references(() => directMessages.id, {
      onDelete: "cascade",
    }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    status: notificationDeliveryStatusEnum("status")
      .default("pending")
      .notNull(),
    providerMessageId: text("provider_message_id"),
    failureCode: text("failure_code"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("notification_delivery_reading_recipient_channel_uidx")
      .on(table.readingId, table.recipientId, table.channel)
      .where(sql`${table.readingId} IS NOT NULL`),
    uniqueIndex("notification_delivery_message_recipient_channel_uidx")
      .on(table.messageId, table.recipientId, table.channel)
      .where(sql`${table.messageId} IS NOT NULL`),
    check(
      "notification_deliveries_one_source",
      sql`(${table.readingId} IS NOT NULL AND ${table.messageId} IS NULL) OR (${table.readingId} IS NULL AND ${table.messageId} IS NOT NULL)`,
    ),
  ],
);

export const forumPosts = pgTable(
  "forum_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    category: forumCategoryEnum("category").notNull(),
    status: moderationStatusEnum("status").default("visible").notNull(),
    isLocked: boolean("is_locked").default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [index("forum_posts_feed_idx").on(table.status, table.createdAt)],
);

export const forumComments = pgTable(
  "forum_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => forumPosts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    status: moderationStatusEnum("status").default("visible").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("forum_comments_post_idx").on(table.postId, table.createdAt),
  ],
);

export const forumFlags = pgTable(
  "forum_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    postId: uuid("post_id").references(() => forumPosts.id, {
      onDelete: "cascade",
    }),
    commentId: uuid("comment_id").references(() => forumComments.id, {
      onDelete: "cascade",
    }),
    reason: text("reason").notNull(),
    status: flagStatusEnum("status").default("open").notNull(),
    reviewedById: uuid("reviewed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    createdAt,
  },
  (table) => [
    index("forum_flags_status_idx").on(table.status, table.createdAt),
    check(
      "forum_flags_one_target",
      sql`(${table.postId} IS NOT NULL AND ${table.commentId} IS NULL) OR (${table.postId} IS NULL AND ${table.commentId} IS NOT NULL)`,
    ),
  ],
);

export const providerEvents = pgTable(
  "provider_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("provider_events_provider_id_uidx").on(
      table.provider,
      table.eventId,
    ),
  ],
);

export const pendingPayouts = pgTable(
  "pending_payouts",
  {
    readerId: uuid("reader_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "restrict" }),
    availableAmount: integer("available_amount").default(0).notNull(),
    reservedAmount: integer("reserved_amount").default(0).notNull(),
    updatedAt,
  },
  (table) => [
    check(
      "pending_payouts_nonnegative",
      sql`${table.availableAmount} >= 0 AND ${table.reservedAmount} >= 0`,
    ),
  ],
);

export const payoutRecords = pgTable(
  "payout_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    readerId: uuid("reader_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    status: payoutStatusEnum("status").default("pending").notNull(),
    stripeTransferId: text("stripe_transfer_id"),
    stripePayoutId: text("stripe_payout_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    initiatedById: uuid("initiated_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    failureReason: text("failure_reason"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("payout_records_idempotency_uidx").on(table.idempotencyKey),
    index("payout_records_reader_idx").on(table.readerId, table.createdAt),
    check("payout_records_positive_amount", sql`${table.amount} > 0`),
  ],
);

export const refundRecords = pgTable(
  "refund_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    readingId: uuid("reading_id")
      .notNull()
      .references(() => readingSessions.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    readerId: uuid("reader_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    readerReversalAmount: integer("reader_reversal_amount")
      .default(0)
      .notNull(),
    status: refundStatusEnum("status").default("pending").notNull(),
    stripeRefundId: text("stripe_refund_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    reason: text("reason").notNull(),
    initiatedById: uuid("initiated_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("refund_records_idempotency_uidx").on(table.idempotencyKey),
    index("refund_records_reading_idx").on(table.readingId, table.createdAt),
    check(
      "refund_records_positive_amounts",
      sql`${table.amount} > 0 AND ${table.readerReversalAmount} >= 0`,
    ),
  ],
);

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    consentSource: text("consent_source").notNull(),
    status: text("status").default("subscribed").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("newsletter_email_lower_uidx").on(sql`lower(${table.email})`),
  ],
);

export const readerInvitations = pgTable(
  "reader_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    fullName: text("full_name").notNull(),
    bio: text("bio").notNull(),
    specialties: text("specialties")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    pricingChat: integer("pricing_chat").notNull(),
    pricingVoice: integer("pricing_voice").notNull(),
    pricingVideo: integer("pricing_video").notNull(),
    tokenHash: text("token_hash").notNull(),
    verificationStatus: readerVerificationEnum("verification_status")
      .default("invited")
      .notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    invitedById: uuid("invited_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt,
  },
  (table) => [
    uniqueIndex("reader_invitations_token_hash_uidx").on(table.tokenHash),
    index("reader_invitations_email_idx").on(table.email, table.expiresAt),
    check(
      "reader_invitations_nonnegative_rates",
      sql`${table.pricingChat} >= 0 AND ${table.pricingVoice} >= 0 AND ${table.pricingVideo} >= 0`,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt,
  },
  (table) => [
    index("audit_logs_target_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
  ],
);

export type AppUser = typeof users.$inferSelect;
export type ReaderProfile = typeof readerProfiles.$inferSelect;
export type ReadingSession = typeof readingSessions.$inferSelect;
export type ForumPost = typeof forumPosts.$inferSelect;
export type WalletLedgerEntry = typeof walletLedgerEntries.$inferSelect;
