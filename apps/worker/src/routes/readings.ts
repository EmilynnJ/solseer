import { Hono } from "hono";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  createReadingSchema,
  readingEvents,
  readingSessions,
  reviewSchema,
  reviews,
  users,
  wallets,
} from "@soulseer/shared";
import type { AppBindings } from "../types";
import { requireRole, requireUser } from "../lib/auth";
import { createDatabase } from "../lib/db";
import { AppError } from "../lib/errors";
import {
  addParticipant,
  createMeeting,
  disableMeeting,
  RealtimeKitProviderError,
  refreshParticipantToken,
  resolveParticipantPresets,
} from "../providers/realtimekit";
import type { ReadingCoordinator } from "../durable/reading-coordinator";
import { logger } from "../lib/log";
import { notifyReaderOfIncomingReading } from "../services/notifications";

export const readingRoutes = new Hono<AppBindings>();

readingRoutes.post(
  "/on-demand",
  requireUser,
  requireRole("client"),
  async (context) => {
    const input = createReadingSchema.parse(await context.req.json());
    const { sql: neonSql } = createDatabase(context.env.DATABASE_URL);
    try {
      const response = await neonSql`
      SELECT public.create_on_demand_reading(
        ${context.get("user").id}::uuid,
        ${input.readerId}::uuid,
        ${input.type}::reading_type
      ) AS id
    `;
      const id = response.rows[0]?.id;
      if (typeof id !== "string")
        throw new Error("Reading request did not return an id.");
      context.executionCtx.waitUntil(
        notifyReaderOfIncomingReading(context.env, {
          id,
          readerId: input.readerId,
          type: input.type,
        }),
      );
      return context.json({ reading: { id, status: "pending" } }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("reader_unavailable")) {
        throw new AppError(
          409,
          "READER_UNAVAILABLE",
          "This Reader is no longer available.",
        );
      }
      if (message.includes("insufficient_starting_balance")) {
        throw new AppError(
          402,
          "INSUFFICIENT_BALANCE",
          "Add funds before starting this reading.",
        );
      }
      if (message.includes("participant_already_busy")) {
        throw new AppError(
          409,
          "READING_ALREADY_ACTIVE",
          "You or this Reader already has an active request.",
        );
      }
      throw error;
    }
  },
);

readingRoutes.post(
  "/:id/accept",
  requireUser,
  requireRole("reader"),
  async (context) => {
    const user = context.get("user");
    const readingId = context.req.param("id");
    const { db } = createDatabase(context.env.DATABASE_URL);
    const [existing] = await db
      .select()
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.id, readingId),
          eq(readingSessions.readerId, user.id),
        ),
      )
      .limit(1);
    if (!existing)
      throw new AppError(
        404,
        "READING_NOT_FOUND",
        "Reading request not found.",
      );

    if (
      inArrayStatus(existing.status, ["connecting", "active"]) &&
      existing.cloudflareMeetingId &&
      existing.readerParticipantId
    ) {
      const token = await refreshParticipantToken(
        context.env,
        existing.cloudflareMeetingId,
        existing.readerParticipantId,
      );
      return context.json({ reading: existing, participantToken: token });
    }
    if (existing.status !== "pending") {
      throw new AppError(
        409,
        "READING_NOT_PENDING",
        "This reading request can no longer be accepted.",
      );
    }

    const [claimed] = await db
      .update(readingSessions)
      .set({ status: "preflight", updatedAt: new Date() })
      .where(
        and(
          eq(readingSessions.id, readingId),
          eq(readingSessions.status, "pending"),
        ),
      )
      .returning();
    if (!claimed)
      throw new AppError(
        409,
        "READING_ALREADY_CLAIMED",
        "This request was already accepted.",
      );

    let meetingId: string | null = null;
    try {
      const [client] = await db
        .select()
        .from(users)
        .where(eq(users.id, claimed.clientId))
        .limit(1);
      if (!client) throw new Error("Assigned client profile not found.");
      const presets = await resolveParticipantPresets(context.env);
      meetingId = await createMeeting(context.env, readingId);
      const [clientParticipant, readerParticipant] = await Promise.all([
        addParticipant(context.env, {
          meetingId,
          appUserId: client.id,
          displayName: client.fullName,
          presetName: presets.client,
        }),
        addParticipant(context.env, {
          meetingId,
          appUserId: user.id,
          displayName: user.fullName,
          presetName: presets.reader,
        }),
      ]);
      const [reading] = await db
        .update(readingSessions)
        .set({
          status: "connecting",
          cloudflareMeetingId: meetingId,
          clientParticipantId: clientParticipant.id,
          readerParticipantId: readerParticipant.id,
          updatedAt: new Date(),
        })
        .where(eq(readingSessions.id, readingId))
        .returning();
      if (!reading) throw new Error("Reading state could not be persisted.");
      const coordinator = context.env.READING_COORDINATOR.getByName(
        readingId,
      ) as DurableObjectStub<ReadingCoordinator>;
      await coordinator.initialize({
        readingId,
        meetingId,
        clientId: reading.clientId,
        readerId: reading.readerId,
      });
      return context.json({
        reading,
        participantToken: readerParticipant.token,
      });
    } catch (error) {
      const stage =
        error instanceof RealtimeKitProviderError ? error.stage : "unknown";
      logger.error(
        "RealtimeKit reading preflight failed",
        {
          requestId: context.get("requestId"),
          userId: user.id,
          readingId,
          operation: stage,
        },
        error instanceof RealtimeKitProviderError
          ? {
              providerStatus: error.providerStatus,
              providerCodes: error.providerCodes,
            }
          : {
              error: error instanceof Error ? error.message : String(error),
            },
      );
      if (meetingId)
        await disableMeeting(context.env, meetingId).catch(() => undefined);
      await db
        .update(readingSessions)
        .set({
          status: "failed",
          failureReason: `realtimekit_${stage}_failed`,
          updatedAt: new Date(),
        })
        .where(eq(readingSessions.id, readingId));
      throw new AppError(
        502,
        "REALTIMEKIT_PREFLIGHT_FAILED",
        "The private reading room could not be prepared. No funds were charged.",
      );
    }
  },
);

readingRoutes.post("/:id/participant-token", requireUser, async (context) => {
  const user = context.get("user");
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [reading] = await db
    .select()
    .from(readingSessions)
    .where(
      and(
        eq(readingSessions.id, context.req.param("id")),
        or(
          eq(readingSessions.clientId, user.id),
          eq(readingSessions.readerId, user.id),
        ),
        inArray(readingSessions.status, ["connecting", "active"]),
      ),
    )
    .limit(1);
  if (!reading?.cloudflareMeetingId) {
    throw new AppError(
      404,
      "READING_NOT_READY",
      "This reading room is not ready.",
    );
  }
  const participantId =
    user.id === reading.clientId
      ? reading.clientParticipantId
      : reading.readerParticipantId;
  if (!participantId)
    throw new AppError(
      409,
      "PARTICIPANT_NOT_READY",
      "Your reading access is not ready.",
    );
  const token = await refreshParticipantToken(
    context.env,
    reading.cloudflareMeetingId,
    participantId,
  );
  return context.json({ participantToken: token });
});

readingRoutes.post("/:id/end", requireUser, async (context) => {
  const user = context.get("user");
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [reading] = await db
    .select({ id: readingSessions.id })
    .from(readingSessions)
    .where(
      and(
        eq(readingSessions.id, context.req.param("id")),
        or(
          eq(readingSessions.clientId, user.id),
          eq(readingSessions.readerId, user.id),
        ),
        inArray(readingSessions.status, ["connecting", "active", "ending"]),
      ),
    )
    .limit(1);
  if (!reading)
    throw new AppError(404, "READING_NOT_FOUND", "Active reading not found.");
  const coordinator = context.env.READING_COORDINATOR.getByName(
    reading.id,
  ) as DurableObjectStub<ReadingCoordinator>;
  await coordinator.requestEnd(user.id);
  return context.json({ status: "ending" }, 202);
});

readingRoutes.post(
  "/:id/rate",
  requireUser,
  requireRole("client"),
  async (context) => {
    const input = reviewSchema.parse(await context.req.json());
    const user = context.get("user");
    const { db } = createDatabase(context.env.DATABASE_URL);
    const [reading] = await db
      .select()
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.id, context.req.param("id")),
          eq(readingSessions.clientId, user.id),
          eq(readingSessions.status, "ended"),
        ),
      )
      .limit(1);
    if (!reading)
      throw new AppError(
        404,
        "READING_NOT_FOUND",
        "Completed reading not found.",
      );
    try {
      const [review] = await db
        .insert(reviews)
        .values({
          readingId: reading.id,
          clientId: user.id,
          readerId: reading.readerId,
          rating: input.rating,
          text: input.review,
        })
        .returning();
      return context.json({ review }, 201);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("reviews_reading_uidx")
      ) {
        throw new AppError(
          409,
          "REVIEW_ALREADY_SUBMITTED",
          "A review was already submitted for this reading.",
        );
      }
      throw error;
    }
  },
);

readingRoutes.get(
  "/client",
  requireUser,
  requireRole("client", "admin"),
  async (context) => {
    return context.json({
      readings: await history(context.env, "client", context.get("user").id),
    });
  },
);

readingRoutes.get(
  "/reader",
  requireUser,
  requireRole("reader", "admin"),
  async (context) => {
    return context.json({
      readings: await history(context.env, "reader", context.get("user").id),
    });
  },
);

readingRoutes.get("/:id", requireUser, async (context) => {
  const user = context.get("user");
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [reading] = await db
    .select()
    .from(readingSessions)
    .where(
      and(
        eq(readingSessions.id, context.req.param("id")),
        user.role === "admin"
          ? sql`true`
          : or(
              eq(readingSessions.clientId, user.id),
              eq(readingSessions.readerId, user.id),
            ),
      ),
    )
    .limit(1);
  if (!reading)
    throw new AppError(404, "READING_NOT_FOUND", "Reading not found.");
  const events = await db
    .select({
      eventType: readingEvents.eventType,
      occurredAt: readingEvents.occurredAt,
    })
    .from(readingEvents)
    .where(eq(readingEvents.readingId, reading.id))
    .orderBy(desc(readingEvents.occurredAt));
  const [balance] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, user.id))
    .limit(1);
  return context.json({
    reading,
    events,
    balance: balance?.availableBalance ?? 0,
  });
});

function inArrayStatus<T extends string>(
  value: string,
  values: readonly T[],
): value is T {
  return values.includes(value as T);
}

async function history(env: Env, role: "client" | "reader", userId: string) {
  const { db } = createDatabase(env.DATABASE_URL);
  const counterpart =
    role === "client" ? readingSessions.readerId : readingSessions.clientId;
  const owner =
    role === "client" ? readingSessions.clientId : readingSessions.readerId;
  return db
    .select({
      id: readingSessions.id,
      type: readingSessions.type,
      status: readingSessions.status,
      pricePerMinute: readingSessions.pricePerMinute,
      durationSeconds: readingSessions.durationSeconds,
      totalPrice: readingSessions.totalPrice,
      createdAt: readingSessions.createdAt,
      startedAt: readingSessions.startedAt,
      completedAt: readingSessions.completedAt,
      counterpartName: users.username,
      rating: reviews.rating,
      review: reviews.text,
    })
    .from(readingSessions)
    .innerJoin(users, eq(users.id, counterpart))
    .leftJoin(reviews, eq(reviews.readingId, readingSessions.id))
    .where(eq(owner, userId))
    .orderBy(desc(readingSessions.createdAt))
    .limit(100);
}
