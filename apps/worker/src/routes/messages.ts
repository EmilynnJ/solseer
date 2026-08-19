import { Hono } from "hono";
import {
  sendDirectMessageSchema,
  startConversationSchema,
} from "@soulseer/shared";
import type { AppBindings } from "../types";
import { requireRole, requireUser } from "../lib/auth";
import { createDatabase } from "../lib/db";
import { AppError } from "../lib/errors";
import { validateUuidParams } from "../lib/http";

type DbRow = Record<string, unknown>;

export const messageRoutes = new Hono<AppBindings>();

messageRoutes.use("*", requireUser, requireRole("client", "reader"));

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function integer(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function conversationJson(row: DbRow) {
  return {
    id: text(row.id),
    counterpart: {
      id: text(row.counterpart_id),
      username: text(row.counterpart_username),
      fullName: text(row.counterpart_full_name),
      profileImageKey: row.counterpart_profile_image_key ?? null,
    },
    lastMessage: row.last_message_id
      ? {
          id: text(row.last_message_id),
          kind: text(row.last_message_kind),
          body: row.last_message_body ?? null,
          priceCents: integer(row.last_message_price_cents),
          locked: Boolean(row.last_message_locked),
          createdAt: row.last_message_created_at,
        }
      : null,
    unreadCount: integer(row.unread_count),
    lastMessageAt: row.last_message_at,
  };
}

function messageJson(row: DbRow) {
  const locked = Boolean(row.locked);
  return {
    id: text(row.id),
    conversationId: text(row.conversation_id),
    senderId: text(row.sender_id),
    kind: text(row.kind),
    body: locked ? null : row.body,
    priceCents: integer(row.price_cents),
    locked,
    unlocked: Boolean(row.unlocked),
    createdAt: row.created_at,
  };
}

async function findConversation(
  databaseUrl: string,
  conversationId: string,
  userId: string,
) {
  const { sql } = createDatabase(databaseUrl);
  const result = await sql`
    SELECT id, client_id, reader_id
    FROM message_conversations
    WHERE id = ${conversationId}::uuid
      AND (client_id = ${userId}::uuid OR reader_id = ${userId}::uuid)
    LIMIT 1
  `;
  const row = result.rows[0] as DbRow | undefined;
  if (!row) {
    throw new AppError(
      404,
      "CONVERSATION_NOT_FOUND",
      "Conversation not found.",
    );
  }
  return row;
}

messageRoutes.get("/conversations", async (context) => {
  const user = context.get("user");
  const { sql } = createDatabase(context.env.DATABASE_URL);
  const result =
    user.role === "client"
      ? await sql`
          SELECT mc.id,
                 counterpart.id AS counterpart_id,
                 counterpart.username AS counterpart_username,
                 counterpart.full_name AS counterpart_full_name,
                 rp.profile_image_key AS counterpart_profile_image_key,
                 latest.id AS last_message_id,
                 latest.kind AS last_message_kind,
                 CASE WHEN latest.kind = 'reader_paid' AND unlock.id IS NULL
                      THEN NULL ELSE latest.body END AS last_message_body,
                 latest.price_cents AS last_message_price_cents,
                 (latest.kind = 'reader_paid' AND unlock.id IS NULL) AS last_message_locked,
                 latest.created_at AS last_message_created_at,
                 mc.last_message_at,
                 (SELECT count(*)::int FROM direct_messages unread
                  WHERE unread.conversation_id = mc.id
                    AND unread.sender_id <> ${user.id}::uuid
                    AND unread.created_at > mc.client_last_read_at) AS unread_count
          FROM message_conversations mc
          JOIN users counterpart ON counterpart.id = mc.reader_id
          LEFT JOIN reader_profiles rp ON rp.user_id = counterpart.id
          LEFT JOIN LATERAL (
            SELECT * FROM direct_messages dm
            WHERE dm.conversation_id = mc.id
            ORDER BY dm.created_at DESC LIMIT 1
          ) latest ON true
          LEFT JOIN message_unlocks unlock ON unlock.message_id = latest.id
          WHERE mc.client_id = ${user.id}::uuid
          ORDER BY mc.last_message_at DESC
        `
      : await sql`
          SELECT mc.id,
                 counterpart.id AS counterpart_id,
                 counterpart.username AS counterpart_username,
                 counterpart.full_name AS counterpart_full_name,
                 NULL::text AS counterpart_profile_image_key,
                 latest.id AS last_message_id,
                 latest.kind AS last_message_kind,
                 latest.body AS last_message_body,
                 latest.price_cents AS last_message_price_cents,
                 false AS last_message_locked,
                 latest.created_at AS last_message_created_at,
                 mc.last_message_at,
                 (SELECT count(*)::int FROM direct_messages unread
                  WHERE unread.conversation_id = mc.id
                    AND unread.sender_id <> ${user.id}::uuid
                    AND unread.created_at > mc.reader_last_read_at) AS unread_count
          FROM message_conversations mc
          JOIN users counterpart ON counterpart.id = mc.client_id
          LEFT JOIN LATERAL (
            SELECT * FROM direct_messages dm
            WHERE dm.conversation_id = mc.id
            ORDER BY dm.created_at DESC LIMIT 1
          ) latest ON true
          WHERE mc.reader_id = ${user.id}::uuid
          ORDER BY mc.last_message_at DESC
        `;
  return context.json({
    conversations: (result.rows as DbRow[]).map(conversationJson),
  });
});

messageRoutes.post("/conversations", async (context) => {
  const user = context.get("user");
  if (user.role !== "client") {
    throw new AppError(
      403,
      "ROLE_FORBIDDEN",
      "Only Clients can start a conversation.",
    );
  }
  const input = startConversationSchema.parse(await context.req.json());
  const { sql } = createDatabase(context.env.DATABASE_URL);
  try {
    const result = await sql`
      SELECT * FROM public.send_client_message(
        ${user.id}::uuid, ${input.readerId}::uuid, ${input.body}
      )
    `;
    const row = result.rows[0] as DbRow | undefined;
    return context.json(
      {
        conversationId: text(row?.conversation_id),
        messageId: text(row?.message_id),
      },
      201,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("reader_unavailable_for_messages")
    ) {
      throw new AppError(
        409,
        "READER_UNAVAILABLE",
        "This Reader is not available for messages.",
      );
    }
    throw error;
  }
});

messageRoutes.get(
  "/conversations/:id",
  validateUuidParams("id"),
  async (context) => {
    const user = context.get("user");
    const conversation = await findConversation(
      context.env.DATABASE_URL,
      context.req.param("id"),
      user.id,
    );
    const { sql } = createDatabase(context.env.DATABASE_URL);
    const result = await sql`
    SELECT dm.id, dm.conversation_id, dm.sender_id, dm.kind,
           CASE WHEN dm.kind = 'reader_paid'
                     AND ${user.role} = 'client'
                     AND unlock.id IS NULL
                THEN NULL ELSE dm.body END AS body,
           dm.price_cents,
           (dm.kind = 'reader_paid' AND ${user.role} = 'client' AND unlock.id IS NULL) AS locked,
           (unlock.id IS NOT NULL) AS unlocked,
           dm.created_at
    FROM direct_messages dm
    LEFT JOIN message_unlocks unlock ON unlock.message_id = dm.id
    WHERE dm.conversation_id = ${context.req.param("id")}::uuid
    ORDER BY dm.created_at ASC
    LIMIT 500
  `;
    return context.json({
      conversation: {
        id: text(conversation.id),
        clientId: text(conversation.client_id),
        readerId: text(conversation.reader_id),
      },
      messages: (result.rows as DbRow[]).map(messageJson),
    });
  },
);

messageRoutes.post(
  "/conversations/:id/messages",
  validateUuidParams("id"),
  async (context) => {
    const user = context.get("user");
    const input = sendDirectMessageSchema.parse(await context.req.json());
    const conversation = await findConversation(
      context.env.DATABASE_URL,
      context.req.param("id"),
      user.id,
    );
    const { sql } = createDatabase(context.env.DATABASE_URL);
    if (user.role === "client") {
      if (input.paid) {
        throw new AppError(
          403,
          "PAID_REPLY_READER_ONLY",
          "Only Readers can price a reply.",
        );
      }
      const result = await sql`
      SELECT * FROM public.send_client_message(
        ${user.id}::uuid, ${text(conversation.reader_id)}::uuid, ${input.body}
      )
    `;
      return context.json(
        { messageId: text((result.rows[0] as DbRow | undefined)?.message_id) },
        201,
      );
    }
    const result = await sql`
    SELECT public.send_reader_message(
      ${user.id}::uuid,
      ${context.req.param("id")}::uuid,
      ${input.body},
      ${input.paid},
      ${input.paid ? input.priceCents : 0}
    ) AS message_id
  `;
    return context.json(
      { messageId: text((result.rows[0] as DbRow | undefined)?.message_id) },
      201,
    );
  },
);

messageRoutes.post(
  "/conversations/:id/read",
  validateUuidParams("id"),
  async (context) => {
    const user = context.get("user");
    await findConversation(
      context.env.DATABASE_URL,
      context.req.param("id"),
      user.id,
    );
    const { sql } = createDatabase(context.env.DATABASE_URL);
    if (user.role === "client") {
      await sql`UPDATE message_conversations SET client_last_read_at = now(), updated_at = now() WHERE id = ${context.req.param("id")}::uuid`;
    } else {
      await sql`UPDATE message_conversations SET reader_last_read_at = now(), updated_at = now() WHERE id = ${context.req.param("id")}::uuid`;
    }
    return context.json({ ok: true });
  },
);

messageRoutes.post(
  "/messages/:id/unlock",
  validateUuidParams("id"),
  async (context) => {
    const user = context.get("user");
    if (user.role !== "client") {
      throw new AppError(
        403,
        "ROLE_FORBIDDEN",
        "Only Clients can unlock a paid reply.",
      );
    }
    const idempotencyKey = context.req.header("Idempotency-Key")?.trim();
    if (
      !idempotencyKey ||
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 200
    ) {
      throw new AppError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "A valid Idempotency-Key header is required.",
      );
    }
    const { sql } = createDatabase(context.env.DATABASE_URL);
    try {
      const result = await sql`
      SELECT public.unlock_paid_message(
        ${context.req.param("id")}::uuid,
        ${user.id}::uuid,
        ${idempotencyKey}
      ) AS result
    `;
      const value = (result.rows[0] as DbRow | undefined)?.result as
        | Record<string, unknown>
        | undefined;
      if (value?.result === "insufficient_balance") {
        throw new AppError(
          402,
          "INSUFFICIENT_BALANCE",
          "Add funds before unlocking this reply.",
          value,
        );
      }
      return context.json({ unlock: value });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("paid_message_not_found")) {
        throw new AppError(
          404,
          "PAID_MESSAGE_NOT_FOUND",
          "Paid reply not found.",
        );
      }
      if (message.includes("idempotency_key_reused")) {
        throw new AppError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "That request key was already used.",
        );
      }
      throw error;
    }
  },
);
